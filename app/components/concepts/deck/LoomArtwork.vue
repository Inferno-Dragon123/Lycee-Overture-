<script setup lang="ts">
import { ImageOff } from "lucide-vue-next";
import { loomImagesKey } from "~/composables/useLoomV2Images";
import type { VisualLoomCard } from "#shared/domain/deck-loom-v2";
const props = withDefaults(defineProps<{ card: VisualLoomCard; priority?: number; crop?: boolean }>(), { priority: 2, crop: false });
const images = inject(loomImagesKey)!;
const root = ref<HTMLElement>();
const visible = ref(false);
const state = computed(() => props.card.img ? images.states.value[props.card.img] ?? "loading" : "error");
const position = computed(() => `${props.card.visualFocus?.x ?? 50}% ${props.card.visualFocus?.y ?? (props.card.category === "キャラクター" ? 35 : 45)}%`);
let observer: IntersectionObserver | undefined;
onMounted(() => {
  observer = new IntersectionObserver(items => { visible.value = items.some(item => item.isIntersecting); }, { rootMargin: "40px" });
  if (root.value) observer.observe(root.value);
  watch(() => [props.card.img, props.priority, visible.value] as const, () => {
    if (props.priority < 2 || visible.value) images.request(props.card.img, props.priority);
  }, { immediate: true });
});
onBeforeUnmount(() => observer?.disconnect());
</script>
<template>
  <span ref="root" class="v2-artwork" :class="{ 'is-cropped': crop }" :data-image-state="state">
    <img v-if="state === 'ready'" :src="card.img" :alt="card.name" :style="{ objectPosition: position }" decoding="async" draggable="false" />
    <span v-else class="v2-artwork-fallback" :aria-label="state === 'error' ? `${card.code} 卡图暂不可用` : `${card.code} 卡图加载中`">
      <ImageOff v-if="state === 'error'" :size="18" /><i v-else class="v2-image-skeleton" />
      <small>{{ card.code }}</small>
    </span>
  </span>
</template>
