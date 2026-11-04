<script setup lang="ts">
import {defineComponent,h,type PropType,type Component} from 'vue';
import {strategyStyleCss,strategyLayoutCss,strategyInlineStyle,type StrategyNode,type StrategySnapshot} from '#shared/domain/strategy';
import type {Card} from '#shared/domain/catalog';
import StrategyReference from './StrategyReference.vue';
const props=defineProps<{doc:StrategyNode;cards:Record<string,Card>;snapshots:Record<string,StrategySnapshot>;printing?:boolean;origin?:string}>();
const emit=defineEmits<{card:[code:string]}>();
const Render:Component=defineComponent({props:{node:{type:Object as PropType<StrategyNode>,required:true}},setup(p){return()=>{
  const n=p.node,a=n.attrs||{},children=()=>n.content?.map((child,index)=>h(Render,{node:child,key:index}));
  if(n.type==='text'){
    let text:any=n.text||'';for(const mark of [...(n.marks||[])].reverse()){const tag=({bold:'strong',italic:'em',strike:'s',code:'code',underline:'u',link:'a'} as Record<string,string>)[mark.type];if(mark.type==='textStyle')text=h('span',{style:strategyStyleCss(mark.attrs)},[text]);else if(tag)text=h(tag,mark.type==='link'?{href:mark.attrs?.href,target:'_blank',rel:'noopener noreferrer',style:strategyStyleCss(n.marks?.find(m=>m.type==='textStyle')?.attrs)}:['underline','strike'].includes(mark.type)?{style:{textDecorationColor:mark.attrs?.color||'currentColor'}}:{},[text]);}return text;
  }
  if(n.type==='reference')return h('div',{class:'strategy-media',style:strategyLayoutCss(a.layout,a.ref?.kind==='card'?45:100)},[h(StrategyReference,{reference:a.ref,cards:props.cards,snapshots:props.snapshots,printing:props.printing,origin:props.origin,textStyle:a.textStyle,onCard:(code:string)=>emit('card',code)})]);
  if(n.type==='cardMention')return h('a',{class:'strategy-mention',style:strategyInlineStyle(n),href:(props.origin||'')+'/cards/'+a.code,onClick:(event:MouseEvent)=>{if(!props.printing){event.preventDefault();emit('card',a.code);}}},(props.cards[a.code]?.name||a.code)+'〔'+a.code+'〕');
  if(n.type==='image')return h('figure',{class:'strategy-image strategy-media',style:strategyLayoutCss(a.layout)},[h('a',{href:a.src,target:'_blank',rel:'noopener noreferrer'},[h('img',{src:a.src,alt:a.alt||'',loading:props.printing?'eager':'lazy'})]),a.title?h('figcaption',{style:strategyStyleCss(a.textStyle)},a.title):null]);
  const tag=n.type==='heading'?'h'+a.level:({doc:'div',paragraph:'p',bulletList:'ul',orderedList:'ol',listItem:'li',blockquote:'blockquote',horizontalRule:'hr',hardBreak:'br',codeBlock:'pre'} as Record<string,string>)[n.type];
  return h(tag||'div',n.type==='orderedList'?{start:a.start}:n.type==='horizontalRule'?{style:{borderColor:a.color||'currentColor'}}:{},children());
};}});
</script>
<template><div class="strategy-prose"><Render :node="doc" /></div></template>
