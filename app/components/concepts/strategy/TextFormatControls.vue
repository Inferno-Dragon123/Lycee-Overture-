<script setup lang="ts">
import type {Editor} from '@tiptap/vue-3';
const props=defineProps<{editor:Editor;prepare?:()=>void}>(),tick=ref(0);
const active=(name:string)=>{tick.value;return props.editor.isActive(name)||(name==='underline'&&props.editor.isActive('link')&&props.editor.getAttributes('textStyle').underline!==false);};
const attributes=computed(()=>{tick.value;return props.editor.getAttributes('textStyle');});
const sizeDirty=ref(false),sizeInput=ref<HTMLInputElement>(),size=ref(String(props.editor.getAttributes('textStyle').fontSize||16));
watch(()=>attributes.value.fontSize,value=>{if(document.activeElement!==sizeInput.value)size.value=String(value||16);});
function format(name:'bold'|'italic'|'underline'){if(props.editor.isDestroyed||!props.editor.isEditable)return;props.prepare?.();const chain=props.editor.chain().focus();if(name==='bold')chain.toggleBold().run();else if(name==='italic')chain.toggleItalic().run();else {const next=!(props.editor.isActive('underline')||(props.editor.isActive('link')&&props.editor.getAttributes('textStyle').underline!==false));if(props.editor.isActive('link'))chain.setMark('textStyle',{...props.editor.getAttributes('textStyle'),underline:next});if(next)chain.setUnderline().run();else chain.unsetUnderline().run();}}
function style(key:'color'|'fontSize',value:string|number){if(props.editor.isDestroyed||!props.editor.isEditable)return;props.prepare?.();props.editor.chain().focus().setMark('textStyle',{...props.editor.getAttributes('textStyle'),[key]:value}).run();}
const refresh=()=>tick.value++;
function commitSize(){if(!sizeDirty.value||props.editor.isDestroyed||!props.editor.isEditable)return;sizeDirty.value=false;const value=Math.round(Math.max(10,Math.min(72,Number(size.value)||16)));size.value=String(value);style('fontSize',value);}
onMounted(()=>props.editor.on('transaction',refresh));onBeforeUnmount(()=>{props.editor.off('transaction',refresh);});
</script>
<template><span class="strategy-text-controls"><button type="button" :aria-pressed="active('bold')" @pointerdown.prevent @click="format('bold')">加粗</button><button type="button" :aria-pressed="active('italic')" @pointerdown.prevent @click="format('italic')">斜体</button><button type="button" :aria-pressed="active('underline')" @pointerdown.prevent @click="format('underline')">下划线</button><label>字体颜色<input type="color" :value="attributes.color||'#46682b'" @pointerdown="prepare?.()" @input="style('color',($event.target as HTMLInputElement).value)" /></label><label>字体大小<input ref="sizeInput" v-model="size" @input="sizeDirty=true" type="number" min="10" max="72" @pointerdown="prepare?.()" @change="commitSize" @blur="commitSize" @keydown.enter.prevent="commitSize" /></label></span></template>
