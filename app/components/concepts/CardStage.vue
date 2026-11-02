<script setup lang="ts">
import type { ShowcaseCard } from "~/demo/collection";
import type * as Three from "three";
import { cardTextureSource } from "#shared/domain/card-artwork";
import { createDrawSurface } from "~/scene/draw-surface";
import {
  DRAW_CONFIG as C,
  drawCameraDistance,
  drawTargets,
} from "~/scene/draw-config";
const props = withDefaults(
  defineProps<{
    cards: ShowcaseCard[];
    kind?: "draw";
    sequence?: number;
    amount?: number;
  }>(),
  { kind: "draw", sequence: 0, amount: 1 },
);
const emit = defineEmits<{ complete: []; ready: [] }>();
const { motion } = useShowcase();
const host = ref<HTMLElement>(),
  state = ref("loading");
let dead = false,
  dispose = () => {},
  play: (() => void) | undefined,
  updateMotion: (() => void) | undefined;
onMounted(async () => {
  const modules = await Promise.all([
    import("three"),
    import("gsap"),
    import("three/addons/environments/RoomEnvironment.js"),
  ]).catch(() => null);
  if (dead) return;
  if (!modules) {
    state.value = "fallback";
    emit("complete");
    return;
  }
  const [T, { gsap }, { RoomEnvironment }] = modules,
    element = host.value!;
  let renderer: Three.WebGLRenderer;
  try {
    renderer = new T.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch {
    state.value = "fallback";
    emit("complete");
    return;
  }
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  element.prepend(renderer.domElement);
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(C.fov, 1, 0.1, 80);
  const room = new RoomEnvironment();
  const pmrem = new T.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.35;
  room.dispose();
  pmrem.dispose();
  scene.add(new T.AmbientLight(0xffffff, 0.9));
  const light = new T.DirectionalLight(0xfff5e8, 1.6);
  light.position.set(-3, 4, 6);
  scene.add(light);
  const rim = new T.DirectionalLight(0xc4deff, 1);
  rim.position.set(4, -1, 3);
  scene.add(rim);
 const surface = createDrawSurface(T);

// =========================================
// 卡牌侧边材质：保留物理光照与实体质感
// =========================================
const edge = new T.MeshStandardMaterial({
  color: 0xe3decf,
  roughness: 0.55,
  metalness: 0.08,
});

// =========================================
// 卡牌印刷表面：不受环境光影响，保留原色
// =========================================
const createPrintMaterial = () =>
  new T.MeshBasicMaterial({
    color: 0xffffff,
    toneMapped: false,
  });

// 已抽出卡牌的背面
const backs = createPrintMaterial();

// 牌堆卡背：保留透明度动画支持
const deckBack = new T.MeshBasicMaterial({
  color: 0xffffff,
  toneMapped: false,
  transparent: true,
  opacity: 1,
});

// 牌堆侧边：保留透明度动画支持
const deckEdge = edge.clone();
deckEdge.transparent = true;

// 所有卡牌正面
const fronts = Array.from(
  { length: 10 },
  () => createPrintMaterial()
);
  const deck = Array.from({ length: 6 }, (_, i) => {
    const mesh = surface.card(deckBack, deckBack, deckEdge, false, true);
    mesh.position.set(-0.42 + i * 0.027, -0.12 + i * 0.014, -0.38 - i * 0.036);
    mesh.rotation.set(-0.08, -0.16, -0.09);
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });
  const cards = fronts.map((front) => {
    const mesh = surface.card(front, backs, edge, true);
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });
  const loader = new T.TextureLoader(),
    textures = new Map<string, Promise<Three.Texture>>(),
    loaded = new Set<Three.Texture>();
  let failed = false,
    visible = true,
    run = 0,
    lastComplete = -1,
    currentCount = 1;
  let timeline: ReturnType<typeof gsap.timeline> | undefined;
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const reduce = () => !motion.value || media.matches;
  const canRun = () => !dead && !failed && visible && !document.hidden;
  let maxNdc = 0;
  const corner = new T.Vector3();
  function render() {
    if (!canRun()) return;
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    for (const mesh of [...deck, ...cards])
      if (mesh.visible)
        for (const x of [-C.cardWidth / 2 - 0.006, C.cardWidth / 2 + 0.006])
          for (const y of [-C.cardHeight / 2 - 0.006, C.cardHeight / 2 + 0.006])
            for (const z of [
              -C.cardThickness / 2 - 0.007,
              C.cardThickness / 2 + 0.007,
            ]) {
              corner
                .set(x, y, z)
                .applyMatrix4(mesh.matrixWorld)
                .project(camera);
              maxNdc = Math.max(maxNdc, Math.abs(corner.x), Math.abs(corner.y));
            }
    element.dataset.maxNdc = maxNdc.toFixed(3);
    element.dataset.surface = fronts[0]!.type;
    element.dataset.cardDepth = String(C.cardThickness);
    // Match the transparent varnish fade to the existing GSAP deck fade.
    surface.setDeckFinishOpacity(deckBack.opacity);
    renderer.render(scene, camera);
  }
  function resize() {
    const { width, height } = element.getBoundingClientRect();
    camera.aspect = width / Math.max(height, 1);
    renderer.setPixelRatio(
      Math.min(devicePixelRatio, width < 450 ? 1.25 : 1.6),
    );
    renderer.setSize(Math.max(width, 1), Math.max(height, 1));
    camera.position.z = drawCameraDistance(camera.aspect, currentCount);
    camera.updateProjectionMatrix();
    render();
  }
  function activity() {
    timeline?.paused(!canRun());
    render();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(element);
  const observer = new IntersectionObserver(([entry]) => {
    visible = !!entry?.isIntersecting;
    activity();
  });
  observer.observe(element);
  document.addEventListener("visibilitychange", activity);
  async function texture(url: string) {
    if (!textures.has(url))
      textures.set(
        url,
        loader
            .loadAsync(cardTextureSource(url))
          .then((t) => {
            if (dead) {
              t.dispose();
              throw new Error("disposed");
            }
            t.colorSpace = T.SRGBColorSpace;
            t.anisotropy = Math.min(
              4,
              renderer.capabilities.getMaxAnisotropy(),
            );
            loaded.add(t);
            return t;
          })
          .catch((error) => {
            textures.delete(url);
            throw error;
          }),
      );
    return textures.get(url)!;
  }
  function complete() {
    if (lastComplete !== props.sequence) {
      lastComplete = props.sequence;
      emit("complete");
    }
  }
  function finish() {
    if (dead || failed) return;
    state.value = "ready";
    render();
    complete();
    emit("ready");
  }
  function fallback() {
    if (dead) return;
    failed = true;
    timeline?.kill();
    state.value = "fallback";
    renderer.domElement.style.visibility = "hidden";
    complete();
  }
  const lost = (event: Event) => {
    event.preventDefault();
    fallback();
  };
  renderer.domElement.addEventListener("webglcontextlost", lost);
  play = async () => {
    if (failed) {
      complete();
      return;
    }
    const generation = ++run;
    timeline?.kill();
    state.value = "animating";
    try {
      const [back, faces] = await Promise.all([
        texture("/design/back.png"),
        Promise.all(
          props.cards.slice(0, props.amount).map((c) => texture(c.img)),
        ),
      ]);
      if (dead || generation !== run) return;
      backs.map = back;
      backs.needsUpdate = true;
      deckBack.map = back;
      deckBack.needsUpdate = true;
      deckBack.opacity = deckEdge.opacity = 1;
      deck.forEach((card) => (card.visible = true));
      cards.forEach((c, i) => {
        c.visible = props.sequence > 0 && i < faces.length;
        fronts[i]!.map = faces[i] || back;
        fronts[i]!.needsUpdate = true;
      });
      const idle = props.sequence === 0,
        current = idle ? 0 : faces.length;
      const target = drawTargets(current);
      maxNdc = 0;
      currentCount = Math.max(1, current);
      const settle = () =>
        cards.slice(0, current).forEach((card, i) => {
          const t = target[i]!;
          card.position.set(t.x, t.y, t.z);
          card.rotation.set(t.rx, t.ry, t.rz);
          card.scale.setScalar(t.scale);
        });
      if (idle || reduce()) {
        deck.forEach((card) => (card.visible = idle));
        settle();
        resize();
        finish();
        return;
      }
      cards.slice(0, current).forEach((card, i) => {
        card.position.set(-0.3, -0.07, 0.05 + i * 0.02);
        card.rotation.set(-0.08, Math.PI, -0.09);
        card.scale.setScalar(1);
      });
      resize();
      timeline = gsap.timeline({
        paused: true,
        onUpdate: render,
        onComplete: () => {
          deck.forEach((card) => (card.visible = false));
          settle();
          finish();
        },
      });
      timeline.to(
        [deckBack, deckEdge],
        { opacity: 0, duration: 0.4, ease: "power2.out" },
        0.7 + (current - 1) * C.stagger,
      );
      deck.forEach((card, i) => {
        timeline!.to(
          card.position,
          { x: card.position.x - 0.07, duration: 0.22, ease: "power2.inOut" },
          0,
        );
        timeline!.to(
          card.position,
          { x: -0.42 + i * 0.027, duration: 0.45, ease: "power2.out" },
          0.25,
        );
      });
      cards.slice(0, current).forEach((card, i) => {
        const t = target[i]!,
          at = 0.22 + i * C.stagger;
        timeline!.to(
          card.scale,
          {
            x: t.scale,
            y: t.scale,
            z: t.scale,
            duration: 0.3,
            ease: "power2.out",
          },
          at,
        );
        timeline!.to(
          card.position,
          {
            y: current === 1 ? 0.6 : 1.05,
            z: 1.05,
            duration: 0.42,
            ease: "power3.out",
          },
          at,
        );
        timeline!.to(
          card.rotation,
          { x: t.rx, y: t.ry, z: t.rz, duration: 0.58, ease: "power2.inOut" },
          at + 0.16,
        );
        timeline!.to(
          card.position,
          { x: t.x, y: t.y, z: t.z + 0.06, duration: 0.66, ease: "power3.out" },
          at + 0.39,
        );
        timeline!.to(
          card.position,
          { z: t.z, duration: 0.28, ease: "sine.out" },
          at + 1.05,
        );
      });
      timeline.to(
        {},
        { duration: 0.01 },
        current === 1 ? 1.79 : C.duration - 0.01,
      );
      activity();
    } catch {
      if (generation === run) fallback();
    }
  };
  updateMotion = () => {
    if (reduce()) timeline?.progress(1);
    render();
  };
  media.addEventListener("change", updateMotion);
  dispose = () => {
    run++;
    timeline?.kill();
    resizeObserver.disconnect();
    observer.disconnect();
    document.removeEventListener("visibilitychange", activity);
    media.removeEventListener("change", updateMotion!);
    renderer.domElement.removeEventListener("webglcontextlost", lost);
    surface.dispose();
    environment.dispose();
    edge.dispose();
    backs.dispose();
    deckBack.dispose();
    deckEdge.dispose();
    fronts.forEach((m) => m.dispose());
    loaded.forEach((t) => t.dispose());
    textures.clear();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
  resize();
  play();
});
watch(
  () => [props.sequence, props.cards.map((c) => c.code).join("|")],
  () => {
    if (play) play();
    else if (state.value === "fallback") emit("complete");
  },
);
watch(motion, () => updateMotion?.());
onBeforeUnmount(() => {
  dead = true;
  dispose();
});
</script>
<template>
  <div
    ref="host"
    class="a-card-stage a-draw-stage"
    data-stage="draw"
    :data-state="state"
    :data-sequence="sequence"
    :data-card-codes="cards.map((c) => c.code).join(',')"
    role="img"
    aria-label="牌堆抽卡 3D 动画"
  >
    <div
      v-if="state === 'fallback' || state === 'loading'"
      class="a-draw-fallback"
      :class="{ 'a-draw-fallback-many': amount > 1 && sequence > 0 }"
    >
      <template v-if="cards.length && sequence > 0"
        ><img
          v-for="(card, i) in cards.slice(0, amount)"
          :key="card.code + i"
          :src="card.img"
          alt=""
      /></template>
      <img v-else src="/design/back.png" alt="官方卡背" />
      <p v-if="state === 'fallback'">当前设备使用静态卡牌展示。</p>
    </div>
  </div>
</template>
