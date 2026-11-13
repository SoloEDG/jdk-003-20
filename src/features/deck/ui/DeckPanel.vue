<script setup lang="ts">
import { computed } from "vue";
import { deckState, selectCard } from "../model/state";
import { cards } from "@/shared/cards";
import { upgradeCost, removalCost } from "../lib/costs";
import {
  WEAR_BROKEN,
  WEAR_DAMAGED,
  CAMP_REPAIR_AMOUNT,
  wearStage,
  effectiveCost,
  wearSummary,
  repairPrice,
} from "@/shared/wear";
defineProps<{ camp: boolean; locked: boolean }>();
const emit = defineEmits<{
  upgrade: [id: string];
  remove: [id: string];
  camp: [action: "rest" | "upgrade" | "repair"];
}>();
const selected = computed(() =>
  deckState.cards.find((c) => c.id === deckState.selected),
);
const brokenCards = computed(() =>
  deckState.cards.filter((c) => c.wear >= WEAR_BROKEN),
);
function stageLabel(wear: number) {
  const stage = wearStage(wear);
  if (stage === "broken") return "完全破损 · 无法出战";
  if (stage === "worn") return "受损 · 费用/伤害下降";
  return "完好";
}
function costOf(c: (typeof deckState.cards)[number]) {
  const spec = cards[c.key]!;
  return effectiveCost(spec, c);
}
const campPreview = computed(() =>
  selected.value
    ? Math.min(CAMP_REPAIR_AMOUNT, selected.value.wear)
    : 0,
);
</script>
<template>
  <section class="panel">
    <div class="section-top">
      <span class="eyebrow">05 / YOUR ARSENAL</span
      ><span>{{ deckState.cards.length }} 张</span>
    </div>
    <h2>行囊中的可能</h2>
    <p class="muted">
      相同卡牌拥有独立身份。强化只影响选中的这一张，战斗中的牌组锁定。磨损达到
      {{ WEAR_DAMAGED }} 受损，达到 {{ WEAR_BROKEN }} 完全破损且不能进入下一场出战牌组。
    </p>
    <div v-if="brokenCards.length" class="wear-alert">
      ✦ {{ brokenCards.length }} 张完全破损：{{
        brokenCards.map((c) => cards[c.key]?.name).join("、")
      }}，需在篝火或商店修复后才能出战。
    </div>
    <div v-if="camp" class="camp">
      <h3>篝火 · {{ deckState.campUsed ? "已经休整" : "选择一次休整" }}</h3>
      <button :disabled="deckState.campUsed" @click="emit('camp', 'rest')">
        休息 · 回复生命</button
      ><button
        :disabled="deckState.campUsed || !deckState.selected"
        @click="emit('camp', 'upgrade')"
      >
        免费强化选中牌
      </button>
      <button
        :disabled="
          deckState.campUsed ||
          !selected ||
          !selected.wear
        "
        data-action="camp-repair"
        @click="emit('camp', 'repair')"
      >
        修复选中牌 · 牺牲休息（{{ campPreview }} 点）
      </button>
    </div>
    <div class="deck-list">
      <button
        v-for="c in deckState.cards"
        :key="c.id"
        :data-card-id="c.id"
        :class="{
          selected: deckState.selected === c.id,
          worn: wearStage(c.wear) === 'worn',
          broken: wearStage(c.wear) === 'broken',
        }"
        @click="selectCard(c.id)"
      >
        <span>{{ cards[c.key]?.name }}{{ c.upgraded ? " +" : "" }}</span>
        <small>{{ cards[c.key]?.text }}</small>
        <div class="wear-line">
          <i
            v-for="n in WEAR_BROKEN"
            :key="n"
            :class="{ on: n <= c.wear }"
          ></i>
          <em :data-stage="wearStage(c.wear)">{{ stageLabel(c.wear) }}</em>
        </div>
        <small v-if="c.wear > 0" class="wear-source">
          磨损 {{ c.wear }}/{{ WEAR_BROKEN }} · 来源：{{ wearSummary(c) }}
        </small>
        <small v-if="wearStage(c.wear) === 'worn'" class="wear-effect">
          预览：{{
            cards[c.key]?.kind === "attack"
              ? "伤害 −2"
              : `费用 ${cards[c.key]?.cost} → ${costOf(c)}`
          }}
        </small>
        <em class="card-id">{{ c.id.slice(-6) }}</em>
      </button>
    </div>
    <div v-if="selected" class="repair-preview notice">
      <b>{{ cards[selected.key]?.name }}</b>
      <span
        >当前磨损 {{ selected.wear }}/{{ WEAR_BROKEN }}（{{
          stageLabel(selected.wear)
        }}）</span
      >
      <ul>
        <li>篝火修复：恢复 {{ campPreview }} 点，消耗一次休息机会</li>
        <li>
          商店修复：
          {{
            selected.wear > 0
              ? `约 ${repairPrice(selected.wear, 0)} 金起（受稀缺影响）完全修复`
              : "无需修复"
          }}
        </li>
        <li>奖励修复权益：可恢复最多 5 点，代替选择新牌</li>
      </ul>
    </div>
    <div class="toolbar">
      <button
        :disabled="locked || !deckState.selected"
        @click="emit('upgrade', deckState.selected)"
      >
        强化 · {{ upgradeCost(false, deckState.hero.scars) }} 金</button
      ><button
        :disabled="locked || !deckState.selected || deckState.cards.length <= 5"
        @click="emit('remove', deckState.selected)"
      >
        移除 · {{ removalCost(deckState.removals) }} 金
      </button>
    </div>
  </section>
</template>
