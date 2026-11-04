<script setup lang="ts">
import { Primitive, type PrimitiveProps } from "reka-ui";
import { cva } from "class-variance-authority";
import { computed } from "vue";
import { LoaderCircle } from "lucide-vue-next";
import { cn } from "~/lib/utils";
import type { HTMLAttributes } from "vue";

defineOptions({ inheritAttrs: false });
const props = withDefaults(
  defineProps<
    PrimitiveProps & {
      variant?: "default" | "outline" | "ghost";
      palette?: "default" | "orbit" | "concept";
      tone?: "brand" | "neutral" | "danger";
      size?: "default" | "sm" | "icon";
      busy?: boolean;
      disabled?: boolean;
      type?: "button" | "submit" | "reset";
      class?: HTMLAttributes["class"];
    }
  >(),
  { as: "button", variant: "default", palette: "default", tone: "brand", size: "default" },
);
const emit = defineEmits<{ click: [MouseEvent] }>();
const blocked = computed(() => !!(props.disabled || props.busy));
const nativeButton = computed(() => props.as === "button" && !props.asChild);
const legacyConceptClass = computed(() => props.size === "icon" ? "p-icon" : props.variant === "ghost" ? "p-text-link" : props.variant === "outline" ? "p-button p-button-quiet" : "p-button");
function guardDisabled(event: Event) {
  if (!blocked.value) return false;
  event.preventDefault();
  event.stopImmediatePropagation();
  return true;
}
function click(event: MouseEvent) {
  if (!guardDisabled(event)) emit("click", event);
}
const variants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-border bg-white hover:bg-muted",
        ghost: "hover:bg-muted text-foreground",
      },
      size: { default: "h-11 px-4", sm: "h-9 px-3", icon: "size-11" },
    },
  },
);
</script>

<template>
  <Primitive
    v-bind="$attrs"
    :as="as"
    :as-child="asChild"
    :class="cn(palette === 'orbit' ? 'orbit-action' : palette === 'concept' ? legacyConceptClass : variants({ variant, size }), props.class)"
    :data-palette="palette === 'orbit' ? palette : undefined"
    :data-variant="palette === 'orbit' ? variant : undefined"
    :data-tone="palette === 'orbit' ? tone : undefined"
    :data-size="palette === 'orbit' ? size : undefined"
    :disabled="nativeButton ? blocked : undefined"
    :aria-disabled="!nativeButton && blocked ? true : undefined"
    :aria-busy="busy || undefined"
    :tabindex="!nativeButton && blocked ? -1 : undefined"
    :type="type || (palette !== 'default' && nativeButton ? 'button' : undefined)"
    @click.capture="guardDisabled"
    @click="click"
    @auxclick.capture="guardDisabled"
  >
    <!-- Primitive's as-child contract requires one unchanged child, including link slots. -->
    <slot v-if="asChild || palette !== 'orbit'" />
    <template v-else>
      <span class="orbit-action-label" :style="busy ? { opacity: 0 } : undefined"><slot /></span>
      <LoaderCircle v-if="busy" class="orbit-action-spinner" aria-hidden="true" />
    </template>
  </Primitive>
</template>
