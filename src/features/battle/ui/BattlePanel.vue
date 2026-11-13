<script setup lang="ts">
import { battleState, currentIntent, drainIntent } from "../model/state";
import { cards } from "@/shared/cards";
import { effectiveCost, wearStage, WEAR_BROKEN } from "@/shared/wear";
import ActorCard from "./ActorCard.vue";
defineEmits<{ play: [id: string]; end: []; settle: [] }>();
function cost(c: (typeof battleState.piles.hand)[number]) {
  return effectiveCost(cards[c.key]!, c);
}
</script>
<template>
  <section class="panel battle-panel">
    <div class="section-top">
      <span class="eyebrow">02 / THE ENCOUNTER</span
      ><span>回合 {{ battleState.turn }}</span>
    </div>
    <h2>{{ battleState.enemy?.name ?? "等待下一场遭遇" }}</h2>
    <div v-if="battleState.enemy" class="arena">
      <ActorCard :actor="battleState.hero" name="余烬旅人" />
      <div class="versus">
        VS<br /><small>{{ battleState.context?.region.toUpperCase() }}</small>
      </div>
      <ActorCard
        :actor="battleState.enemy"
        :name="battleState.enemy.name"
        enemy
        :intent="currentIntent()"
        :drain="drainIntent()"
      />
    </div>
    <div v-else class="empty-art">
      ✧
      <p>在路线图中选择一个哨站<br /><small>每次出牌都可能改变战局</small></p>
    </div>
    <div v-if="battleState.phase === 'playing'">
      <div class="energy-line">
        <b>◉ {{ battleState.energy }} / 3 能量</b
        ><span
          >抽牌 {{ battleState.piles.draw.length }} · 弃牌
          {{ battleState.piles.discard.length }} · 消耗
          {{ battleState.piles.exhaust.length }}</span
        ><button data-action="end-turn" @click="$emit('end')">
          {{ drainIntent() ? "承受耗尽 →" : "结束回合 →" }}
        </button>
      </div>
      <p v-if="drainIntent()" class="drain-hint">
        敌人本回合不攻击，将耗尽你一张牌（磨损 +2 并进入消耗堆）。
      </p>
      <div class="hand">
        <button
          v-for="c in battleState.piles.hand"
          :key="c.id"
          class="playing-card"
          :data-hand-id="c.id"
          :class="[
            wearStage(c.wear),
            { temp: c.temp },
          ]"
          :disabled="cost(c) > battleState.energy"
          @click="$emit('play', c.id)"
        >
          <i>{{ cost(c) }}</i
          ><span>{{
            cards[c.key]!.kind === "attack"
              ? "⚔"
              : cards[c.key]!.kind === "power"
                ? "✺"
                : "◇"
          }}</span>
          <h3>
            {{ cards[c.key]!.name }}{{ c.upgraded ? " +" : ""
            }}<em v-if="c.temp" class="temp-tag">临时</em>
          </h3>
          <p>{{ cards[c.key]!.text }}<b v-if="c.upgraded"> 效果 +2</b></p>
          <small>{{ cards[c.key]!.kind.toUpperCase() }}</small>
          <small v-if="c.wear > 0" class="card-wear">
            磨损 {{ c.wear }}/{{ WEAR_BROKEN }} · 本场累计
          </small>
        </button>
      </div>
    </div>
    <div
      v-if="battleState.phase === 'won' || battleState.phase === 'lost'"
      class="notice"
    >
      <h3>
        {{
          battleState.phase === "won"
            ? "遭遇胜利 · 火种仍在"
            : "旅途结束 · 余烬熄灭"
        }}
      </h3>
      <p class="settle-wear">
        本场磨损将在结算时一次写回永久卡牌；临时复制牌的磨损不会传回原卡。
      </p>
      <button data-action="settle" @click="$emit('settle')">
        {{ battleState.phase === "won" ? "收取战利品 →" : "查看旅程结果" }}
      </button>
    </div>
    <details v-if="battleState.log.length" open>
      <summary>效果记录 · 最新在前</summary>
      <div class="battle-log">
        <p v-for="(line, i) in battleState.log" :key="i">{{ line }}</p>
      </div>
    </details>
  </section>
</template>
