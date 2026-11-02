<script setup lang="ts">
import {
  ArrowRight,
  ArrowDown,
  Search,
  Layers,
  Library,
  Wrench,
  Users,
  MoreHorizontal,
  Shuffle,
  X,
  Check,
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
import ChoiceListbox from "./ChoiceListbox.vue";
import CardStage from "./CardStage.vue";
import HeroStage from "./HeroStage.vue";
import DemoBackpack from "./DemoBackpack.vue";
import { demoCards, demoSeries, useShowcase } from "~/composables/useShowcase";
import { useCollection } from "~/composables/useCollection";
import { drawHand, expandDeck } from "~/demo/hand";
import type { ShowcaseCard } from "~/demo/collection";
import { chinaDay, firstSeriesCards } from '#shared/domain/presentation';
const { data: dailyWall, refresh: refreshWall } = await useFetch<{ day: string; codes: string[] }>('/api/catalog/daily-wall', { key: 'orbit-daily-wall' });
let wallTimer: ReturnType<typeof setInterval> | undefined;
function checkWallDay() { if (dailyWall.value?.day !== chinaDay()) void refreshWall(); }
onMounted(() => { checkWallDay(); wallTimer = setInterval(checkWallDay, 60000); document.addEventListener('visibilitychange', checkWallDay); });
onBeforeUnmount(() => { clearInterval(wallTimer); document.removeEventListener('visibilitychange', checkWallDay); });
const wallCode = (row: number, index: number) => dailyWall.value?.codes[((row - 1) * 8 + index - 1) % (dailyWall.value?.codes.length || 1)];
const { mode, selected, motion, theme, utility } = useShowcase();
const {
  owned,
  candidates,
  displayCards,
  series,
  rarity,
  totalOwned,
  randomize,
  setDisplay,
  storageError,
} = useCollection();
const root = ref<HTMLElement>();
useCardWave(root);
const picker = ref(false);
const backpack = ref(false);
const selection = ref<string[]>([]);
const { catalog, load } = useDisplayCatalog();
const { decks, error: deckError } = usePracticeDecks();
const { quantities, total } = useShowcase();
const deckId = ref("");
const importedName = ref("");
const originalDeck = ref<ShowcaseCard[]>([]);
const remaining = ref<ShowcaseCard[]>([]);
const handError = ref("");
const result = ref<ShowcaseCard[]>([]);
const pending = ref<ShowcaseCard[]>([]);
const drawing = ref(false);
const drawSequence = ref(0);
const other = ref("");
const gallery = ref<HTMLElement>();
useDragGallery(gallery);
const pickMessage = ref("");
let returningFromBackpack = false;
const drawAmount = ref(1);
const options = computed(() => [
  { value: "", label: "全部系列" },
  ...demoSeries.map((s) => ({ value: s.code, label: s.name })),
]);
const deckOptions = computed(() => [
  { value: "", label: "从我的卡组选择" },
  ...(total.value === 60
    ? [{ value: "current", label: "当前构筑 · 60 张" }]
    : []),
  ...decks.value.map((d) => ({ value: d.id, label: `${d.name} · 60 张` })),
]);
const pickQuery = ref("");
const pickPage = ref(1);
const visibleCandidates = computed(() =>
  candidates.value.filter(
    (c) =>
      !pickQuery.value ||
      `${c.code} ${c.name}`
        .toLowerCase()
        .includes(pickQuery.value.toLowerCase()),
  ),
);
const candidatePages = computed(() =>
  Math.max(1, Math.ceil(visibleCandidates.value.length / 48)),
);
const pagedCandidates = computed(() =>
  visibleCandidates.value.slice((pickPage.value - 1) * 48, pickPage.value * 48),
);
watch([series, rarity, pickQuery], () => {
  pickPage.value = 1;
});
const rarityOptions = computed(() => [
  { value: "", label: "全部稀有度" },
  ...[...new Set(catalog.value.map((c) => c.rarity))]
    .sort()
    .map((value) => ({ value, label: value })),
]);
const featured = computed(() => { const covers = firstSeriesCards(catalog.value); return demoSeries.map(series => ({ ...series, cover: covers.get(series.code)?.img })); });
const reduce = () =>
  !motion.value ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function start() {
  document
    .getElementById("quick-start")
    ?.scrollIntoView({ behavior: reduce() ? "instant" : "smooth" });
}
async function builder() {
  mode.value = true;
  await navigateTo("/concepts/orbit/cards?view=all");
}
function choose(code: string) {
  if (selection.value.includes(code))
    selection.value = selection.value.filter((c) => c !== code);
  else selection.value.push(code);
}
watch(picker, (open) => {
  if (open) {
    if (!returningFromBackpack)
      selection.value = displayCards.value.map((c) => c.code);
    returningFromBackpack = false;
    pickMessage.value = "";
  }
});
async function returnToPicker() {
  returningFromBackpack = true;
  backpack.value = false;
  await nextTick();
  picker.value = true;
}
function random() {
  if (randomize()) {
    selection.value = displayCards.value.map((c) => c.code);
    picker.value = false;
  } else pickMessage.value = "所选范围暂无卡牌，请调整范围或先添加卡牌。";
}
const workflowHand = useState<
  import("#shared/domain/deck-library").LibraryDeck | null
>("workflow-tool-deck", () => null);
const workflowRoute = useRoute();
const handCatalog = useOrbitCatalog();
onMounted(async () => {
  if (workflowRoute.query.hand === "1" && workflowHand.value) {
    await handCatalog.load();
    try {
      originalDeck.value = expandDeck(
        workflowHand.value.quantities,
        handCatalog.cards.value,
      );
      importedName.value = workflowHand.value.name;
      resetHand();
      await nextTick();
      document
        .querySelector(".a-draw-action")
        ?.scrollIntoView({ block: "center" });
    } catch (e) {
      handError.value = (e as Error).message;
    }
  }
});
function importDeck() {
  try {
    const chosen = decks.value.find((d) => d.id === deckId.value);
    const source =
      deckId.value === "current" ? quantities.value : chosen?.quantities;
    if (!source) throw new Error("请先选择卡组。");
    const expanded = expandDeck(source, catalog.value);
    originalDeck.value = expanded;
    importedName.value = deckId.value === "current" ? "当前构筑" : chosen!.name;
    resetHand();
  } catch (e) {
    handError.value = (e as Error).message;
  }
}
function resetHand() {
  if (drawing.value) return;
  remaining.value = [...originalDeck.value];
  pending.value = [];
  result.value = [];
  drawSequence.value = 0;
  handError.value = "";
}
async function draw(amount: number) {
  if (drawing.value) return;
  try {
    const next = drawHand(remaining.value, amount);
    remaining.value = next.remaining;
    drawAmount.value = amount;
    pending.value = next.hand;
    drawing.value = true;
    drawSequence.value++;
    handError.value = "";
  } catch (e) {
    handError.value = (e as Error).message;
  }
}
function reveal() {
  if (!drawing.value) return;
  result.value = [...pending.value];
  drawing.value = false;
}
watch(other, async (value) => {
  if (!value) return;
  other.value = "";
  if (value === "announcements" || value === "account") utility.value = value;
  else await navigateTo(`/concepts/orbit/${value}`);
});
let dispose: () => void = () => {};
onMounted(() => {
  const visibility = () =>
    root.value?.classList.toggle("a-paused", document.hidden);
  document.addEventListener("visibilitychange", visibility);
  visibility();
  dispose = () => document.removeEventListener("visibilitychange", visibility);
});
onBeforeUnmount(() => dispose());
</script>
<template>
  <div ref="root" class="a-home">
    <div class="a-wall" aria-hidden="true" :data-wall-day="dailyWall?.day">
      <div v-for="row in 10" :key="row" class="a-wall-row">
        <div class="a-wall-track">
          <div v-for="copy in 2" :key="copy" class="a-wall-group">
            <img
              v-for="i in 8"
              :key="i"
              :src="wallCode(row, i) ? `/api/cards/${wallCode(row, i)}/thumbnail` : undefined"
              :data-card-code="wallCode(row, i)"
              alt=""
              loading="lazy"
              decoding="async"
              fetchpriority="low"
            />
          </div>
        </div>
      </div>
    </div>
    <section class="a-hero">
      <div class="a-identity">
        <h1 class="max-w-6xl">站名占位符</h1>
        <p>lycee overture卡查工具箱</p>
        <button class="a-start" @click="start">
          开始使用 <ArrowDown :size="19" />
        </button>
      </div>
      <div class="a-display">
        <HeroStage
          :cards="displayCards"
          :blocked="picker || backpack || !!utility || !!selected"
          @settings="picker = true"
        />
      </div>
    </section>
    <section id="quick-start" class="a-quick" aria-label="快速开始">
      <div class="a-draw">
        <h2>起手模拟</h2>
        <div class="a-draw-glow" aria-hidden="true" />
        <CardStage
          kind="draw"
          :cards="pending"
          :sequence="drawSequence"
          :amount="drawAmount"
          @complete="reveal"
        />
        <div class="a-draw-action">
          <div class="a-import-row">
            <ChoiceListbox
              v-model="deckId"
              label="导入卡组"
              hide-label
              :options="deckOptions"
            />
            <button
              class="a-backpack-open"
              :disabled="drawing || !deckId"
              @click="importDeck"
            >
              导入卡组
            </button>
          </div>
          <p v-if="importedName" role="status">
            {{ importedName }} · 剩余 {{ remaining.length }} / 60
          </p>
          <div class="a-draw-buttons">
            <button
              :disabled="drawing || remaining.length < 1"
              @click="draw(1)"
            >
              单抽</button
            ><button
              :disabled="drawing || remaining.length < 7"
              @click="draw(7)"
            >
              抽七 <ArrowRight :size="18" />
            </button>
          </div>
          <div class="a-sim-utilities">
            <button
              class="a-backpack-open"
              :disabled="drawing || !originalDeck.length"
              @click="resetHand"
            >
              重新洗牌
            </button>
          </div>
          <p>从导入的 60 张卡组无放回抽取，不加入背包。</p>
          <p v-if="storageError" role="alert">{{ storageError }}</p>
          <p v-if="handError || deckError" role="alert">
            {{ handError || deckError }}
          </p>
        </div>
      </div>
      <nav class="a-shortcuts" aria-label="快速导航">
        <NuxtLink to="/concepts/orbit/cards" class="a-shortcut a-find"
          ><Search /><span>卡牌查询</span><ArrowRight
        /></NuxtLink>
        <button class="a-shortcut a-build" @click="builder">
          <Layers /><span>组卡模式</span><ArrowRight />
        </button>
        <NuxtLink to="/concepts/orbit/decks" class="a-shortcut a-decks"
          ><Library /><span>我的卡组</span><ArrowRight
        /></NuxtLink>
        <NuxtLink to="/concepts/orbit/tools" class="a-shortcut a-tools"
          ><Wrench /><span>工具箱</span><small>TTS · 卡表 · 卡图 PDF</small
          ><ArrowRight
        /></NuxtLink>
        <NuxtLink to="/concepts/orbit/community" class="a-shortcut a-community"
          ><Users /><span>卡组社区</span><ArrowRight
        /></NuxtLink>
        <div class="a-other">
          <ChoiceListbox
            v-model="other"
            label="其他功能"
            hide-label
            :options="[
              { value: 'groups', label: '玩家社群' },
              { value: 'learn', label: '攻略' },
              { value: 'announcements', label: '公告' },
              { value: 'account', label: '账号管理' },
            ]"
            ><template #button
              ><MoreHorizontal /><span>其他</span
              ><small>社群 · 攻略 · 公告 · 账号</small></template
            ></ChoiceListbox
          >
        </div>
      </nav>
      <Transition name="a-reveal"
        ><section
          v-if="result.length && !drawing"
          :key="drawSequence"
          class="a-draw-results"
          aria-label="本次抽取卡牌"
        >
          <h3>本次抽取</h3>
          <div>
            <button
              v-for="(card, i) in result"
              :key="drawSequence + '-' + i"
              :style="{ '--i': i }"
              data-wave-item
              :aria-label="`起手卡牌 ${i + 1} ${card.code}`"
              @click="selected = card"
            >
              <img class="a-wave-visual" :src="card.img" :alt="card.name" />
            </button>
          </div></section
      ></Transition>
    </section>
    <section class="a-series" aria-label="系列一览">
      <h2>系列一览</h2>
      <div class="a-gallery-wrap">
        <div
          ref="gallery"
          class="a-gallery"
          tabindex="0"
          role="region"
          aria-label="系列画廊，按住鼠标左键拖动，或使用左右方向键"
          @dragstart.prevent
        >
          <div
            v-for="item in featured"
            :key="item.code"
            class="a-series-cell"
            data-wave-item
          >
            <NuxtLink
              :to="`/concepts/orbit/cards?series=${encodeURIComponent(item.code)}`"
              class="a-series-item a-wave-visual"
              draggable="false"
              ><img
                v-if="item.cover"
                :src="item.cover"
                alt=""
                loading="lazy"
                draggable="false"
              />
              <div v-else class="a-series-word" aria-hidden="true" />
              <h3>{{ item.name }}</h3></NuxtLink
            >
          </div>
        </div>
      </div>
    </section>
    <DemoBackpack v-model:open="backpack" @back="returnToPicker" />
    <DialogRoot v-model:open="picker"
      ><DialogPortal
        ><DialogOverlay class="p-dialog-overlay" /><DialogContent
          class="a-picker p-card-modal"
          :class="[
            'concept-orbit',
            { 'a-light': theme === 'light', 'p-motion-off': !motion },
          ]"
          ><DialogTitle>更换展示卡牌</DialogTitle
          ><DialogDescription
            >从背包选择任意范围参与轮播，或随机展示三张；卡牌可从全站卡库免费添加。</DialogDescription
          ><DialogClose class="p-icon p-dialog-close" aria-label="关闭展示设置"
            ><X
          /></DialogClose>
          <div class="a-picker-filters">
            <ChoiceListbox
              v-model="series"
              label="背包系列范围"
              :options="options"
            /><ChoiceListbox
              v-model="rarity"
              label="背包稀有度范围"
              :options="rarityOptions"
            />
          </div>
          <label class="a-picker-search"
            >搜索背包<input v-model="pickQuery" placeholder="卡号或名称"
          /></label>
          <div class="a-picker-actions">
            <button
              class="p-button p-button-quiet"
              @click="
                selection = [
                  ...new Set([
                    ...selection,
                    ...visibleCandidates.map((c) => c.code),
                  ]),
                ]
              "
            >
              全选当前范围</button
            ><button class="p-button p-button-quiet" @click="selection = []">
              清空选择</button
            ><button
              class="p-button p-button-quiet"
              @click="
                picker = false;
                backpack = true;
              "
            >
              添加卡牌到背包
            </button>
          </div>
          <p>
            背包共 {{ totalOwned }} 张，当前范围 {{ candidates.length }} 种。
          </p>
          <div class="a-picker-grid">
            <button
              v-for="card in pagedCandidates"
              :key="card.code"
              :aria-label="`选择展示 ${card.code}`"
              :aria-pressed="selection.includes(card.code)"
              @click="choose(card.code)"
            >
              <img :src="card.img" :alt="card.name" /><span
                >{{ card.code }} × {{ owned[card.code] }}</span
              ><Check v-if="selection.includes(card.code)" />
            </button>
          </div>
          <div v-if="candidatePages > 1" class="p-pagination">
            <button :disabled="pickPage <= 1" @click="pickPage--">上一页</button
            ><span>{{ pickPage }} / {{ candidatePages }}</span
            ><button :disabled="pickPage >= candidatePages" @click="pickPage++">
              下一页
            </button>
          </div>
          <p v-if="!candidates.length">此范围没有卡牌。</p>
          <p v-if="storageError" role="alert">{{ storageError }}</p>
          <p v-if="pickMessage" role="status">{{ pickMessage }}</p>
          <div class="a-picker-actions">
            <button
              class="p-button p-button-quiet"
              :disabled="!candidates.length"
              @click="random"
            >
              <Shuffle :size="17" />范围内随机</button
            ><button
              class="p-button"
              :disabled="!selection.length"
              @click="if (setDisplay(selection)) picker = false;"
            >
              应用范围（{{ selection.length }} 张）
            </button>
          </div></DialogContent
        ></DialogPortal
      ></DialogRoot
    >
  </div>
</template>
