import type { Actor, JourneyContext } from "@/shared/domain";
export interface Enemy extends Actor {
  name: string;
  attack: number;
  reward: number;
  pattern: number[];
}
export function spawnEnemy(c: JourneyContext): Enemy {
  const elite = c.kind === "elite";
  const boss = c.kind === "boss";
  const hp = (boss ? 80 : elite ? 40 : 25) + c.depth * 4 + c.influence.heat * 2;
  return {
    name: boss
      ? "裂隙守望者"
      : c.region === "forest"
        ? "孢冠巡游者"
        : c.region === "forge"
          ? "熔炉卫兵"
          : "空洞回声",
    hp,
    maxHp: hp,
    block: 0,
    strength: Math.floor(c.influence.heat / 2),
    poison: 0,
    thorns: c.region === "forge" ? 1 : 0,
    attack: (elite ? 8 : 5) + Math.floor(c.depth / 2),
    reward: (elite ? 28 : 18) + c.influence.heat * 3,
    pattern: boss ? [1.5, 0.7, 1.2] : [1, 0.7, 1.3],
  };
}
/** 弱回合（倍率 0.7）敌人不攻击，改为耗尽玩家的一张牌，使其积累磨损。 */
export function isDrainTurn(enemy: Enemy, turn: number) {
  return enemy.pattern[(turn - 1) % enemy.pattern.length]! < 1;
}
export function enemyIntent(enemy: Enemy, turn: number) {
  if (isDrainTurn(enemy, turn)) return 0;
  return (
    Math.floor(
      enemy.attack * enemy.pattern[(turn - 1) % enemy.pattern.length]!,
    ) + enemy.strength
  );
}
