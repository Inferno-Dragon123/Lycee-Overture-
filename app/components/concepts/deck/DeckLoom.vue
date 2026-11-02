<script setup lang="ts">
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-vue-next";
import { loomMatches, loomAtlasIndex, reconcileLoomOrder, type LoomCard, type LoomEntry } from "#shared/domain/deck-loom";
import { categoryLabels } from "#shared/domain/catalog";
import "~/assets/css/deck-loom.css";
const props = defineProps<{ entries: LoomEntry[]; total: number }>();
const emit = defineEmits<{ change: [card: LoomCard, delta: number]; detail: [card: LoomCard] }>();
const order = defineModel<string[]>("order", { default: () => [] });
const focused = defineModel<string>("focused", { default: "" });
const query = ref("");
const expanded = ref(false);
const atlas = ref<HTMLElement>();
watch(() => props.entries.map(entry => entry.card.code), () => {
  const oldIndex = order.value.indexOf(focused.value);
  const nextOrder = reconcileLoomOrder(order.value, props.entries);
  order.value = nextOrder;
  if (!nextOrder.includes(focused.value)) focused.value = nextOrder[Math.max(0, Math.min(oldIndex, nextOrder.length - 1))] ?? "";
}, { immediate: true });
const ordered = computed(() => {
  const map = new Map(props.entries.map(entry => [entry.card.code, entry]));
  return order.value.flatMap(code => map.has(code) ? [map.get(code)!] : []);
});
const matches = computed(() => ordered.value.filter(entry => loomMatches(entry.card, query.value)));
watch(query, () => { if (query.value.trim() && matches.value[0]) focused.value = matches.value[0].card.code; });
const current = computed(() => ordered.value.find(entry => entry.card.code === focused.value));
const index = computed(() => order.value.indexOf(focused.value));
const neighbors = computed(() => ordered.value.slice(Math.max(0, index.value - 2), Math.min(ordered.value.length, index.value + 3)));
function move(delta: number) {
  const pool = query.value.trim() ? matches.value : ordered.value;
  if (!pool.length) return;
  const position = pool.findIndex(entry => entry.card.code === focused.value);
  focused.value = pool[(position + delta + pool.length) % pool.length]!.card.code;
}
function keyboard(event: KeyboardEvent) {
  if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    if (event.key === "Home") focused.value = ordered.value[0]?.card.code ?? "";
    else if (event.key === "End") focused.value = ordered.value.at(-1)?.card.code ?? "";
    else move(event.key === "ArrowRight" ? 1 : -1);
    void nextTick(() => atlas.value?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true }));
  }
}
let gesture: { id: number; x: number; y: number; dragged: boolean } | null = null;
function pointerDown(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0) return;
  suppressClick = false;
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
}
function pointerMove(event: PointerEvent) {
  if (!gesture || event.pointerId !== gesture.id || !atlas.value) return;
  if (!gesture.dragged) {
    const dx = Math.abs(event.clientX - gesture.x), dy = Math.abs(event.clientY - gesture.y);
    if (dy > dx && dy > 8) { suppressClick = true; gesture = null; return; }
    if (dx < 8) return;
    gesture.dragged = true;
    atlas.value.setPointerCapture(event.pointerId);
  }
  const rect = atlas.value.getBoundingClientRect();
  const target = ordered.value[loomAtlasIndex(event.clientX, event.clientY, rect, ordered.value.length)];
  if (target) focused.value = target.card.code;
}
function pointerEnd(event: PointerEvent) {
  if (atlas.value?.hasPointerCapture(event.pointerId)) atlas.value.releasePointerCapture(event.pointerId);
  // The following click must not replace the last drag preview with the capture target.
  if (gesture?.dragged) suppressClick = true;
  gesture = null;
}
let suppressClick = false;
function select(code: string) {
  if (suppressClick) { suppressClick = false; return; }
  focused.value = code;
}
function captureClick(event: MouseEvent) {
  if (suppressClick) { event.stopPropagation(); suppressClick = false; }
}
</script>

<template>
  <section class="deck-loom" aria-label="卡组织机">
    <div class="loom-search">
      <input v-model="query" type="search" aria-label="卡组内搜索" placeholder="搜索卡组内名称、编号、属性" />
      <span role="status">{{ query.trim() ? `${matches.length} 项匹配` : `${entries.length} 种` }}</span>
    </div>
    <div ref="atlas" class="loom-atlas" :class="{ 'is-dense': ordered.length > 20 }" :style="{ '--loom-columns': Math.max(1, Math.min(20, ordered.length)) }" role="group" aria-label="卡组图谱，左右方向键切换卡牌" @keydown="keyboard"
      @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerEnd" @pointercancel="pointerEnd"
      @click.capture="captureClick">
      <button v-for="entry in ordered" :key="entry.card.code" class="loom-spine"
        :class="{ 'is-match': query.trim() && loomMatches(entry.card, query) }"
        :aria-label="`${entry.card.name} ${entry.card.code}，${entry.count} 张`" :aria-pressed="focused === entry.card.code"
        :tabindex="focused === entry.card.code ? 0 : -1" @click="select(entry.card.code)">
        <span>{{ entry.card.code.replace('LO-', '') }}</span><b>×{{ entry.count }}</b>
      </button>
      <p v-if="!entries.length" class="loom-empty">卡组为空，先从卡查加入卡牌。</p>
    </div>
    <div v-if="current" class="loom-focus" aria-label="聚焦卡牌">
      <button class="loom-art" :aria-label="`查看卡牌 ${current.card.code}`" @click="emit('detail', current.card)">
        <img v-if="current.card.img" :src="current.card.img" :alt="current.card.name" />
        <span v-else>{{ current.card.attribute }}</span>
      </button>
      <div class="loom-summary">
        <strong :title="current.card.name">{{ current.card.name }}</strong>
        <small data-testid="loom-code">{{ current.card.code }}</small>
        <small>{{ current.card.attribute }} · {{ categoryLabels[current.card.category] || current.card.category }} · EX {{ current.card.ex ?? '—' }} · 费用 {{ current.card.cost || '—' }}</small>
        <small>AP {{ current.card.ap ?? '—' }} / DP {{ current.card.dp ?? '—' }} / SP {{ current.card.sp ?? '—' }} / DMG {{ current.card.dmg ?? '—' }}</small>
        <div class="loom-quantity">
          <button :aria-label="`减少 ${current.card.code}`" @click="emit('change', current.card, -1)"><Minus :size="16" /></button>
          <output aria-label="聚焦卡牌数量" aria-live="polite">{{ current.count }}</output>
          <button :aria-label="`增加 ${current.card.code}`" :disabled="total >= 60" @click="emit('change', current.card, 1)"><Plus :size="16" /></button>
          <button class="loom-detail" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? '收起' : '详情' }}</button>
        </div>
      </div>
    </div>
    <div v-if="current && expanded" class="loom-effect" tabindex="0" aria-label="聚焦卡牌效果">
      <p>{{ current.card.textZh || '暂无中文效果' }}</p>
      <details><summary>日文原文</summary><p>{{ current.card.textJa }}</p></details>
      <button @click="emit('detail', current.card)">查看完整卡牌</button>
    </div>
    <div v-if="current" class="loom-navigation">
      <button aria-label="上一张卡组卡牌" :disabled="!matches.length" @click="move(-1)"><ChevronLeft :size="18" /></button>
      <span>{{ index + 1 }} / {{ entries.length }}</span>
      <button aria-label="下一张卡组卡牌" :disabled="!matches.length" @click="move(1)"><ChevronRight :size="18" /></button>
    </div>
    <div v-if="current" class="loom-neighbors" aria-label="附近卡牌精确选择">
      <button v-for="entry in neighbors" :key="entry.card.code" :aria-pressed="focused === entry.card.code"
        :aria-label="`定位 ${entry.card.code}`" @click="focused = entry.card.code">{{ entry.card.code.replace('LO-', '') }}</button>
    </div>
  </section>
</template>
