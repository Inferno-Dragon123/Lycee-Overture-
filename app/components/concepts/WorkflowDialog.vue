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
const open = defineModel<boolean>("open", { required: true });
defineProps<{ title: string; description?: string; wide?: boolean }>();
const { theme, motion } = useShowcase();
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
        ><DialogTitle>{{ title }}</DialogTitle
        ><DialogDescription>{{ description || "" }}</DialogDescription
        ><DialogClose class="p-icon p-dialog-close" aria-label="关闭窗口"
          ><X /></DialogClose
        ><slot /></DialogContent></DialogPortal
  ></DialogRoot>
</template>
