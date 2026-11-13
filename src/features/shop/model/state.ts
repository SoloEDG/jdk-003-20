import { reactive, readonly } from "vue";
import type { JourneyContext, Purchase } from "@/shared/domain";
import { makeStock, type StockItem } from "../lib/stock";
import { priceFor } from "../lib/pricing";
import { repairPrice } from "@/shared/wear";
const state = reactive({
  context: null as JourneyContext | null,
  stock: [] as StockItem[],
  purchases: [] as Purchase[],
  open: false,
});
export const shopState = readonly(state);
export function openShop(c: JourneyContext) {
  if (state.context?.nodeId !== c.nodeId) {
    state.context = c;
    state.stock = makeStock(c);
  }
  state.open = true;
}
export function itemPrice(id: string) {
  const item = state.stock.find((s) => s.id === id);
  return item && state.context
    ? priceFor(item.basePrice, state.context.influence)
    : Infinity;
}
export function preparePurchase(id: string): Purchase | null {
  const item = state.stock.find((s) => s.id === id);
  if (!state.open || !item || item.sold) return null;
  return { id: item.id, card: item.card, price: itemPrice(id) };
}
export function completePurchase(p: Purchase) {
  const item = state.stock.find((s) => s.id === p.id);
  if (!item || item.sold) return false;
  item.sold = true;
  state.purchases.push(p);
  return true;
}

export interface RepairQuote {
  cardId: string;
  price: number;
}
/** 修复报价：只对当前牌组中真实存在且有磨损的牌生成；无磨损或不存在则返回 null（不会收费）。 */
export function quoteRepair(
  cardId: string,
  wearOf: (id: string) => number,
): RepairQuote | null {
  if (!state.open || !state.context) return null;
  const wear = wearOf(cardId);
  if (!Number.isFinite(wear) || wear <= 0) return null;
  return {
    cardId,
    price: repairPrice(wear, state.context.influence.scarcity),
  };
}

export function closeShop() {
  state.open = false;
}
export function exportShop() {
  return JSON.parse(JSON.stringify(state));
}
export function restoreShop(d: ReturnType<typeof exportShop>) {
  Object.assign(state, d);
}
export function resetShop() {
  state.context = null;
  state.stock = [];
  state.purchases = [];
  state.open = false;
}
