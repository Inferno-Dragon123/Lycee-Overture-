<script setup lang="ts">
import type {Card} from '#shared/domain/catalog';
defineProps<{card?:Card}>();
const status=ref(''),manual=ref('');
async function copy(card:Card|undefined,language:'zh'|'ja'){
  const text=(language==='zh'?card?.textZh:card?.textJa)?.trim()||'';
  if(!text){status.value='这张卡暂无'+(language==='zh'?'中文':'日文')+'效果';return;}
  try{await navigator.clipboard.writeText(text);manual.value='';status.value='已复制'+(language==='zh'?'中文':'日文')+'效果';}
  catch{manual.value=text;status.value='未取得剪贴板权限，请选择下方文字复制';}
}
</script>
<template><details class="effect-copy"><summary>复制效果</summary><div><button type="button" @click="copy(card,'zh')">中文效果</button><button type="button" @click="copy(card,'ja')">日文效果</button><small v-if="status" role="status">{{ status }}</small><textarea v-if="manual" :value="manual" readonly aria-label="待复制的卡牌效果" @focus="($event.target as HTMLTextAreaElement).select()" /></div></details></template>
