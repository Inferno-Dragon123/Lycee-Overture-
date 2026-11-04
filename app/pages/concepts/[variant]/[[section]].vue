<script setup lang="ts">
import { concepts } from "~/composables/useShowcase";
import ConceptShell from "~/components/concepts/ConceptShell.vue";
import ConceptHome from "~/components/concepts/ConceptHome.vue";
import ConceptCatalog from "~/components/concepts/ConceptCatalog.vue";
import ConceptPages from "~/components/concepts/ConceptPages.vue";
import OrbitHome from "~/components/concepts/OrbitHome.vue";
const route = useRoute();
const variant = computed(() => String(route.params.variant));
const section = computed(() => String(route.params.section || "home"));
if (!concepts.some((concept) => concept.id === variant.value))
  throw createError({ statusCode: 404, message: "没有这个设计方案" });
useSeoMeta({
  title: () =>
    variant.value === 'orbit' ? '站名占位符·LO卡查工具箱' : `${concepts.find((c) => c.id === variant.value)?.name} · Lycee 设计预览`,
});
</script>
<template>
  <ConceptShell :variant="variant" :section="section"
    ><OrbitHome v-if="variant === 'orbit' && section === 'home'" /><ConceptHome
      v-else-if="section === 'home'"
      :key="variant"
      :variant="variant" /><ConceptCatalog
      v-else-if="section === 'cards'"
      :variant="variant" /><ConceptPages
      v-else-if="!['announcements', 'account'].includes(section)"
      :variant="variant"
      :section="section"
  /></ConceptShell>
</template>
