<script setup lang="ts">
import { Primitive, type PrimitiveProps } from "reka-ui";
import { cva } from "class-variance-authority";
import { cn } from "~/lib/utils";
import type { HTMLAttributes } from "vue";

const props = withDefaults(
  defineProps<
    PrimitiveProps & {
      variant?: "default" | "outline" | "ghost";
      size?: "default" | "sm" | "icon";
      class?: HTMLAttributes["class"];
    }
  >(),
  { as: "button", variant: "default", size: "default" },
);
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
    :as="as"
    :as-child="asChild"
    :class="cn(variants({ variant, size }), props.class)"
    ><slot
  /></Primitive>
</template>
