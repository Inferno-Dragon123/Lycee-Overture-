<script setup lang="ts">
import WorkflowDialog from "../WorkflowDialog.vue";
import OrbitButton from "../OrbitButton.vue";
import { isCustomDeckCover } from '#shared/domain/deck-library';
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
const account = useWorkflowAccount();
const uploading = ref(false), uploadError = ref(''), uploadedCover = ref('');
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
      props.cover && (props.quantities[props.cover] || isCustomDeckCover(props.cover))
        ? props.cover
        : cards.value[0]?.code || "";
    uploadError.value = '';
    uploadedCover.value = isCustomDeckCover(props.cover) ? props.cover : '';
  }
});
async function upload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || uploading.value) return;
  uploadError.value = '';
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    uploadError.value = '请选择 5 MiB 以内的 PNG、JPEG 或 WebP 图片。'; input.value = ''; return;
  }
  uploading.value = true;
  try {
    const body = new FormData(); body.append('image', file);
    const result = await $fetch<{ url: string }>('/api/workflow/deck-covers', { method: 'POST', body });
    uploadedCover.value = cover.value = result.url;
  } catch (error) {
    uploadError.value = (error as { data?: { message?: string } }).data?.message || '封面上传失败，请重试。';
  } finally { uploading.value = false; input.value = ''; }
}
function submit() {
  if (props.busy || uploading.value || !name.value.trim() || !cover.value) return;
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
        <label v-if="account.user.value">上传自定义封面（PNG、JPEG、WebP，最大 5 MiB）<input type="file" accept="image/png,image/jpeg,image/webp" :disabled="uploading || busy" @change="upload" /></label>
        <p v-else class="p-muted">登录后可上传自定义封面。</p>
        <p v-if="uploading" role="status">正在上传封面…</p>
        <p v-if="uploadError" role="alert">{{ uploadError }}</p>
        <div class="deck-cover-choices">
          <button v-if="uploadedCover" type="button" aria-label="已上传的自定义封面" :aria-pressed="cover === uploadedCover" @click="cover = uploadedCover"><img :src="uploadedCover" alt="自定义封面预览" /><span>自定义封面</span></button>
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
      <OrbitButton type="submit" :busy="busy || uploading" :disabled="uploading || !name.trim() || !cover">确认保存</OrbitButton>
    </form></WorkflowDialog
  >
</template>
