import { reactive, readonly } from "vue";
import { starter, createCard, canRemove } from "../lib/collection";
import { upgradeCost, removalCost, campHealing } from "../lib/costs";
import type { CardInstance, ExpeditionSummary, WearEntry } from "@/shared/domain";
import {
  WEAR_BROKEN,
  CAMP_REPAIR_AMOUNT,
  accumulateWear,
  repairWear,
} from "@/shared/wear";
import type { WearDelta } from "@/features/battle";
const state = reactive({
  cards: starter(),
  hero: { hp: 72, maxHp: 72, gold: 80, scars: 0 } as ExpeditionSummary,
  removals: 0,
  campUsed: false,
  selected: "",
  /** 已结算过磨损的战斗 id，重复结算不会让同一场磨损再次写回。 */
  settledBattles: [] as string[],
});
export const deckState = readonly(state);

/** 仅供单元测试使用的可变原始状态出口；应用与 UI 一律使用只读的 deckState。 */
export function _rawDeckState() {
  return state;
}
export function deckCards(): CardInstance[] {
  return state.cards.map((c) => ({ ...c }));
}
export function addCard(key: string) {
  state.cards.push(createCard(key));
}
export function spendGold(amount: number) {
  if (!Number.isFinite(amount) || amount < 0 || amount > state.hero.gold)
    return false;
  state.hero.gold -= amount;
  return true;
}
export function earnGold(amount: number) {
  state.hero.gold += Math.max(0, amount);
}
export function setHp(hp: number) {
  state.hero.hp = Math.min(state.hero.maxHp, Math.max(0, hp));
}
export function heal(amount: number) {
  setHp(state.hero.hp + amount);
}
export function selectCard(id: string) {
  state.selected = id;
}
export function upgradeCard(id: string, free = false) {
  const c = state.cards.find((c) => c.id === id);
  if (!c || c.upgraded) return false;
  if (!free && !spendGold(upgradeCost(c.upgraded, state.hero.scars)))
    return false;
  c.upgraded = true;
  return true;
}
export function removeCard(id: string) {
  if (
    !canRemove(state.cards.length) ||
    !state.cards.some((c) => c.id === id) ||
    !spendGold(removalCost(state.removals))
  )
    return false;
  state.cards = state.cards.filter((c) => c.id !== id);
  state.removals++;
  state.selected = "";
  return true;
}

/**
 * 战斗结算时把本场磨损一次写回真正受损的永久实例。
 * 按 originId 定位，同名多张互不影响；已结算过的战斗直接跳过，保证幂等。
 * 返回实际发生变化的实例 id 列表。
 */
export function applyBattleWear(battleId: string, deltas: WearDelta[]): string[] {
  if (state.settledBattles.includes(battleId)) return [];
  const touched: string[] = [];
  for (const delta of deltas) {
    const card = state.cards.find((c) => c.id === delta.originId);
    if (!card) continue;
    for (const entry of delta.entries as WearEntry[]) {
      const applied = accumulateWear(card, entry.source, entry.amount);
      if (applied > 0 && !touched.includes(card.id)) touched.push(card.id);
    }
  }
  state.settledBattles.push(battleId);
  return touched;
}

/** 篝火修复：修复选中牌，返回实际修复量。是否消耗休息机会由 useCamp 统一控制。 */
export function campRepair(id: string) {
  const card = state.cards.find((c) => c.id === id);
  if (!card || card.wear <= 0) return 0;
  return repairWear(card, CAMP_REPAIR_AMOUNT);
}

/** 商店付费修复：调用方负责先扣款；只修复真正存在且有磨损的牌。 */
export function payRepair(id: string, amount: number) {
  const card = state.cards.find((c) => c.id === id);
  if (!card || card.wear <= 0 || amount <= 0) return 0;
  return repairWear(card, amount);
}

/** 奖励修复权益：用权益点数修复指定牌，不收取金币。 */
export function grantRepair(id: string, amount: number) {
  const card = state.cards.find((c) => c.id === id);
  if (!card || card.wear <= 0 || amount <= 0) return 0;
  return repairWear(card, amount);
}

export function brokenCount() {
  return state.cards.filter((c) => c.wear >= WEAR_BROKEN).length;
}

export function openCamp() {
  state.campUsed = false;
}
export function useCamp(action: "rest" | "upgrade" | "repair", heat: number) {
  if (state.campUsed) return false;
  if (action === "rest") {
    heal(campHealing(state.hero.maxHp, heat));
  } else if (action === "upgrade") {
    if (!upgradeCard(state.selected, true)) return false;
  }
  // repair 由命令层调用 campRepair 处理（需要返回实际修复量并保证幂等）。
  state.campUsed = true;
  return true;
}
export function exportDeck() {
  return JSON.parse(
    JSON.stringify({
      cards: state.cards,
      hero: state.hero,
      removals: state.removals,
      campUsed: state.campUsed,
      settledBattles: state.settledBattles,
    }),
  );
}
export function restoreDeck(d: ReturnType<typeof exportDeck>) {
  state.cards = d.cards;
  state.hero = d.hero;
  state.removals = d.removals;
  state.campUsed = d.campUsed;
  // 旧存档没有磨损字段：默认无磨损但保留原强化。
  for (const c of state.cards) {
    if (typeof c.wear !== "number") c.wear = 0;
    if (!Array.isArray(c.wearLog)) c.wearLog = [];
  }
  state.settledBattles = Array.isArray(d.settledBattles)
    ? d.settledBattles
    : [];
  state.selected = "";
}
export function resetDeck() {
  state.cards = starter();
  state.hero = { hp: 72, maxHp: 72, gold: 80, scars: 0 };
  state.removals = 0;
  state.campUsed = false;
  state.selected = "";
  state.settledBattles = [];
}
