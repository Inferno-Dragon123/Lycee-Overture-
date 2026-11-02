<script setup lang="ts">
import { Plus, ExternalLink, Minus } from "lucide-vue-next";
import { categoryLabels, type Card } from "#shared/domain/catalog";
defineProps<{ card: Card }>();
const language = ref<"zh" | "ja">("zh");
const { total, count, editable, change } = useDeck();
</script>
<template>
  <div class="card-detail">
    <div class="detail-art">
      <CardImage :src="card.img" :name="card.name" eager /><a
        :href="`https://lycee-tcg.com/card/card_detail.php?cardno=${encodeURIComponent(card.code)}`"
        target="_blank"
        rel="noopener noreferrer"
        class="text-link"
        >前往官方卡牌资料 <ExternalLink :size="13"
      /></a>
    </div>
    <div class="detail-copy">
      <div class="detail-code">
        <span>{{ card.code }}</span
        ><span class="rarity-tag">{{ card.rarity }}</span
        ><span>{{ categoryLabels[card.category] || card.category }}</span>
      </div>
      <h2>{{ card.name }}</h2>
      <p class="detail-version">{{ card.version }}</p>
      <dl class="stats">
        <div
          v-for="(value, label) in {
            属性: card.attribute,
            EX: card.ex,
            COST: card.cost || '—',
            AP: card.ap,
            DP: card.dp,
            SP: card.sp,
            DMG: card.dmg,
          }"
          :key="label"
        >
          <dt>{{ label }}</dt>
          <dd>{{ value ?? "—" }}</dd>
        </div>
      </dl>
      <div class="language-tabs" role="group" aria-label="效果语言">
        <button :aria-pressed="language === 'zh'" @click="language = 'zh'">
          中文效果</button
        ><button :aria-pressed="language === 'ja'" @click="language = 'ja'">
          日本語原文
        </button>
      </div>
      <p class="effect-text" :lang="language === 'ja' ? 'ja' : 'zh-CN'">
        {{
          (language === "zh" ? card.textZh : card.textJa) || "此卡暂无效果文本"
        }}
      </p>
      <p class="fine-print">中文为辅助译文，规则与卡牌效果以官方原文为准。</p>
      <div class="detail-add">
        <UiButton :disabled="!editable || total >= 60" @click="change(card, 1)"
          ><Plus />加入卡组</UiButton
        ><UiButton
          v-if="count(card.code)"
          variant="outline"
          :disabled="!editable"
          :aria-label="`减少 ${card.code}`"
          @click="change(card, -1)"
          ><Minus /></UiButton
        ><span>已加入 {{ count(card.code) }} 张 · 共 {{ total }}/60 张</span>
      </div>
    </div>
  </div>
</template>
