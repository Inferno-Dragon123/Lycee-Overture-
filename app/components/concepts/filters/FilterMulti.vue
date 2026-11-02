<script setup lang="ts">
import { Listbox, ListboxButton, ListboxOptions, ListboxOption, ListboxLabel } from "@headlessui/vue";
import { Check, ChevronDown, Search } from "lucide-vue-next";
const props = defineProps<{ label: string; options: { value: string; label: string; keywords?: string; group?: string }[] }>();
const model = defineModel<string[]>({ required: true });
const query = ref("");
const trigger = ref<{ $el: HTMLElement }>();
const filtered = computed(() => props.options.filter(o => `${o.label} ${o.value} ${o.keywords || ""} ${o.group || ""}`.normalize("NFKC").toLowerCase().includes(query.value.normalize("NFKC").toLowerCase())));
</script>
<template>
  <Listbox v-model="model" multiple as="div" class="f-multi" v-slot="{ open }">
    <ListboxLabel class="f-label">{{ label }}</ListboxLabel>
    <ListboxButton ref="trigger" class="f-multi-trigger">
      <span>{{ model.length ? model.map(v => options.find(o => o.value === v)?.label || v).join('、') : '不限' }}</span>
      <span v-if="model.length" class="f-count">{{ model.length }}</span><ChevronDown :size="16" :class="{ 'is-open': open }" />
    </ListboxButton>
    <Transition name="f-options">
      <ListboxOptions v-if="open" static class="f-multi-options" as="ul">
        <li role="none" class="f-option-search"><Search :size="16" /><input v-model="query" :aria-label="`搜索${label}选项`" placeholder="搜索选项" @keydown.stop @keydown.escape.prevent="trigger?.$el.click()" /></li>
        <ListboxOption v-for="o in filtered" :key="o.value" :value="o.value" as="template" v-slot="{ selected, active }">
          <li class="f-option" :class="{ 'is-selected': selected, 'is-active': active }"><Check :size="15" :class="{ 'is-hidden': !selected }" /><span>{{ o.label }}<small v-if="o.group">{{ o.group }}</small></span></li>
        </ListboxOption>
        <li v-if="!filtered.length" role="none" class="f-help">没有匹配的选项。</li>
      </ListboxOptions>
    </Transition>
  </Listbox>
</template>
