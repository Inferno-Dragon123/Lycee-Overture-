<script setup lang="ts">
import { Plus, Minus, ArrowUpRight } from "lucide-vue-next";
import type { Card } from "#shared/domain/catalog";
import { DECK_CARD_LIMIT } from "#shared/domain/deck";
import LoomArtwork from "./LoomArtwork.vue";
defineProps<{ card: Card; count: number; total: number; editable: boolean; editing: boolean; highlighted: boolean }>();
const emit = defineEmits<{ edit: [code: string | null]; change: [card: Card, delta: number]; detail: [card: Card] }>();
function leave(event: FocusEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) emit("edit", null);
}
</script>
<template>
  <article class="v3-tile" :data-code="card.code" :class="{ 'is-editing': editing, 'is-highlighted': highlighted }" @focusout="leave" @keydown.esc.stop="emit('edit', null)">
    <button class="v3-tile-art" :aria-label="`查看卡牌 ${card.code}`" @click="emit('detail', card)">
      <LoomArtwork :card="card" /><span class="v3-detail-hint"><ArrowUpRight :size="14" />详情</span>
    </button>
    <div class="v3-tile-meta"><span>{{ card.code }}</span><span :title="card.name">{{ card.name }}</span></div>
    <div class="v3-tile-quantity">
      <button class="v3-count-toggle" :aria-label="`编辑 ${card.code} 数量，当前 ${count} 张`" :aria-expanded="editing" @click="emit('edit', editing ? null : card.code)">× {{ count }}</button>
      <div class="v3-inline-editor" :aria-label="`${card.code} 数量操作`">
        <button :disabled="!editable || count < 1" :aria-label="`减少 ${card.code}`" @click="emit('change', card, -1)"><Minus :size="16" /></button>
        <output :aria-label="`${card.code} 张数`">{{ count }}</output>
        <button :disabled="!editable || total >= DECK_CARD_LIMIT" :aria-label="`增加 ${card.code}`" @click="emit('change', card, 1)"><Plus :size="16" /></button>
      </div>
    </div>
  </article>
</template>
