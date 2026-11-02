<script setup lang="ts">
import {
  makeTts,
  defaultPrintSettings,
  printLayout,
  officialBack,
  printCards,
  type PrintSettings,
} from "#shared/domain/exports";
import { totalCards, type LibraryDeck } from "#shared/domain/deck-library";
import type { Card } from "#shared/domain/catalog";
import {
  renderPrint,
  downloadPdf,
  downloadText,
  type RenderedPages,
} from "~/utils/print-renderer";
import ChoiceListbox from "./ChoiceListbox.vue";
import WorkflowDialog from "./WorkflowDialog.vue";
import CardSearch from "./CardSearch.vue";
const state = useShowcase(),
  library = usePracticeDecks(),
  route = useRoute(),
  account = useWorkflowAccount();
const transfer = useState<LibraryDeck | null>("workflow-tool-deck", () => null);
const active = ref(
  ["tts", "list", "images"].includes(String(route.query.tool))
    ? String(route.query.tool)
    : "tts",
);
const source = ref(transfer.value ? "imported" : ""),
  name = ref(transfer.value?.name || "我的卡组"),
  back = ref(officialBack),
  json = ref(""),
  error = ref(""),
  busy = ref(false),
  picker = ref(false),
  pages = ref<RenderedPages | null>(null),
  previewPage = ref(0),
  custom = ref<Record<string, number>>({});
const settings = ref<PrintSettings>({ ...defaultPrintSettings });
const backs = ref<{ id: string; url: string }[]>([]);
const sourceOptions = computed(() => [
  { value: "", label: "请选择卡组" },
  { value: "current", label: `当前构筑 · ${state.total.value} 张` },
  ...(transfer.value
    ? [{ value: "imported", label: `已导入 · ${transfer.value.name}` }]
    : []),
  ...library.decks.value.map((d) => ({ value: d.id, label: d.name })),
  ...(active.value === "images"
    ? [{ value: "custom", label: "自定义选择卡牌和数量" }]
    : []),
]);
const quantities = computed(() =>
  source.value === "custom"
    ? custom.value
    : source.value === "current"
      ? state.quantities.value
      : source.value === "imported"
        ? transfer.value?.quantities || {}
        : library.decks.value.find((d) => d.id === source.value)?.quantities ||
          {},
);
const count = computed(() => totalCards(quantities.value));
const layout = computed(() => {
  try {
    return printLayout(settings.value);
  } catch {
    return null;
  }
});
let renderId = 0,
  controller: AbortController | undefined,
  timer: ReturnType<typeof setTimeout> | undefined;
async function regenerate() {
  const id = ++renderId;
  controller?.abort();
  controller = new AbortController();
  error.value = "";
  pages.value = null;
  previewPage.value = 0;
  if (active.value === "tts") {
    try {
      json.value = JSON.stringify(
        makeTts(
          name.value,
          quantities.value,
          state.catalog.byCode.value,
          back.value,
        ),
        null,
        2,
      );
    } catch (e) {
      error.value = (e as Error).message;
    }
    busy.value = false;
    return;
  }
  busy.value = true;
  try {
    const result = await renderPrint(
      name.value,
      quantities.value,
      state.catalog.byCode.value,
      settings.value,
      active.value === "list",
      controller.signal,
    );
    if (id === renderId) {
      pages.value = result;
      if (result.missing.length)
        error.value = `${result.missing.length} 种卡图读取失败，请重试后导出：${result.missing.join("、")}`;
    }
  } catch (e) {
    if (id === renderId) error.value = (e as Error).message;
  } finally {
    if (id === renderId) busy.value = false;
  }
}
watch(
  [active, source, name, back, quantities, settings],
  () => {
    clearTimeout(timer);
    renderId++;
    controller?.abort();
    pages.value = null;
    busy.value = true;
    timer = setTimeout(regenerate, 250);
  },
  { deep: true },
);
watch(source, (value) => {
  const deck =
    value === "imported"
      ? transfer.value
      : library.decks.value.find((d) => d.id === value);
  if (deck) name.value = deck.name;
  if (value === "custom") picker.value = true;
});
watch(active, (value) => {
  if (value !== "images" && source.value === "custom") source.value = "";
});
onMounted(async () => {
  library.load();
  await state.catalog.load();
  await regenerate();
  await account.refresh();
  if (account.user.value) await loadBacks();
});
onBeforeUnmount(() => {
  clearTimeout(timer);
  controller?.abort();
  renderId++;
});
async function loadBacks() {
  try {
    backs.value = await $fetch<{ id: string; url: string }[]>(
      "/api/workflow/cardbacks",
    );
  } catch (e) {
    error.value = (e as Error).message;
  }
}
function choose(card: Card, delta = 1) {
  const next = { ...custom.value },
    n = (next[card.code] || 0) + delta;
  if (n < 0 || n > 60 || totalCards(next) + delta > 200) return;
  if (n) next[card.code] = n;
  else delete next[card.code];
  custom.value = next;
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  error.value = "";
  try {
    const form = new FormData();
    form.append("image", file);
    await $fetch("/api/workflow/cardbacks", { method: "POST", body: form });
    await loadBacks();
  } catch (e) {
    error.value =
      (e as { data?: { message: string } }).data?.message || "卡背上传失败";
  } finally {
    input.value = "";
  }
}
async function removeBack(id: string) {
  try {
    await $fetch("/api/workflow/cardbacks", {
      method: "DELETE",
      query: { id },
    });
    if (backs.value.find((b) => b.id === id)?.url === back.value)
      back.value = officialBack;
    await loadBacks();
  } catch {
    error.value = "删除卡背失败";
  }
}
async function download() {
  try {
    if (active.value === "tts") {
      const data = JSON.parse(json.value);
      if (
        !Array.isArray(data.ObjectStates) ||
        typeof data.SaveName !== "string"
      )
        throw new Error("请保留 TTS 的 SaveName 与 ObjectStates 字段");
      downloadText(name.value, JSON.stringify(data, null, 2));
    } else if (pages.value && !pages.value.missing.length)
      await downloadPdf(name.value, pages.value);
  } catch (e) {
    error.value = (e as Error).message;
  }
}
const dimensions: [keyof PrintSettings, string][] = [
  ["pageWidth", "纸张宽度"],
  ["pageHeight", "纸张高度"],
  ["cardWidth", "卡牌宽度"],
  ["cardHeight", "卡牌高度"],
  ["margin", "页边距"],
  ["gap", "卡牌间距"],
];
</script>
<template>
  <section class="tool-workbench">
    <div class="p-tool-tabs">
      <button
        v-for="t in [
          { id: 'tts', label: 'TTS 生成' },
          { id: 'list', label: '生成卡表' },
          { id: 'images', label: '打印卡图 PDF' },
        ]"
        :key="t.id"
        :class="{ active: active === t.id }"
        @click="active = t.id"
      >
        {{ t.label }}
      </button>
    </div>
    <div class="tool-workflow-layout">
      <div class="tool-live-preview">
        <label v-if="active === 'tts'" class="tts-editor"
          >TTS JSON<textarea
            v-model="json"
            spellcheck="false"
            aria-label="TTS JSON 内容"
          /></label
        ><template v-else
          ><p v-if="busy" role="status">正在生成预览…</p>
          <img
            v-if="pages?.images[previewPage]"
            :src="pages.images[previewPage]"
            :alt="active === 'list' ? '生成的卡表预览' : '打印卡图排版预览'"
          />
          <nav v-if="pages" class="p-pagination">
            <button :disabled="previewPage === 0" @click="previewPage--">
              上一张预览</button
            ><span>{{ previewPage + 1 }} / {{ pages.images.length }}</span
            ><button
              :disabled="previewPage >= pages.images.length - 1"
              @click="previewPage++"
            >
              下一张预览
            </button>
          </nav></template
        >
      </div>
      <div class="tool-options workflow-form">
        <ChoiceListbox
          v-model="source"
          label="卡组来源"
          :options="sourceOptions"
        /><label>卡组名称<input v-model="name" maxlength="80" /></label>
        <p>{{ count }} 张</p>
        <template v-if="active === 'tts'"
          ><ChoiceListbox
            v-model="back"
            label="卡背"
            :options="[
              { value: officialBack, label: '官方卡背' },
              ...backs.map((b, i) => ({
                value: b.url,
                label: `自定义卡背 ${i + 1}`,
              })),
            ]"
          /><label
            >上传自定义卡背<input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              :disabled="!account.user.value || backs.length >= 3"
              @change="upload"
          /></label>
          <p class="p-muted">
            注册并登录后可上传，最多 3 张。{{
              account.user.value ? "" : "请先在账号管理登录。"
            }}
          </p>
          <button v-for="(b, i) in backs" :key="b.id" @click="removeBack(b.id)">
            删除自定义卡背 {{ i + 1 }}
          </button></template
        ><template v-if="active === 'images'"
          ><button
            v-if="source === 'custom'"
            class="p-button"
            @click="picker = true"
          >
            选择打印卡牌
          </button>
          <div class="print-dimensions">
            <label v-for="[key, label] in dimensions" :key="key"
              >{{ label }}（mm）<input
                v-model.number="settings[key]"
                type="number"
                min="0"
                max="420"
                step="0.1"
            /></label>
          </div>
          <button @click="settings = { ...defaultPrintSettings }">
            恢复 A4 默认参数
          </button>
          <p v-if="layout">
            每页 {{ layout.perPage }} 张 · {{ layout.columns }} 列 ×
            {{ layout.rows }} 行
          </p>
          <p class="p-muted">
            默认 A4 · 63×88 mm · 页边距 7 mm · 间距 1 mm · 每页 9
            张。打印请选择实际大小 / 100%。
          </p></template
        >
        <p v-if="error" role="alert">{{ error }}</p>
        <button v-if="error" @click="regenerate">重试生成</button
        ><button
          class="p-button"
          :disabled="
            busy ||
            !count ||
            (active !== 'tts' && (!pages || !!pages.missing.length))
          "
          @click="download"
        >
          {{ active === "tts" ? "下载 TTS JSON" : "下载 PDF" }}
        </button>
      </div>
    </div>
    <WorkflowDialog
      v-model:open="picker"
      title="选择打印卡牌"
      description="与卡查使用相同的详细筛选。每种最多 60 张，每次最多 200 张。"
      wide
      ><CardSearch @choose="choose"
        ><template #actions="{ card }"
          ><div class="p-stepper">
            <button
              :aria-label="`减少打印 ${card.code}`"
              :disabled="!custom[card.code]"
              @click="choose(card, -1)"
            >
              −</button
            ><b>{{ custom[card.code] || 0 }}</b
            ><button
              :aria-label="`增加打印 ${card.code}`"
              :disabled="
                (custom[card.code] || 0) >= 60 || totalCards(custom) >= 200
              "
              @click="choose(card)"
            >
              +
            </button>
          </div></template
        ></CardSearch
      ><button class="p-button" @click="picker = false">
        完成选择（{{ totalCards(custom) }} 张）
      </button></WorkflowDialog
    >
  </section>
</template>
