<script setup lang="ts">
import { computed } from "vue";
import { shopState, itemPrice, quoteRepair } from "../model/state";
import { quoteMessage } from "../lib/pricing";
import { cards } from "@/shared/cards";
import { deckState } from "@/features/deck";
import { wearStage, WEAR_BROKEN } from "@/shared/wear";
defineProps<{ gold: number }>();
defineEmits<{ buy: [id: string]; repair: [id: string]; leave: [] }>();
const repairTargets = computed(() =>
  deckState.cards
    .filter((c) => c.wear > 0)
    .map((c) => ({
      id: c.id,
      name: cards[c.key]?.name ?? c.key,
      wear: c.wear,
      stage: wearStage(c.wear),
      quote: quoteRepair(c.id, (id) =>
        deckState.cards.find((x) => x.id === id)?.wear ?? 0,
      ),
    })),
);
</script>
<template>
  <section class="panel">
    <div class="section-top">
      <span class="eyebrow">04 / THE TRADER</span><span>旅途补给</span>
    </div>
    <h2>路上的旧相识</h2>
    <template v-if="shopState.open"
      ><p class="muted">
        {{
          quoteMessage(
            shopState.context!.influence.favor,
            shopState.context!.influence.scarcity,
          )
        }}
      </p>
      <div class="stock">
        <div v-for="item in shopState.stock" :key="item.id">
          <div>
            <b>{{ cards[item.card]?.name }}</b
            ><small>{{ cards[item.card]?.text }}</small>
          </div>
          <button
            :disabled="item.sold || gold < itemPrice(item.id)"
            :data-stock="item.id"
            @click="$emit('buy', item.id)"
          >
            {{ item.sold ? "已售出" : itemPrice(item.id) + " 金 · 购买" }}
          </button>
        </div>
      </div>
      <div class="repair-shop">
        <h3>铁匠整备 · 付费修复</h3>
        <p class="muted">
          按当前磨损计价并完全修复；取消选择不会收费，金币不足无法成交。
        </p>
        <p v-if="!repairTargets.length" class="muted">
          你的卡牌都还完好，暂不需要整备。
        </p>
        <div v-for="t in repairTargets" :key="t.id" class="stock">
          <div>
            <b>{{ t.name }}</b
            ><small
              >磨损 {{ t.wear }}/{{ WEAR_BROKEN }}（{{
                t.stage === "broken" ? "完全破损" : "受损"
              }}）· 完全修复</small
            >
          </div>
          <button
            :disabled="!t.quote || gold < t.quote.price"
            :data-repair="t.id"
            @click="$emit('repair', t.id)"
          >
            {{ t.quote ? t.quote.price + " 金 · 修复" : "不可修复" }}
          </button>
        </div>
      </div>
      <button data-action="leave-shop" @click="$emit('leave')">
        收好行囊，继续前进 →
      </button></template
    >
    <div v-else class="empty-mini">
      寻找路线上的天平标记。安路的好感让金币走得更远。
    </div>
  </section>
</template>
