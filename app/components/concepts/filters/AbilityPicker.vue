<script setup lang="ts">
import { Check, ChevronRight } from "lucide-vue-next";
import type { AbilityFacet } from "#shared/domain/basic-abilities";
import { toggleAbility } from "#shared/domain/filters";
const props = defineProps<{ options: AbilityFacet[] }>();
const model = defineModel<string[]>({ required: true });
const query = ref("");
const active = ref("step");
const families = computed(() => props.options.filter(f => `${f.label} ${f.japanese} ${f.value}`.normalize("NFKC").toLowerCase().includes(query.value.normalize("NFKC").toLowerCase())));
const family = computed(() => props.options.find(f => f.value === active.value)!);
function choose(value: string) { model.value = toggleAbility(model.value, value); }
</script>
<template>
  <div class="f-abilities">
    <input v-model="query" aria-label="搜索基础能力" placeholder="搜索能力名称" />
    <div class="f-cascade">
      <div class="f-families" aria-label="基础能力种类"><button v-for="f in families" :key="f.value" :aria-pressed="active === f.value" @click="active = f.value">{{ f.label }}<span>{{ model.filter(v => v === f.value || v.startsWith(f.value + ':')).length || '' }}</span><ChevronRight :size="14" /></button><p v-if="!families.length" class="f-help">没有匹配的能力。</p></div>
      <div class="f-variants" :aria-label="`${family.label}的代价或效果`">
        <h4>{{ family.label }}</h4>
        <button :aria-pressed="model.includes(family.value)" @click="choose(family.value)"><Check :size="15" :class="{ 'is-hidden': !model.includes(family.value) }" /><span>任意形式</span></button>
        <button v-for="o in family.options" :key="o.value" :aria-pressed="model.includes(o.value)" @click="choose(o.value)"><Check :size="15" :class="{ 'is-hidden': !model.includes(o.value) }" /><span>{{ o.label }}<small v-if="o.label !== o.original && o.original">{{ o.original }}</small></span></button>
        <p v-if="!family.options.length" class="f-help">当前样例没有此能力的具体形式。</p>
      </div>
    </div>
  </div>
</template>
