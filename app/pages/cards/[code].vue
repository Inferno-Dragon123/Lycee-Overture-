<script setup lang="ts">
import { ArrowLeft, Layers } from "lucide-vue-next";
import type { Card } from "#shared/domain/catalog";
const route = useRoute();
const { data: card, error } = await useFetch<Card>(
  () => `/api/cards/${encodeURIComponent(String(route.params.code))}`,
);
if (error.value || !card.value)
  throw createError({
    statusCode: error.value?.statusCode ?? 404,
    statusMessage: "未找到这张卡牌",
  });
useSeoMeta({
  title: () => `${card.value?.name} · ${card.value?.code} | Lycee 卡查`,
  description: () => card.value?.textZh.slice(0, 160),
});
</script>
<template>
  <main id="main-content" class="detail-page page-container">
    <div class="page-back">
      <NuxtLink to="/cards" class="text-link"
        ><ArrowLeft :size="16" />返回卡牌图鉴</NuxtLink
      ><NuxtLink to="/builder" class="text-link"
        ><Layers :size="16" />本地卡组</NuxtLink
      >
    </div>
    <CardDetail v-if="card" :card="card" />
  </main>
</template>
