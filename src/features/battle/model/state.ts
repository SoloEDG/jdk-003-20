import { reactive, readonly } from "vue";
import type {
  Actor,
  BattleResult,
  CardInstance,
  JourneyContext,
  WearSource,
} from "@/shared/domain";
import { cards } from "@/shared/cards";
import { uid } from "@/shared/random";
import {
  WEAR_BROKEN,
  WEAR_PER_PLAY,
  WEAR_PER_DRAIN,
  effectiveCost,
  effectiveDamage,
} from "@/shared/wear";
import { spawnEnemy, enemyIntent, isDrainTurn, type Enemy } from "../lib/enemies";
import {
  makePiles,
  drawCards,
  discardHand,
  conjureCopy,
  type Piles,
  type BattleCard,
  type BattleWear,
} from "../lib/piles";
import {
  resolveEffect,
  poisonTick,
  damage,
  type EffectEvent,
} from "../lib/effects";
interface BattleState {
  id: string;
  context: JourneyContext | null;
  hero: Actor;
  enemy: Enemy | null;
  piles: Piles;
  /** 本场磨损记账：key 为战斗副本 id，结算时才映射回永久实例。 */
  wear: BattleWear;
  energy: number;
  turn: number;
  phase: "idle" | "playing" | "won" | "lost";
  queue: EffectEvent[];
  log: string[];
  result: BattleResult | null;
}
const emptyHero = (): Actor => ({
  hp: 72,
  maxHp: 72,
  block: 0,
  strength: 0,
  poison: 0,
  thorns: 0,
});
const state = reactive<BattleState>({
  id: "",
  context: null,
  hero: emptyHero(),
  enemy: null,
  piles: makePiles([], ""),
  wear: {},
  energy: 3,
  turn: 1,
  phase: "idle",
  queue: [],
  log: [],
  result: null,
});
export const battleState = readonly(state);

/** 仅供单元测试使用的可变原始状态出口；应用与 UI 一律使用只读的 battleState。 */
export function _rawBattleState() {
  return state;
}

/** 在战斗副本上积累磨损并记账；临时复制牌只记在本场，结算时不会回传原卡。 */
function applyBattleWear(card: BattleCard, source: WearSource, amount: number) {
  const before = card.wear;
  card.wear = Math.min(WEAR_BROKEN, card.wear + amount);
  const applied = card.wear - before;
  if (applied <= 0) return;
  const list = (state.wear[card.id] ??= []);
  const entry = list.find((e) => e.source === source);
  if (entry) entry.amount += applied;
  else list.push({ source, amount: applied });
}

export function beginBattle(
  context: JourneyContext,
  deck: CardInstance[],
  hp: number,
  maxHp: number,
) {
  state.id = uid("battle");
  state.context = context;
  state.hero = { ...emptyHero(), hp, maxHp };
  state.enemy = spawnEnemy(context);
  state.piles = makePiles(deck, context.nodeId);
  state.wear = {};
  state.energy = 3;
  state.turn = 1;
  state.phase = "playing";
  state.queue = [];
  state.result = null;
  const broken = deck.filter((c) => c.wear >= WEAR_BROKEN).length;
  state.log = [
    "战斗开始。状态和牌堆仅属于本场遭遇。",
    ...(broken
      ? [`${broken} 张完全破损的牌无法进入本场出战牌组，需先修复。`]
      : []),
  ];
  drawCards(state.piles, 5, 1);
}
function finish() {
  if (!state.enemy || !state.context) return;
  if (state.hero.hp <= 0 || state.enemy.hp <= 0) {
    state.phase = state.hero.hp <= 0 ? "lost" : "won";
    state.result = {
      id: state.id,
      nodeId: state.context.nodeId,
      won: state.phase === "won",
      hp: state.hero.hp,
      gold: state.enemy.reward,
      context: JSON.parse(JSON.stringify(state.context)),
    };
    state.queue = [];
  }
}
function drain() {
  while (state.queue.length && state.phase === "playing") {
    const event = state.queue.shift()!;
    if (event.effect.type === "draw") {
      drawCards(state.piles, event.effect.amount, state.turn);
      state.log.unshift(`抽取 ${event.effect.amount} 张牌`);
    } else if (event.effect.type === "energy") {
      state.energy += event.effect.amount;
    } else if (event.effect.type === "copy") {
      const origin = state.piles.hand.find((c) => !c.temp);
      if (origin) {
        const copy = conjureCopy(origin);
        state.piles.hand.push(copy);
        state.log.unshift(`余烬回响：临时复制了一张 ${cards[origin.key]!.name}`);
      } else {
        state.log.unshift("余烬回响：手中没有可复制的牌");
      }
    } else if (state.enemy)
      state.log.unshift(resolveEffect(event, state.hero, state.enemy));
    finish();
  }
  state.log = state.log.slice(0, 18);
}
export function playCard(id: string) {
  if (state.phase !== "playing") return false;
  const card = state.piles.hand.find((c) => c.id === id);
  if (!card) return false;
  const spec = cards[card.key]!;
  const cost = effectiveCost(spec, card);
  if (state.energy < cost) return false;
  state.energy -= cost;
  state.piles.hand = state.piles.hand.filter((c) => c.id !== id);
  (spec.kind === "power" ? state.piles.exhaust : state.piles.discard).push(
    card,
  );
  // 实际打出才积累磨损；预览与抽牌不写入。
  applyBattleWear(card, "played", WEAR_PER_PLAY);
  state.queue.push(
    ...spec.effects.map((e) => {
      const upgradedBonus = card.upgraded && e.type !== "energy" ? 2 : 0;
      const base = e.amount + upgradedBonus;
      return {
        effect: {
          ...e,
          amount:
            e.type === "damage"
              ? effectiveDamage(base, spec, card)
              : base,
        },
        source: "hero" as const,
        label: spec.name,
      };
    }),
  );
  drain();
  return true;
}

/** 敌人耗尽玩家一张牌：优先手牌，其次抽牌堆；被耗尽的牌进入消耗堆并积累更重磨损。 */
function enemyDrainCard() {
  const p = state.piles;
  const pool = p.hand.length ? p.hand : p.draw;
  if (!pool.length) {
    state.log.unshift("敌人试图耗尽你的牌，但已无牌可耗");
    return;
  }
  const idx = Math.floor(Math.random() * pool.length);
  const card = pool.splice(idx, 1)[0]!;
  p.exhaust.push(card);
  applyBattleWear(card, "drained", WEAR_PER_DRAIN);
  state.log.unshift(
    `敌人耗尽了 ${cards[card.key]!.name}，该牌磨损 +${WEAR_PER_DRAIN} 并进入消耗堆`,
  );
}

export function endTurn() {
  if (state.phase !== "playing" || !state.enemy) return;
  const poison = poisonTick(state.enemy);
  if (poison) state.log.unshift(`敌人中毒失去 ${poison} 生命`);
  finish();
  if (state.phase !== "playing") return;
  if (isDrainTurn(state.enemy, state.turn)) {
    enemyDrainCard();
  } else {
    const amount = enemyIntent(state.enemy, state.turn);
    damage(state.hero, amount);
    state.log.unshift(`敌人攻击 ${amount}`);
  }
  poisonTick(state.hero);
  finish();
  if (state.phase !== "playing") return;
  discardHand(state.piles);
  state.turn++;
  state.energy = 3;
  state.hero.block = 0;
  state.enemy.block = state.turn % 3 === 0 ? 5 : 0;
  drawCards(state.piles, 5, state.turn);
}
export function currentIntent() {
  return state.enemy ? enemyIntent(state.enemy, state.turn) : 0;
}
export function drainIntent() {
  return state.enemy ? isDrainTurn(state.enemy, state.turn) : false;
}

/** 单张永久实例在本场结算时应写回的磨损增量。 */
export interface WearDelta {
  originId: string;
  entries: { source: WearSource; amount: number }[];
}
/**
 * 把本场磨损按永久实例聚合：临时复制牌（无 originId）的磨损被丢弃，不传回原卡。
 * 只在战斗结算时调用一次，不在预览或抽牌时写入。
 */
export function collectWearDeltas(): WearDelta[] {
  const byOrigin = new Map<string, Map<WearSource, number>>();
  for (const card of allBattleCards()) {
    if (card.temp || !card.originId) continue;
    const entries = state.wear[card.id];
    if (!entries?.length) continue;
    const agg = byOrigin.get(card.originId) ?? new Map<WearSource, number>();
    for (const e of entries)
      agg.set(e.source, (agg.get(e.source) ?? 0) + e.amount);
    byOrigin.set(card.originId, agg);
  }
  return [...byOrigin.entries()].map(([originId, agg]) => ({
    originId,
    entries: [...agg.entries()].map(([source, amount]) => ({ source, amount })),
  }));
}
function allBattleCards(): BattleCard[] {
  const p = state.piles;
  return [...p.draw, ...p.hand, ...p.discard, ...p.exhaust];
}

export function exportBattle() {
  return JSON.parse(JSON.stringify(state)) as BattleState;
}
export function restoreBattle(d: BattleState) {
  // 兼容旧存档：战斗副本可能缺少磨损/来源标记字段，统一补齐默认值。
  for (const pile of [
    d.piles.draw,
    d.piles.hand,
    d.piles.discard,
    d.piles.exhaust,
  ]) {
    for (const c of pile) {
      if (typeof c.wear !== "number") c.wear = 0;
      if (!Array.isArray(c.wearLog)) c.wearLog = [];
      if (typeof c.temp !== "boolean") c.temp = false;
    }
  }
  if (!d.wear || typeof d.wear !== "object") d.wear = {};
  Object.assign(state, d);
}
export function resetBattle() {
  state.phase = "idle";
  state.context = null;
  state.enemy = null;
  state.result = null;
  state.piles = makePiles([], "");
  state.wear = {};
  state.log = [];
}
