import type { JourneyContext } from "@/shared/domain";
import { shuffle, hash } from "@/shared/random";
export function rewardPool(context: JourneyContext) {
  const rare =
    context.influence.heat >= 2 ||
    context.kind === "elite" ||
    context.kind === "boss";
  const pool =
    context.region === "forest"
      ? ["venom", "shelter", "guard", "focus", "echo"]
      : context.region === "forge"
        ? ["strike", "guard", "burst", "fury", "echo"]
        : ["venom", "burst", "focus", "fury", "echo"];
  return shuffle(
    rare
      ? pool
      : [...pool.filter((k) => !["burst", "fury", "echo"].includes(k)), "strike"],
    hash(context.nodeId),
  ).slice(0, 3);
}
