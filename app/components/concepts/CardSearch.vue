<script setup lang="ts">
import { Search, SlidersHorizontal } from "lucide-vue-next";
import {
  createFilterEngine,
  emptyFilters,
  cloneFilters,
  filterParams,
} from "#shared/domain/filters";
import FilterPanel from "./filters/FilterPanel.vue";
import type { Card } from "#shared/domain/catalog";
const props = defineProps<{ codes?: string[]; artSelectable?: boolean }>();
const emit = defineEmits<{ choose: [Card] }>();
const catalog = useOrbitCatalog();
const engine = computed(() => createFilterEngine(catalog.cards.value));
const model = ref(emptyFilters()),
  applied = ref(emptyFilters()),
  error = ref(""),
  expanded = ref(false);
const result = computed(() =>
  engine.value.search(
    applied.value,
    "",
    props.codes ? new Set(props.codes) : undefined,
  ),
);
let timer: ReturnType<typeof setTimeout> | undefined;
function apply() {
  try {
    engine.value.validate(model.value);
    applied.value = cloneFilters(model.value);
    error.value = "";
  } catch (e) {
    error.value = (e as Error).message;
  }
}
watch(
  () => filterParams(model.value).toString(),
  () => {
    clearTimeout(timer);
    timer = setTimeout(apply, 180);
  },
);
watch(
  () => {
    const copy = cloneFilters(model.value);
    copy.page = 1;
    return filterParams(copy).toString();
  },
  () => {
    model.value.page = 1;
  },
);
onMounted(() => {
  void catalog.load();
});
onBeforeUnmount(() => clearTimeout(timer));
function clear() {
  model.value = emptyFilters();
  apply();
}
function pageTo(page: number) {
  model.value.page = page;
  apply();
}
</script>
<template>
  <section class="shared-card-search" aria-label="全站卡牌检索">
    <div class="shared-search-bar">
      <Search :size="18" /><label class="sr-only" for="shared-card-query"
        >搜索卡牌</label
      ><input
        id="shared-card-query"
        v-model="model.q"
        placeholder="卡号、名称、中日文效果"
        maxlength="200"
      /><button
        class="p-icon"
        aria-label="全站详细筛选"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <SlidersHorizontal :size="20" /></button
      ><button v-if="model.q" @click="model.q = ''">清空</button>
    </div>
    <div class="shared-search-layout" :class="{ 'with-filters': expanded }">
      <FilterPanel
        v-if="expanded"
        v-model="model"
        embedded
        :engine="engine"
        :pending="false"
        :error="error"
        @close="expanded = false"
        @apply="apply"
        @clear="clear"
      />
      <div>
        <p v-if="catalog.loading.value">正在读取完整卡库…</p>
        <p v-if="catalog.error.value" role="alert">
          {{ catalog.error.value }}<button @click="catalog.load">重试</button>
        </p>
        <p v-if="error && !expanded" role="alert">{{ error }}</p>
        <p>
          {{ result.total }} 种卡牌<span v-if="!codes && catalog.ready.value">
            · 卡库 {{ catalog.cards.value.length }} 种</span
          >
        </p>
        <div class="shared-card-grid a-wallet-grid">
          <article
            v-for="card in result.cards"
            :key="card.code"
            :aria-label="`背包卡牌 ${card.code}`"
          >
            <component
              :is="artSelectable === false ? 'div' : 'button'"
              class="shared-art"
              :aria-label="artSelectable === false ? undefined : `选择 ${card.code}`"
              @click="artSelectable !== false && emit('choose', card)"
            >
              <img :src="card.img" :alt="card.name" loading="lazy" />
            </component>
            <h3>{{ card.code }} · {{ card.rarity }}</h3>
            <p>{{ card.name }}</p>
            <slot name="actions" :card="card"
              ><button @click="emit('choose', card)">选择卡牌</button></slot
            >
          </article>
        </div>
        <p v-if="!result.total">此范围没有卡牌。</p>
        <nav class="p-pagination" aria-label="检索分页">
          <button
            :disabled="result.page <= 1"
            aria-label="上一页背包"
            @click="pageTo(result.page - 1)"
          >
            上一页</button
          ><span>{{ result.page }} / {{ result.pages }}</span
          ><button
            :disabled="result.page >= result.pages"
            aria-label="下一页背包"
            @click="pageTo(result.page + 1)"
          >
            下一页
          </button>
        </nav>
      </div>
    </div>
  </section>
</template>
