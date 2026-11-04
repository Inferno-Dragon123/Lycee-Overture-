<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3';
import type { SelectionBookmark } from '@tiptap/pm/state';
import { ChevronDown } from 'lucide-vue-next';
const props = defineProps<{ editor: Editor; kind: 'underline' | 'strike' | 'horizontalRule'; prepare?: () => void }>();
const tick = ref(0), menu = ref<HTMLDetailsElement>();
const label = computed(() => ({ underline: '下划线', strike: '删除线', horizontalRule: '分隔线' })[props.kind]);
const attributes = computed(() => { tick.value; return props.editor.getAttributes(props.kind); });
const active = computed(() => { tick.value; return props.editor.isActive(props.kind) || (props.kind === 'underline' && props.editor.isActive('link') && props.editor.getAttributes('textStyle').underline !== false); });
let bookmark: SelectionBookmark | undefined;
function restore() {
  props.prepare?.();
  if (bookmark) { try { props.editor.view.dispatch(props.editor.state.tr.setSelection(bookmark.resolve(props.editor.state.doc))); } catch { /* Retain current selection if the document changed. */ } }
}
function remember() { props.prepare?.(); bookmark = props.editor.state.selection.getBookmark(); }
function toggle() {
  if (!props.editor.isEditable) return;
  props.prepare?.(); const chain = props.editor.chain().focus();
  if (props.kind === 'horizontalRule') chain.setHorizontalRule().run();
  else if (props.kind === 'strike') chain.toggleStrike().run();
  else {
    const next = !(props.editor.isActive('underline') || (props.editor.isActive('link') && props.editor.getAttributes('textStyle').underline !== false));
    if (props.editor.isActive('link')) chain.setMark('textStyle', { ...props.editor.getAttributes('textStyle'), underline: next });
    if (next) chain.setUnderline().run(); else chain.unsetUnderline().run();
  }
}
function color(value: string | null) {
  if (!props.editor.isEditable) return;
  restore();
  if (props.kind === 'horizontalRule') {
    if (props.editor.isActive('horizontalRule')) props.editor.chain().focus().updateAttributes('horizontalRule', { color: value }).run();
    else {
      props.editor.chain().focus().setHorizontalRule().run();
      // The command leaves the caret in the next paragraph. Select the new rule
      // so repeated color changes edit it rather than inserting more rules.
      const selection = props.editor.state.selection;
      const pos = selection.$from.before() - 1;
      if (pos >= 0 && props.editor.state.doc.nodeAt(pos)?.type.name === 'horizontalRule')
        props.editor.chain().setNodeSelection(pos).updateAttributes('horizontalRule', { color: value }).run();
    }
  } else props.editor.chain().focus().setMark(props.kind, { color: value }).run();
  bookmark = props.editor.state.selection.getBookmark();
}
function close() { if (menu.value) menu.value.open = false; menu.value?.querySelector('summary')?.focus({ preventScroll: true }); }
function outside(event: PointerEvent) { if (!menu.value?.contains(event.target as Node) && menu.value) menu.value.open = false; }
const refresh = () => tick.value++;
onMounted(() => { props.editor.on('transaction', refresh); document.addEventListener('pointerdown', outside); });
onBeforeUnmount(() => { props.editor.off('transaction', refresh); document.removeEventListener('pointerdown', outside); });
</script>
<template>
  <span class="strategy-line-control">
    <button class="orbit-tool" type="button" :aria-pressed="kind === 'horizontalRule' ? undefined : active" @pointerdown.prevent @click="toggle">{{ label }}</button>
    <details ref="menu" class="strategy-line-menu" @keydown.esc.stop.prevent="close" @toggle="($event.target as HTMLDetailsElement).open && remember()">
      <summary class="orbit-tool" :aria-label="label + '颜色设置'" @pointerdown="remember"><ChevronDown :size="14" aria-hidden="true" /></summary>
      <div role="group" :aria-label="label + '颜色'">
        <label>{{ label }}颜色<input type="color" :value="attributes.color || '#46682b'" @input="color(($event.target as HTMLInputElement).value)" /></label>
        <button type="button" class="orbit-tool" @click="color(null)">跟随当前文字颜色</button>
      </div>
    </details>
  </span>
</template>
