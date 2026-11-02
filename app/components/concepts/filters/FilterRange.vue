<script setup lang="ts">
import type { NumberRange } from "#shared/domain/filters";
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from "reka-ui";
defineProps<{ label: string }>();
const model = defineModel<NumberRange>({ required: true });
const bounds = computed(() => [model.value.min ?? 0, model.value.max ?? 19]
  .map(value => Math.max(0, Math.min(19, value))).sort((a, b) => a - b));
const unlimited = computed(() => model.value.min === null && model.value.max === null);
function input(side: "min" | "max", event: Event) {
  const value = (event.target as HTMLInputElement).value;
  model.value = { ...model.value, [side]: value === "" ? null : Math.max(0, Math.min(19, Math.trunc(Number(value)))) };
}
function slide(values: number[] | undefined) {
  if (values?.length === 2) model.value = { min: values[0]!, max: values[1]! };
}
</script>
<template>
  <fieldset class="f-range">
    <legend>{{ label }}</legend>
    <div class="f-range-inputs"><input type="number" min="0" max="19" step="1" :value="model.min" :aria-label="`${label} 下限`" placeholder="最小" @input="input('min', $event)" /><span>～</span><input type="number" min="0" max="19" step="1" :value="model.max" :aria-label="`${label} 上限`" placeholder="最大" @input="input('max', $event)" /><button :aria-label="`${label} 不限`" :aria-pressed="unlimited" @click="model = { min: null, max: null }">不限</button></div>
    <SliderRoot class="f-integer-slider" :class="{ 'is-unlimited': unlimited }" :model-value="bounds" :min="0" :max="19" :step="1" :min-steps-between-thumbs="0" @update:model-value="slide">
      <SliderTrack class="f-slider-track"><SliderRange class="f-slider-range" /></SliderTrack>
      <SliderThumb class="f-slider-thumb" :aria-label="`${label} 下限滑块`" />
      <SliderThumb class="f-slider-thumb" :aria-label="`${label} 上限滑块`" />
    </SliderRoot>
    <div class="f-range-scale" aria-hidden="true"><span>0</span><span>19</span></div>
  </fieldset>
</template>
