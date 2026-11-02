<script setup lang="ts">
import type {StrategyTextStyle} from '#shared/domain/strategy';
import BufferedNumberInput from './BufferedNumberInput.vue';
const props=defineProps<{value?:StrategyTextStyle}>();
const emit=defineEmits<{change:[value:StrategyTextStyle]}>();
const update=(key:string,value:unknown)=>emit('change',{...props.value,[key]:value});
</script>
<template><span class="object-text-style"><label>文字颜色<input type="color" :value="value?.color||'#46682b'" @input="update('color',($event.target as HTMLInputElement).value)" /></label><label>字号<BufferedNumberInput :min="10" :max="72" :model-value="value?.fontSize||16" @update:model-value="update('fontSize',$event)" /></label><button type="button" :aria-pressed="!!value?.bold" @click="update('bold',!value?.bold)">加粗</button><button type="button" :aria-pressed="!!value?.italic" @click="update('italic',!value?.italic)">斜体</button><button type="button" :aria-pressed="!!value?.underline" @click="update('underline',!value?.underline)">下划线</button><button type="button" @click="emit('change',{})">重置样式</button></span></template>
