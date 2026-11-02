<script setup lang="ts">
import {
  ArrowLeft,
  ArrowRight,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-vue-next";
import type { ShowcaseCard } from "~/demo/collection";
import {
  HERO_MOTION_CONFIG,
  heroOrder,
  type HeroPhase,
} from "~/scene/hero-config";
import type { createHeroScene } from "~/scene/hero-scene";
const props = defineProps<{ cards: ShowcaseCard[]; blocked?: boolean }>();
const emit = defineEmits<{ settings: [] }>();
const { motion } = useShowcase();
const host = ref<HTMLElement>();
const phase = ref<HeroPhase>("loading");
const fallbackReason = ref<"image" | "webgl">("webgl");
const index = ref(0),
  main = ref("");
const automatic = ref(true),
  active = ref(false),
  systemReduced = ref(false);
const reduced = computed(() => !motion.value || systemReduced.value);
const ordered = computed(() => heroOrder(props.cards, index.value));
const state = computed(() =>
  phase.value === "idle"
    ? "ready"
    : phase.value === "fallback"
      ? "fallback"
      : phase.value === "loading"
        ? "loading"
        : "animating",
);
const cycling = computed(
  () =>
    automatic.value &&
    !reduced.value &&
    active.value &&
    !props.blocked &&
    props.cards.length > 1 &&
    phase.value === "idle",
);
let scene: ReturnType<typeof createHeroScene> | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let dead = false;
function schedule() {
  clearTimeout(timer);
  if (cycling.value)
    timer = setTimeout(() => advance(1, false), HERO_MOTION_CONFIG.autoDelayMs);
}
watch(cycling, schedule);
function advance(direction: number, manual = true) {
  if (manual) automatic.value = false;
  index.value =
    (((index.value + direction) % Math.max(1, props.cards.length)) +
      props.cards.length) %
    Math.max(1, props.cards.length);
  clearTimeout(timer);
  scene?.request(ordered.value);
}
function replay() {
  automatic.value = false;
  clearTimeout(timer);
  scene?.request(ordered.value, true);
}
function toggleAuto() {
  automatic.value = !automatic.value;
  if (automatic.value) advance(1, false);
}
watch(
  () => props.cards.map((c) => c.code).join("|"),
  () => {
    index.value = 0;
    clearTimeout(timer);
    scene?.request(ordered.value);
  },
);
watch(
  () => props.blocked,
  (blocked) => scene?.setBlocked(!!blocked),
);
watch(motion, (value) => scene?.setMotion(value));
let stopMedia = () => {};
onMounted(async () => {
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const mediaChange = () => {
    systemReduced.value = media.matches;
  };
  mediaChange();
  media.addEventListener("change", mediaChange);
  stopMedia = () => media.removeEventListener("change", mediaChange);
  try {
    const [T, { gsap }, { createHeroScene }] = await Promise.all([
      import("three"),
      import("gsap"),
      import("~/scene/hero-scene"),
    ]);
    if (dead || !host.value) return;
    scene = createHeroScene(T, gsap, {
      host: host.value,
      phase(next, code, reason) {
        phase.value = next;
        if (reason) fallbackReason.value = reason;
        if (code) main.value = code;
      },
      activity(value) {
        active.value = value;
      },
    });
    scene.setMotion(motion.value);
    scene.setBlocked(!!props.blocked);
    scene.request(ordered.value);
  } catch {
    if (!dead) phase.value = "fallback";
  }
});
onBeforeUnmount(() => {
  dead = true;
  clearTimeout(timer);
  stopMedia();
  scene?.dispose();
});
</script>
<template>
  <div class="a-hero-presentation">
    <div
      ref="host"
      class="a-card-stage a-hero-stage"
      data-stage="hero"
      :data-state="state"
      :data-phase="phase"
      :data-fallback-reason="state === 'fallback' ? fallbackReason : undefined"
      :data-card-codes="cards.map((c) => c.code).join(',')"
      :data-main="phase === 'fallback' ? ordered[0]?.code : main"
      :data-auto="cycling"
      role="img"
      :aria-label="`展示卡牌 3D 动画${main ? '，主卡 ' + main : ''}`"
    >
      <div
        v-if="state === 'fallback' || state === 'loading'"
        class="a-hero-fallback"
        :class="{ 'a-hero-single': ordered.length === 1 }"
      >
        <img
          v-for="(card, i) in ordered"
          :key="card.code"
          :src="card.img"
          :alt="card.name"
          :style="{ '--i': i }"
        />
        <img v-if="!ordered.length" src="/design/back.png" alt="官方卡背" />
        <p v-if="state === 'fallback'">{{ fallbackReason === 'image' ? '卡图暂时加载失败，可重试或更换卡牌。' : '当前设备使用静态卡牌展示。' }}</p>
      </div>
    </div>
    <div class="a-display-controls a-hero-controls">
      <button v-if="state === 'fallback' && fallbackReason === 'image'" @click="replay"><RotateCcw :size="17" />重新加载卡图</button>
      <div
        v-if="cards.length > 1"
        class="a-hero-transport"
        role="group"
        aria-label="展示卡轮播"
      >
        <button aria-label="上一张展示卡" @click="advance(-1)">
          <ArrowLeft :size="18" />
        </button>
        <button
          :aria-label="automatic && !reduced ? '暂停轮播' : '开启轮播'"
          :disabled="reduced || state === 'fallback'"
          :aria-pressed="automatic && !reduced"
          @click="toggleAuto"
        >
          <Pause v-if="automatic && !reduced" :size="17" /><Play
            v-else
            :size="17"
          />
        </button>
        <button aria-label="下一张展示卡" @click="advance(1)">
          <ArrowRight :size="18" />
        </button>
      </div>
      <button
        :disabled="state === 'loading' || state === 'fallback' || reduced"
        @click="replay"
      >
        <RotateCcw :size="17" />重播动画
      </button>
      <button @click="emit('settings')">
        <SlidersHorizontal :size="17" />更换展示卡牌
      </button>
    </div>
  </div>
</template>
