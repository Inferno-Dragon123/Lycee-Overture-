<script setup lang="ts">
import {snapStrategyAlignment,type StrategyLayout} from '#shared/domain/strategy';
import BufferedNumberInput from './BufferedNumberInput.vue';
const props=defineProps<{label:string;inline?:boolean;layout?:StrategyLayout;media?:boolean;disabled?:boolean}>();
const emit=defineEmits<{layout:[value:StrategyLayout];preview:[value:StrategyLayout|null]}>();
const root=ref<HTMLElement>(),open=ref(false),guide=ref('');
let timer:ReturnType<typeof setTimeout>|undefined,start={x:0,y:0},suppressed=false,cleanupDrag:(()=>void)|undefined;
function place(){const rect=root.value?.getBoundingClientRect();if(!rect)return;root.value!.style.setProperty('--object-offset',Math.min(0,innerWidth-rect.left-Math.min(520,innerWidth-24)-12)+'px');root.value!.classList.toggle('menu-below',rect.top<(document.querySelector('.p-header')?.getBoundingClientRect().bottom||80)+100);}
watch(open,()=>nextTick(place));watch(()=>props.layout,()=>nextTick(place),{deep:true});
function cancel(){clearTimeout(timer);timer=undefined;}
function press(e:PointerEvent){if(props.disabled||e.pointerType==='mouse'||(e.target as HTMLElement).closest('[data-object-menu]'))return;start={x:e.clientX,y:e.clientY};cancel();timer=setTimeout(()=>{open.value=true;suppressed=true;},500);}
function move(e:PointerEvent){if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>10)cancel();}
function click(e:MouseEvent){if(suppressed&&!(e.target as HTMLElement).closest('[data-object-menu]')){e.preventDefault();e.stopPropagation();suppressed=false;}}
function close(){open.value=false;const active=document.activeElement as HTMLElement;if(root.value?.contains(active))active.blur();}
function outside(e:PointerEvent){if(!root.value?.contains(e.target as Node))open.value=false;}
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
onMounted(()=>document.addEventListener('pointerdown',outside));onBeforeUnmount(()=>{cancel();cleanupDrag?.();document.removeEventListener('pointerdown',outside);});
</script>
<template><component :is="inline?'span':'div'" ref="root" class="strategy-object" :class="{'is-open':open}" @pointerenter="place" @focusin="place" @pointerdown="press" @pointermove="move" @pointerup="cancel" @pointercancel="cancel" @click.capture="click" @contextmenu.prevent="open=true" @keydown.esc.stop="open=false">
  <slot /><component :is="inline?'span':'div'" v-if="!disabled" class="strategy-object-menu" data-object-menu role="toolbar" :aria-label="label" @pointerdown.stop>
    <template v-if="media"><button type="button" aria-label="拖动对齐" class="strategy-align-handle" @pointerdown="drag($event,'align')">⠿ 对齐</button><button v-for="(name,value) in {left:'左对齐',center:'居中',right:'右对齐'}" :key="value" type="button" :aria-pressed="(layout?.align||'left')===value" @click="change({align:value,offset:undefined})">{{ name }}</button><label>宽度<BufferedNumberInput aria-label="显示宽度百分比" :min="15" :max="100" :model-value="layout?.width||100" @update:model-value="change({width:$event})" />%</label><label><input type="checkbox" :checked="!!layout?.wrap" @change="change({wrap:($event.target as HTMLInputElement).checked})" />文字环绕</label></template>
    <label v-if="media">水平位置<BufferedNumberInput aria-label="水平位置百分比" :min="0" :max="100" :model-value="layout?.offset??(layout?.align==='right'?100:layout?.align==='center'?50:0)" @update:model-value="change({offset:$event,align:'left'})" />%</label><slot name="actions" /><button type="button" class="strategy-tools-close" @click="close">收起操作</button>
  </component><button v-if="media&&!disabled" type="button" :style="layout?.align==='right'?{left:'0',right:'auto'}:undefined" class="strategy-resize-handle" aria-label="等比例缩放" @pointerdown="drag($event,'resize')" /><span v-if="guide" class="strategy-alignment-guide" role="status">{{ guide }}</span>
</component></template>
