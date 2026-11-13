<script setup lang="ts">
import { computed } from "vue";
import { rewardState, chooseReward, chooseRepair } from "../model/state";
import { cards } from "@/shared/cards";
import { deckState } from "@/features/deck";
import { wearStage, WEAR_BROKEN } from "@/shared/wear";
defineEmits<{ claim: [skip: boolean] }>();
const wornCards = computed(() =>
  deckState.cards
    .filter((c) => c.wear > 0)
    .map((c) => ({
      id: c.id,
      name: cards[c.key]?.name ?? c.key,
      wear: c.wear,
      stage: wearStage(c.wear),
    })),
);
</script>
<template>
  <section class="panel">
    <div class="section-top">
      <span class="eyebrow">03 / THE SPOILS</span><span>三选一</span>
    </div>
    <h2>把胜利带进下一场</h2>
    <p class="muted">
      战斗结束后结算金币，并选择一张新牌，或用修复权益（恢复
      {{ rewardState.offer?.repair ?? 5 }} 点磨损）代替新牌。林地额外疗愈。
    </p>
    <div v-if="rewardState.offer && !rewardState.offer.claimed">
      <div class="notice">
        ✦ {{ rewardState.offer.gold }} 金币 · 回复
        {{ rewardState.offer.heal }} 生命 · 修复权益
        {{ rewardState.offer.repair }} 点
      </div>
      <div class="reward-options">
        <button
          v-for="key in rewardState.offer.cards"
          :key="key"
          :class="{ selected: rewardState.selected === key }"
          @click="chooseReward(key)"
        >
          <b>{{ cards[key]?.name }}</b
          ><small>{{ cards[key]?.text }}</small
          ><em>{{ cards[key]?.rarity }}</em>
        </button>
      </div>
      <div class="repair-offer">
        <h3>修复权益 · 代替新牌</h3>
        <p v-if="!wornCards.length" class="muted">
          牌组中没有磨损的卡牌，本次无需修复。
        </p>
        <div v-else class="repair-targets">
          <button
            v-for="c in wornCards"
            :key="c.id"
            :class="{ selected: rewardState.repairTarget === c.id }"
            :data-repair-target="c.id"
            @click="chooseRepair(c.id)"
          >
            <b>{{ c.name }}</b
            ><small>磨损 {{ c.wear }}/{{ WEAR_BROKEN }}（{{
              c.stage === "broken" ? "完全破损" : "受损"
            }}）· 恢复最多 {{ rewardState.offer.repair }} 点</small>
          </button>
        </div>
      </div>
      <div class="toolbar">
        <button
          :disabled="!rewardState.selected && !rewardState.repairTarget"
          data-action="claim"
          @click="$emit('claim', false)"
        >
          {{
            rewardState.repairTarget
              ? "使用修复权益并领取战利品"
              : "收下选中牌与战利品"
          }}
        </button>
        <button data-action="skip-reward" @click="$emit('claim', true)">
          仅收取金币
        </button>
      </div>
    </div>
    <div v-else class="empty-mini">
      {{
        rewardState.offer?.claimed
          ? "战利品已收入行囊。下一段路线已开放。"
          : "战胜敌人，发现下一张关键卡牌。"
      }}
    </div>
  </section>
</template>
