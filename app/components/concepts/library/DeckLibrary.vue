<script setup lang="ts">
import {
  emptyDeckSearch,
  deckComposition,
  matchesDeck,
  totalCards,
  type LibraryDeck,
} from "#shared/domain/deck-library";
import DeckSearchBar from "./DeckSearchBar.vue";
import WorkflowDialog from "../WorkflowDialog.vue";
const library = usePracticeDecks(),
  state = useShowcase(),
  route = useRoute();
const filters = useState('library-deck-search', () => emptyDeckSearch());
const deleting = ref<LibraryDeck | null>(null);
const deleteOpen = computed({
  get: () => !!deleting.value,
  set: (v) => {
    if (!v) deleting.value = null;
  },
});
const visible = computed(() =>
  library.decks.value.filter((d) =>
    matchesDeck(
      d,
      filters.value,
      deckComposition(d.quantities, state.catalog.byCode.value),
    ),
  ),
);
const cover = (d: LibraryDeck) =>
  state.catalog.byCode.value.get(d.cover || Object.keys(d.quantities)[0] || "")
    ?.img;
onMounted(() => {
  library.load();
  void state.catalog.load();
  state.panel.value = "none";
});
async function resume() {
  if (!state.editable.value) return;
  state.mode.value = true;
  state.panel.value = "deck";
  await navigateTo(
    library.draft.value?.resume || "/concepts/orbit/cards?view=all",
  );
}
async function create() {
  if (library.draft.value || state.total.value || !state.editable.value) return;
  if (!state.resetCurrent()) return;
  await resume();
}
function remove() {
  if (!deleting.value) return;
  if (deleting.value.id === "draft") {
    if (!state.resetCurrent()) return;
  } else if (!library.remove(deleting.value.id)) return;
  deleting.value = null;
}
</script>
<template>
  <section class="deck-library">
    <div class="p-collection-title">
      <h2>我的收藏与构筑</h2>
      <button
        class="p-button"
        :disabled="
          !!library.draft.value || !!state.total.value || !state.editable.value
        "
        @click="create"
      >
        新建卡组
      </button>
    </div>
    <p v-if="library.error.value" role="alert">{{ library.error.value }}</p>
    <p v-if="state.catalog.error.value" role="alert">{{ state.catalog.error.value }} <button @click="state.catalog.load">重试恢复</button></p>
    <p v-else-if="library.draft.value && !state.catalog.ready.value" role="status">正在恢复草稿，请稍候…</p>
    <article v-if="library.draft.value" class="library-draft">
      <button class="library-cover" :disabled="!state.editable.value" @click="resume">
        <img
          v-if="cover(library.draft.value)"
          :src="cover(library.draft.value)"
          alt=""
        /><strong class="draft-label">待编辑</strong
        ><span
          >{{ library.draft.value.name }} ·
          {{ totalCards(library.draft.value.quantities) }} / 60 张</span
        ></button
      ><button class="p-text-link" @click="deleting = library.draft.value">
        删除草稿
      </button>
    </article>
    <DeckSearchBar v-model="filters" />
    <div class="library-grid">
      <article v-for="deck in visible" :key="deck.id">
        <NuxtLink
          class="library-cover"
          :to="`/concepts/orbit/deck?deck=${encodeURIComponent(deck.id)}`"
          ><img v-if="cover(deck)" :src="cover(deck)" alt="" />
          <div>
            <small>{{ deck.example ? "样例" : "已保存" }} · 60 张</small>
            <h3>{{ deck.name }}</h3>
            <p>{{ deck.description }}</p>
            <b>查看卡组 →</b>
          </div></NuxtLink
        ><button
          v-if="!deck.example"
          class="p-text-link"
          :aria-label="`删除 ${deck.name}`"
          @click="deleting = deck"
        >
          删除卡组
        </button>
      </article>
    </div>
    <p v-if="!visible.length">没有符合条件的卡组。</p>
    <WorkflowDialog
      v-model:open="deleteOpen"
      title="删除卡组"
      description="删除后无法恢复。"
      ><p>{{ deleting?.name }}</p>
      <button class="p-button" @click="remove">确认删除</button></WorkflowDialog
    >
  </section>
</template>
