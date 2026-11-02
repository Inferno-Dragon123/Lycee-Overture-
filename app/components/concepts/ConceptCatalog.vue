<script setup lang="ts">
import { Search, ArrowUpRight, ArrowLeft, ArrowRight, Plus, Minus, X, SlidersHorizontal } from "lucide-vue-next";
import { demoSeries, useShowcase } from "~/composables/useShowcase";
import { useCatalogFilters } from "~/composables/useCatalogFilters";
import { DECK_CARD_LIMIT } from "#shared/domain/deck";
import ChoiceListbox from "./ChoiceListbox.vue";
import FilterPanel from "./filters/FilterPanel.vue";
import { firstSeriesCards } from '#shared/domain/presentation';
const props = defineProps<{ variant: string }>();
const route = useRoute();
const { mode, filtersOpen, selected, total, count, change, editable } = useShowcase();
const { draft, applied, pending, error, result, chips, apply, clear, pageTo, sortBy, remove, engine } = useCatalogFilters();
const q = computed({ get: () => draft.value.q, set: value => { draft.value.q = value; } });
const version = computed({ get: () => applied.value.version[0] || "", set: value => { draft.value.version = value ? [value] : []; void apply(); } });
const seriesPage = ref(1);
const cardPage = computed({ get: () => result.value.page, set: value => { void pageTo(value); } });
const selectedSeries = computed(() => demoSeries.find(s => s.code === route.query.series));
const seriesView = computed(() => !selectedSeries.value && route.query.view !== "all" && !chips.value.length);
const currentSeries = computed(() => demoSeries.slice((seriesPage.value - 1) * 8, seriesPage.value * 8));
const base = computed(() => "/concepts/" + props.variant + "/cards");
const catalog = useOrbitCatalog();
const seriesCovers = computed(() => firstSeriesCards(catalog.cards.value));
onMounted(() => { void catalog.load(); });
const cards = computed(() => catalog.ready.value ? result.value.cards : []);
const pagedCards = cards;
const sort = computed({ get: () => applied.value.sort, set: value => { void sortBy(value); } });
async function applyPreview() {
  if (await apply() && window.innerWidth < 1000) filtersOpen.value = false;
}
</script>
<template>
  <div class="p-catalog p-section">
    <div class="p-catalog-heading">
      <div>
        <h1>卡牌查询</h1>
      </div>
    </div>
    <div class="p-catalog-search">
      <Search :size="22" /><label class="sr-only" for="prototype-search"
        >搜索卡牌</label
      ><input
        id="prototype-search"
        v-model="q"
        placeholder="卡号、名称或效果，自动搜索"
        maxlength="200"
        @keydown.enter.prevent="applyPreview"
      /><button
        id="prototype-filter-toggle"
        class="p-icon"
        :aria-expanded="filtersOpen"
        aria-label="打开详细筛选"
        @click="filtersOpen = !filtersOpen"
      >
        <SlidersHorizontal :size="21" />
      </button>
    </div>
    <div class="p-catalog-tabs">
      <NuxtLink :to="base" :class="{ active: seriesView }"
        >按系列探索</NuxtLink
      ><NuxtLink :to="`${base}?view=all`" :class="{ active: !seriesView }"
        >全部卡牌</NuxtLink
      ><span>{{ catalog.ready.value ? `完整卡库 · ${catalog.cards.value.length} 张卡牌` : "正在读取完整卡库" }}</span>
    </div>
    <p v-if="catalog.error.value" role="alert">{{ catalog.error.value }} <button @click="catalog.load">重试读取卡库</button></p>
    <p v-if="error && !filtersOpen" role="alert" class="f-error f-main-error">{{ error }}</p>
    <div v-if="chips.length || pending" class="f-applied" aria-label="生效筛选条件">
      <button v-for="chip in chips" :key="chip.key + ':' + chip.value" class="f-chip" :aria-label="'移除 ' + chip.label" @click="remove(chip.key, chip.value)">{{ chip.label }}<X :size="14" /></button>
      <button v-if="chips.length" class="f-clear-text" @click="clear">清空条件</button>
      <span v-if="pending" class="f-help" role="status">正在刷新…</span>
    </div>
    <Transition name="f-window"><FilterPanel v-if="filtersOpen" v-model="draft" :engine="engine" :pending="pending" :error="error" @close="filtersOpen = false" @apply="applyPreview" @clear="clear" /></Transition>
    <div class="p-catalog-body">
      <div class="p-catalog-results">
        <template v-if="seriesView"
          ><div class="p-collection-title">
            <h2>系列一览</h2>
            <span>{{ demoSeries.length }} 个系列分类</span>
          </div>
          <div class="p-series-grid">
            <NuxtLink
              v-for="(series, i) in currentSeries"
              :key="series.code"
              :to="`${base}?series=${encodeURIComponent(series.code)}`"
              class="p-series-cover"
              :style="{ '--tile-index': i }"
              ><div class="p-series-cover-art">
                <img
                  v-if="seriesCovers.get(series.code)"
                  :src="seriesCovers.get(series.code)!.img"
                  :data-card-code="seriesCovers.get(series.code)!.code"
                  alt=""
                  loading="lazy"
                />
              </div>
              <div>
                <h3>{{ series.name }}</h3>
                <span
                  >{{ series.count }} 张收录 ·
                  {{ series.versions.length }} 个版本</span
                ><ArrowUpRight :size="20" /></div
            ></NuxtLink>
          </div>
          <div class="p-pagination">
            <button
              class="p-icon"
              :disabled="seriesPage === 1"
              aria-label="上一页系列"
              @click="seriesPage--"
            >
              <ArrowLeft :size="18" /></button
            ><span
              >{{ seriesPage }}
              <i>/ {{ Math.ceil(demoSeries.length / 8) }}</i></span
            ><button
              class="p-icon"
              :disabled="seriesPage >= Math.ceil(demoSeries.length / 8)"
              aria-label="下一页系列"
              @click="seriesPage++"
            >
              <ArrowRight :size="18" />
            </button></div
        ></template>
        <template v-else
          ><div class="p-collection-title">
            <h2>{{ selectedSeries?.name || "探索全部卡牌" }}</h2>
            <span>{{ result.total }} 张展示卡</span>
            <ChoiceListbox v-model="sort" label="结果排序" hide-label :options="[{value:'code-desc',label:'编号降序'}, {value:'code-asc',label:'编号升序'}, {value:'name',label:'名称排序'}]" />
          </div>
          <div
            v-if="selectedSeries"
            class="p-version-rail"
            aria-label="系列版本"
          >
            <button :class="{ active: !version }" @click="version = ''">
              全部版本</button
            ><button
              v-for="item in selectedSeries.versions"
              :key="item"
              :class="{ active: version === item }"
              @click="version = item"
            >
              {{ item }}
            </button>
          </div>
          <TransitionGroup name="a-card" tag="div" class="p-demo-card-grid">
            <article
              v-for="card in pagedCards"
              :key="card.code"
              class="p-demo-card"
            >
              <button
                class="p-demo-card-art"
                :aria-label="`查看卡牌 ${card.code}`"
                @click="selected = card"
              >
                <img :src="card.img" :alt="card.name" loading="lazy" /><span
                  >探索卡牌 <ArrowUpRight :size="17"
                /></span>
              </button>
              <div class="p-demo-card-meta">
                <span>{{ card.code }}</span
                ><b>{{ card.rarity }}</b>
              </div>
              <h3>{{ card.name }}</h3>
              <div v-if="mode" class="p-stepper">
                <button
                  :aria-label="`减少 ${card.code}`"
                  :disabled="!editable || !count(card.code)"
                  @click="change(card, -1)"
                >
                  <Minus :size="16" /></button
                ><b>{{ count(card.code) || "加入构筑" }}</b
                ><button
                  :aria-label="`增加 ${card.code}`"
                  :disabled="!editable || total >= DECK_CARD_LIMIT"
                  @click="change(card, 1)"
                >
                  <Plus :size="16" />
                </button>
              </div>
            </article>
          </TransitionGroup>
          <div
            v-if="result.pages > 1"
            class="p-pagination"
            aria-label="卡牌分页"
          >
            <button
              class="p-icon"
              :disabled="cardPage === 1"
              aria-label="上一页卡牌"
              @click="cardPage--"
            >
              <ArrowLeft :size="18" />
            </button>
            <span
              >{{ cardPage }} <i>/ {{ result.pages }}</i></span
            >
            <button
              class="p-icon"
              :disabled="cardPage >= result.pages"
              aria-label="下一页卡牌"
              @click="cardPage++"
            >
              <ArrowRight :size="18" />
            </button>
          </div>
          <div v-if="catalog.ready.value && !cards.length" class="p-blank">
            <Search :size="34" />
            <h3>没有符合条件的卡牌</h3>
            <p>可调整条件后重试。</p>
            <button class="p-button" @click="clear">清空筛选</button>
          </div></template
        >
      </div>
    </div>
  </div>
</template>
