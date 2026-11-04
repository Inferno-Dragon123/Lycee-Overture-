<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { computed, inject, unref, type Ref } from "vue";
import Button from "../ui/button/Button.vue";

defineOptions({ inheritAttrs: false });
const conceptVariant = inject<string | Ref<string>>('concept-button-variant', 'orbit');
const palette = computed(() => unref(conceptVariant) === 'orbit' ? 'orbit' : 'concept');
withDefaults(defineProps<PrimitiveProps & {
  variant?: "default" | "outline" | "ghost";
  tone?: "brand" | "neutral" | "danger";
  size?: "default" | "sm" | "icon";
  busy?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  class?: HTMLAttributes["class"];
}>(), { as: "button", variant: "default", tone: "brand", size: "default" });
</script>

<template>
  <Button
    v-bind="$attrs"
    :palette="palette"
    :as="as"
    :as-child="asChild"
    :variant="variant"
    :tone="tone"
    :size="size"
    :busy="busy"
    :disabled="disabled"
    :type="type"
    :class="$props.class"
  ><slot /></Button>
</template>
