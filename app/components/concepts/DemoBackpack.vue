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
import { X, ArrowLeft, ArrowRight } from "lucide-vue-next";
import CardSearch from "./CardSearch.vue";

const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ back: [] }>();
const { theme, motion } = useShowcase();
const { owned, storageError, add, remove } = useCollection();
const tab = ref("bag");
const busy = ref(false),
  message = ref("");
watch(tab, () => {
  message.value = "";
});
async function change(code: string, deleting = false) {
  if (busy.value) return;
  busy.value = true;
  try {
    if (await (deleting ? remove(code) : add(code)))
      message.value = deleting ? "已从背包移除。" : "已加入背包。";
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <DialogRoot v-model:open="open"
    ><DialogPortal
      ><DialogOverlay class="p-dialog-overlay" />
      <DialogContent
        class="p-card-modal a-wallet concept-orbit"
        :class="{ 'a-light': theme === 'light', 'p-motion-off': !motion }"
      >
        <DialogTitle>展示背包</DialogTitle>
        <DialogDescription
          >从全站卡库添加卡牌，用于首页展示；仅保存在此浏览器。</DialogDescription
        >
        <DialogClose class="p-icon p-dialog-close" aria-label="关闭展示背包"
          ><X
        /></DialogClose>
        <button class="p-text-link" @click="emit('back')">
          <ArrowLeft :size="16" />返回更换展示卡牌
        </button>
        <div class="a-wallet-bar">
          <div class="a-wallet-tabs" role="group" aria-label="背包功能">
            <button :aria-pressed="tab === 'bag'" @click="tab = 'bag'">
              我的卡牌
            </button>
            <button :aria-pressed="tab === 'catalog'" @click="tab = 'catalog'">
              全站卡库
            </button>
          </div>
        </div>
        <p v-if="storageError" role="alert">{{ storageError }}</p>
        <p v-if="message" role="status">{{ message }}</p>
        <CardSearch
          :codes="
            tab === 'bag'
              ? Object.keys(owned).filter((code) => owned[code])
              : undefined
          "
          :art-selectable="tab !== 'bag'"
          @choose="(card) => change(card.code)"
          ><template #actions="{ card }"
            ><button
              v-if="tab === 'bag'"
              :aria-label="`移除 ${card.code}`"
              :disabled="busy"
              @click="change(card.code, true)"
            >
              移出背包</button
            ><button
              v-else
              :aria-label="`收藏 ${card.code}`"
              :disabled="busy || !!owned[card.code]"
              @click="change(card.code)"
            >
              {{ owned[card.code] ? "已在背包" : "加入背包" }}
            </button></template
          ></CardSearch
        >
      </DialogContent>
    </DialogPortal></DialogRoot
  >
</template>
