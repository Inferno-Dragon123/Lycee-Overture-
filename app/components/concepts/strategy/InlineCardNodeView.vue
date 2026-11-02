<script setup lang="ts">
import {NodeViewWrapper,nodeViewProps} from '@tiptap/vue-3';
import {strategyInlineStyle} from '#shared/domain/strategy';
import StrategyObjectTools from './StrategyObjectTools.vue';
import CardEffectCopy from './CardEffectCopy.vue';
import ObjectTextStyle from './ObjectTextStyle.vue';
const props=defineProps(nodeViewProps),ctx=inject<any>('strategy-editor-context');
</script>
<template><NodeViewWrapper as="span" class="strategy-inline-node" contenteditable="false"><StrategyObjectTools inline label="行内卡牌操作" :disabled="!editor.isEditable"><a class="strategy-mention" :href="'/cards/'+node.attrs.code" :style="strategyInlineStyle(node.toJSON())" @click.prevent="ctx.card(node.attrs.code)">{{ ctx.cards.value[node.attrs.code]?.name||node.attrs.code }}〔{{ node.attrs.code }}〕</a><template #actions><CardEffectCopy :card="ctx.cards.value[node.attrs.code]" /><ObjectTextStyle :value="node.attrs.textStyle" @change="value=>updateAttributes({textStyle:value})" /><button type="button" @click="deleteNode">删除行内卡牌</button></template></StrategyObjectTools></NodeViewWrapper></template>
