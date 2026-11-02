<script setup lang="ts">
import {
  Listbox,
  ListboxButton,
  ListboxLabel,
  ListboxOptions,
  ListboxOption,
} from "@headlessui/vue";
import { Check, ChevronDown } from "lucide-vue-next";
defineProps<{
  label: string;
  options: { value: string; label: string }[];
  hideLabel?: boolean;
}>();
const value = defineModel<string>({ required: true });
</script>
<template>
  <Listbox v-model="value" as="div" class="relative min-w-0 text-sm">
    <ListboxLabel
      :class="hideLabel ? 'sr-only' : 'mb-2 block text-sm text-[var(--muted)]'"
      >{{ label }}</ListboxLabel
    >
    <ListboxButton
      class="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-left text-[var(--ink)] outline-none transition hover:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:scale-[.98]"
    >
      <slot name="button"
        ><span class="min-w-0 truncate">{{
          options.find((option) => option.value === value)?.label || "请选择"
        }}</span
        ><ChevronDown class="size-4 shrink-0"
      /></slot>
    </ListboxButton>
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 scale-95 opacity-0"
      enter-to-class="translate-y-0 scale-100 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 scale-100 opacity-100"
      leave-to-class="translate-y-1 scale-95 opacity-0"
    >
      <ListboxOptions
        class="absolute left-0 right-0 z-[65] mt-2 max-h-64 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1.5 text-[var(--ink)] shadow-2xl outline-none"
      >
        <ListboxOption
          v-for="option in options"
          :key="option.value"
          v-slot="{ active, selected }"
          :value="option.value"
          as="template"
        >
          <li
            class="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-3 transition"
            :class="active ? 'bg-[var(--accent)] text-[var(--on-accent)]' : ''"
          >
            <span>{{ option.label }}</span
            ><Check v-if="selected" class="size-4 shrink-0" />
          </li>
        </ListboxOption>
      </ListboxOptions>
    </Transition>
  </Listbox>
</template>
