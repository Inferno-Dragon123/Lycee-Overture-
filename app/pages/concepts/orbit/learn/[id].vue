<script setup lang="ts">
import ConceptShell from '~/components/concepts/ConceptShell.vue';
import StrategyReader from '~/components/concepts/strategy/StrategyReader.vue';
const route=useRoute(),id=computed(()=>String(route.params.id));
useSeoMeta({title:'玩家攻略 · 站名占位符·LO卡查工具箱'});
</script>
<template><ConceptShell variant="orbit" section="learn"><StrategyReader :key="id" :id="id" /></ConceptShell></template>
