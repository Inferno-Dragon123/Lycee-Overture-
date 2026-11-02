<script setup lang="ts">
import type { MatchMode } from "#shared/domain/filters";
defineProps<{ label: string }>();
const model = defineModel<MatchMode>({ required: true });
</script>
<template><div class="f-match" role="group" :aria-label="`${label}匹配方式`"><button :aria-pressed="model === 'or'" @click="model = 'or'">任一</button><button :aria-pressed="model === 'and'" @click="model = 'and'">全部</button></div></template>
