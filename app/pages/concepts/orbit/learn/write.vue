<script setup lang="ts">
import ConceptShell from '~/components/concepts/ConceptShell.vue';
import StrategyEditor from '~/components/concepts/strategy/StrategyEditor.vue';
const route=useRoute();
const defaultId=useState('strategy-new-id:'+route.fullPath,()=>'a_'+crypto.randomUUID());
const id=computed(()=>/^a_[a-f0-9-]{36}$/.test(String(route.query.draft||''))?String(route.query.draft):defaultId.value);
useSeoMeta({title:'撰写攻略 · 站名占位符·LO卡查工具箱'});
</script>
<template><ConceptShell variant="orbit" section="learn"><StrategyEditor :key="id" :id="id" /></ConceptShell></template>
