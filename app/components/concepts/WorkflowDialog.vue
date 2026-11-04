<script setup lang="ts">
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "reka-ui";
import { X } from "lucide-vue-next";
import OrbitButton from "./OrbitButton.vue";
const open = defineModel<boolean>("open", { required: true });
defineProps<{ title: string; description?: string; wide?: boolean }>();
const { theme, motion } = useShowcase();
const route = useRoute();
const isOrbit = computed(() => route.path.startsWith('/concepts/orbit'));
</script>
<template>
  <DialogRoot v-model:open="open"
    ><DialogPortal
      ><DialogOverlay class="p-dialog-overlay" /><DialogContent
        class="p-card-modal workflow-dialog concept-orbit"
        :class="{
          'a-light': theme === 'light',
          'p-motion-off': !motion,
          'workflow-wide': wide,
        }"
        >
        <header class="workflow-dialog-header">
          <DialogTitle>{{ title }}</DialogTitle>
          <DialogDescription :class="{ 'sr-only': !description }">{{ description || "" }}</DialogDescription>
          <OrbitButton v-if="isOrbit" as-child variant="ghost" tone="neutral" size="icon"><DialogClose class="p-icon p-dialog-close" aria-label="关闭窗口"><X /></DialogClose></OrbitButton>
          <DialogClose v-else class="p-icon p-dialog-close" aria-label="关闭窗口"><X /></DialogClose>
        </header>
        <div class="workflow-dialog-body"><slot /></div>
        <footer v-if="$slots.footer" class="workflow-dialog-footer"><slot name="footer" /></footer>
      </DialogContent></DialogPortal
  ></DialogRoot>
</template>
