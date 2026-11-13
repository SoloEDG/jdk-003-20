import type { CardInstance } from "@/shared/domain";
import { uid } from "@/shared/random";

function makeCard(key: string): CardInstance {
  return { id: uid("card"), key, upgraded: false, wear: 0, wearLog: [] };
}

export function starter(): CardInstance[] {
  return [
    "strike",
    "strike",
    "strike",
    "guard",
    "guard",
    "venom",
    "focus",
    "shelter",
  ].map(makeCard);
}
export function createCard(key: string): CardInstance {
  return makeCard(key);
}
export function canRemove(size: number) {
  return size > 5;
}
