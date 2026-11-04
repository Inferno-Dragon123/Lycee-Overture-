<script setup lang="ts">
import {strategyRequest} from '~/utils/strategy-api';

import type {StrategyArticle,StrategySnapshot} from '#shared/domain/strategy';
import {printStrategy,type ArticlePrintOptions} from '~/utils/strategy-print';
import StrategyContent from './StrategyContent.vue';
import ChoiceListbox from '../ChoiceListbox.vue';
import WorkflowDialog from '../WorkflowDialog.vue';
import OrbitButton from '../OrbitButton.vue';
import { Undo2 } from 'lucide-vue-next';
const props=defineProps<{id:string}>(),catalog=useOrbitCatalog(),state=useShowcase();
const article=ref<(StrategyArticle&{snapshots:Record<string,StrategySnapshot>})|null>(null),error=ref(''),busy=ref(false),pdfOpen=ref(false),options=reactive<ArticlePrintOptions>({paper:'a4',cover:false,pageNumbers:true,links:true});
const cards=computed(()=>Object.fromEntries(catalog.byCode.value));
const withdrawing=ref(false);
async function load(){error.value='';try{article.value=await strategyRequest('/api/strategy/articles',{query:{id:props.id,view:'public'}});await catalog.load();}catch(e){error.value=(e as {data?:{message?:string}}).data?.message||'攻略暂时不可读取';}}
async function pdf(){if(!article.value||busy.value)return;busy.value=true;try{await printStrategy(article.value,cards.value,article.value.snapshots,options);pdfOpen.value=false;}catch(e){error.value=(e as Error).message;}finally{busy.value=false;}}
async function unpublish(){if(!article.value||withdrawing.value)return;withdrawing.value=true;try{await strategyRequest('/api/strategy/articles',{method:'PATCH',body:{id:props.id,revision:article.value.revision,action:'unpublish'}});await navigateTo('/concepts/orbit/learn?tab=mine');}catch(e){error.value=(e as {data?:{message?:string}}).data?.message||'撤回失败';}finally{withdrawing.value=false;}}
onMounted(()=>void load());
</script>
<template><section class="strategy-reader"><header class="strategy-reader-actions"><OrbitButton as-child variant="ghost" tone="neutral"><NuxtLink to="/concepts/orbit/learn?tab=articles">← 返回玩家攻略</NuxtLink></OrbitButton><div v-if="article"><OrbitButton @click="pdfOpen=true" variant="outline" tone="neutral" size="default">导出PDF</OrbitButton><OrbitButton v-if="article.canEdit" as-child><NuxtLink :to="'/concepts/orbit/learn/write?draft='+id">编辑攻略</NuxtLink></OrbitButton><OrbitButton v-if="article.canEdit" @click="unpublish" variant="ghost" tone="danger" size="default" :busy="withdrawing"><Undo2 aria-hidden="true" />撤回公开</OrbitButton></div></header><p v-if="error" role="alert">{{ error }}<OrbitButton @click="load" variant="ghost" tone="neutral" size="sm">重新读取</OrbitButton></p><p v-if="!article&&!error" role="status">正在读取攻略…</p><article v-if="article" class="strategy-reading-article"><header><small>{{ article.category }} · {{ article.author }}</small><h1>{{ article.title }}</h1><p>{{ article.summary }}</p><div class="article-tags"><span v-for="tag in article.tags" :key="tag">{{ tag }}</span></div><img v-if="article.cover" class="article-cover" :src="article.cover" alt="攻略封面" /></header><StrategyContent :doc="article.doc" :cards="cards" :snapshots="article.snapshots" @card="code=>{const c=catalog.byCode.value.get(code);if(c)state.selected.value=c;}" /></article><WorkflowDialog v-model:open="pdfOpen" title="导出PDF" description="打开打印窗口后选择“另存为PDF”。"><form class="workflow-form" @submit.prevent="pdf"><ChoiceListbox :model-value="options.paper" label="纸张" :options="[{value:'a4',label:'A4'},{value:'letter',label:'Letter'}]" @update:model-value="options.paper=$event==='letter'?'letter':'a4'" /><label class="strategy-consent"><input v-model="options.cover" type="checkbox" />包含封面</label><label class="strategy-consent"><input v-model="options.pageNumbers" type="checkbox" />页码</label><label class="strategy-consent"><input v-model="options.links" type="checkbox" />附外部链接</label><OrbitButton  :disabled="busy" type="submit" variant="default" tone="brand" size="default" :busy="busy">准备PDF并打开打印</OrbitButton></form></WorkflowDialog></section></template>
