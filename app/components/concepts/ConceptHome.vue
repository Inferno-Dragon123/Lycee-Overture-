<script setup lang="ts">
import {
  ArrowUpRight,
  ArrowDown,
  ArrowRight,
  Layers,
  Search,
  Wand2,
  Users,
  RotateCcw,
  Plus,
  ChevronRight,
} from "lucide-vue-next";
import { demoCards, demoSeries, useShowcase } from "~/composables/useShowcase";
import ChoiceListbox from "./ChoiceListbox.vue";
const props = defineProps<{ variant: string }>();
const { motion, selected, notify } = useShowcase();
const root = ref<HTMLElement>();
const pool = ref("all");
const drawResult = ref<typeof demoCards>([]);
const drawing = ref(false);
const activeSeries = ref("YUZ");
const featured = computed(() =>
  ["YUZ", "SP", "AUG", "VA"].map((code) =>
    demoSeries.find((series) => series.code === code)!,
  ),
);
let animation: { revert: () => void } | undefined;
let drawTimer: ReturnType<typeof setTimeout> | undefined;
let disposeMedia: (() => void) | undefined;
let disposeAmbient: (() => void) | undefined;
let active = true;
let motionGeneration = 0;
const path = (page: string) => `/concepts/${props.variant}/${page}`;
async function animate() {
  const generation = ++motionGeneration;
  animation?.revert();
  if (
    !motion.value ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  const { gsap } = await import("gsap");
  const { ScrollTrigger } = await import("gsap/ScrollTrigger");
  if (!active || generation !== motionGeneration) return;
  gsap.registerPlugin(ScrollTrigger);
  animation = gsap.context(() => {
    gsap.from(".p-hero-copy > *", {
      y: 24,
      opacity: 0,
      duration: 0.8,
      stagger: 0.09,
      ease: "power3.out",
    });
    gsap.from(".p-hero-fan img", {
      y: 100,
      opacity: 0,
      duration: 1.2,
      stagger: 0.12,
      ease: "power3.out",
    });
    gsap.utils.toArray<HTMLElement>(".p-scroll-art").forEach((element) => {
      gsap.fromTo(
        element,
        { scale: 0.8 },
        {
          scale: 1,
          ease: "none",
          scrollTrigger: {
            trigger: element,
            start: "top bottom",
            end: "center center",
            scrub: 1,
          },
        },
      );
      gsap.to(element, {
        opacity: 0.2,
        ease: "none",
        scrollTrigger: {
          trigger: ".p-hero",
          start: "center top",
          end: "bottom top",
          scrub: 1,
        },
      });
    });
    gsap.utils.toArray<HTMLElement>(".p-stack-card").forEach((element, index) =>
      gsap.fromTo(
        element,
        { y: 60 + index * 30, rotate: index * 7 - 7 },
        {
          y: 0,
          rotate: index * 3 - 3,
          scrollTrigger: {
            trigger: ".p-story",
            start: "top bottom",
            end: "center center",
            scrub: 1,
          },
        },
      ),
    );
  }, root.value);
}
onMounted(() => {
  void animate();
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const listener = () => void animate();
  media.addEventListener("change", listener);
  disposeMedia = () => media.removeEventListener("change", listener);
  const visibility = () =>
    root.value?.classList.toggle("p-tab-hidden", document.hidden);
  document.addEventListener("visibilitychange", visibility);
  visibility();
  const observer = new IntersectionObserver(([entry]) => {
    root.value?.classList.toggle("p-hero-offscreen", !entry?.isIntersecting);
  });
  const hero = root.value?.querySelector(".p-hero");
  if (hero) observer.observe(hero);
  disposeAmbient = () => {
    observer.disconnect();
    document.removeEventListener("visibilitychange", visibility);
  };
});
watch(motion, () => {
  if (import.meta.client) void animate();
});
onBeforeUnmount(() => {
  active = false;
  animation?.revert();
  disposeMedia?.();
  disposeAmbient?.();
  clearTimeout(drawTimer);
});
function quickStart() {
  document.getElementById("quick-start")?.scrollIntoView({
    behavior:
      motion.value &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "smooth"
        : "instant",
  });
}
function draw(amount: number) {
  if (drawing.value) return;
  drawing.value = true;
  const cards =
    pool.value === "all"
      ? demoCards
      : demoCards.filter((card) => card.brand === pool.value);
  const choices = cards.length ? cards : demoCards;
  drawTimer = setTimeout(
    () => {
      drawResult.value = Array.from(
        { length: amount },
        (_, i) => choices[(i + drawResult.value.length) % choices.length]!,
      );
      drawing.value = false;
    },
    motion.value &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 680
      : 0,
  );
}
</script>

<template>
  <div ref="root" class="p-home">
    <section class="p-hero" :class="{ 'p-is-drawing': drawing }">
      <div class="p-card-ribbons" aria-hidden="true">
        <div v-for="row in 3" :key="row" class="p-ribbon">
          <div>
            <img
              v-for="(card, i) in [
                ...demoCards.slice((row - 1) * 4, row * 4),
                ...demoCards.slice((row - 1) * 4, row * 4),
              ]"
              :key="i"
              :src="card.img"
              alt=""
            />
          </div>
        </div>
      </div>
      <div class="p-hero-halo" aria-hidden="true" />
      <div class="p-hero-copy">
        <p class="p-hero-overline">LYCÈE OVERTURE · 不止于卡牌</p>
        <h1 v-if="variant === 'orbit'">
          让热爱，<br />在此<span>交汇。</span>
        </h1>
        <h1 v-else-if="variant === 'paper'">
          每一次相遇，<br />都值得<span>入藏。</span>
        </h1>
        <h1 v-else>你的热爱。<br /><span>即刻开场。</span></h1>
        <p class="p-hero-description">
          从一张心动的卡，到独属于你的构筑。<br />查卡、组卡、分享，在这里连接每一种可能。
        </p>
        <div class="p-hero-cta">
          <button class="p-button" @click="quickStart">
            开始使用 <ArrowDown :size="17" /></button
          ><NuxtLink :to="path('cards')" class="p-hero-secondary"
            >探索卡牌 <ArrowUpRight :size="18"
          /></NuxtLink>
        </div>
      </div>
      <div class="p-hero-fan p-scroll-art" aria-label="精选卡牌展示">
        <div class="p-orbit-ring" aria-hidden="true" />
        <button
          v-for="(card, i) in demoCards.slice(0, 3)"
          :key="card.code"
          :style="{ '--card-index': i }"
          :aria-label="`查看精选卡牌 ${card.code}`"
          @click="selected = card"
        >
          <img :src="card.img" :alt="card.name" fetchpriority="high" /><span>{{
            card.code
          }}</span>
        </button>
        <div class="p-fan-note">
          <span>{{
            variant === "paper" ? "THE COLLECTION" : "Collect your story."
          }}</span
          ><small>始于热爱，不止收藏</small>
        </div>
      </div>
      <div class="p-hero-baseline">
        <span>FIND YOUR NEXT FAVOURITE.</span
        ><button @click="quickStart">向下探索 <ArrowDown :size="12" /></button>
      </div>
    </section>
    <div class="p-brand-line" aria-hidden="true">
      <span>YUZUSOFT</span><i /> <span>SAGA PLANETS</span><i /><span
        >VisualArt’s</span
      ><i /><span>AUGUST</span><i /><span>AND YOUR FAVOURITES.</span>
    </div>
    <section id="quick-start" class="p-quick p-section">
      <div class="p-section-heading">
        <div>
          <p class="p-kicker">让今天，多一点期待</p>
          <h2>从这里，开启下一幕<span>。</span></h2>
        </div>
        <span class="p-section-aside">一次抽卡，一份灵感。</span>
      </div>
      <div class="p-quick-grid">
        <div class="p-draw-box">
          <div class="p-draw-heading">
            <span>今日的幸运卡</span><span>100 <small>初始抽数</small></span>
          </div>
          <div class="p-draw-stage" :class="{ drawing }">
            <i /><i /><button
              v-if="drawResult.length"
              class="p-drawn-card"
              aria-label="查看抽卡演示结果"
              @click="selected = drawResult[0]!"
            >
              <img :src="drawResult[0]!.img" :alt="drawResult[0]!.name" />
            </button>
            <div v-else class="p-card-back">
              <span>lycée</span><small>OVERTURE</small><i />
            </div>
            <span class="p-draw-orbit" />
          </div>
          <div class="p-draw-options">
            <ChoiceListbox
              v-model="pool"
              label="抽卡系列"
              hide-label
              :options="[
                { value: 'all', label: '全部系列' },
                ...featured.map((s) => ({ value: s.code, label: s.name })),
              ]"
            /><span>SP <b>10%</b></span>
          </div>
          <div class="p-draw-buttons">
            <button
              class="p-button p-button-quiet"
              :disabled="drawing"
              @click="draw(1)"
            >
              单抽 <Plus :size="16" /></button
            ><button class="p-button" :disabled="drawing" @click="draw(10)">
              {{ drawing ? "正在揭晓…" : "十连抽卡" }}<Wand2 :size="16" />
            </button>
          </div>
          <p class="p-demo-caption">动画演示 · 不消耗抽数，不产生真实资产</p>
          <div v-if="drawResult.length" class="p-draw-result" role="status">
            <button
              v-for="(card, i) in drawResult"
              :key="i"
              :aria-label="`演示抽卡 ${i + 1} ${card.code}`"
              @click="selected = card"
            >
              <img :src="card.img" :alt="card.name" />
            </button>
          </div>
        </div>
        <div class="p-shortcuts">
          <NuxtLink :to="path('cards')" class="p-shortcut p-shortcut-main"
            ><div><Search :size="24" /><ArrowUpRight :size="25" /></div>
            <span>每一种可能，都有迹可循。</span>
            <h3>卡牌图鉴</h3>
            <p>按系列探索 · 中日文效果 · 多维检索</p>
            <div class="p-inline-art">
              <img
                v-for="card in demoCards.slice(3, 6)"
                :key="card.code"
                :src="card.img"
                alt=""
              /></div></NuxtLink
          ><NuxtLink :to="path('decks')" class="p-shortcut"
            ><div><Layers :size="24" /><ArrowUpRight :size="25" /></div>
            <h3>我的构筑</h3>
            <p>让零散灵感，成为完整答案。</p>
            <span class="p-line-drawing" aria-hidden="true"
              ><i /><i /><i /></span></NuxtLink
          ><NuxtLink :to="path('tools')" class="p-shortcut"
            ><div><Wand2 :size="24" /><ArrowUpRight :size="25" /></div>
            <h3>随行工具箱</h3>
            <p>TTS、卡表、卡图，一处就够。</p></NuxtLink
          ><NuxtLink :to="path('community')" class="p-shortcut"
            ><div><Users :size="24" /><ArrowUpRight :size="25" /></div>
            <h3>灵感在流动</h3>
            <p>去社区，发现另一种解法。</p></NuxtLink
          >
        </div>
      </div>
    </section>
    <section class="p-featured-section p-section">
      <div class="p-section-heading">
        <div>
          <p class="p-kicker">熟悉的世界，崭新的相遇</p>
          <h2>你喜欢的，都在这里。</h2>
        </div>
        <NuxtLink :to="path('cards')" class="p-text-link"
          >探索全部系列 <ArrowUpRight :size="16"
        /></NuxtLink>
      </div>
      <div class="p-series-accordion">
        <NuxtLink
          v-for="series in featured"
          :key="series.code"
          :to="`${path('cards')}?series=${series.code}`"
          :class="{ expanded: activeSeries === series.code }"
          @mouseenter="activeSeries = series.code"
          @focus="activeSeries = series.code"
          ><img
            :src="`/design/cards/${series.image}.png`"
            :alt="series.name"
            loading="lazy" />
          <div>
            <span>{{ series.count }} 张收录卡牌</span>
            <h3>{{ series.name }}</h3>
            <ArrowUpRight :size="22" /></div
        ></NuxtLink>
      </div>
    </section>
    <section class="p-story p-section">
      <div class="p-story-copy">
        <p class="p-kicker">每一张，都有它的位置</p>
        <h2>一张，是心动。<br />六十张，<span>是你的故事。</span></h2>
        <p>
          收藏喜欢的角色，试试从未设想的搭配。<br />让每一个微小的灵感，都有被记住的地方。
        </p>
        <NuxtLink :to="path('decks')" class="p-button"
          >开始我的构筑 <ArrowRight :size="17"
        /></NuxtLink>
      </div>
      <div class="p-story-stack">
        <img
          v-for="(card, i) in demoCards.slice(6, 9)"
          :key="card.code"
          class="p-stack-card"
          :style="{ '--stack-index': i }"
          :src="card.img"
          :alt="card.name"
          loading="lazy"
        />
      </div>
    </section>
  </div>
</template>
