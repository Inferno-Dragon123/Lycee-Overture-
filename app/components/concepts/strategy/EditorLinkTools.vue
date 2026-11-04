<script setup lang="ts">
import OrbitButton from '../OrbitButton.vue';
import { Unlink } from 'lucide-vue-next';
import type {Editor} from '@tiptap/vue-3';
import {getMarkRange} from '@tiptap/core';
import TextFormatControls from './TextFormatControls.vue';
const props=defineProps<{editor:Editor}>(),emit=defineEmits<{edit:[range:{from:number;to:number}]} >();
const link=ref<{from:number;to:number;href:string;left:number;top:number;anchorTop:number;anchorBottom:number}|null>(null),state=useShowcase();
let editorRoot:HTMLElement|undefined;
let hold:ReturnType<typeof setTimeout>|undefined,hide:ReturnType<typeof setTimeout>|undefined,origin={x:0,y:0},suppress=false;
function identify(event:PointerEvent){const a=(event.target as Element).closest<HTMLAnchorElement>('a[href]');if(!a||a.closest('.strategy-node,.strategy-inline-node'))return null;
  try{const pos=props.editor.view.posAtDOM(a,0),range=getMarkRange(props.editor.state.doc.resolve(pos),props.editor.schema.marks.link!);if(!range)return null;const rect=a.getBoundingClientRect();return {...range,href:a.href,left:Math.max(8,Math.min(innerWidth-Math.min(620,innerWidth-16)-8,rect.left)),top:rect.bottom+8,anchorTop:rect.top,anchorBottom:rect.bottom};}catch{return null;}}
watch(link,async value=>{if(!value)return;await nextTick();if(link.value!==value)return;const menu=document.querySelector<HTMLElement>('.strategy-link-tools');if(!menu)return;const height=menu.getBoundingClientRect().height,header=document.querySelector('.p-header')?.getBoundingClientRect().bottom||80;value.top=value.anchorTop-height-8>header+6?value.anchorTop-height-8:Math.max(header+6,Math.min(innerHeight-height-8,value.anchorBottom+8));});
function over(e:PointerEvent){if(e.pointerType!=='mouse')return;const found=identify(e);if(found){clearTimeout(hide);link.value=found;}}
function out(e:PointerEvent){const next=e.relatedTarget as Element|null;if(next?.closest?.('.strategy-link-tools')||next?.closest?.('a')===(e.target as Element).closest('a'))return;if(next&&editorRoot?.contains(next))return;hide=setTimeout(()=>{if(!document.querySelector('.strategy-link-tools:hover'))link.value=null;},500);}
function press(e:PointerEvent){if(e.pointerType==='mouse')return;const found=identify(e);if(!found)return;origin={x:e.clientX,y:e.clientY};hold=setTimeout(()=>{link.value=found;suppress=true;},500);}
function move(e:PointerEvent){if(Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>10)clearTimeout(hold);}
function cancelHide(){clearTimeout(hide);}
function release(){clearTimeout(hold);}
function click(e:MouseEvent){if(suppress){e.preventDefault();e.stopPropagation();suppress=false;}}
function select(){if(link.value)props.editor.commands.setTextSelection({from:link.value.from,to:link.value.to});}
function outside(e:PointerEvent){if(!(e.target as Element).closest('.strategy-link-tools,.strategy-richtext a'))link.value=null;}
onMounted(()=>{const root=props.editor.view.dom;editorRoot=root;root.addEventListener('pointerover',over);root.addEventListener('pointerout',out);root.addEventListener('pointerdown',press);root.addEventListener('pointermove',move);root.addEventListener('pointerup',release);root.addEventListener('pointercancel',release);root.addEventListener('click',click,true);document.addEventListener('pointerdown',outside);});
onBeforeUnmount(()=>{clearTimeout(hold);clearTimeout(hide);const root=editorRoot;if(!root)return;root.removeEventListener('pointerover',over);root.removeEventListener('pointerout',out);root.removeEventListener('pointerdown',press);root.removeEventListener('pointermove',move);root.removeEventListener('pointerup',release);root.removeEventListener('pointercancel',release);root.removeEventListener('click',click,true);document.removeEventListener('pointerdown',outside);});
</script>
<template><Teleport to="body"><div v-if="link&&editor.isEditable&&!state.selected.value&&!state.utility.value" class="strategy-link-tools concept-orbit" :class="{'a-light':state.theme.value==='light'}" role="toolbar" aria-label="文字链接操作" :style="{left:link.left+'px',top:link.top+'px'}" @pointerenter="cancelHide"><OrbitButton as-child variant="ghost" tone="neutral" size="sm"><a :href="link.href" target="_blank" rel="noopener noreferrer">打开链接 ↗</a></OrbitButton><OrbitButton type="button" @click="emit('edit',{from:link.from,to:link.to})" variant="ghost" tone="neutral" size="sm">修改链接</OrbitButton><OrbitButton type="button" @click="select();editor.chain().focus().unsetLink().run();link=null" variant="ghost" tone="danger" size="sm"><Unlink aria-hidden="true" />移除链接</OrbitButton><TextFormatControls :editor="editor" :prepare="select" /><OrbitButton type="button" @click="link=null" variant="ghost" tone="neutral" size="sm">收起操作</OrbitButton></div></Teleport></template>
