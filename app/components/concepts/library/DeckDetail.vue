<script setup lang="ts">
import { demoSeries } from "~/composables/useShowcase";
import { categoryLabels } from "#shared/domain/catalog";
import {
  validateLibraryDeck,
  type LibraryDeck,
  isCustomDeckCover,
  deckCoverUrl,
} from "#shared/domain/deck-library";
import {
  deckWallCards,
  type DeckWallFilters,
} from "#shared/domain/deck-loom-v3";
import ChoiceListbox from "../ChoiceListbox.vue";
import DeckSaveDialog from "./DeckSaveDialog.vue";
import OrbitButton from "../OrbitButton.vue";
import { deckReturnPath } from '#shared/domain/presentation';
const route = useRoute(),
  library = usePracticeDecks(),
  state = useShowcase();
const account = useWorkflowAccount(), cloud = usePersonalCloud();
const router = useRouter();
const returnTo = computed(() => deckReturnPath(route.query.from, !!route.query.publication));
const returnLabel = computed(() => returnTo.value.startsWith('/concepts/orbit/community') ? '← 返回卡组社区' : '← 我的卡组');
const canPublish = computed(() => !route.query.publication && !imported.value && !deck.value?.example && !returnTo.value.startsWith('/concepts/orbit/community'));
const canEdit = computed(() => !imported.value || (!!account.user.value && !!publicationInfo.value?.sourceDeckId));
function returnToSource(event: MouseEvent) {
  if (!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) {
    event.preventDefault();
    if (window.history.state?.back === returnTo.value) router.back();
    else void navigateTo(returnTo.value);
  }
}
const transfer = useState<LibraryDeck | null>("workflow-tool-deck", () => null);
const publicationInfo = ref<{ id: string; version: number; sourceDeckId: string } | null>(null);
const imported = ref<LibraryDeck | null>(null),
  error = ref(""),
  share = ref(""),
  publish = ref(false),
  publishBusy = ref(false);
const deck = computed(
  () =>
    imported.value ||
    library.decks.value.find((d) => d.id === route.query.deck),
);
const group = ref("category"),
  tool = ref("tts");
const filters = ref<DeckWallFilters>({
  q: "",
  category: "",
  attributes: [],
  sort: "default",
});
const groups = computed(() => {
  const rows = deckWallCards(
    Object.keys(deck.value?.quantities || {}).flatMap((code) =>
      state.catalog.byCode.value.get(code)
        ? [state.catalog.byCode.value.get(code)!]
        : [],
    ),
    filters.value,
  );
  const map = new Map<string, typeof rows>();
  for (const c of rows) {
    const key =
      group.value === "category"
        ? categoryLabels[c.category] || c.category
        : group.value === "brand"
          ? demoSeries.find((s) => s.code === c.brand)?.name || c.brand
          : group.value === "cost"
            ? `${c.costTotal ?? "未知"} 费`
            : c.attribute;
    map.set(key, [...(map.get(key) || []), c]);
  }
  return [...map].sort(([a], [b]) =>
    group.value === "cost"
      ? a.localeCompare(b, "zh", { numeric: true })
      : group.value === "category"
        ? Object.values(categoryLabels).indexOf(a) -
          Object.values(categoryLabels).indexOf(b)
        : a.localeCompare(b, "zh"),
  );
});
onMounted(async () => {
  library.load();
  state.panel.value = "none";
  await state.catalog.load();
  await account.refresh();
  if (route.query.deck && account.user.value) {
    try {
      publicationInfo.value = await $fetch<{ id: string; version: number; sourceDeckId: string } | null>('/api/workflow/community', { query: { sourceDeckId: String(route.query.deck) } });
    } catch { error.value = '发布记录暂时无法读取，私人卡组仍可查看。'; }
  }
  if (route.query.snapshot) {
    try {
      const d=await $fetch<Record<string,unknown>>('/api/workflow/legacy-snapshot',{query:{id:String(route.query.snapshot)}});
      imported.value=validateLibraryDeck(d,true);
    }catch{error.value='无法打开旧卡组快照，或原记录超出二代构筑限制。原始数据已保留。';}
  }
  if (route.query.publication) {
    try {
      const d = await $fetch<Record<string, unknown>>(
        route.query.legacy === "1"
          ? "/api/workflow/legacy"
          : "/api/workflow/community",
        { query: { id: String(route.query.publication) } },
      );
      imported.value = validateLibraryDeck(
        { ...d, quantities: d.quantities || d.cards },
        true,
      );
      if (d.canEdit && typeof d.sourceDeckId === 'string' && route.query.legacy !== "1")
        publicationInfo.value = {
          id: String(d.id),
          version: Number(d.version),
          sourceDeckId: d.sourceDeckId,
        };
    } catch {
      error.value = "无法读取公开卡组，请稍后重试。";
    }
  }
  if (route.hash.startsWith("#deck=")) {
    try {
      imported.value = validateLibraryDeck(
        JSON.parse(decodeURIComponent(route.hash.slice(6))),
        true,
      );
    } catch {
      error.value = "分享链接中的卡组无效。";
    }
  }
});
async function tools() {
  if (!deck.value) return;
  transfer.value = JSON.parse(JSON.stringify(deck.value));
  await navigateTo(`/concepts/orbit/tools?tool=${tool.value}`);
}
async function hand() {
  if (!deck.value) return;
  transfer.value = deck.value;
  await navigateTo("/concepts/orbit?hand=1");
}
function sharing() {
  if (!deck.value) return;
  share.value = `${location.origin}/concepts/orbit/deck#deck=${encodeURIComponent(JSON.stringify({ ...deck.value, example: undefined }))}`;
  navigator.clipboard
    ?.writeText(share.value)
    .then(() => state.notify("分享链接已复制。"))
    .catch(() => {});
}
async function publication(meta: {
  name: string;
  description: string;
  cover: string;
}) {
  if (!canPublish.value || !deck.value || publishBusy.value) return;
  publishBusy.value = true;
  error.value = "";
  try {
    if (!account.user.value) throw new Error('请先登录后发布卡组。');
    const sourceDeckId = deck.value.id;
    if (!library.save(deck.value.quantities, meta.name, state.catalog.cards.value, { ...meta, editingId: sourceDeckId })) throw new Error(library.error.value);
    if (!await cloud.flush()) throw new Error(cloud.error.value || '私人卡组尚未同步，请同步成功后重试发布。');
    const current = await $fetch<{ id: string; version: number; sourceDeckId: string } | null>('/api/workflow/community', { query: { sourceDeckId } });
    const result = await $fetch<{ id: string; version: number; sourceDeckId: string }>("/api/workflow/community", {
      method: current ? "PATCH" : "POST",
      body: current ? { id: current.id, version: current.version, action: 'publish' }
        : { ...meta, cards: deck.value.quantities, sourceDeckId },
    });
    publicationInfo.value = result;
    publish.value = false;
    state.notify(current ? "社区公开版本已更新。" : "卡组发布成功。");
  } catch (e) {
    error.value =
      (e as { data?: { message: string } }).data?.message ||
      (e as Error).message || "发布失败，请先登录并检查服务连接。";
  } finally {
    publishBusy.value = false;
  }
}
async function add() {
  if (!deck.value) return;
  let cover = deck.value.cover;
  if (isCustomDeckCover(cover) && !publicationInfo.value) {
    if (account.user.value) {
      try {
        const body = new FormData(); body.append('sourceCover', cover);
        cover = (await $fetch<{ url: string }>('/api/workflow/deck-covers', { method: 'POST', body })).url;
      } catch { error.value = '无法保存这张封面，请重试后再添加卡组。'; return; }
    } else cover = undefined;
  }
  if (
    deck.value &&
    library.save(
      deck.value.quantities,
      deck.value.name,
      state.catalog.cards.value,
      { description: deck.value.description, cover },
    )
  )
    state.notify("已添加到我的卡组。");
  else error.value = library.error.value;
}
async function editDeck() {
  if (!canEdit.value || !deck.value) return;
  const original = publicationInfo.value && imported.value ? library.decks.value.find(d => d.id === publicationInfo.value!.sourceDeckId) : deck.value;
  if (!original) { error.value = '请先完成个人卡组同步，再编辑这份私人原件。'; return; }
  await state.editSaved(original);
}
</script>
<template>
  <section class="deck-detail">
    <OrbitButton as-child variant="ghost" tone="neutral"><a :href="returnTo" class="p-text-link" @click="returnToSource"
      >{{ returnLabel }}</a
    ></OrbitButton>
    <p v-if="error" role="alert">{{ error }}</p>
    <template v-if="deck"
      ><h2>{{ deck.name }}</h2>
      <img v-if="isCustomDeckCover(deck.cover)" class="deck-custom-cover" :src="deckCoverUrl(deck, state.catalog.byCode.value)" alt="卡组自定义封面" />
      <p class="deck-full-description">{{ deck.description }}</p>
      <div class="deck-detail-actions">
        <OrbitButton v-if="canEdit" :variant="imported ? 'outline' : 'default'" :tone="imported ? 'neutral' : 'brand'" @click="editDeck">
          编辑该卡组</OrbitButton
        ><OrbitButton variant="outline" tone="neutral" @click="sharing">导出分享链接</OrbitButton
        ><OrbitButton v-if="imported" @click="add">
          添加到我的卡组</OrbitButton
        ><ChoiceListbox
          v-model="tool"
          label="导入工具箱"
          :options="[
            { value: 'tts', label: 'TTS 生成' },
            { value: 'list', label: '生成卡表' },
            { value: 'images', label: '打印卡图 PDF' },
          ]"
        /><OrbitButton variant="outline" tone="neutral" @click="tools">导入并打开工具</OrbitButton
        ><OrbitButton variant="outline" tone="neutral" @click="hand">导入并跳转起手模拟</OrbitButton
        ><OrbitButton v-if="canPublish" variant="outline" tone="neutral" @click="publish = true">
          {{ publicationInfo ? "更新社区公开版本" : "发布到卡组社区" }}
        </OrbitButton>
      </div>
      <label v-if="share" class="workflow-field"
        >分享链接<input
          :value="share"
          readonly
          @focus="($event.target as HTMLInputElement).select()"
      /></label>
      <div class="deck-detail-filters">
        <label
          >搜索卡牌<input
            v-model="filters.q"
            placeholder="名称或完整编号" /></label
        ><ChoiceListbox
          v-model="group"
          label="分类排序"
          :options="[
            { value: 'category', label: '卡牌类型' },
            { value: 'brand', label: '所属系列' },
            { value: 'cost', label: '费用' },
            { value: 'attribute', label: '属性' },
          ]"
        /><ChoiceListbox
          v-model="filters.category"
          label="卡牌类别"
          :options="[
            { value: '', label: '全部类别' },
            ...Object.entries(categoryLabels).map(([value, label]) => ({
              value,
              label,
            })),
          ]"
        />
        <div class="v3-attributes">
          <button
            type="button"
            v-for="a in ['雪', '月', '花', '宙', '日', '無']"
            :key="a"
            :aria-pressed="filters.attributes.includes(a)"
            @click="
              filters.attributes = filters.attributes.includes(a)
                ? filters.attributes.filter((v) => v !== a)
                : [...filters.attributes, a]
            "
          >
            {{ a }}
          </button>
        </div>
      </div>
      <section v-for="[label, cards] in groups" :key="label">
        <h3>{{ label }}</h3>
        <div class="deck-detail-grid">
          <button
            type="button"
            v-for="card in cards"
            :key="card.code"
            @click="state.selected.value = card"
          >
            <img :src="card.img" :alt="card.name" loading="lazy" /><span
              >{{ card.code }} <b>× {{ deck.quantities[card.code] }}</b></span
            >
          </button>
        </div>
      </section>
      <DeckSaveDialog
        v-if="canPublish"
        v-model:open="publish"
        :title="publicationInfo ? '更新社区公开版本' : '发布到卡组社区'"
        :name="deck.name"
        :description="deck.description"
        :cover="deck.cover"
        :quantities="deck.quantities"
        :busy="publishBusy"
        :error="error"
        @save="publication"
    /></template>
    <p v-else>未找到该卡组。</p>
  </section>
</template>
<style scoped>
.deck-custom-cover { display: block; max-width: min(100%, 32rem); max-height: 24rem; object-fit: contain; margin-block: 1rem; border-radius: 12px; }
</style>
