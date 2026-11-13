export type Region = "forest" | "forge" | "abyss";
export type NodeKind = "battle" | "elite" | "shop" | "camp" | "boss";
export interface Influence {
  heat: number;
  favor: number;
  scarcity: number;
}
export interface RouteNode {
  id: string;
  region: Region;
  depth: number;
  lane: number;
  kind: NodeKind;
  title: string;
  influence: Influence;
  next: string[];
}
export type WearSource = "played" | "drained" | "repair";
export interface WearEntry {
  source: WearSource;
  amount: number;
}
export interface CardInstance {
  id: string;
  key: string;
  upgraded: boolean;
  /** 永久磨损值，0 完好，达到 WEAR_DAMAGED 受损，达到 WEAR_BROKEN 完全破损。 */
  wear: number;
  /** 磨损来源累计（按来源聚合），用于牌组页展示磨损从何而来。 */
  wearLog: WearEntry[];
}
export interface CardSpec {
  key: string;
  name: string;
  cost: number;
  kind: "attack" | "skill" | "power";
  text: string;
  rarity: "common" | "rare";
  effects: Effect[];
}
export type Effect = {
  type:
    | "damage"
    | "block"
    | "draw"
    | "poison"
    | "strength"
    | "heal"
    | "energy"
    | "copy";
  amount: number;
  target: "hero" | "enemy";
};
export interface Actor {
  hp: number;
  maxHp: number;
  block: number;
  strength: number;
  poison: number;
  thorns: number;
}
export interface JourneyContext {
  nodeId: string;
  region: Region;
  depth: number;
  kind: NodeKind;
  influence: Influence;
}
export interface BattleResult {
  id: string;
  nodeId: string;
  won: boolean;
  hp: number;
  gold: number;
  context: JourneyContext;
}
export interface RewardOffer {
  id: string;
  source: string;
  cards: string[];
  gold: number;
  heal: number;
  /** 可选的修复权益点数，可代替新牌用于修复一张永久卡牌。 */
  repair: number;
  claimed: boolean;
}
export interface Purchase {
  id: string;
  card: string;
  price: number;
}
export interface ExpeditionSummary {
  hp: number;
  maxHp: number;
  gold: number;
  scars: number;
}
export const regionNames: Record<Region, string> = {
  forest: "苔光林地",
  forge: "熔铁边境",
  abyss: "无声深渊",
};
