<script setup lang="ts">
import {
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  X,
  Layers,
  Grid2X2,
  ChevronRight,
  MonitorDown,
  RotateCcw,
} from "lucide-vue-next";
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "reka-ui";
import {
  categoryLabels,
  type Card,
  type SearchQuery,
  type CatalogFacets,
} from "#shared/domain/catalog";

const route = useRoute();
const router = useRouter();
const { mode, total } = useDeck();
const { engine, enableLocal, search } = useCardSearch();
const { data: facets } = await useFetch<CatalogFacets>("/api/catalog/facets");
const queryKeys = [
  "q",
  "series",
  "version",
  "category",
  "attribute",
  "rarity",
] as const;
const query = computed<SearchQuery>(() => {
  const result: SearchQuery = {
    page: Number(route.query.page) || 1,
    pageSize: 24,
  };
  for (const key of queryKeys)
    result[key] = typeof route.query[key] === "string" ? route.query[key] : "";
  return result;
});
const draft = ref(query.value.q || "");
watch(
  () => query.value.q,
  (value) => {
    draft.value = value || "";
  },
);
const {
  data: results,
  status,
  error,
  refresh,
} = await useAsyncData("card-search", () => search(query.value), {
  watch: [query],
});
const seriesView = computed(
  () =>
    route.query.view !== "cards" &&
    !queryKeys.some((key) => query.value[key]),
);
const filtersOpen = ref(false);
const deckOpen = ref(true);
const mobilePanel = ref<"results" | "filters" | "deck">("results");
watch(mode, (value) => {
  if (value) deckOpen.value = true;
  else if (mobilePanel.value === "deck") mobilePanel.value = "results";
});
const currentSeries = computed(() =>
  facets.value?.series.find((item) => item.name === query.value.series),
);
const selected = ref<Card | null>(null);
const dialogOpen = ref(false);
let trigger: HTMLElement | null = null;
const activeFilters = computed(() =>
  queryKeys
    .filter((key) => query.value[key])
    .map((key) => ({
      key,
      label:
        key === "category"
          ? categoryLabels[query.value[key]!] || query.value[key]
          : query.value[key],
    })),
);

function setQuery(values: Record<string, string | number | undefined>) {
  return router.push({
    path: "/cards",
    query: { ...route.query, page: undefined, view: "cards", ...values },
  });
}
function setFilter(key: string, event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  void setQuery({
    [key]: value || undefined,
    ...(key === "series" ? { version: undefined } : {}),
  });
}
function toggleFilters() {
  filtersOpen.value = !filtersOpen.value;
  mobilePanel.value = filtersOpen.value ? "filters" : "results";
}
function toggleDeck() {
  if (window.innerWidth < 1200)
    mobilePanel.value = mobilePanel.value === "deck" ? "results" : "deck";
  else deckOpen.value = !deckOpen.value;
}
function openCard(card: Card, event: MouseEvent) {
  selected.value = card;
  trigger = event.currentTarget as HTMLElement;
  dialogOpen.value = true;
}
function restoreFocus(event: Event) {
  event.preventDefault();
  trigger?.focus();
}
function reset() {
  draft.value = "";
  void router.push("/cards?view=cards");
}
useSeoMeta({ title: "卡牌图鉴 | Lycee Overture 卡查工具箱" });
</script>

<template>
  <main id="main-content" class="catalog-page page-container">
    <div class="page-intro">
      <div>
        <span class="eyebrow">THE CARD ARCHIVE</span>
        <h1>每一张卡，<span>都是新的可能。</span></h1>
        <p>
          跨越作品的相遇，从这里开始。检索卡牌、读懂效果，找到你的构筑灵感。
        </p>
      </div>
      <div class="catalog-stamp">
        <strong>{{ facets?.total.toLocaleString() ?? "—" }}</strong
        ><span>张卡牌 · 中日文对照</span>
      </div>
    </div>
    <form
      class="search-bar"
      role="search"
      @submit.prevent="setQuery({ q: draft.trim() || undefined })"
    >
      <Search :size="22" /><label for="card-query" class="sr-only"
        >搜索卡号、名称或效果</label
      ><input
        id="card-query"
        v-model="draft"
        maxlength="200"
        placeholder="搜索卡号、名称或中日文效果…"
        autocomplete="off"
      /><kbd class="search-hint">试试 6972</kbd
      ><UiButton type="submit">搜索 <ArrowRight /></UiButton>
    </form>
    <div class="catalog-toolbar">
      <div class="view-tabs">
        <button
          :class="{ active: seriesView }"
          @click="
            router.push('/cards');
          "
        >
          <Grid2X2 :size="16" />按系列浏览</button
        ><button
          :class="{ active: !seriesView }"
          @click="setQuery({ view: 'cards' })"
        >
          全部卡牌
        </button>
      </div>
      <div class="toolbar-actions">
        <button
          class="text-link filter-toggle"
          :aria-expanded="filtersOpen"
          @click="toggleFilters"
        >
          <SlidersHorizontal :size="16" />筛选<span
            v-if="activeFilters.length"
            class="filter-count"
            >{{ activeFilters.length }}</span
          ></button
        ><button v-if="mode" class="text-link" @click="toggleDeck">
          <Layers :size="16" />卡组 {{ total }}/60
        </button>
      </div>
    </div>
    <div
      class="mobile-panels"
      :class="{ 'panels-visible': filtersOpen || mode }"
    >
      <button
        :class="{ active: mobilePanel === 'results' }"
        @click="mobilePanel = 'results'"
      >
        卡牌结果</button
      ><button
        v-if="filtersOpen"
        :class="{ active: mobilePanel === 'filters' }"
        @click="mobilePanel = 'filters'"
      >
        筛选条件</button
      ><button
        v-if="mode"
        :class="{ active: mobilePanel === 'deck' }"
        @click="mobilePanel = 'deck'"
      >
        当前卡组 · {{ total }}
      </button>
    </div>
    <div
      class="workspace"
      :class="{
        'has-filters': filtersOpen,
        'has-deck': mode && deckOpen,
        [`mobile-${mobilePanel}`]: true,
      }"
    >
      <aside v-if="filtersOpen" class="filter-panel" aria-label="筛选条件">
        <div class="panel-title">
          <span><SlidersHorizontal :size="17" />筛选条件</span
          ><button
            class="icon-button"
            aria-label="关闭筛选"
            @click="
              filtersOpen = false;
              mobilePanel = 'results';
            "
          >
            <X :size="16" />
          </button>
        </div>
        <label for="series-filter">系列简称</label
        ><select
          id="series-filter"
          :value="query.series"
          @change="setFilter('series', $event)"
        >
          <option value="">全部系列</option>
          <option
            v-for="series in facets?.series"
            :key="series.name"
            :value="series.name"
          >
            {{ series.name }}（{{ series.count }}）
          </option>
        </select>
        <label for="version-filter">收录版本</label
        ><select
          id="version-filter"
          :value="query.version"
          :disabled="!currentSeries"
          @change="setFilter('version', $event)"
        >
          <option value="">
            {{ currentSeries ? "全部版本" : "请先选择系列" }}
          </option>
          <option
            v-for="version in currentSeries?.versions"
            :key="version"
            :value="version"
          >
            {{ version }}
          </option>
        </select>
        <label for="category-filter">卡牌类型</label
        ><select
          id="category-filter"
          :value="query.category"
          @change="setFilter('category', $event)"
        >
          <option value="">全部类型</option>
          <option
            v-for="category in facets?.categories"
            :key="category"
            :value="category"
          >
            {{ categoryLabels[category] || category }}
          </option>
        </select>
        <label for="attribute-filter">属性</label
        ><select
          id="attribute-filter"
          :value="query.attribute"
          @change="setFilter('attribute', $event)"
        >
          <option value="">全部属性</option>
          <option
            v-for="attribute in facets?.attributes"
            :key="attribute"
            :value="attribute"
          >
            {{ attribute }}
          </option>
        </select>
        <label for="rarity-filter">稀有度</label
        ><select
          id="rarity-filter"
          :value="query.rarity"
          @change="setFilter('rarity', $event)"
        >
          <option value="">全部稀有度</option>
          <option
            v-for="rarity in facets?.rarities"
            :key="rarity"
            :value="rarity"
          >
            {{ rarity }}
          </option>
        </select>
        <UiButton variant="outline" class="mt-6 w-full" @click="reset"
          ><RotateCcw />重置条件</UiButton
        >
        <div class="filter-note">
          <span>搜索小提示</span>
          <p>数字卡号与完整卡号均可查询。效果支持中文与日文原文。</p>
          <p>当前为基础筛选预览，数值与基本能力筛选将在后续补齐。</p>
        </div>
      </aside>
      <section
        class="results-panel"
        :aria-busy="status === 'pending'"
        aria-label="卡牌结果"
      >
        <template v-if="seriesView">
          <div class="result-heading">
            <h2>寻找你喜欢的作品</h2>
            <span>{{ facets?.series.length }} 个系列分类</span>
          </div>
          <div class="series-grid">
            <button
              v-for="(series, index) in facets?.series"
              :key="series.name"
              class="series-tile"
              :style="{ '--series-hue': String((index * 47 + 215) % 360) }"
              @click="setQuery({ series: series.name })"
            >
              <span class="series-tile-copy"
                ><span class="series-label">系列简称</span
                ><strong>{{ series.name }}</strong
                ><span
                  >{{ series.count }} 张卡牌 ·
                  {{ series.versions.length }} 个版本</span
                ><span class="series-explore"
                  >浏览卡牌 <ArrowUpRight :size="17" /></span
              ></span>
              <div class="series-art">
                <CardImage
                  :src="series.image"
                  :name="`${series.name} 系列代表卡图`"
                />
              </div>
            </button>
          </div>
        </template>
        <template v-else>
          <div class="result-heading">
            <h2>
              {{ query.series || "全部卡牌" }}
              <ChevronRight v-if="query.series" :size="15" /><span
                v-if="query.version"
                class="version-heading"
                >{{ query.version }}</span
              >
            </h2>
            <span role="status" data-testid="result-total"
              >{{ results?.total.toLocaleString() ?? "—" }} 个结果</span
            >
          </div>
          <div v-if="activeFilters.length" class="active-filters">
            <button
              v-for="filter in activeFilters"
              :key="filter.key"
              :aria-label="`移除条件 ${filter.label}`"
              @click="
                setQuery({
                  [filter.key]: undefined,
                  ...(filter.key === 'series' ? { version: undefined } : {}),
                })
              "
            >
              {{ filter.label }}<X :size="12" /></button
            ><button class="clear-filters" @click="reset">清空</button>
          </div>
          <div v-if="error" class="empty-results" role="alert">
            <h3>卡库暂时未能加载</h3>
            <p>保留了你的筛选条件，请稍后重试。</p>
            <UiButton @click="refresh()">重试</UiButton>
          </div>
          <div v-else-if="!results?.total" class="empty-results">
            <Search :size="32" />
            <h3>暂时没有找到这张卡</h3>
            <p>试试更短的关键词，或清除一项筛选条件。</p>
            <UiButton variant="outline" @click="reset">清空筛选</UiButton>
          </div>
          <div
            v-else
            class="card-grid"
            :class="{ 'is-loading': status === 'pending' }"
          >
            <article
              v-for="card in results.cards"
              :key="card.code"
              class="catalog-card"
              :data-code="card.code"
            >
              <button
                class="card-art-button"
                :aria-label="`查看 ${card.code} ${card.name}`"
                @click="openCard(card, $event)"
              >
                <CardImage :src="card.img" :name="card.name" /><span
                  class="card-peek"
                  >查看详情 <ArrowUpRight :size="14"
                /></span>
              </button>
              <div class="card-meta">
                <span>{{ card.code }}</span
                ><span :class="['rarity', `rarity-${card.rarity}`]">{{
                  card.rarity
                }}</span>
              </div>
              <NuxtLink :to="`/cards/${card.code}`" class="card-name">{{
                card.name
              }}</NuxtLink>
              <div class="card-subtitle">
                <span
                  >{{ card.attribute || "—" }} ·
                  {{ categoryLabels[card.category] || card.category }}</span
                ><span>{{ card.brand }}</span>
              </div>
              <QuantityControl v-if="mode" :card="card" />
            </article>
          </div>
          <div v-if="results && results.pages > 1 && !error" class="pagination">
            <UiButton
              variant="outline"
              :disabled="results.page <= 1 || status === 'pending'"
              aria-label="上一页"
              @click="setQuery({ page: results.page - 1 })"
              ><ArrowLeft /></UiButton
            ><span>第 {{ results.page }} / {{ results.pages }} 页</span
            ><UiButton
              variant="outline"
              :disabled="results.page >= results.pages || status === 'pending'"
              aria-label="下一页"
              @click="setQuery({ page: results.page + 1 })"
              ><ArrowRight
            /></UiButton>
          </div>
        </template>
        <div class="search-engine">
          <span
            class="engine-dot"
            :class="{ local: engine === 'local' }"
          /><span role="status">{{
            {
              server: "在线搜索可用",
              loading: "正在准备本地搜索…",
              local: "本地搜索已就绪",
              fallback: "本地搜索未就绪，已使用在线搜索",
            }[engine]
          }}</span
          ><button
            v-if="engine === 'server' || engine === 'fallback'"
            class="text-link"
            @click="enableLocal"
          >
            <MonitorDown :size="14" />启用本地搜索</button
          ><small v-if="engine === 'server'"
            >将下载完整卡库，适合连续查卡</small
          >
        </div>
      </section>
      <aside v-if="mode && deckOpen" class="deck-aside"><DeckPanel /></aside>
    </div>
    <DialogRoot v-model:open="dialogOpen"
      ><DialogPortal
        ><DialogOverlay class="dialog-overlay" /><DialogContent
          class="dialog-content"
          @close-auto-focus="restoreFocus"
          ><DialogTitle class="sr-only">{{ selected?.name }}</DialogTitle
          ><DialogDescription class="sr-only"
            >卡牌中日文效果与组卡操作</DialogDescription
          ><DialogClose class="dialog-close icon-button" aria-label="关闭详情"
            ><X :size="21" /></DialogClose
          ><CardDetail v-if="selected" :card="selected" /><NuxtLink
            v-if="selected"
            class="text-link detail-permalink"
            :to="`/cards/${selected.code}`"
            @click="dialogOpen = false"
            >打开独立详情页
            <ArrowUpRight :size="15" /></NuxtLink></DialogContent></DialogPortal
    ></DialogRoot>
  </main>
</template>
