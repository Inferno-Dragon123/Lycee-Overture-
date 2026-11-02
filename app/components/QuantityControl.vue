<script setup lang="ts">
import { Plus, Minus } from "lucide-vue-next";
import type { DeckCard } from "#shared/domain/deck";
defineProps<{ card: DeckCard }>();
const { count, total, editable, change } = useDeck();
</script>
<template>
  <div class="quantity-control">
    <UiButton
      variant="ghost"
      size="icon"
      :aria-label="`减少 ${card.code}`"
      :disabled="!editable || count(card.code) === 0"
      @click="change(card, -1)"
      ><Minus
    /></UiButton>
    <span :aria-label="`${card.code} 数量`">{{ count(card.code) }}</span>
    <UiButton
      variant="ghost"
      size="icon"
      :aria-label="`增加 ${card.code}`"
      :disabled="!editable || total >= 60"
      @click="change(card, 1)"
      ><Plus
    /></UiButton>
  </div>
</template>
