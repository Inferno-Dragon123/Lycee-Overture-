<script setup lang="ts">
const props = defineProps<{ src: string; name: string; eager?: boolean }>();
const failed = ref(false);
const loaded = ref(false);
watch(
  () => props.src,
  () => {
    failed.value = false;
    loaded.value = false;
  },
);
</script>
<template>
  <div class="card-image">
    <img
      v-if="!failed"
      :src="src"
      :alt="name"
      :loading="eager ? 'eager' : 'lazy'"
      width="300"
      height="420"
      decoding="async"
      referrerpolicy="no-referrer"
      :class="{ 'image-loaded': loaded }"
      @load="loaded = true"
      @error="failed = true"
    />
    <div v-if="!loaded" class="image-fallback" aria-hidden="true">
      <span>LYCÈE</span
      ><small>{{ failed ? "卡图暂时无法加载" : "卡图加载中" }}</small>
    </div>
  </div>
</template>
