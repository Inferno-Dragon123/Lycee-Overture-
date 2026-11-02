<script setup lang="ts">
import { ArrowUpRight, Layers } from "lucide-vue-next";
const { mode } = useDeck();
useSeoMeta({ title: "本地卡组工作台 | Lycee 卡查工具箱" });
</script>
<template>
  <main id="main-content" class="builder-page page-container">
    <div class="page-intro">
      <div>
        <span class="eyebrow"><Layers :size="15" /> DECK WORKSPACE</span>
        <h1>构筑你的下一场可能。</h1>
        <p>灵感无需一次成型。在这里，一张一张完善你的卡组。</p>
      </div>
      <UiButton as-child
        ><NuxtLink to="/cards?view=cards" @click="mode = true"
          >继续选卡<ArrowUpRight /></NuxtLink
      ></UiButton>
    </div>
    <div class="builder-layout">
      <DeckPanel full />
      <aside class="builder-guide">
        <span class="eyebrow">构筑手记</span>
        <h2>先留住灵感，<br />再完成构筑。</h2>
        <ol>
          <li>
            <strong>随时停下，草稿会留下。</strong>
            <p>每次加减自动写入当前浏览器，刷新页面后继续编辑。</p>
          </li>
          <li>
            <strong>60 张，才是一副完整卡组。</strong>
            <p>不足 60 张保持草稿；满 60 张后，点击保存本地卡组。</p>
          </li>
          <li>
            <strong>保存在此设备。</strong>
            <p>本阶段尚未接入账号与云端。请勿清除浏览器的网站数据。</p>
          </li>
        </ol>
        <p class="fine-print">
          同名投入、禁限表与比赛环境校验将在后续阶段加入。
        </p>
      </aside>
    </div>
  </main>
</template>
