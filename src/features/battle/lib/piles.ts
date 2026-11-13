import type { CardInstance, WearSource } from "@/shared/domain";
import { shuffle, hash, uid } from "@/shared/random";
import { WEAR_BROKEN } from "@/shared/wear";

/** 战斗内使用的卡牌副本：与永久实例隔离，磨损只在本场积累，结算时才写回。 */
export interface BattleCard extends CardInstance {
  /** 对应的永久实例 id；临时复制牌没有原卡，为 undefined。 */
  originId?: string;
  /** 是否为战斗中生成的临时复制，其磨损不传回原卡。 */
  temp: boolean;
}

export interface Piles {
  draw: BattleCard[];
  hand: BattleCard[];
  discard: BattleCard[];
  exhaust: BattleCard[];
}

/** 深拷贝永久实例，战斗中对副本的任何磨损都不会立刻污染原卡。完全破损的牌不进入出战牌组。 */
export function makePiles(cards: CardInstance[], seed: string): Piles {
  const battleCards = cards
    .filter((c) => c.wear < WEAR_BROKEN)
    .map((c): BattleCard => ({
      ...JSON.parse(JSON.stringify(c)),
      id: uid("battle-card"),
      originId: c.id,
      temp: false,
    }));
  return {
    draw: shuffle(battleCards, hash(seed)),
    hand: [],
    discard: [],
    exhaust: [],
  };
}

/** 生成一张临时复制牌：独立 id、无原卡映射，磨损永不回传。 */
export function conjureCopy(origin: BattleCard): BattleCard {
  return {
    ...JSON.parse(JSON.stringify(origin)),
    id: uid("echo-card"),
    originId: undefined,
    temp: true,
  };
}

export function drawCards(p: Piles, n: number, seed: number) {
  for (let i = 0; i < n; i++) {
    if (!p.draw.length && p.discard.length) {
      p.draw = shuffle(p.discard, seed + i);
      p.discard = [];
    }
    const card = p.draw.pop();
    if (card) p.hand.push(card);
  }
}
export function discardHand(p: Piles) {
  p.discard.push(...p.hand);
  p.hand = [];
}

/** 本场按战斗副本 id 记录的磨损增量，结算时按 originId 聚合写回永久实例。 */
export type BattleWear = Record<string, { source: WearSource; amount: number }[]>;
