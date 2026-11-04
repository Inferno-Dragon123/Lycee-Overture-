<script setup lang="ts">
import OrbitButton from '../OrbitButton.vue';
import { GripHorizontal } from 'lucide-vue-next';
import {snapStrategyAlignment,type StrategyLayout} from '#shared/domain/strategy';
import BufferedNumberInput from './BufferedNumberInput.vue';
const props=defineProps<{label:string;inline?:boolean;layout?:StrategyLayout;media?:boolean;disabled?:boolean}>();
const emit=defineEmits<{layout:[value:StrategyLayout];preview:[value:StrategyLayout|null]}>();
const root=ref<HTMLElement>(),menu=ref<HTMLElement>(),open=ref(false),dismissed=ref(false),sorting=ref(false),guide=ref('');
let sortFrame=0;
let menuObserver:ResizeObserver|undefined;
let timer:ReturnType<typeof setTimeout>|undefined,start={x:0,y:0},suppressed=false,cleanupDrag:(()=>void)|undefined;
function place(){
  const rect=root.value?.getBoundingClientRect();if(!rect)return;
  const header=Math.max(0,...[...document.querySelectorAll('.p-header,.strategy-editor-header,.strategy-toolbar')].map(el=>el.getBoundingClientRect()).filter(r=>r.bottom>0&&r.top<innerHeight).map(r=>r.bottom));
  if(rect.bottom<header||rect.top>innerHeight){open.value=false;root.value!.style.setProperty('--object-menu-top','0px');return;}
  const naturalHeight=Math.min((menu.value?.scrollHeight||238)+2,240);
  const above=Math.max(0,rect.top-header-8),below=Math.max(0,innerHeight-rect.bottom-8);
  const useAbove=above>=naturalHeight||above>=below,space=Math.max(44,useAbove?above:below),height=Math.min(naturalHeight,space);
  // Meet the object's edge so a mouse can reach the toolbar without crossing a hover gap.
  let top=useAbove?rect.top-height:rect.bottom;
  if(open.value&&Math.max(above,below)<44)top=Math.max(header+8,innerHeight-height-8);
  root.value!.style.setProperty('--object-offset',Math.min(0,innerWidth-rect.left-Math.min(520,innerWidth-24)-12)+'px');
  root.value!.style.setProperty('--object-menu-top',top-rect.top+'px');root.value!.style.setProperty('--object-menu-space',space+'px');
}
watch(open,()=>nextTick(place));watch(()=>props.layout,()=>nextTick(place),{deep:true});
function cancel(){clearTimeout(timer);timer=undefined;}
function press(e:PointerEvent){if(props.disabled||e.pointerType==='mouse'||(e.target as HTMLElement).closest('[data-object-menu]'))return;start={x:e.clientX,y:e.clientY};cancel();timer=setTimeout(()=>{open.value=true;suppressed=true;},500);}
function move(e:PointerEvent){if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>10)cancel();}
function click(e:MouseEvent){if(suppressed){e.preventDefault();e.stopImmediatePropagation();suppressed=false;}}
function close(){open.value=false;dismissed.value=true;const active=document.activeElement as HTMLElement;if(menu.value?.contains(active)){const opener=[...root.value!.querySelectorAll<HTMLElement>('a[href],button')].find(el=>!el.closest('[data-object-menu]'));(opener||root.value?.closest<HTMLElement>('[contenteditable=true]'))?.focus({preventScroll:true});}}
function leaveFocus(e:FocusEvent){if(!root.value?.contains(e.relatedTarget as Node|null))dismissed.value=false;}
function enterFocus(e:FocusEvent){if(!root.value?.contains(e.relatedTarget as Node|null))dismissed.value=false;place();}
function outside(e:PointerEvent){if(!root.value?.contains(e.target as Node)&&(open.value||root.value?.contains(document.activeElement)))close();}
function startSort(e:DragEvent){if(!(e.target as Element).closest('[data-drag-handle]'))return;cancelAnimationFrame(sortFrame);sortFrame=requestAnimationFrame(()=>{sorting.value=true;});}
function finishSort(){cancelAnimationFrame(sortFrame);sorting.value=false;}
function change(value:Partial<StrategyLayout>){if(!props.disabled)emit('layout',{...props.layout,...value});}
function drag(event:PointerEvent,mode:'resize'|'align'){
  if(props.disabled)return;event.preventDefault();event.stopPropagation();cancel();open.value=true;
  const media=root.value?.closest<HTMLElement>('[data-strategy-media]'),column=media?.closest<HTMLElement>('.tiptap');if(!media||!column)return;
  const rect=column.getBoundingClientRect(),width=media.getBoundingClientRect().width,initial=event.clientX;let pending={...props.layout},changed=false;
  const movement=(e:PointerEvent)=>{if(e.pointerId!==event.pointerId)return;e.preventDefault();changed=true;
    if(mode==='resize'){const raw=(width+(e.clientX-initial)*(props.layout?.align==='right'?-1:props.layout?.align==='center'?2:1))/rect.width*100;const snap=[25,33,50,66,75,100].find(n=>Math.abs(n-raw)<2);pending={...props.layout,width:Math.max(15,Math.min(100,Math.round(snap??raw)))};guide.value=pending.width+'%';}
    else{const raw=Math.max(0,Math.min(100,(e.clientX-rect.left-width/2)/Math.max(1,rect.width-width)*100)),align=snapStrategyAlignment(raw,100),target=({left:0,center:50,right:100})[align];if(Math.abs(raw-target)<=4){pending={...props.layout,align,offset:undefined};guide.value=({left:'左对齐',center:'居中',right:'右对齐'})[align];}else{pending={...props.layout,align:'left',offset:Math.round(raw)};guide.value='水平位置 '+pending.offset+'%';}}
    emit('preview',pending);
  };
  const finish=(e:PointerEvent)=>{if(e.pointerId!==event.pointerId)return;if(changed&&e.type!=='pointercancel')emit('layout',pending);suppressed=changed;emit('preview',null);guide.value='';cleanupDrag?.();};
  cleanupDrag=()=>{window.removeEventListener('pointermove',movement);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',finish);cleanupDrag=undefined;};
  window.addEventListener('pointermove',movement,{passive:false});window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',finish);
}
onMounted(()=>{document.addEventListener('pointerdown',outside);window.addEventListener('resize',place);window.addEventListener('scroll',place,true);menuObserver=new ResizeObserver(place);if(menu.value)menuObserver.observe(menu.value);});onBeforeUnmount(()=>{cancel();finishSort();cleanupDrag?.();menuObserver?.disconnect();document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);});
</script>
<template><component :is="inline?'span':'div'" ref="root" class="strategy-object" :class="{'is-open':open,'is-dismissed':dismissed}" @pointerenter="dismissed=false;place()" @focusin="enterFocus" @focusout="leaveFocus" @pointerdown.capture="suppressed=false;dismissed=false" @pointerdown="press" @pointermove="move" @pointerup="cancel" @pointercancel="cancel" @click.capture="click" @contextmenu.prevent="open=true" @keydown.esc.stop="close" @dragstart.capture="startSort" @dragend="finishSort">
  <slot /><component :is="inline?'span':'div'" v-if="!disabled" ref="menu" class="strategy-object-menu" :style="sorting?{opacity:0,pointerEvents:'none'}:undefined" data-object-menu role="toolbar" :aria-label="label" @pointerdown.stop>
    <template v-if="media"><button type="button" aria-label="拖动对齐" class="orbit-tool strategy-align-handle" @pointerdown="drag($event,'align')"><GripHorizontal :size="16" aria-hidden="true" />对齐</button><button class="orbit-tool" v-for="(name,value) in {left:'左对齐',center:'居中',right:'右对齐'}" :key="value" type="button" :aria-pressed="(layout?.align||'left')===value" @click="change({align:value,offset:undefined})">{{ name }}</button><label>宽度<BufferedNumberInput aria-label="显示宽度百分比" :min="15" :max="100" :model-value="layout?.width||100" @update:model-value="change({width:$event})" />%</label><label><input type="checkbox" :checked="!!layout?.wrap" @change="change({wrap:($event.target as HTMLInputElement).checked})" />文字环绕</label></template>
    <label v-if="media">水平位置<BufferedNumberInput aria-label="水平位置百分比" :min="0" :max="100" :model-value="layout?.offset??(layout?.align==='right'?100:layout?.align==='center'?50:0)" @update:model-value="change({offset:$event,align:'left'})" />%</label><slot name="actions" /><OrbitButton type="button" class="strategy-tools-close" @click="close" variant="ghost" tone="neutral" size="sm">收起操作</OrbitButton>
  </component><button v-if="media&&!disabled" type="button" :style="layout?.align==='right'?{left:'0',right:'auto'}:undefined" class="strategy-resize-handle" aria-label="等比例缩放" @pointerdown="drag($event,'resize')" /><span v-if="guide" class="strategy-alignment-guide" role="status">{{ guide }}</span>
</component></template>
