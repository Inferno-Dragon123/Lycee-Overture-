<script setup lang="ts">
import { demoSeries } from "~/composables/useShowcase";
import { categoryLabels } from "#shared/domain/catalog";
import {
  validateLibraryDeck,
  type LibraryDeck,
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
const router = useRouter();
const returnTo = computed(() => deckReturnPath(route.query.from, !!route.query.publication));
const returnLabel = computed(() => returnTo.value.startsWith('/concepts/orbit/community') ? '← 返回卡组社区' : '← 我的卡组');
function returnToSource(event: MouseEvent) {
  if (!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) {
    event.preventDefault();
    if (window.history.state?.back === returnTo.value) router.back();
    else void navigateTo(returnTo.value);
  }
}
const transfer = useState<LibraryDeck | null>("workflow-tool-deck", () => null);
const publicationInfo = ref<{ id: string; version: number } | null>(null);
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
      if (d.canEdit && route.query.legacy !== "1")
        publicationInfo.value = {
          id: String(d.id),
          version: Number(d.version),
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
  if (!deck.value || publishBusy.value) return;
  publishBusy.value = true;
  error.value = "";
  try {
    await $fetch("/api/workflow/community", {
      method: publicationInfo.value ? "PATCH" : "POST",
      body: {
        ...meta,
        cards: deck.value.quantities,
        ...(publicationInfo.value
          ? { ...publicationInfo.value, action: "edit" }
          : {}),
      },
    });
    if (publicationInfo.value) publicationInfo.value.version++;
    if (imported.value) imported.value = { ...imported.value, ...meta };
    publish.value = false;
    state.notify(publicationInfo.value ? "发布信息已更新。" : "卡组发布成功。");
  } catch (e) {
    error.value =
      (e as { data?: { message: string } }).data?.message ||
      "发布失败，请先登录并检查服务连接。";
  } finally {
    publishBusy.value = false;
  }
}
function add() {
  if (
    deck.value &&
    library.save(
      deck.value.quantities,
      deck.value.name,
      state.catalog.cards.value,
      { description: deck.value.description, cover: deck.value.cover },
    )
  )
    state.notify("已添加到我的卡组。");
  else error.value = library.error.value;
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
      <p class="deck-full-description">{{ deck.description }}</p>
      <div class="deck-detail-actions">
        <OrbitButton :variant="imported ? 'outline' : 'default'" :tone="imported ? 'neutral' : 'brand'" @click="state.editSaved(deck)">
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
        ><OrbitButton variant="outline" tone="neutral" @click="publish = true">
          {{ publicationInfo ? "修改发布信息" : "发布到卡组社区" }}
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
        v-model:open="publish"
        :title="publicationInfo ? '修改发布信息' : '发布到卡组社区'"
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
