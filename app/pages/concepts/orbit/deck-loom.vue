<script setup lang="ts">
import DeckLoom from "~/components/concepts/deck/DeckLoom.vue";
import { updateShowcaseQuantity, type LoomCard } from "#shared/domain/deck-loom";
import type { SearchResult } from "#shared/domain/catalog";
import "~/assets/css/concepts.css";
import "~/assets/css/orbit.css";
const size = ref(20);
const hydrated = ref(false);
onMounted(() => { hydrated.value = true; });
const realCards = ref<LoomCard[]>([]);
const source = ref<"mock" | "api">("mock");
const loading = ref(false);
const error = ref("");
const light = ref(false);
const list = ref(false);
const detail = ref<LoomCard | null>(null);
const dialog = ref<HTMLDialogElement>();
const quantities = ref<Record<string, number>>({});
const history = ref<Record<string, number>[]>([]);
const mockCards: LoomCard[] = Array.from({ length: 60 }, (_, index) => ({
  code: `MOCK-${String(index + 1).padStart(3, "0")}`, name: `模拟卡牌 ${index + 1}`,
  img: "", category: index % 3 ? "キャラクター" : "イベント", attribute: ["日", "月", "雪", "宙", "花"][index % 5]!,
  ex: 2, ap: index % 6, dp: index % 5, sp: index % 3, dmg: 1, cost: "日日",
  textZh: "仅用于交互测试的模拟效果，不代表真实卡牌。", textJa: "テスト用の模擬カード。",
}));
const cards = computed(() => (source.value === "mock" ? mockCards : realCards.value).slice(0, size.value));
const entries = computed(() => cards.value.filter(card => quantities.value[card.code]).map(card => ({ card, count: quantities.value[card.code]! })));
const total = computed(() => entries.value.reduce((sum, entry) => sum + entry.count, 0));
function reset(count: number) {
  size.value = count;
  quantities.value = Object.fromEntries(cards.value.map(card => [card.code, 1]));
  history.value = [];
}
reset(20);
async function loadReal() {
  loading.value = true;
  error.value = "";
  try {
    const result = await $fetch<SearchResult>("/api/cards/search", { query: { pageSize: 60 } });
    if (result.cards.length < 60) throw new Error("insufficient cards");
    realCards.value = result.cards;
    source.value = "api";
    reset(size.value);
  } catch { error.value = "卡库读取失败，当前测试卡组已保留，可重试。"; }
  finally { loading.value = false; }
}
function change(card: LoomCard, delta: number) {
  const next = updateShowcaseQuantity(quantities.value, card.code, delta);
  if (!next) return;
  history.value = [...history.value.slice(-19), { ...quantities.value }];
  quantities.value = next;
}
function undo() {
  const previous = history.value.pop();
  if (previous) quantities.value = previous;
}
async function showDetail(card: LoomCard) {
  detail.value = card;
  await nextTick();
  dialog.value?.showModal();
}
useSeoMeta({ title: "Deck Loom 独立测试 | Lycee" });
</script>

<template>
  <main class="concept concept-orbit loom-prototype" :data-ready="hydrated" :class="{ 'a-light': light }">
    <header>
      <h1>卡组织机 · 独立原型</h1>
      <p>{{ source === 'mock' ? '模拟数据' : '本地卡牌数据库 · 只读接口' }}，测试编辑不写入当前构筑。</p>
      <button @click="light = !light">{{ light ? '切换夜晚模式' : '切换日间模式' }}</button>
      <button :disabled="loading" @click="loadReal">{{ loading ? '正在读取卡库' : '使用真实卡库测试' }}</button>
      <button v-if="source === 'api'" @click="source = 'mock'; reset(size)">切回模拟数据</button>
      <p v-if="error" role="alert">{{ error }}</p>
    </header>
    <div class="loom-scenarios" aria-label="卡种测试场景">
      <button v-for="count in [20, 40, 60]" :key="count" :disabled="loading" :aria-pressed="size === count" @click="reset(count)">{{ count }} 种卡牌</button>
    </div>
    <section class="loom-test-workspace">
      <div class="loom-test-heading"><strong data-testid="loom-test-total">{{ total }} / 60 张 · {{ entries.length }} 种</strong><button :disabled="!history.length" @click="undo">撤销</button></div>
      <div class="loom-view-switch"><button :aria-pressed="!list" @click="list = false">卡组图谱</button><button :aria-pressed="list" @click="list = true">传统列表</button></div>
      <DeckLoom v-if="!list" :entries="entries" :total="total" @change="change" @detail="showDetail" />
      <div v-else class="loom-prototype-list" aria-label="完整卡牌列表">
        <div v-for="entry in entries" :key="entry.card.code">
          <button @click="showDetail(entry.card)">{{ entry.card.name }} · {{ entry.card.code }}</button>
          <button :aria-label="`减少 ${entry.card.code}`" @click="change(entry.card, -1)">−</button><b>{{ entry.count }}</b>
          <button :aria-label="`增加 ${entry.card.code}`" :disabled="total >= 60" @click="change(entry.card, 1)">＋</button>
        </div>
      </div>
    </section>
    <dialog ref="dialog" class="loom-test-dialog" aria-label="完整卡牌详情">
      <template v-if="detail"><button @click="dialog?.close()">关闭详情</button><h2>{{ detail.name }}</h2><p>{{ detail.code }}</p><p>{{ detail.textZh }}</p><p>{{ detail.textJa }}</p></template>
    </dialog>
  </main>
</template>

<style scoped>
.loom-prototype { min-height: 100dvh; padding: 32px max(16px, calc((100vw - 920px)/2)); background: var(--bg); color: var(--ink); }
header h1 { font-size: 28px; } header p { color: var(--muted); margin-block: 12px !important; font-size: 14px; }
.loom-prototype button { background: var(--soft); color: var(--ink); border: 0; border-radius: 8px; padding: 10px; }
.loom-prototype button[aria-pressed=true] { background: var(--accent); color: var(--on-accent); }
.loom-prototype button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
header > button { margin: 0 8px 8px 0; font-size: 13px; }
.loom-scenarios { display: flex; gap: 8px; margin-block: 20px; }
.loom-scenarios button[aria-pressed=true] { background: var(--accent); color: var(--on-accent); }
.loom-test-workspace { width: min(100%, 420px); height: 490px; background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 18px; display: flex; flex-direction: column; }
.loom-test-heading { display: flex; align-items: center; justify-content: space-between; font-size: 14px; }
.loom-test-workspace > .deck-loom { flex: 1; overflow: auto; }
.loom-prototype-list { overflow-y: auto; min-height: 0; }
.loom-prototype-list > div { display: flex; align-items: center; gap: 5px; margin-bottom: 8px; }
.loom-prototype-list button:first-child { flex: 1; text-align: left; font-size: 12px; }
.loom-test-dialog { margin: auto; max-width: min(90vw, 560px); max-height: 80dvh; overflow: auto; padding: 24px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 16px; }
.loom-test-dialog::backdrop { background: #0008; }
.loom-test-dialog p { white-space: pre-wrap; margin-top: 14px !important; }
</style>
