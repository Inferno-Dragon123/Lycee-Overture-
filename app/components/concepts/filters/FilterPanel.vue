<script setup lang="ts">
import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/vue";
import { X, ChevronDown, RotateCcw, Check } from "lucide-vue-next";
import { emptyFilters, filterChips, type FilterModel, type createFilterEngine } from "#shared/domain/filters";
import { categoryLabels } from "#shared/domain/catalog";
import { specialAbilityTerms } from "#shared/domain/special-abilities";
import mapping from "../../../../docs/research/series-abbreviations.json";
import { demoSeries } from "~/composables/useShowcase";
import FilterMulti from "./FilterMulti.vue";
import FilterRange from "./FilterRange.vue";
import AbilityPicker from "./AbilityPicker.vue";
import MatchMode from "./MatchMode.vue";
const props = defineProps<{ engine: ReturnType<typeof createFilterEngine>; pending: boolean; error: string; embedded?: boolean }>();
const model = defineModel<FilterModel>({ required: true });
const emit = defineEmits<{ close: []; apply: []; clear: [] }>();
const panel = ref<HTMLElement>();
const count = (keys: string[]) => filterChips(model.value).filter(c => keys.includes(c.key)).length;
const groups = computed(() => [
  { id: "basic", label: "基础信息", count: count(["q", "code", "attribute", "category", "costTotal", "costAttribute"]) },
  { id: "numbers", label: "数值条件", count: count(["ex", "ap", "dp", "sp", "dmg"]) },
  { id: "abilities", label: "卡牌能力", count: count(["ability", "special", "effect"]) },
  { id: "collection", label: "作品与收藏", count: count(["brand", "version", "rarity"]) },
  { id: "advanced", label: "高级筛选", count: count(["position"]) },
]);
const options = (key: "rarity" | "trait" | "ex") => props.engine.facets[key].map(value => ({ value, label: value }));
const brands = computed(() => props.engine.facets.brand.map(value => ({ value, label: demoSeries.find(s => s.code === value)?.name || value, keywords: value.split(" ").map(code => { const m = mapping.entities.find(e => e.code === code); return m ? `${m.nameJa} ${m.displayNameZh}` : code; }).join(" ") })));
const { cards: catalogCards } = useOrbitCatalog();
const versions = computed(() => props.engine.facets.version.filter(value => !model.value.brand.length || catalogCards.value.some(c => c.version === value && model.value.brand.includes(c.brand))).map(value => ({ value, label: value, group: demoSeries.find(s => s.code === catalogCards.value.find(c => c.version === value)?.brand)?.name })));
onMounted(() => { if (!props.embedded) nextTick(() => panel.value?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true })); });
onBeforeUnmount(() => {
  if (props.embedded) return;
  const next = window.innerWidth < 1000 ? document.querySelector<HTMLButtonElement>(".p-deck-drawer button") : null;
  (next || document.getElementById("prototype-filter-toggle"))?.focus({ preventScroll: true });
});
</script>
<template>
  <aside ref="panel" class="p-filter-sheet f-panel" aria-label="详细筛选面板" @keydown.esc.stop.prevent="emit('close')">
    <div class="f-panel-heading"><h2>详细筛选</h2><button class="p-icon" aria-label="关闭详细筛选" @click="emit('close')"><X :size="20" /></button></div>
    <div class="f-panel-scroll">
      <Disclosure v-for="group in groups" :key="group.id" :default-open="['basic', 'numbers'].includes(group.id)" as="section" class="f-group" v-slot="{ open }">
        <DisclosureButton class="f-group-heading"><span>{{ group.label }}</span><span v-if="group.count" class="f-count">{{ group.count }}</span><ChevronDown :size="16" :class="{ 'is-open': open }" /></DisclosureButton>
        <Transition name="f-options"><DisclosurePanel :unmount="false" class="f-group-content">
          <template v-if="group.id === 'basic'">
            <label class="f-label">关键词<input v-model="model.q" maxlength="200" placeholder="中日文、多词、-排除词" @keydown.enter.prevent="emit('apply')" /></label>
            <label class="f-label">卡牌编号<input v-model="model.code" maxlength="200" placeholder="如 4865 或 LO-4865-S" @keydown.enter.prevent="emit('apply')" /></label>
            <div><div class="f-field-heading"><span>属性</span><MatchMode v-model="model.attributeMode" label="属性" /></div><div class="f-segments" role="group" aria-label="卡牌属性"><button v-for="v in engine.facets.attribute" :key="v" :aria-pressed="model.attribute.includes(v)" @click="model.attribute = model.attribute.includes(v) ? model.attribute.filter(x => x !== v) : [...model.attribute, v]">{{ v === '無' ? '无' : v }}</button></div></div>
            <div><span class="f-label">卡牌类别</span><div class="f-segments" role="group" aria-label="卡牌类别"><button v-for="v in engine.facets.category" :key="v" :aria-pressed="model.category.includes(v)" @click="model.category = model.category.includes(v) ? model.category.filter(x => x !== v) : [...model.category, v]">{{ categoryLabels[v] }}</button></div></div>
            <FilterRange v-model="model.costTotal" label="费用总量" />
            <div><div class="f-field-heading"><span>费用属性</span><MatchMode v-model="model.costMode" label="费用属性" /></div><div class="f-segments" role="group" aria-label="费用属性"><button v-for="v in engine.facets.costAttribute" :key="v" :aria-pressed="model.costAttribute.includes(v)" @click="model.costAttribute = model.costAttribute.includes(v) ? model.costAttribute.filter(x => x !== v) : [...model.costAttribute, v]">{{ v === '無' ? '无' : v }}</button></div><p class="f-help">匹配原始费用符号；“全部”要求包含每种所选属性，与总费用数量分别判断。</p></div>
          </template>
          <template v-else-if="group.id === 'numbers'">
            <div><span class="f-label">EX</span><div class="f-segments" role="group" aria-label="EX 数值"><button v-for="v in engine.facets.ex" :key="v" :aria-pressed="model.ex.includes(v)" @click="model.ex = model.ex.includes(v) ? model.ex.filter(x => x !== v) : [...model.ex, v]">{{ v }}</button></div></div>
            <FilterRange v-model="model.ap" label="AP" /><FilterRange v-model="model.dp" label="DP" /><FilterRange v-model="model.sp" label="SP" /><FilterRange v-model="model.dmg" label="DMG" />
          </template>
          <template v-else-if="group.id === 'abilities'">
            <div class="f-field-heading"><span>基础能力</span><MatchMode v-model="model.abilityMode" label="基础能力" /></div>
            <AbilityPicker v-model="model.ability" :options="engine.abilities" />
            <div class="f-field-heading"><span>特殊能力</span><MatchMode v-model="model.specialMode" label="特殊能力" /></div>
            <div class="f-specials" role="group" aria-label="特殊能力"><button v-for="o in specialAbilityTerms" :key="o.value" :aria-pressed="model.special.includes(o.value)" @click="model.special = model.special.includes(o.value) ? model.special.filter(x => x !== o.value) : [...model.special, o.value]"><Check :size="14" :class="{ 'is-hidden': !model.special.includes(o.value) }" />{{ o.label }}</button></div>
            <label class="f-label">效果关键词<input v-model="model.effect" maxlength="200" placeholder="中文或日文效果" /></label>
          </template>
          <template v-else-if="group.id === 'collection'">
            <FilterMulti v-model="model.brand" label="品牌" :options="brands" />
            <FilterMulti v-model="model.version" label="收录版本" :options="versions" />
            <FilterMulti v-model="model.rarity" label="稀有度" :options="options('rarity')" />
          </template>
          <template v-else>
            <div><span class="f-label">配置限制</span><div class="f-segments" role="group" aria-label="配置限制"><button v-for="o in [{value:'any',label:'不限'}, {value:'yes',label:'有'}, {value:'no',label:'无'}] as const" :key="o.value" :aria-pressed="model.position === o.value" @click="model.position = o.value">{{ o.label }}</button></div></div>
            <div class="f-unavailable"><label><input type="checkbox" disabled />合并同编号卡牌</label><p class="f-help">当前卡库缺少同编号身份映射，保留每张异画的完整编号。</p></div>
          </template>
        </DisclosurePanel></Transition>
      </Disclosure>
    </div>
    <div class="f-panel-footer">
      <p v-if="error" role="alert" class="f-error">{{ error }}</p>
      <p class="f-apply-state" role="status">{{ error ? '请修正筛选条件' : pending ? '正在刷新…' : '结果自动更新' }}</p>
      <div><button class="f-clear" @click="model = emptyFilters(); emit('clear')"><RotateCcw :size="16" />清空</button></div>
    </div>
  </aside>
</template>
