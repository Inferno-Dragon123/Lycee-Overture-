<script setup lang="ts">
import {
  emptyDeckSearch,
  deckComposition,
  matchesDeck,
  totalCards,
  type LibraryDeck,
  deckCoverUrl,
} from "#shared/domain/deck-library";
import DeckSearchBar from "./DeckSearchBar.vue";
import WorkflowDialog from "../WorkflowDialog.vue";
import OrbitButton from "../OrbitButton.vue";
import { Trash2 } from "lucide-vue-next";
const library = usePracticeDecks(),
  state = useShowcase(),
  route = useRoute();
const filters = useState('library-deck-search', () => emptyDeckSearch());
const root = ref<HTMLElement>();
const createReason = computed(() => library.draft.value || state.total.value ? '请先保存或删除当前草稿，再新建卡组。' : !state.editable.value ? '卡库或个人卡组尚未恢复，请等待恢复完成。' : '');
const deleting = ref<LibraryDeck | null>(null);
const deleteKind = computed(() => deleting.value?.id === "draft" ? "草稿" : "卡组");
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
  deckCoverUrl(d, state.catalog.byCode.value);
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
async function remove() {
  if (!deleting.value) return;
  if (deleting.value.id === "draft") {
    if (!state.resetCurrent()) return;
  } else if (!library.remove(deleting.value.id)) return;
  deleting.value = null;
  await nextTick();
  root.value?.querySelector<HTMLElement>('.p-collection-title button:not(:disabled), .library-cover:not(:disabled)')?.focus();
}
</script>
<template>
  <section ref="root" class="deck-library">
    <div class="p-collection-title">
      <h1>我的卡组</h1>
      <OrbitButton
        :disabled="
          !!library.draft.value || !!state.total.value || !state.editable.value
        "
        :aria-describedby="createReason ? 'library-create-reason' : undefined"
        @click="create"
      >
        新建卡组
      </OrbitButton>
    </div>
    <p v-if="createReason" id="library-create-reason" class="p-muted">{{ createReason }}</p>
    <p v-if="library.error.value" role="alert">{{ library.error.value }}</p>
    <p v-if="state.catalog.error.value" role="alert">{{ state.catalog.error.value }} <button @click="state.catalog.load">重试恢复</button></p>
    <p v-else-if="library.draft.value && !state.catalog.ready.value" role="status">正在恢复草稿，请稍候…</p>
    <article v-if="library.draft.value" class="library-draft library-entry">
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
      ><div class="library-card-actions"><OrbitButton variant="ghost" tone="danger" @click="deleting = library.draft.value">
        <Trash2 aria-hidden="true" />删除草稿
      </OrbitButton></div>
    </article>
    <DeckSearchBar v-model="filters" />
    <div class="library-grid">
      <article v-for="deck in visible" :key="deck.id" class="library-entry">
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
        ><div v-if="!deck.example" class="library-card-actions"><OrbitButton
          variant="ghost" tone="danger"
          :aria-label="`删除 ${deck.name}`"
          @click="deleting = deck"
        >
          <Trash2 aria-hidden="true" />删除卡组
        </OrbitButton></div>
      </article>
    </div>
    <p v-if="!visible.length">没有符合条件的卡组。</p>
    <WorkflowDialog
      v-model:open="deleteOpen"
      :title="`删除${deleteKind}`"
      :description="deleteKind === '草稿' ? '将清空当前草稿和编辑内容，删除后无法恢复。' : '将删除这份私人卡组；同步成功后关联的社区发布也会删除，删除后无法恢复。'"
      ><p class="delete-object-name">{{ deleting?.name }}</p>
      <p v-if="library.error.value" role="alert">{{ library.error.value }}</p>
      <template #footer><OrbitButton variant="outline" tone="neutral" @click="deleteOpen = false">取消</OrbitButton><OrbitButton tone="danger" @click="remove"><Trash2 aria-hidden="true" />确认删除{{ deleteKind }}</OrbitButton></template></WorkflowDialog
    >
  </section>
</template>
