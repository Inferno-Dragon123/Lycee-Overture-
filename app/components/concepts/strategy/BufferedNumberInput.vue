<script setup lang="ts">
const props=defineProps<{modelValue:number;min:number;max:number}>();
const emit=defineEmits<{'update:modelValue':[value:number]}>();
// Editor focus transactions may rerender a node while a number is being typed.
// Keep its pending text separate from the last committed document attribute.
const value=ref<string|number>(String(props.modelValue)),dirty=ref(false);
watch(()=>props.modelValue,next=>{if(!dirty.value)value.value=String(next);});
function commit(){if(!dirty.value)return;const raw=Number(value.value),next=Math.max(props.min,Math.min(props.max,String(value.value).trim()&&Number.isFinite(raw)?Math.round(raw):props.modelValue));dirty.value=false;value.value=String(next);emit('update:modelValue',next);}
</script>
<template><input v-model="value" type="number" :min="min" :max="max" step="1" @input="dirty=true" @change="commit" @blur="commit" @keydown.enter.prevent="commit" /></template>
