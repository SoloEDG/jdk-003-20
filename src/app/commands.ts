import { enterRoute, resolveRoute, resetRoute } from "@/features/route";
import {
  battleState,
  beginBattle,
  playCard,
  endTurn,
  collectWearDeltas,
  resetBattle,
} from "@/features/battle";
import {
  deckState,
  deckCards,
  addCard,
  earnGold,
  spendGold,
  setHp,
  heal,
  upgradeCard,
  removeCard,
  applyBattleWear,
  campRepair,
  payRepair,
  grantRepair,
  openCamp,
  useCamp,
  resetDeck,
} from "@/features/deck";
import {
  openReward,
  claimReward,
  resetReward,
} from "@/features/reward";
import {
  openShop,
  preparePurchase,
  completePurchase,
  quoteRepair,
  closeShop,
  resetShop,
} from "@/features/shop";
import {
  session,
  switchTab,
  setContext,
  notify,
  finishRun,
  resetSession,
} from "./session";
import { save, clearSave } from "./persistence";
function persist() {
  if (!save()) notify("本地保存失败，请保留当前页面。");
}
export function navigate(id: string) {
  if (session.ended) return;
  const c = enterRoute(id);
  if (!c) return;
  setContext(c);
  if (c.kind === "shop") {
    openShop(c);
    switchTab("shop");
  } else if (c.kind === "camp") {
    openCamp();
    switchTab("deck");
  } else {
    beginBattle(c, deckCards(), deckState.hero.hp, deckState.hero.maxHp);
    switchTab("battle");
  }
  notify(
    `进入 ${c.nodeId} · 威胁 ${c.influence.heat} / 好感 ${c.influence.favor}`,
  );
  persist();
}
export function play(id: string) {
  playCard(id);
  persist();
}
export function turn() {
  endTurn();
  persist();
}

/** 战斗结算：无论胜负都把本场磨损一次写回永久实例（幂等，重复结算不重复扣）。 */
function settleWearOnce() {
  const r = battleState.result;
  if (!r) return [];
  const deltas = collectWearDeltas();
  const touched = applyBattleWear(r.id, deltas);
  if (touched.length)
    notify(`本场磨损已写回 ${touched.length} 张卡牌，破损情况可在牌组页查看。`);
  return touched;
}

export function settle() {
  const r = battleState.result;
  if (!r) return;
  settleWearOnce();
  if (!r.won) {
    setHp(r.hp);
    finishRun();
    notify("这次旅途已经结束。卡牌磨损已保留，重新启程可整备后再战。");
    persist();
    return;
  }
  if (openReward(JSON.parse(JSON.stringify(r)))) {
    setHp(r.hp);
    switchTab("reward");
    notify("胜利！可选择新牌，也可用修复权益代替新牌。");
  }
  persist();
}
export function claim(skip: boolean) {
  const wornIds = deckState.cards.filter((c) => c.wear > 0).map((c) => c.id);
  const grant = claimReward(skip, wornIds);
  if (!grant) return;
  if (grant.card) addCard(grant.card);
  // 修复权益只在领取时应用一次；已经修好的牌无法再次成为目标，不会重新变坏。
  if (grant.repair) grantRepair(grant.repair.cardId, grant.repair.amount);
  earnGold(grant.gold);
  heal(grant.heal);
  resolveRoute();
  if (session.context?.kind === "boss") {
    finishRun();
    notify("裂隙已被封存。你把余烬带回了黎明。");
  } else notify("奖励已结算，新的路线开放。");
  switchTab("route");
  persist();
}
export function buy(id: string) {
  const p = preparePurchase(id);
  if (!p || !spendGold(p.price)) {
    notify("无法购买：库存或金币不足。");
    return;
  }
  if (!completePurchase(p)) {
    earnGold(p.price);
    return;
  }
  addCard(p.card);
  notify("交易完成，卡牌已收入牌组。");
  persist();
}

/** 商店付费修复：先报价、再扣款，任何一步失败都不收费，取消则完全不扣费。 */
export function repair(id: string) {
  const wearOf = (cardId: string) =>
    deckState.cards.find((c) => c.id === cardId)?.wear ?? 0;
  const quote = quoteRepair(id, wearOf);
  if (!quote) {
    notify("无法修复：目标不存在或已经完好。");
    return;
  }
  if (!spendGold(quote.price)) {
    notify("无法修复：金币不足。");
    return;
  }
  const repaired = payRepair(quote.cardId, Number.POSITIVE_INFINITY);
  if (repaired <= 0) {
    earnGold(quote.price);
    notify("修复未生效，已退还金币。");
    return;
  }
  notify(`花费 ${quote.price} 金修复了 ${repaired} 点磨损。`);
  persist();
}

export function leaveShop() {
  closeShop();
  resolveRoute();
  switchTab("route");
  persist();
}
export function camp(action: "rest" | "upgrade" | "repair") {
  if (!session.context || session.context.kind !== "camp") return;
  // 修复需要选中一张真实存在且有磨损的牌；校验失败不消耗休息机会。
  if (action === "repair") {
    const target = deckState.cards.find((c) => c.id === deckState.selected);
    if (!target || target.wear <= 0) {
      notify("无法修复：请先在牌组中选择一张仍有磨损的牌。");
      return;
    }
  }
  if (!useCamp(action, session.context.influence.heat)) return;
  if (action === "repair") {
    const repaired = campRepair(deckState.selected);
    notify(
      repaired > 0
        ? `你牺牲这次休息修复了 ${repaired} 点磨损。`
        : "修复未生效，篝火没有被消耗。",
    );
  } else {
    notify("篝火逐渐熄灭，你准备好继续上路。");
  }
  resolveRoute();
  persist();
}
export function upgrade(id: string) {
  if (battleState.phase === "playing") return;
  notify(upgradeCard(id) ? "卡牌强化完成。" : "无法强化：金币不足或已经强化。");
  persist();
}
export function remove(id: string) {
  if (battleState.phase === "playing") return;
  notify(
    removeCard(id)
      ? "已移除卡牌。"
      : "无法移除：至少保留五张牌，且需要足够金币。",
  );
  persist();
}
export function restart() {
  resetRoute();
  resetBattle();
  resetDeck();
  resetReward();
  resetShop();
  resetSession();
  clearSave();
  persist();
}
