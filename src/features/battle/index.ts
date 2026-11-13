export { default as BattlePanel } from "./ui/BattlePanel.vue";
export {
  battleState,
  beginBattle,
  playCard,
  endTurn,
  currentIntent,
  drainIntent,
  collectWearDeltas,
  exportBattle,
  restoreBattle,
  resetBattle,
} from "./model/state";
export type { WearDelta } from "./model/state";
