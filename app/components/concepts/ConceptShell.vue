<script setup lang="ts">
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Minus,
  X,
  Layers,
  SlidersHorizontal,
  MoreHorizontal,
  Sun,
  Moon,
  Menu,
  Check,
  ChevronDown,
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
import { concepts, useShowcase } from "~/composables/useShowcase";
import "~/assets/css/concepts.css";
import "@fontsource-variable/geist";
import "~/assets/css/orbit.css";
import "~/assets/css/feedback.css";
import "~/assets/css/workflow.css";
import "~/assets/css/strategy.css";
import "~/assets/css/inner-background.css";
import "~/assets/css/filter-workbench.css";
import OrbitBackground from "./OrbitBackground.vue";
import ConceptPages from "./ConceptPages.vue";
import DeckLoomV3 from "./deck/DeckLoomV3.vue";
import { DECK_CARD_LIMIT } from "#shared/domain/deck";
import DeckLoom from "./deck/DeckLoom.vue";
import type { LoomCard } from "#shared/domain/deck-loom";
import { demoCards } from "~/composables/useShowcase";
import "~/assets/css/deck-loom.css";
const props = defineProps<{ variant: string; section: string }>();
const route = useRoute();
useInteractionFeedback();
const {
  mode,
  theme,
  utility,
  panel,
  filtersOpen,
  selected,
  motion,
  toast,
  total,
  entries,
  change,
  count,
  notify,
  history,
  undo,
  editable,
  catalog,
  locateCard,
  lastEdit,
} = useShowcase();
const deckView = useState<"list" | "loom">("showcase-deck-view", () => "list");
const loomOrder = useState<string[]>("showcase-loom-order", () => []);
const loomFocused = useState("showcase-loom-focused", () => "");
function changeLoom(card: LoomCard, delta: number) {
  const real = demoCards.find((item) => item.code === card.code);
  if (real) change(real, delta);
}
function detailLoom(card: LoomCard) {
  selected.value = demoCards.find((item) => item.code === card.code) ?? null;
}
const { save: savePractice, error: practiceError } = usePracticeDecks();
const { quantities } = useShowcase();
function saveDeck() {
  if (savePractice(quantities.value))
    notify("卡组已保存在我的卡组，可导入起手模拟。");
  else notify(practiceError.value);
}
const menu = ref(false);
const hydrated = ref(false);
const narrowScreen = ref(false);
const mobileDeckOpen = computed(
  () =>
    props.variant === "orbit" &&
    narrowScreen.value &&
    mode.value &&
    panel.value === "deck",
);
let bodyOverflow = "";
watch(mobileDeckOpen, (open) => {
  if (!import.meta.client) return;
  if (open) {
    bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  } else document.body.style.overflow = bodyOverflow;
});
function measureScreen() {
  narrowScreen.value = window.innerWidth < 1000;
}
onMounted(() => {
  measureScreen();
  window.addEventListener("resize", measureScreen);
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", measureScreen);
  if (mobileDeckOpen.value) document.body.style.overflow = bodyOverflow;
});
function trapDeckFocus(event: KeyboardEvent) {
  if (!mobileDeckOpen.value || event.key !== "Tab") return;
  const buttons = Array.from(
    (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
      "button:not(:disabled),input,[tabindex='0']",
    ),
  ).filter(
    (el) =>
      el.getClientRects().length &&
      getComputedStyle(el).visibility !== "hidden",
  );
  const first = buttons[0],
    last = buttons.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus({ preventScroll: true });
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus({ preventScroll: true });
  }
}
let deckReturnFocus: HTMLElement | null = null;
watch(
  () => mode.value && panel.value === "deck",
  async (open) => {
    if (!import.meta.client) return;
    if (open) {
      deckReturnFocus = document.activeElement as HTMLElement;
      await nextTick();
      document
        .querySelector<HTMLButtonElement>(".p-deck-drawer button")
        ?.focus({ preventScroll: true });
    } else {
      await nextTick();
      if (deckReturnFocus?.isConnected)
        deckReturnFocus.focus({ preventScroll: true });
    }
  },
);
onMounted(() => {
  hydrated.value = true;
});
const utilityOpen = computed({
  get: () => !!utility.value,
  set: (value) => {
    if (!value) utility.value = null;
  },
});
watch(
  () => props.section,
  (section) => {
    if (section === "announcements" || section === "account")
      utility.value = section;
  },
  { immediate: true },
);
let returnFocus: HTMLElement | null = null;
watch([selected, utility], ([card, page]) => {
  if (import.meta.client && (card || page))
    returnFocus = document.activeElement as HTMLElement;
});
function restoreFocus(event: Event) {
  event.preventDefault();
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  else
    (
      document.querySelector<HTMLButtonElement>(".p-drawer-heading button") ??
      document.querySelector<HTMLButtonElement>(".p-deck-fab")
    )?.focus({ preventScroll: true });
}
const language = ref("zh");
const categoryNames: Record<string, string> = {
  キャラクター: "角色",
  イベント: "事件",
  アイテム: "道具",
  エリア: "场地",
};
const modal = computed({
  get: () => Boolean(selected.value),
  set: (value) => {
    if (!value) selected.value = null;
  },
});
const path = (page = "") =>
  `/concepts/${props.variant}${page ? `/${page}` : ""}`;
const nav = [
  { label: "首页", page: "" },
  { label: "卡查", page: "cards" },
  { label: "我的卡组", page: "decks" },
  { label: "工具箱", page: "tools" },
  { label: "卡组社区", page: "community" },
];
let timer: ReturnType<typeof setTimeout> | undefined;
watch(toast, (value) => {
  clearTimeout(timer);
  if (value)
    timer = setTimeout(() => {
      toast.value = "";
    }, 4200);
});
watch(
  () => route.path,
  () => {
    menu.value = false;
    selected.value = null;
    if (props.section !== "cards") filtersOpen.value = false;
  },
);
onBeforeUnmount(() => clearTimeout(timer));
async function toggleMode() {
  mode.value = !mode.value;
  if (mode.value && props.section !== "cards") {
    const drafts = usePracticeDecks();
    await navigateTo(drafts.draft.value?.resume || path("cards"));
  } else if (panel.value === "deck") panel.value = "none";
}
function closeWithEscape(event: KeyboardEvent) {
  if (event.key === "Escape" && !event.defaultPrevented) {
    if (filtersOpen.value) filtersOpen.value = false;
    else panel.value = "none";
    menu.value = false;
  }
}
onMounted(() => window.addEventListener("keydown", closeWithEscape));
onBeforeUnmount(() => window.removeEventListener("keydown", closeWithEscape));
</script>

<template>
  <div
    class="concept"
    :data-ready="hydrated"
    :class="[
      `concept-${variant}`,
      { 'a-light': theme === 'light', 'a-approved': variant === 'orbit' },
      { 'p-motion-off': !motion, 'p-deck-open': mode && panel === 'deck' },
      {
        'a-inner': variant === 'orbit' && section !== 'home',
        'a-deck-v3': variant === 'orbit',
      },
      {
        'a-filter-workbench': section === 'cards',
        'p-filters-open': section === 'cards' && filtersOpen,
      },
    ]"
  >
    <OrbitBackground v-if="variant === 'orbit' && section !== 'home'" />
    <a class="p-skip" href="#concept-content">跳转到内容</a>
    <header class="p-header" :inert="mobileDeckOpen">
      <NuxtLink :to="path()" class="p-brand" aria-label="返回首页"
        ><span class="p-brand-mark">L<span /></span
        ><span>lycée<span class="p-brand-sub">OVERTURE</span></span></NuxtLink
      >
      <nav class="p-nav" aria-label="主导航">
        <NuxtLink
          v-for="item in nav"
          :key="item.page"
          :to="path(item.page)"
          :class="{ current: section === (item.page || 'home') }"
          >{{ item.label }}</NuxtLink
        >
      </nav>
      <div class="p-header-actions">
        <button
          class="p-mode"
          role="switch"
          aria-label="组卡模式"
          :aria-checked="mode"
          @click="toggleMode"
        >
          <span class="p-toggle"><i /></span><span>组卡模式</span></button
        ><button
          class="p-icon"
          :aria-label="theme === 'dark' ? '切换日间模式' : '切换夜晚模式'"
          @click="theme = theme === 'dark' ? 'light' : 'dark'"
        >
          <Sun v-if="theme === 'dark'" :size="19" /><Moon
            v-else
            :size="19"
          /></button
        ><button
          class="p-icon p-more"
          aria-label="更多导航"
          :aria-expanded="menu"
          @click="menu = !menu"
        >
          <X v-if="menu" :size="20" /><MoreHorizontal v-else :size="23" />
        </button>
      </div>
      <Transition name="a-pop"
        ><nav v-if="menu" class="p-menu" aria-label="更多功能">
          <NuxtLink
            v-for="item in nav"
            :key="item.page"
            :to="path(item.page)"
            class="p-mobile-only"
            >{{ item.label }}<ArrowUpRight :size="17" /></NuxtLink
          ><NuxtLink
            v-for="item in [
              { page: 'groups', label: '玩家社群' },
              { page: 'learn', label: '新手入门' },
            ]"
            :key="item.page"
            :to="path(item.page)"
            >{{ item.label }}<ArrowUpRight :size="17"
          /></NuxtLink>
          <button
            @click="
              utility = 'announcements';
              menu = false;
            "
          >
            公告
          </button>
          <button
            @click="
              utility = 'account';
              menu = false;
            "
          >
            账号管理
          </button>
          <button @click="motion = !motion">
            {{ motion ? "关闭动效" : "开启动效" }}
          </button>
        </nav></Transition
      >
    </header>
    <div class="p-page-flow" :inert="mobileDeckOpen">
      <main id="concept-content" class="p-main">
        <PersonalCloudStatus class="personal-sync-status" />
        <Transition name="a-page" mode="out-in"
          ><div :key="section"><slot /></div
        ></Transition>
      </main>
      <footer class="p-footer">
        <div class="p-footer-links">
          <a
            href="https://github.com/Inferno-Dragon123/Lycee-Overture-"
            target="_blank"
            rel="noopener noreferrer"
            >项目地址 <ArrowUpRight :size="13" /></a
          ><span>致谢 · 待补充</span>
        </div>
        <p>
          同人非官方自建站。卡牌版权归 Lycee
          官方及相应权利人所有，数据为自收集，未经允许不可商用。
        </p>
        <div class="p-footer-bottom">
          <span>Lycee Overture 卡查工具箱</span><span>ICP备案 · 待审核</span>
        </div>
      </footer>
    </div>
    <button
      v-if="section === 'cards'"
      class="p-fab p-filter-fab"
      aria-label="详细筛选"
      :aria-expanded="filtersOpen"
      @click="filtersOpen = !filtersOpen"
    >
      <SlidersHorizontal :size="21" /><span>筛选</span>
    </button>
    <button
      v-if="mode"
      class="p-fab p-deck-fab"
      aria-label="当前卡组"
      :aria-expanded="panel === 'deck'"
      @click="panel = panel === 'deck' ? 'none' : 'deck'"
    >
      <Layers :size="21" /><span>{{ total }}<small>/60</small></span>
    </button>
    <Transition name="a-drawer"
      ><aside
        v-if="mode && panel === 'deck'"
        class="p-deck-drawer"
        :class="{
          'p-loom-drawer': variant !== 'orbit' && deckView === 'loom',
          'v3-drawer': variant === 'orbit',
        }"
        aria-label="当前卡组面板"
        @keydown="trapDeckFocus"
        @keydown.esc.stop.prevent="panel = 'none'"
      >
        <div class="p-drawer-heading">
          <span>当前构筑</span
          ><button
            class="p-icon"
            aria-label="关闭卡组面板"
            @click="panel = 'none'"
          >
            <X :size="20" />
          </button>
        </div>
        <DeckLoomV3 v-if="variant === 'orbit'" />
        <template v-else>
          <h2>未命名卡组<span>本地演示草稿</span></h2>
          <div class="loom-view-switch" aria-label="卡组显示方式">
            <button
              :aria-pressed="deckView === 'list'"
              @click="deckView = 'list'"
            >
              传统列表
            </button>
            <button
              :aria-pressed="deckView === 'loom'"
              @click="deckView = 'loom'"
            >
              卡组图谱
            </button>
            <button class="loom-undo" :disabled="!history.length" @click="undo">
              撤销
            </button>
          </div>
          <div class="p-deck-meter">
            <strong data-testid="prototype-total">{{ total }}</strong
            ><span>/ 60</span>
          </div>
          <div class="p-meter">
            <i :style="{ width: `${(total / 60) * 100}%` }" />
          </div>
          <DeckLoom
            v-if="deckView === 'loom'"
            v-model:order="loomOrder"
            v-model:focused="loomFocused"
            :entries="entries"
            :total="total"
            @change="changeLoom"
            @detail="detailLoom" />
          <p v-if="deckView === 'list' && !entries.length" class="p-deck-empty">
            卡组为空<span>到卡查页面，点击卡片上的 +。</span>
          </p>
          <div v-if="deckView === 'list' && entries.length" class="p-deck-list">
            <div
              v-for="type in ['キャラクター', 'イベント', 'アイテム', 'エリア']"
              :key="type"
            >
              <h3 v-if="entries.some((entry) => entry.card.category === type)">
                {{ categoryNames[type] }}
              </h3>
              <div
                v-for="entry in entries.filter(
                  (item) => item.card.category === type,
                )"
                :key="entry.card.code"
                class="p-mini-card"
              >
                <img :src="entry.card.img" :alt="entry.card.name" />
                <div>
                  <span>{{ entry.card.name }}</span
                  ><small>{{ entry.card.code }}</small>
                  <div class="p-stepper">
                    <button
                      :aria-label="`减少 ${entry.card.code}`"
                      @click="change(entry.card, -1)"
                    >
                      <Minus :size="13" /></button
                    ><b>{{ entry.count }}</b
                    ><button
                      :disabled="total >= 60"
                      :aria-label="`增加 ${entry.card.code}`"
                      @click="change(entry.card, 1)"
                    >
                      <Plus :size="13" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button class="p-button" :disabled="total !== 60" @click="saveDeck">
            <Check :size="16" />保存卡组</button
          ><NuxtLink :to="path('decks')" class="p-text-link"
            >查看完整构筑 <ArrowUpRight :size="15" /></NuxtLink
        ></template></aside
    ></Transition>
    <div v-if="variant !== 'orbit'" class="p-design-dock" aria-label="设计版本">
      <span>静态概念</span
      ><NuxtLink
        v-for="concept in concepts"
        :key="concept.id"
        :to="{
          path: `/concepts/${concept.id}${section === 'home' ? '' : `/${section}`}`,
          query: route.query,
        }"
        :aria-label="`方案 ${concept.letter} ${concept.name}`"
        :class="{ active: variant === concept.id }"
        >{{ concept.letter }}<span>{{ concept.name }}</span></NuxtLink
      >
    </div>
    <Transition name="p-toast"
      ><div v-if="toast" class="p-toast-message" role="status">
        {{ toast
        }}<button
          v-if="
            lastEdit &&
            toast.includes(lastEdit.code) &&
            count(lastEdit.code) &&
            variant === 'orbit'
          "
          class="v3-toast-locate"
          @click="locateCard(lastEdit.code)"
        >
          定位卡牌</button
        ><button class="p-icon" aria-label="关闭提示" @click="toast = ''">
          <X :size="16" />
        </button></div
    ></Transition>
    <DialogRoot v-model:open="modal"
      ><DialogPortal
        ><DialogOverlay class="p-dialog-overlay" /><DialogContent
          class="p-card-modal"
          :class="[
            `concept-${variant}`,
            { 'a-light': theme === 'light', 'p-motion-off': !motion },
          ]"
          @close-auto-focus="restoreFocus"
          ><DialogTitle class="sr-only">{{ selected?.name }}</DialogTitle
          ><DialogDescription class="sr-only"
            >完整卡牌详情，数量操作同步当前本地卡组。</DialogDescription
          ><DialogClose class="p-icon p-dialog-close" aria-label="关闭详情"
            ><X /></DialogClose
          ><template v-if="selected"
            ><img
              :src="selected.img"
              :alt="selected.name"
              class="p-detail-art"
            />
            <div class="p-detail-info">
              <span class="p-kicker"
                >{{ selected.code }} · {{ selected.rarity }}</span
              >
              <h2>{{ selected.name }}</h2>
              <dl>
                <div
                  v-for="(value, key) in {
                    类别: categoryNames[selected.category] || selected.category,
                    属性: selected.attribute,
                    费用: catalog.byCode.value.get(selected.code)?.cost || '—',
                    DMG: catalog.byCode.value.get(selected.code)?.dmg ?? '—',
                    版本:
                      catalog.byCode.value.get(selected.code)?.version ||
                      selected.version,
                    稀有度: selected.rarity,
                    EX: selected.ex,
                    AP: selected.ap,
                    DP: selected.dp,
                    SP: selected.sp,
                  }"
                  :key="key"
                  :data-detail-field="key"
                >
                  <dt>{{ key }}</dt>
                  <dd>{{ value }}</dd>
                </div>
              </dl>
              <div class="p-language">
                <button
                  :class="{ active: language === 'zh' }"
                  @click="language = 'zh'"
                >
                  中文效果</button
                ><button
                  :class="{ active: language === 'ja' }"
                  @click="language = 'ja'"
                >
                  日本語
                </button>
              </div>
              <p class="p-effect">
                {{ language === "zh" ? selected.textZh : selected.textJa }}
              </p>
              <div v-if="mode" class="v3-detail-quantity">
                <button
                  class="p-button"
                  :disabled="!editable || !count(selected.code)"
                  :aria-label="`减少 ${selected.code}`"
                  @click="change(selected, -1)"
                >
                  <Minus :size="17" />减少一张</button
                ><output>{{ count(selected.code) }} 张</output>
              </div>
              <button
                v-if="mode"
                class="p-button"
                :disabled="!editable || total >= DECK_CARD_LIMIT"
                @click="change(selected, 1)"
              >
                加入卡组 <Plus :size="17" />
              </button>
              <p class="p-muted">
                {{
                  mode
                    ? `这张卡已加入 ${count(selected.code)} 张`
                    : "开启组卡模式，开始你的构筑。"
                }}
              </p>
            </div></template
          ></DialogContent
        ></DialogPortal
      ></DialogRoot
    >
    <DialogRoot v-model:open="utilityOpen"
      ><DialogPortal
        ><DialogOverlay class="p-dialog-overlay" /><DialogContent
          class="a-utility p-card-modal"
          :class="[
            `concept-${variant}`,
            { 'a-light': theme === 'light', 'p-motion-off': !motion },
          ]"
          @close-auto-focus="restoreFocus"
          ><DialogTitle class="sr-only">{{
            utility === "announcements" ? "公告" : "账号管理"
          }}</DialogTitle
          ><DialogDescription class="sr-only"
            >账号管理、个人数据同步和站点公告。</DialogDescription
          ><DialogClose class="p-icon p-dialog-close" aria-label="关闭窗口"
            ><X /></DialogClose
          ><ConceptPages
            v-if="utility"
            :variant="variant"
            :section="utility" /></DialogContent></DialogPortal
    ></DialogRoot>
  </div>
</template>
