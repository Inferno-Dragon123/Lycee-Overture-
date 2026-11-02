<script setup lang="ts">
import { deckAttributes, type DeckSearch } from "#shared/domain/deck-library";
import ChoiceListbox from "../ChoiceListbox.vue";
import { demoSeries } from "~/composables/useShowcase";
const model = defineModel<DeckSearch>({ required: true });
const series = computed(() => [
  { value: "", label: "全部会社" },
  ...demoSeries.map((s) => ({ value: s.code, label: s.name })),
]);
function range(a: string, side: "min" | "max", event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  const value = raw === "" ? null : Number(raw);
  model.value.ranges[a] = {
    min: null,
    max: null,
    ...model.value.ranges[a],
    [side]: value,
  };
}
</script>
<template>
  <section class="deck-search-bar" aria-label="卡组检索">
    <label
      >名称与简介<input
        v-model="model.q"
        placeholder="搜索自己的构筑"
        maxlength="200" /></label
    ><ChoiceListbox
      v-model="model.type"
      label="卡组类型"
      :options="[
        { value: '', label: '全部类型' },
        { value: 'single', label: '系列单' },
        { value: 'mix', label: '混成' },
      ]"
    /><ChoiceListbox
      v-if="model.type === 'single'"
      v-model="model.series"
      label="系列单会社"
      :options="series"
    /><ChoiceListbox
      v-model="model.color"
      label="属性构成"
      :options="[
        { value: '', label: '全部属性' },
        { value: 'mix', label: '混色' },
        ...deckAttributes.map((a) => ({
          value: a,
          label: a === '他' ? '其他属性' : a + '单',
        })),
      ]"
    />
    <fieldset v-if="model.color === 'mix'" class="deck-attribute-ranges">
      <legend>属性数量范围</legend>
      <label v-for="a in deckAttributes" :key="a"
        >{{ a
        }}<input
          type="number"
          min="0"
          max="200"
          step="1"
          :aria-label="`${a}属性最少张数`"
          :value="model.ranges[a]?.min"
          @input="range(a, 'min', $event)" />～<input
          type="number"
          min="0"
          max="200"
          step="1"
          :aria-label="`${a}属性最多张数`"
          :value="model.ranges[a]?.max"
          @input="range(a, 'max', $event)"
      /></label>
    </fieldset>
  </section>
</template>
