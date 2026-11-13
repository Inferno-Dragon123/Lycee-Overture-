<script setup lang="ts">
import type { Card } from "#shared/domain/catalog";
import { cardTextureSource } from "#shared/domain/card-artwork";
import ConceptShell from "~/components/concepts/ConceptShell.vue";
import ConceptCatalog from "~/components/concepts/ConceptCatalog.vue";
const route = useRoute();
const { selected } = useShowcase();
const { data: card, error } = await useFetch<Card>(
  () => `/api/cards/${encodeURIComponent(String(route.params.code))}`,
);
if (error.value || !card.value)
  throw createError({
    statusCode: error.value?.statusCode ?? 404,
    statusMessage: "未找到这张卡牌",
  });
useSeoMeta({
  title: () => `${card.value?.name} · ${card.value?.code} | EasyLc`,
  description: () => card.value?.textZh.slice(0, 160),
});
onMounted(() => {
  watch(card, (value) => {
    if (value) selected.value = { ...value, img: cardTextureSource(value.img) };
  }, { immediate: true });
});
</script>
<template>
  <ConceptShell variant="orbit" section="cards">
    <ConceptCatalog variant="orbit" />
  </ConceptShell>
</template>
