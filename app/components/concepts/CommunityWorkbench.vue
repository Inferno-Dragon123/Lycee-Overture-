<script setup lang="ts">
import { emptyDeckSearch, type LibraryDeck } from "#shared/domain/deck-library";
import DeckSearchBar from "./library/DeckSearchBar.vue";
import ChoiceListbox from "./ChoiceListbox.vue";
import WorkflowDialog from "./WorkflowDialog.vue";
import CardSearch from "./CardSearch.vue";
const state = useShowcase(),
  account = useWorkflowAccount();
const route = useRoute();
const view = useState('community-workbench-view', () => ({ filters: emptyDeckSearch(), source: 'all', page: 1, codes: [] as string[], match: 'all' }));
const { filters, source, page, codes, match } = toRefs(view.value);
const error = ref(""),
  busy = ref(false),
  picker = ref(false);
interface Item extends LibraryDeck {
  author?: string;
  author_name?: string;
  status?: string;
  version?: number;
  cover_code?: string;
  updatedAt?: string;
  legacy?: boolean;
}
const result = useState<{
  items: Item[];
  total: number;
  pages: number;
  page: number;
}>('community-workbench-result', () => ({ items: [], total: 0, pages: 1, page: 1 }));
let requestId = 0,
  timer: ReturnType<typeof setTimeout> | undefined;
async function load() {
  const id = ++requestId;
  busy.value = true;
  error.value = "";
  try {
      const data = await $fetch<{
        items: Item[];
        total: number;
        pages: number;
        page: number;
      }>("/api/workflow/community", {
        query: {
          filters: JSON.stringify(filters.value),
          page: page.value,
          ...(source.value === "mine" ? { mine: "1" } : { source: source.value }),
          ...(codes.value.length
            ? { codes: codes.value.join(","), match: match.value }
            : {}),
        },
      });
      if (id === requestId) result.value = data;
  } catch (e) {
    if (id === requestId)
      error.value =
        (e as { data?: { message: string } }).data?.message ||
        "无法读取社区，请重试。";
  } finally {
    if (id === requestId) busy.value = false;
  }
}
watch(
  [filters, source, codes, match],
  () => {
    page.value = 1;
    clearTimeout(timer);
    timer = setTimeout(load, 220);
  },
  { deep: true },
);
watch(page, () => { clearTimeout(timer); timer = setTimeout(load, 220); });
onMounted(async () => {
  await state.catalog.load();
  await account.refresh();
  await load();
});
onBeforeUnmount(() => {
  clearTimeout(timer);
  requestId++;
});
const cover = (d: Item) =>
  state.catalog.byCode.value.get(
    d.cover || d.cover_code || Object.keys(d.quantities || {})[0] || "",
  )?.img;
async function manage(item: Item, action: string) {
  try {
    await $fetch("/api/workflow/community", {
      method: action === "delete" ? "DELETE" : "PATCH",
      body: { id: item.id, version: item.version, action },
    });
    await load();
  } catch (e) {
    error.value =
      (e as { data?: { message: string } }).data?.message || "操作失败";
  }
}
const deleting = ref<Item | null>(null),
  confirmDelete = computed({
    get: () => !!deleting.value,
    set: (v) => {
      if (!v) deleting.value = null;
    },
  });
</script>
<template>
  <section class="community-workbench">
    <div class="deck-detail-actions">
      <ChoiceListbox
        v-model="source"
        label="卡组来源"
        :options="[
          { value: 'all', label: '全部' },
          { value: 'community', label: '玩家投稿' },
          { value: 'official_tournament', label: '官网赛事' },
          { value: 'official_user', label: '官网玩家' },
          { value: 'mine', label: '我的发布' },
        ]"
      /><button class="p-button" @click="state.utility.value = 'account'">
        {{ account.user.value ? "账号管理" : "登录后发布" }}</button
      ><NuxtLink to="/concepts/orbit/decks" class="p-button"
        >从我的卡组发布</NuxtLink
      >
    </div>
    <DeckSearchBar v-model="filters" />
    <div class="deck-detail-actions">
      <button class="p-button" @click="picker = true">添加卡牌检索条件</button
      ><ChoiceListbox
        v-model="match"
        label="卡牌匹配"
        :options="[
          { value: 'all', label: '全部包含' },
          { value: 'any', label: '任意包含' },
        ]"
      /><button
        v-for="code in codes"
        :key="code"
        @click="codes = codes.filter((c) => c !== code)"
      >
        {{ code }} ×
      </button>
    </div>
    <p v-if="busy" role="status">正在读取卡组…</p>
    <p v-if="error" role="alert">
      {{ error }}<button @click="load">重试</button>
    </p>
    <div class="library-grid">
      <article v-for="deck in result.items" :key="deck.id">
        <NuxtLink
          class="library-cover"
          :to="{ path: '/concepts/orbit/deck', query: { publication: deck.id, ...(deck.legacy ? { legacy: '1' } : {}), from: route.fullPath } }"
          ><img v-if="cover(deck)" :src="cover(deck)" alt="" />
          <div>
            <small>{{ deck.author || deck.author_name || "玩家" }}</small>
            <h3>{{ deck.name }}</h3>
            <p>{{ deck.description }}</p>
            <b>预览卡组 →</b>
          </div></NuxtLink
        >
        <div v-if="source === 'mine'" class="deck-detail-actions">
          <button
            @click="
              manage(deck, deck.status === 'public' ? 'unpublish' : 'publish')
            "
          >
            {{ deck.status === "public" ? "下架" : "重新公开" }}</button
          ><button @click="deleting = deck">删除发布</button>
        </div>
      </article>
    </div>
    <p v-if="!busy && !result.items.length && !error">暂无符合条件的卡组。</p>
    <nav class="p-pagination">
      <button :disabled="page <= 1 || busy" @click="page--">上一页</button
      ><span
        >{{ result.page }} / {{ Math.max(1, result.pages) }} ·
        {{ result.total }} 套</span
      ><button :disabled="page >= result.pages || busy" @click="page++">
        下一页
      </button>
    </nav>
    <WorkflowDialog
      v-model:open="picker"
      title="选择卡组检索卡牌"
      description="最多选择 10 种基础编号。"
      wide
      ><CardSearch
        @choose="
          (card) => {
            const base = card.code.slice(0, 7);
            if (!codes.includes(base) && codes.length < 10) codes.push(base);
          }
        "
        ><template #actions="{ card }"
          ><button
            :disabled="
              codes.includes(card.code.slice(0, 7)) || codes.length >= 10
            "
            @click="codes.push(card.code.slice(0, 7))"
          >
            {{ codes.includes(card.code.slice(0, 7)) ? "已选" : "加入检索" }}
          </button></template
        ></CardSearch
      ></WorkflowDialog
    ><WorkflowDialog
      v-model:open="confirmDelete"
      title="删除发布"
      description="该发布将不再显示，已保存的本地副本不受影响。"
      ><button
        class="p-button"
        @click="
          deleting && manage(deleting, 'delete');
          deleting = null;
        "
      >
        确认删除
      </button></WorkflowDialog
    >
  </section>
</template>
