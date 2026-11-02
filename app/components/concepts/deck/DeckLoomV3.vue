<script setup lang="ts">
import { Search, X, MoreHorizontal, Check, Layers } from "lucide-vue-next";
import { categoryLabels } from "#shared/domain/catalog";
import { DECK_CARD_LIMIT } from "#shared/domain/deck";
import {
  deckWallCards,
  type DeckWallFilters,
} from "#shared/domain/deck-loom-v3";
import DeckCardTile from "./DeckCardTile.vue";
import DeckSaveDialog from "../library/DeckSaveDialog.vue";
import ChoiceListbox from "../ChoiceListbox.vue";
import "~/assets/css/deck-loom-v3.css";
const {
  entries,
  total,
  change,
  count,
  selected,
  deckName,
  quantities,
  editable,
  storageError,
  catalog,
  resetCurrent,
  saveDraft,
  deckDescription,
  deckCover,
  editingId,
  lastEdit,
  locate,
  notify,
} = useShowcase();
const { decks, save, error: saveError } = usePracticeDecks();
useLoomV2Images();
const root = ref<HTMLElement>();
const searchInput = ref<HTMLInputElement>();
const filters = useState<DeckWallFilters>("v3-wall-filters", () => ({
  q: "",
  category: "",
  attributes: [],
  sort: "default",
}));
const saveOpen = ref(false);
const editing = ref<string | null>(null);
const searchOpen = ref(!!filters.value.q);
const more = ref(false);
const confirmClear = ref(false);
const cancelClear = ref<HTMLButtonElement>();
watch(confirmClear, async (value) => {
  if (value) {
    await nextTick();
    cancelClear.value?.focus({ preventScroll: true });
  }
});
const highlight = ref("");
let highlightTimer: ReturnType<typeof setTimeout> | undefined;
const visibleCards = computed(() =>
  deckWallCards(
    entries.value.map((entry) => entry.card),
    filters.value,
  ),
);
const categories = Object.entries(categoryLabels);
const attributes = ["雪", "月", "花", "宙", "日", "無"];
const activeFilters = computed(
  () =>
    !!filters.value.q ||
    !!filters.value.category ||
    !!filters.value.attributes.length,
);
function resetFilters() {
  filters.value = { ...filters.value, q: "", category: "", attributes: [] };
}
function toggleAttribute(value: string) {
  filters.value.attributes = filters.value.attributes.includes(value)
    ? filters.value.attributes.filter((item) => item !== value)
    : [...filters.value.attributes, value];
}
async function toggleSearch() {
  searchOpen.value = !searchOpen.value;
  if (searchOpen.value) {
    await nextTick();
    searchInput.value?.focus({ preventScroll: true });
  } else filters.value.q = "";
}
function saveCurrent(metadata: {
  name: string;
  description: string;
  cover: string;
}) {
  if (!editable.value) return;
  if (
    save(quantities.value, metadata.name, catalog.cards.value, {
      ...metadata,
      editingId: editingId.value,
      clearDraft: true,
    })
  ) {
    resetCurrent(true);
    saveOpen.value = false;
    notify("卡组保存成功，已开始下一套构筑。");
  } else notify(saveError.value);
}
async function changeTile(card: Parameters<typeof change>[0], delta: number) {
  const order = visibleCards.value;
  const index = order.findIndex((item) => item.code === card.code);
  const removing = delta < 0 && count(card.code) === 1;
  change(card, delta);
  if (removing) {
    editing.value = null;
    await nextTick();
    const next =
      visibleCards.value[Math.min(index, visibleCards.value.length - 1)];
    if (next)
      root.value
        ?.querySelector<HTMLElement>(
          `[data-code="${next.code}"] .v3-count-toggle`,
        )
        ?.focus({ preventScroll: true });
    else
      root.value
        ?.querySelector<HTMLInputElement>("#v3-deck-name")
        ?.focus({ preventScroll: true });
  }
}
function clearDeck() {
  if (resetCurrent()) {
    confirmClear.value = false;
    more.value = false;
    notify("卡组已清空。");
  }
}
watch(lastEdit, (value) => {
  clearTimeout(highlightTimer);
  highlight.value = value?.code ?? "";
  highlightTimer = setTimeout(() => {
    highlight.value = "";
  }, 650);
});
async function locateRequested() {
  const code = locate.value?.code;
  if (!code || !count(code)) return;
  resetFilters();
  editing.value = code;
  await nextTick();
  const tile = root.value?.querySelector<HTMLElement>(`[data-code="${code}"]`);
  tile?.scrollIntoView({ block: "nearest" });
  tile
    ?.querySelector<HTMLButtonElement>(".v3-count-toggle")
    ?.focus({ preventScroll: true });
}
watch(locate, locateRequested);
onMounted(async () => {
  await catalog.load();
  await locateRequested();
});
onBeforeUnmount(() => clearTimeout(highlightTimer));
</script>
<template>
  <section
    ref="root"
    class="v3-workbench"
    aria-label="Deck Loom V3 卡组编辑器"
    :aria-busy="catalog.loading.value"
  >
    <header class="v3-header">
      <div class="v3-title-row">
        <Layers :size="18" /><label class="sr-only" for="v3-deck-name"
          >当前卡组名称</label
        ><input id="v3-deck-name" v-model="deckName" maxlength="100" :disabled="!editable" /><button
          aria-label="卡组更多操作"
          :aria-expanded="more"
          @click="more = !more"
        >
          <MoreHorizontal :size="20" />
        </button>
      </div>
      <p class="v3-total">
        <strong data-testid="prototype-total">{{ total }}</strong> /
        {{ DECK_CARD_LIMIT }} 张 <span>{{ entries.length }} 种</span
        ><span>{{ total === DECK_CARD_LIMIT ? "张数已满" : "构筑中" }}</span>
      </p>
    </header>
    <div class="v3-body">
      <p v-if="catalog.loading.value" role="status">
        正在读取完整卡库，原卡组保留中…
      </p>
      <p v-if="catalog.error.value" class="v3-notice" role="alert">
        {{ catalog.error.value
        }}<button @click="catalog.load">重试读取卡库</button>
      </p>
      <p v-if="storageError" class="v3-notice" role="alert">
        {{ storageError }}请先备份并修复本地记录。
      </p>
      <div v-if="more" class="v3-more">
        <p v-if="saveError" role="alert">{{ saveError }}</p>
        <button
          class="v3-danger"
          :disabled="!editable || !entries.length"
          @click="confirmClear = true"
        >
          清空当前卡组
        </button>
        <div
          v-if="confirmClear"
          role="alertdialog"
          aria-label="确认清空卡组"
          aria-describedby="v3-clear-message"
        >
          <p id="v3-clear-message">清空当前卡组？此操作同时删除当前草稿。</p>
          <button ref="cancelClear" @click="confirmClear = false">
            取消清空</button
          ><button @click="clearDeck">确认清空</button>
        </div>
      </div>
      <div class="v3-toolbar">
        <div class="v3-category" aria-label="卡组类别">
          <button
            :aria-pressed="!filters.category"
            @click="filters.category = ''"
          >
            全部</button
          ><button
            v-for="[value, label] in categories"
            :key="value"
            :aria-pressed="filters.category === value"
            @click="filters.category = value"
          >
            {{ label }}
          </button>
        </div>
        <div class="v3-tools-row">
          <ChoiceListbox
            v-model="filters.sort"
            label="卡组排序"
            hide-label
            :options="[
              { value: 'default', label: '加入顺序' },
              { value: 'code', label: '完整编号' },
              { value: 'cost', label: '费用升序' },
              { value: 'attribute', label: '属性排序' },
              { value: 'category', label: '类别排序' },
            ]"
          /><button
            :aria-expanded="searchOpen"
            aria-label="卡组内搜索"
            @click="toggleSearch"
          >
            <Search :size="18" />
          </button>
        </div>
        <div v-if="searchOpen" class="v3-search">
          <Search :size="16" /><input
            ref="searchInput"
            v-model="filters.q"
            aria-label="搜索当前卡组"
            placeholder="名称或完整编号"
            maxlength="200"
          /><button
            v-if="filters.q"
            aria-label="清空卡组搜索"
            @click="
              filters.q = '';
              searchInput?.focus();
            "
          >
            <X :size="16" />
          </button>
        </div>
        <div class="v3-attributes" aria-label="卡组属性">
          <span>属性</span
          ><button
            v-for="attribute in attributes"
            :key="attribute"
            :aria-pressed="filters.attributes.includes(attribute)"
            @click="toggleAttribute(attribute)"
          >
            {{ attribute === "無" ? "无" : attribute }}
          </button>
        </div>
      </div>
      <div
        v-if="!entries.length && catalog.ready.value && !storageError"
        class="v3-empty"
      >
        <Layers :size="30" />
        <h3>卡组为空</h3>
        <p>在卡查结果中点击 + 加入卡牌。</p>
      </div>
      <div v-else-if="!visibleCards.length && entries.length" class="v3-empty">
        <Search :size="30" />
        <h3>当前条件下没有卡牌</h3>
        <p>卡组仍有 {{ entries.length }} 种卡牌。</p>
        <button @click="resetFilters">清空卡组筛选</button>
      </div>
      <p v-if="activeFilters && visibleCards.length" class="v3-filter-status">
        显示 {{ visibleCards.length }} / {{ entries.length }} 种<button
          @click="resetFilters"
        >
          重置筛选
        </button>
      </p>
      <div class="v3-wall" @click.self="editing = null" data-testid="v3-wall">
        <DeckCardTile
          v-for="card in visibleCards"
          :key="card.code"
          :card="card"
          :count="count(card.code)"
          :total="total"
          :editable="editable"
          :editing="editing === card.code"
          :highlighted="highlight === card.code"
          @edit="editing = $event"
          @change="changeTile"
          @detail="selected = $event"
        />
      </div>
    </div>
    <footer class="v3-footer">
      <p>仅校验张数与完整编号；特殊构筑限制尚未核实。</p>
      <div>
        <button
          class="v3-save-draft"
          :disabled="!editable || !total"
          @click="saveDraft()"
        >
          保存草稿</button
        ><button
          class="v3-save"
          :disabled="!editable || total !== DECK_CARD_LIMIT"
          @click="saveOpen = true"
        >
          <Check :size="16" />保存卡组
        </button>
      </div>
      <small>当前草稿自动保留在本机 · 保存需 {{ DECK_CARD_LIMIT }} 张</small>
    </footer>
    <DeckSaveDialog
      v-model:open="saveOpen"
      :name="deckName"
      :description="deckDescription"
      :cover="deckCover"
      :quantities="quantities"
      :error="saveError"
      @save="saveCurrent"
    />
  </section>
</template>
