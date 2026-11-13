import type { CardInstance, CardSpec, WearSource, WearEntry } from "./domain";

/** 达到该磨损后卡牌受损（费用上升或伤害下降）。 */
export const WEAR_DAMAGED = 6;
/** 达到该磨损后卡牌完全破损，不能进入下一场出战牌组。 */
export const WEAR_BROKEN = 10;

/** 实际打出一张牌积累的磨损。 */
export const WEAR_PER_PLAY = 1;
/** 被敌人耗尽一张牌积累的磨损。 */
export const WEAR_PER_DRAIN = 2;

/** 受损攻击牌的伤害削减。 */
export const DAMAGE_PENALTY = 2;
/** 受损非攻击牌的费用增加。 */
export const COST_PENALTY = 1;
/** 篝火一次休整可修复的磨损。 */
export const CAMP_REPAIR_AMOUNT = 4;
/** 奖励修复权益可修复的磨损。 */
export const REWARD_REPAIR_AMOUNT = 5;

export type WearStage = "fresh" | "worn" | "broken";

export function wearStage(wear: number): WearStage {
  if (wear >= WEAR_BROKEN) return "broken";
  if (wear >= WEAR_DAMAGED) return "worn";
  return "fresh";
}

export function isDamaged(card: Pick<CardInstance, "wear">) {
  return card.wear >= WEAR_DAMAGED;
}

export function isBroken(card: Pick<CardInstance, "wear">) {
  return card.wear >= WEAR_BROKEN;
}

/** 磨损后的实际费用：受损的技能/能力牌费用上升，攻击牌费用不变。 */
export function effectiveCost(spec: CardSpec, card: Pick<CardInstance, "wear">) {
  if (spec.kind !== "attack" && isDamaged(card))
    return spec.cost + COST_PENALTY;
  return spec.cost;
}

/** 磨损后的基础伤害（不含力量）：受损攻击牌伤害下降，最低保留 1 点。 */
export function effectiveDamage(baseAmount: number, spec: CardSpec, card: Pick<CardInstance, "wear">) {
  if (spec.kind === "attack" && isDamaged(card))
    return Math.max(1, baseAmount - DAMAGE_PENALTY);
  return baseAmount;
}

/** 把一次磨损按来源聚合进磨损记录。 */
export function addWearEntry(entries: WearEntry[], source: WearSource, amount: number) {
  if (amount <= 0) return;
  const existing = entries.find((e) => e.source === source);
  if (existing) existing.amount += amount;
  else entries.push({ source, amount });
}

/** 在给定磨损上限内增加磨损，返回实际增加量（不会超过完全破损阈值）。 */
export function accumulateWear(card: CardInstance, source: WearSource, amount: number) {
  const before = card.wear;
  card.wear = Math.min(WEAR_BROKEN, card.wear + Math.max(0, amount));
  const applied = card.wear - before;
  if (applied > 0) addWearEntry(card.wearLog, source, applied);
  return applied;
}

/** 修复指定磨损量，返回实际修复量；不会把卡牌修成负数，也不会让已修好的牌重新变坏。 */
export function repairWear(card: CardInstance, amount: number) {
  const before = card.wear;
  card.wear = Math.max(0, card.wear - Math.max(0, amount));
  const repaired = before - card.wear;
  if (repaired > 0) addWearEntry(card.wearLog, "repair", -repaired);
  return repaired;
}

/** 商店付费全修的报价：按当前磨损计价，无磨损则不可修复。 */
export function repairPrice(wear: number, scarcity: number) {
  if (wear <= 0) return Infinity;
  return wear * 6 + scarcity * 4;
}

export function wearSummary(card: { wearLog: readonly WearEntry[] }) {
  return card.wearLog
    .map((e) => `${e.source === "played" ? "打出" : e.source === "drained" ? "耗尽" : "修复"} ${e.amount > 0 ? "+" : ""}${e.amount}`)
    .join(" · ");
}
