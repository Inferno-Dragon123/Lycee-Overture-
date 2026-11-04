<script setup lang="ts">
import type {Editor} from '@tiptap/vue-3';
import {TextSelection} from '@tiptap/pm/state';
import TextFormatControls from './TextFormatControls.vue';
const props=defineProps<{editor:Editor}>(),show=ref(false),position=ref({left:'10px',top:'100px'}),state=useShowcase(),toolbar=ref<HTMLElement>();
let frame=0,selecting=false;
function update(){cancelAnimationFrame(frame);frame=requestAnimationFrame(async()=>{
  const selection=props.editor.state.selection;let atom=false;
  if(selection instanceof TextSelection&&!selection.empty)props.editor.state.doc.nodesBetween(selection.from,selection.to,n=>{if(n.isAtom&&!n.isText)atom=true;});
  show.value=!selecting&&(props.editor.isFocused||!!document.activeElement?.closest('.strategy-selection-toolbar'))&&props.editor.isEditable&&selection instanceof TextSelection&&!selection.empty&&!atom&&!!props.editor.state.doc.textBetween(selection.from,selection.to).trim();
  if(!show.value)return;
  try{const a=props.editor.view.coordsAtPos(selection.from),b=props.editor.view.coordsAtPos(selection.to),header=Math.max(0,...[...document.querySelectorAll('.p-header,.strategy-editor-header,.strategy-toolbar')].map(el=>el.getBoundingClientRect()).filter(r=>r.bottom>0&&r.top<innerHeight).map(r=>r.bottom));
    if(b.bottom<header||a.top>innerHeight){show.value=false;return;}
    await nextTick();if(!show.value)return;
    const bounds=toolbar.value?.getBoundingClientRect(),width=bounds?.width||Math.min(440,innerWidth-16),height=bounds?.height||60;
    const above=a.top-height-8,below=b.bottom+8;
    position.value={left:Math.max(8,Math.min(innerWidth-width-8,(a.left+b.left-width)/2))+'px',top:Math.max(header+8,Math.min(innerHeight-height-8,above>=header+8?above:below))+'px'};
  }catch{show.value=false;}
});}
function outside(e:PointerEvent){const target=e.target as Element;if(target.closest('.strategy-richtext')&&!target.closest('[contenteditable=false]')){selecting=true;show.value=false;}else if(!target.closest('.strategy-selection-toolbar,.strategy-toolbar'))show.value=false;}
function release(){selecting=false;update();}
onMounted(()=>{props.editor.on('selectionUpdate',update);props.editor.on('transaction',update);window.addEventListener('scroll',update,true);window.addEventListener('resize',update);document.addEventListener('pointerdown',outside);document.addEventListener('pointerup',release);document.addEventListener('pointercancel',release);});
onBeforeUnmount(()=>{cancelAnimationFrame(frame);props.editor.off('selectionUpdate',update);props.editor.off('transaction',update);window.removeEventListener('scroll',update,true);window.removeEventListener('resize',update);document.removeEventListener('pointerdown',outside);document.removeEventListener('pointerup',release);document.removeEventListener('pointercancel',release);});
</script>
<template><Teleport to="body"><div v-if="show&&!state.selected.value&&!state.utility.value" ref="toolbar" role="toolbar" aria-label="所选文本样式" class="strategy-selection-toolbar concept-orbit" :class="{'a-light':state.theme.value==='light'}" :style="position"><TextFormatControls :editor="editor" /></div></Teleport></template>
