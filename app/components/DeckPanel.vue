<script setup lang="ts">
import { Layers, Undo2, Check, ArrowUpRight } from "lucide-vue-next";
import { categoryLabels } from "#shared/domain/catalog";
defineProps<{ full?: boolean }>();
const {
  deck,
  total,
  storageStatus,
  notice,
  history,
  editable,
  save,
  undo,
  rename,
} = useDeck();
const grouped = computed(() =>
  Object.entries(
    Object.groupBy(deck.value.entries, (entry) => entry.card.category),
  ),
);
const statusText = computed(
  () =>
    ({
      loading: "正在读取本地草稿…",
      saved:
        deck.value.status === "complete"
          ? "本地卡组已保存"
          : "草稿已保存在此设备",
      saving: "正在写入本地…",
      error: "本地存储失败，当前改动可能无法恢复",
      invalid: "草稿格式异常，原记录已保留；编辑已暂停",
    })[storageStatus.value],
);
</script>
<template>
  <section class="deck-panel" aria-label="当前卡组">
    <div class="panel-title">
      <span><Layers :size="18" /> 当前卡组</span
      ><span class="status-pill">{{
        deck.status === "complete" ? "已保存" : "草稿"
      }}</span>
    </div>
    <label class="sr-only" for="deck-name">卡组名称</label>
    <input
      id="deck-name"
      class="deck-name"
      :value="deck.name"
      maxlength="80"
      :disabled="!editable"
      @input="rename(($event.target as HTMLInputElement).value)"
    />
    <div class="deck-count">
      <strong data-testid="deck-total">{{ total }}</strong
      ><span>/ 60 张</span
      ><span class="deck-progress-label">{{
        total === 60 ? "可以保存了" : `还差 ${60 - total} 张`
      }}</span>
    </div>
    <div class="progress-track">
      <div :style="{ width: `${(total / 60) * 100}%` }" />
    </div>
    <p
      class="storage-status"
      :class="{ warning: ['error', 'invalid'].includes(storageStatus) }"
      role="status"
    >
      {{ statusText }}
    </p>
    <div v-if="!deck.entries.length" class="empty-deck">
      <Layers :size="34" :stroke-width="1" />
      <h3>从一张喜欢的卡开始</h3>
      <p>开启组卡模式，点击卡片下方的 +，<br />你的构筑会出现在这里。</p>
    </div>
    <div
      v-for="[category, entries] in grouped"
      :key="category"
      class="deck-group"
    >
      <h3>
        {{ categoryLabels[category] || category }}
        <span
          >{{
            entries?.reduce((sum, entry) => sum + entry.quantity, 0)
          }}
          张</span
        >
      </h3>
      <div v-for="entry in entries" :key="entry.card.code" class="deck-entry">
        <NuxtLink
          :to="`/cards/${entry.card.code}`"
          :aria-label="`查看 ${entry.card.name}`"
          ><CardImage :src="entry.card.img" :name="entry.card.name"
        /></NuxtLink>
        <div class="entry-info">
          <p>{{ entry.card.name }}</p>
          <small>{{ entry.card.code }}</small
          ><QuantityControl :card="entry.card" />
        </div>
      </div>
    </div>
    <div class="deck-actions">
      <UiButton
        class="w-full"
        :disabled="!editable || total !== 60"
        @click="save"
        ><Check />保存本地卡组</UiButton
      >
      <UiButton
        variant="outline"
        class="w-full"
        :disabled="!history.length || !editable"
        @click="undo"
        ><Undo2 />撤销上一步</UiButton
      >
      <NuxtLink v-if="!full" class="text-link" to="/builder"
        >展开卡组工作台 <ArrowUpRight :size="15"
      /></NuxtLink>
    </div>
    <p v-if="notice" role="status" class="notice">{{ notice }}</p>
    <p class="fine-print">
      仅保存在当前浏览器。60 张为保存条件，赛事禁限与同名投入规则尚未校验。
    </p>
  </section>
</template>
