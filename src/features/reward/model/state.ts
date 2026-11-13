import { reactive, readonly } from "vue";
import type { BattleResult, RewardOffer } from "@/shared/domain";
import { offerFrom, validChoice } from "../lib/settlement";
import { REWARD_REPAIR_AMOUNT } from "@/shared/wear";
const state = reactive({
  offer: null as RewardOffer | null,
  history: [] as string[],
  selected: "",
  /** 选择修复权益时指定的永久卡牌 id。 */
  repairTarget: "",
});
export const rewardState = readonly(state);
export function openReward(result: BattleResult) {
  if (!result.won || state.history.includes(result.id)) return false;
  state.offer = offerFrom(result);
  state.selected = "";
  state.repairTarget = "";
  return true;
}
export function chooseReward(key: string) {
  if (state.offer?.cards.includes(key)) {
    state.selected = key;
    state.repairTarget = "";
  }
}
export function chooseRepair(cardId: string) {
  state.repairTarget = cardId;
  state.selected = "";
}
export interface RewardGrant {
  card: string | null;
  gold: number;
  heal: number;
  repair: { cardId: string; amount: number } | null;
}
export function claimReward(
  skip = false,
  wornCardIds: string[] = [],
): RewardGrant | null {
  const offer = state.offer;
  if (!offer || offer.claimed) return null;
  const wantsRepair = !!state.repairTarget;
  if (!validChoice(offer, wantsRepair ? null : skip ? null : state.selected))
    return null;
  // 修复权益必须指向牌组中真实存在且仍有磨损的牌，否则拒绝结算，不会产生任何消耗。
  if (wantsRepair && !wornCardIds.includes(state.repairTarget)) return null;
  offer.claimed = true;
  state.history.push(offer.source);
  return {
    card: skip || wantsRepair ? null : state.selected,
    gold: offer.gold,
    heal: offer.heal,
    repair: wantsRepair
      ? { cardId: state.repairTarget, amount: offer.repair }
      : null,
  };
}
export function exportReward() {
  return JSON.parse(
    JSON.stringify({
      offer: state.offer,
      history: state.history,
      repairTarget: state.repairTarget,
    }),
  );
}
export function restoreReward(d: ReturnType<typeof exportReward>) {
  state.offer = d.offer;
  // 兼容旧存档：修复权益字段缺失时补默认值。
  if (state.offer && typeof state.offer.repair !== "number")
    state.offer.repair = REWARD_REPAIR_AMOUNT;
  state.history = d.history;
  state.repairTarget = d.repairTarget ?? "";
  state.selected = "";
}
export function resetReward() {
  state.offer = null;
  state.history = [];
  state.selected = "";
  state.repairTarget = "";
}
