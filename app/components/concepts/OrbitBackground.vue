<script setup lang="ts">
// Pause composited CSS rotations while the document is hidden; no frame timer.
const hidden = ref(false);
function syncVisibility() {
  hidden.value = document.hidden;
}
onMounted(() => {
  syncVisibility();
  document.addEventListener("visibilitychange", syncVisibility);
});
onBeforeUnmount(() => {
  document.removeEventListener("visibilitychange", syncVisibility);
});
</script>

<template>
  <div
    class="a-official-background"
    :class="{ 'is-paused': hidden }"
    aria-hidden="true"
  >
    <div
      v-for="side in ['left', 'right']"
      :key="side"
      :class="`a-orbit-emblem a-orbit-${side}`"
    >
      <span class="a-orbit-layer a-orbit-outer" />
      <span class="a-orbit-layer a-orbit-inner" />
      <span class="a-orbit-layer a-orbit-center" />
    </div>
  </div>
</template>
