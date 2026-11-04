<script setup lang="ts">
import WorkflowDialog from "../WorkflowDialog.vue";
import OrbitButton from "../OrbitButton.vue";
const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{
  name: string;
  description?: string;
  cover?: string;
  quantities: Record<string, number>;
  title?: string;
  busy?: boolean;
  error?: string;
}>();
const emit = defineEmits<{
  save: [{ name: string; description: string; cover: string }];
}>();
const catalog = useOrbitCatalog();
const name = ref(""),
  description = ref(""),
  cover = ref("");
const cards = computed(() =>
  Object.keys(props.quantities)
    .filter((code) => props.quantities[code]! > 0)
    .flatMap((code) =>
      catalog.byCode.value.get(code) ? [catalog.byCode.value.get(code)!] : [],
    ),
);
watch(open, (v) => {
  if (v) {
    name.value = props.name;
    description.value = props.description || "";
    cover.value =
      props.cover && props.quantities[props.cover]
        ? props.cover
        : cards.value[0]?.code || "";
  }
});
function submit() {
  if (props.busy || !name.value.trim() || !cover.value) return;
  emit("save", { name: name.value.trim(), description: description.value.trim(), cover: cover.value });
}
</script>
<template>
  <WorkflowDialog
    v-model:open="open"
    :title="title || '保存卡组'"
    description="确认名称、简介和封面。"
    ><form
      class="workflow-form"
      @submit.prevent="submit"
    >
      <label>卡组名称<input v-model="name" maxlength="100" required /></label
      ><label
        >卡组简介<textarea v-model="description" maxlength="2000" rows="4" />
      </label>
      <fieldset>
        <legend>选择封面</legend>
        <div class="deck-cover-choices">
          <button
            v-for="card in cards"
            :key="card.code"
            type="button"
            :aria-label="`封面 ${card.code}`"
            :aria-pressed="cover === card.code"
            @click="cover = card.code"
          >
            <img :src="card.img" :alt="card.name" loading="lazy" /><span>{{
              card.code
            }}</span>
          </button>
        </div>
      </fieldset>
      <p v-if="error" role="alert">{{ error }}</p>
      <OrbitButton type="submit" :busy="busy" :disabled="!name.trim() || !cover">确认保存</OrbitButton>
    </form></WorkflowDialog
  >
</template>
