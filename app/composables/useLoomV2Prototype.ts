import { reconcileLoomOrder, updateShowcaseQuantity } from "#shared/domain/deck-loom";
import { adjacentLoomFocus, loomCategories, mixedLoomSample, mockLoomV2Cards, updateLoomRecent, type VisualLoomCard } from "#shared/domain/deck-loom-v2";
import type { SearchResult } from "#shared/domain/catalog";

export function useLoomV2Prototype() {
  const size = ref(20), pool = ref<VisualLoomCard[]>([]);
  const source = ref<"api" | "mock">("api"), loading = ref(false), error = ref("");
  const quantities = ref<Record<string, number>>({});
  const order = ref<string[]>([]), focused = ref(""), recent = ref<string[]>([]);
  const history = ref<{ before: Record<string, number>; code: string }[]>([]);
  const cards = computed(() => pool.value.slice(0, size.value));
  const entries = computed(() => cards.value.filter(card => quantities.value[card.code]).map(card => ({ card, count: quantities.value[card.code]! })));
  const total = computed(() => entries.value.reduce((sum, entry) => sum + entry.count, 0));
  watch(entries, next => {
    const previous = order.value;
    const nextOrder = reconcileLoomOrder(previous, next);
    focused.value = adjacentLoomFocus(previous, nextOrder, focused.value);
    order.value = nextOrder;
    recent.value = recent.value.filter(code => (quantities.value[code] ?? 0) > 0);
  }, { flush: "sync" });
  function reset(count = size.value) {
    size.value = count;
    quantities.value = Object.fromEntries(cards.value.map(card => [card.code, 1]));
    order.value = cards.value.map(card => card.code);
    focused.value = order.value[0] ?? "";
    history.value = []; recent.value = [];
  }
  let controller: AbortController | undefined;
  async function loadReal() {
    controller?.abort();
    const request = new AbortController(); controller = request;
    loading.value = true; error.value = "";
    try {
      const results = await Promise.all(loomCategories.map(category => $fetch<SearchResult>("/api/cards/search", {
        query: { category, pageSize: 60 }, signal: request.signal,
      })));
      const sample = mixedLoomSample(results.flatMap(result => result.cards));
      if (sample.length < 60) throw new Error("insufficient cards");
      if (request.signal.aborted) return;
      source.value = "api"; pool.value = sample; reset();
    } catch {
      if (!request.signal.aborted) error.value = "真实卡库读取失败，当前测试卡组已保留。请重试或使用模拟数据。";
    } finally { if (controller === request) loading.value = false; }
  }
  function useMock() {
    controller?.abort(); controller = undefined;
    loading.value = false; error.value = ""; source.value = "mock";
    pool.value = mockLoomV2Cards(); reset();
  }
  function change(card: VisualLoomCard, delta: number) {
    if (!delta || !cards.value.some(item => item.code === card.code)) return;
    const next = updateShowcaseQuantity(quantities.value, card.code, delta);
    if (!next) return;
    history.value = [...history.value.slice(-19), { before: { ...quantities.value }, code: card.code }];
    quantities.value = next;
    recent.value = updateLoomRecent(recent.value, card.code, next);
  }
  function undo() {
    const previous = history.value.pop();
    if (!previous) return;
    quantities.value = previous.before;
    recent.value = updateLoomRecent(recent.value, previous.code, previous.before);
    if (previous.before[previous.code]) focused.value = previous.code;
  }
  function clear() {
    if (!total.value) return;
    history.value = [...history.value.slice(-19), { before: { ...quantities.value }, code: focused.value }];
    quantities.value = {};
  }
  onMounted(() => { void loadReal(); });
  onBeforeUnmount(() => controller?.abort());
  return { size, source, loading, error, entries, total, order, focused, recent, history, reset, loadReal, useMock, change, undo, clear };
}
