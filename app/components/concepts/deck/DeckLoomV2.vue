<script setup lang="ts">
import { ChevronLeft, ChevronRight, Search, X, Minus, Plus } from "lucide-vue-next";
import { categoryLabels } from "#shared/domain/catalog";
import { loomMatches } from "#shared/domain/deck-loom";
import { closestLoomCard, groupLoomEntries, loomNeighborhood, type LoomGrouping, type VisualLoomCard, type VisualLoomEntry } from "#shared/domain/deck-loom-v2";
import LoomArtwork from "./LoomArtwork.vue";
const props = defineProps<{ entries: VisualLoomEntry[]; total: number; recent: string[] }>();
const focused = defineModel<string>("focused", { default: "" });
const order = defineModel<string[]>("order", { default: () => [] });
const grouping = defineModel<LoomGrouping>("grouping", { default: "none" });
const navigatorMode = defineModel<"nearby" | "recent">("navigator", { default: "nearby" });
const emit = defineEmits<{ change: [card: VisualLoomCard, delta: number]; detail: [card: VisualLoomCard] }>();
const query = ref("");
const mobile = ref(false);
const atlas = ref<HTMLElement>();
const atlasWidth = ref(0);
const hovered = ref<VisualLoomCard | null>(null);
const tooltip = ref({ left: "0px", top: "0px" });
const candidate = ref("");
const dragging = ref(false);
const ordered = computed(() => {
  const map = new Map(props.entries.map(entry => [entry.card.code, entry]));
  return order.value.flatMap(code => map.has(code) ? [map.get(code)!] : []);
});
const groups = computed(() => groupLoomEntries(ordered.value, grouping.value));
const displayed = computed(() => groups.value.flatMap(group => group.entries));
const rows = computed(() => props.entries.length <= 20 ? 1 : props.entries.length <= 40 ? 2 : 3);
const spineWidth = computed(() => {
  const columns = groups.value.reduce((sum, group) => sum + Math.ceil(group.entries.length / rows.value), 0);
  const gaps = Math.max(0, groups.value.length - 1) * 14 + Math.max(0, columns - groups.value.length) * 4;
  return Math.max(mobile.value ? 24 : 28, Math.min(64, Math.floor((atlasWidth.value - 10 - gaps) / Math.max(1, columns))));
});
const active = computed(() => displayed.value.find(entry => entry.card.code === (candidate.value || focused.value)));
const matches = computed(() => displayed.value.filter(entry => loomMatches(entry.card, query.value)));
const navigation = computed(() => navigatorMode.value === "nearby"
  ? loomNeighborhood(displayed.value, candidate.value || focused.value, mobile.value ? 3 : 5)
  : props.recent.flatMap(code => {
    const entry = displayed.value.find(item => item.card.code === code);
    return entry ? [entry] : [];
  }).slice(0, mobile.value ? 3 : 5));
function reveal() {
  const target = atlas.value?.querySelector<HTMLElement>('[aria-pressed="true"]');
  if (!target || !atlas.value) return;
  const panel = atlas.value.getBoundingClientRect(), card = target.getBoundingClientRect();
  if (card.left < panel.left) atlas.value.scrollLeft -= panel.left - card.left + 8;
  else if (card.right > panel.right) atlas.value.scrollLeft += card.right - panel.right + 8;
}
watch([focused, grouping], () => { hovered.value = null; void nextTick(reveal); });
watch(query, () => { if (query.value.trim() && matches.value[0]) focused.value = matches.value[0].card.code; });
function move(delta: number) {
  const pool = query.value.trim() ? matches.value : displayed.value;
  if (!pool.length) return;
  const index = pool.findIndex(entry => entry.card.code === focused.value);
  focused.value = pool[(index + delta + pool.length) % pool.length]!.card.code;
}
function keyboard(event: KeyboardEvent) {
  if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    if (event.key === "Home") focused.value = displayed.value[0]?.card.code ?? "";
    else if (event.key === "End") focused.value = displayed.value.at(-1)?.card.code ?? "";
    else move(event.key === "ArrowRight" ? 1 : -1);
    void nextTick(() => atlas.value?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true }));
  }
}
function hover(event: PointerEvent, card: VisualLoomCard) {
  if (event.pointerType !== "mouse" || dragging.value || !matchMedia("(hover: hover)").matches) return;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  tooltip.value = { left: `${Math.max(8, Math.min(rect.right + 10, innerWidth - 176))}px`, top: `${Math.max(8, Math.min(rect.top, innerHeight - 258))}px` };
  hovered.value = card;
}
let gesture: { id: number; x: number; y: number; lastX: number; lastY: number } | null = null;
let suppressClick = false, frame = 0;
function hit(x: number, y: number) {
  const rects = [...(atlas.value?.querySelectorAll<HTMLElement>("[data-card-code]") ?? [])].map(node => {
    const rect = node.getBoundingClientRect();
    return { code: node.dataset.cardCode!, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  });
  candidate.value = closestLoomCard(rects, x, y);
}
function autoScroll() {
  if (!gesture || !dragging.value || !atlas.value) return;
  const rect = atlas.value.getBoundingClientRect();
  const offset = gesture.lastX < rect.left + 24 ? -10 : gesture.lastX > rect.right - 24 ? 10 : 0;
  if (offset) { atlas.value.scrollLeft += offset; hit(gesture.lastX, gesture.lastY); }
  frame = requestAnimationFrame(autoScroll);
}
function pointerDown(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0) return;
  suppressClick = false; hovered.value = null;
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY };
}
function pointerMove(event: PointerEvent) {
  if (!gesture || gesture.id !== event.pointerId || !atlas.value) return;
  if (!dragging.value) {
    const dx = Math.abs(event.clientX - gesture.x), dy = Math.abs(event.clientY - gesture.y);
    if (dy > dx && dy > 8) { gesture = null; suppressClick = true; return; }
    if (dx < 8) return;
    dragging.value = true;
    atlas.value.setPointerCapture(event.pointerId);
    frame = requestAnimationFrame(autoScroll);
  }
  gesture.lastX = event.clientX; gesture.lastY = event.clientY;
  hit(event.clientX, event.clientY);
}
function finish(event: PointerEvent, commit: boolean) {
  cancelAnimationFrame(frame);
  if (dragging.value) {
    if (commit && candidate.value) focused.value = candidate.value;
    suppressClick = true;
  }
  dragging.value = false; candidate.value = ""; gesture = null;
  if (atlas.value?.hasPointerCapture(event.pointerId)) atlas.value.releasePointerCapture(event.pointerId);
}
function captureClick(event: MouseEvent) {
  if (suppressClick) { event.stopPropagation(); suppressClick = false; }
}
let media: MediaQueryList | undefined;
let sizeObserver: ResizeObserver | undefined;
const resize = () => { mobile.value = media?.matches ?? false; hovered.value = null; };
onMounted(() => {
  media = matchMedia("(max-width: 599px)"); resize(); media.addEventListener("change", resize);
  sizeObserver = new ResizeObserver(() => { atlasWidth.value = atlas.value?.getBoundingClientRect().width ?? 0; });
  if (atlas.value) sizeObserver.observe(atlas.value);
});
onBeforeUnmount(() => { media?.removeEventListener("change", resize); sizeObserver?.disconnect(); cancelAnimationFrame(frame); });
</script>

<template>
  <section class="v2-loom" aria-label="V2 视觉卡组织机" :data-dragging="dragging" @keydown.esc.stop.prevent="hovered = null">
    <div class="v2-tools">
      <label class="v2-search"><Search :size="17" /><input v-model="query" type="search" aria-label="卡组内搜索" placeholder="名称、完整卡号或属性" maxlength="200" />
        <button v-if="query" aria-label="清空卡组搜索" @click="query = ''"><X :size="16" /></button>
      </label>
      <div class="v2-grouping" aria-label="图谱分类">
        <button v-for="item in [{ key: 'none', label: '全部' }, { key: 'attribute', label: '属性' }, { key: 'category', label: '类别' }]" :key="item.key" :aria-pressed="grouping === item.key" @click="grouping = item.key as LoomGrouping">{{ item.label }}</button>
        <span role="status">{{ query.trim() ? `${matches.length} 项匹配` : `${entries.length} 种卡牌` }}</span>
      </div>
    </div>
    <div class="v2-content">
      <div ref="atlas" class="v2-atlas" :style="{ '--v2-rows': rows, '--v2-spine-width': `${spineWidth}px` }" role="group" aria-label="视觉卡组图谱" @keydown="keyboard"
        @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="finish($event, true)" @pointercancel="finish($event, false)" @click.capture="captureClick" @pointerleave="hovered = null">
        <div v-for="group in groups" :key="group.key" class="v2-atlas-group">
          <span class="v2-lane-label">{{ group.label }}</span>
          <div class="v2-spines">
            <button v-for="entry in group.entries" :key="entry.card.code" class="v2-spine" :data-card-code="entry.card.code"
              :aria-label="`${entry.card.name} ${entry.card.code}，${entry.count} 张`" :aria-pressed="focused === entry.card.code"
              :class="{ 'is-preview': candidate === entry.card.code, 'is-match': query.trim() && loomMatches(entry.card, query) }"
              :tabindex="focused === entry.card.code ? 0 : -1" @click="focused = entry.card.code" @pointerenter="hover($event, entry.card)">
              <LoomArtwork :card="entry.card" crop /><b class="v2-count">×{{ entry.count }}</b>
            </button>
          </div>
        </div>
        <p v-if="!entries.length" class="v2-empty">卡组为空，可撤销或重新载入测试场景。</p>
      </div>
      <div class="v2-visual-navigation" aria-label="视觉导航">
        <div class="v2-nav-modes"><button :aria-pressed="navigatorMode === 'nearby'" @click="navigatorMode = 'nearby'">邻近卡牌</button><button :aria-pressed="navigatorMode === 'recent'" @click="navigatorMode = 'recent'">最近编辑</button></div>
        <div class="v2-nav-cards">
          <button class="v2-nav-arrow" aria-label="上一张卡组卡牌" :disabled="!matches.length || dragging" @click="move(-1)"><ChevronLeft :size="20" /></button>
          <div class="v2-slots">
            <button v-for="entry in navigation" :key="entry.card.code" class="v2-slot" :title="`${entry.card.name} · ${entry.card.code}`"
              :aria-label="`定位 ${entry.card.code} ${entry.card.name}，${entry.count} 张`" :aria-pressed="focused === entry.card.code"
              @click="focused = entry.card.code" @pointerenter="hover($event, entry.card)" @pointerleave="hovered = null">
              <LoomArtwork :card="entry.card" :priority="1" /><b class="v2-count">×{{ entry.count }}</b>
            </button>
            <p v-if="!navigation.length" class="v2-empty">{{ navigatorMode === 'recent' ? '尚无最近编辑' : '尚无卡牌' }}</p>
          </div>
          <button class="v2-nav-arrow" aria-label="下一张卡组卡牌" :disabled="!matches.length || dragging" @click="move(1)"><ChevronRight :size="20" /></button>
        </div>
      </div>
      <div v-if="active" class="v2-focus" aria-label="聚焦编辑摘要">
        <button class="v2-focus-art" :aria-label="`查看完整卡牌 ${active.card.code}`" @click="emit('detail', active.card)"><LoomArtwork :card="active.card" :priority="0" /></button>
        <div class="v2-summary"><h2 :title="active.card.name">{{ active.card.name }}</h2><span data-testid="v2-code">{{ active.card.code }}</span>
          <p>{{ active.card.attribute }} · {{ categoryLabels[active.card.category] || active.card.category }} · EX {{ active.card.ex ?? '—' }}</p>
          <p>费用 {{ active.card.cost || '—' }}</p>
          <dl><div v-for="(value, label) in { AP: active.card.ap, DP: active.card.dp, SP: active.card.sp, DMG: active.card.dmg }" :key="label"><dt>{{ label }}</dt><dd>{{ value ?? '—' }}</dd></div></dl>
        </div>
      </div>
    </div>
    <footer class="v2-quantity" aria-label="当前卡牌数量编辑">
      <template v-if="active"><button :aria-label="`减少 ${active.card.code}`" :disabled="dragging" @click="emit('change', active.card, -1)"><Minus :size="19" /></button>
        <output aria-label="当前卡牌数量" aria-live="polite">{{ active.count }}</output>
        <button :aria-label="`增加 ${active.card.code}`" :disabled="total >= 60 || dragging" @click="emit('change', active.card, 1)"><Plus :size="19" /></button>
        <button class="v2-detail-button" :disabled="dragging" @click="emit('detail', active.card)">完整详情</button>
      </template><p v-else>选择卡牌后即可编辑数量。</p>
    </footer>
    <div v-if="hovered" class="v2-hover-preview" role="tooltip" aria-label="临时卡牌预览" :style="tooltip">
      <LoomArtwork :card="hovered" :priority="0" /><strong>{{ hovered.name }}</strong><small>{{ hovered.code }}</small>
    </div>
  </section>
</template>
