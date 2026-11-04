<script setup lang="ts">
import OrbitButton from '../OrbitButton.vue';
import { Trash2, ArrowUp, ArrowDown } from 'lucide-vue-next';
import {NodeViewWrapper,nodeViewProps} from '@tiptap/vue-3';
import {strategyLayoutCss,splitStrategyGallery} from '#shared/domain/strategy';
import StrategyReference from './StrategyReference.vue';
import StrategyObjectTools from './StrategyObjectTools.vue';
import CardEffectCopy from './CardEffectCopy.vue';
import ObjectTextStyle from './ObjectTextStyle.vue';
import BufferedNumberInput from './BufferedNumberInput.vue';
const props=defineProps(nodeViewProps),ctx=inject<any>('strategy-editor-context');
const refData=computed(()=>props.node.attrs.ref),preview=ref<any>(null),editingGroup=ref(false);
function move(i:number,delta:number){const codes=[...refData.value.codes],to=i+delta;if(to<0||to>=codes.length)return;[codes[i],codes[to]]=[codes[to],codes[i]];props.updateAttributes({ref:{kind:'gallery',codes}});}
function remove(i:number){const codes=refData.value.codes.filter((_:string,j:number)=>i!==j);if(!codes.length)props.deleteNode();else props.updateAttributes({ref:{kind:'gallery',codes}});}
function inline(){const pos=props.getPos();if(typeof pos==='number')props.editor.chain().focus().insertContentAt({from:pos,to:pos+props.node.nodeSize},{type:'paragraph',content:[{type:'cardMention',attrs:{code:refData.value.code,textStyle:props.node.attrs.textStyle}}]}).run();}
function split(){const pos=props.getPos();if(typeof pos!=='number')return;props.editor.chain().focus().insertContentAt({from:pos,to:pos+props.node.nodeSize},splitStrategyGallery({...props.node.toJSON(),attrs:{...props.node.attrs,layout:{columns:ctx.mobile.value?2:4,...props.node.attrs.layout}}})).run();}
</script>
<template><NodeViewWrapper class="strategy-node strategy-media" data-strategy-media :data-reference-kind="refData?.kind" :style="strategyLayoutCss(preview||node.attrs.layout,refData?.kind==='card'?45:100)" contenteditable="false">
  <StrategyObjectTools :label="refData?.kind==='gallery'?'卡片组操作':refData?.kind==='card'?'卡牌操作':'引用操作'" media :layout="{width:refData?.kind==='card'?45:100,...node.attrs.layout}" :disabled="!editor.isEditable" @preview="preview=$event" @layout="layout=>updateAttributes({layout})">
    <StrategyReference :reference="refData" :cards="ctx.cards.value" :snapshots="ctx.snapshots.value" :text-style="node.attrs.textStyle" @card="ctx.card" />
    <template #actions>
      <CardEffectCopy v-if="refData?.kind==='card'" :card="ctx.cards.value[refData.code]" /><OrbitButton v-if="refData?.kind==='card'" type="button" @click="inline" variant="ghost" tone="neutral" size="sm">改为行内引用</OrbitButton>
      <template v-if="refData?.kind==='gallery'"><OrbitButton type="button" @click="ctx.editGallery(getPos,refData.codes)" variant="ghost" tone="neutral" size="sm">增添卡牌</OrbitButton><OrbitButton type="button" @click="editingGroup=!editingGroup" variant="ghost" tone="neutral" size="sm">编辑卡片组</OrbitButton><OrbitButton type="button" @click="split" variant="ghost" tone="neutral" size="sm">拆开卡片组</OrbitButton><label>列数<BufferedNumberInput :min="1" :max="6" :model-value="node.attrs.layout?.columns||(ctx.mobile.value?2:4)" @update:model-value="updateAttributes({layout:{...node.attrs.layout,columns:$event}})" /></label><span v-if="editingGroup" class="gallery-order"><span v-for="(code,i) in refData.codes" :key="code">{{ code }}<OrbitButton type="button" :disabled="i===0" :aria-label="'前移 '+code" @click="move(Number(i),-1)" variant="ghost" tone="neutral" size="sm"><ArrowUp aria-hidden="true" /></OrbitButton><OrbitButton type="button" :disabled="i===refData.codes.length-1" :aria-label="'后移 '+code" @click="move(Number(i),1)" variant="ghost" tone="neutral" size="sm"><ArrowDown aria-hidden="true" /></OrbitButton><OrbitButton type="button" :aria-label="'移除 '+code" @click="remove(Number(i))" variant="ghost" tone="danger" size="sm"><Trash2 aria-hidden="true" />移除</OrbitButton></span></span></template>
      <ObjectTextStyle :value="node.attrs.textStyle" @change="value=>updateAttributes({textStyle:value})" /><OrbitButton type="button" :disabled="!ctx.canMove(getPos,-1)" @click="ctx.moveObject(getPos,-1)" variant="ghost" tone="neutral" size="sm">上移一段</OrbitButton><OrbitButton type="button" :disabled="!ctx.canMove(getPos,1)" @click="ctx.moveObject(getPos,1)" variant="ghost" tone="neutral" size="sm">下移一段</OrbitButton><button class="orbit-tool" type="button" data-drag-handle draggable="true">拖动排序</button><OrbitButton type="button" @click="deleteNode" variant="ghost" tone="danger" size="sm"><Trash2 aria-hidden="true" />删除引用</OrbitButton>
    </template>
  </StrategyObjectTools>
</NodeViewWrapper></template>
