<script setup lang="ts">
import {loRules} from '~/content/lo-rules';
import {siteGuide} from '~/content/site-guide';
const props=defineProps<{kind:'rules'|'guide'}>();
const chapters=computed(()=>props.kind==='rules'?loRules:siteGuide),q=ref('');
const filtered=computed(()=>chapters.value.filter(c=>JSON.stringify(c).toLowerCase().includes(q.value.toLowerCase())));
</script>
<template>
  <div class="rule-reader">
    <aside class="reading-toc"><label>搜索本篇<input v-model="q" type="search" placeholder="章节、能力或关键词" /></label><nav aria-label="文章目录"><a v-for="c in filtered" :key="c.id" :href="'#'+c.id">{{ c.title }}</a></nav></aside>
    <article class="reading-prose">
      <header><p class="reading-kicker">{{ kind==='rules'?'从卡片到对局':'开始使用工具箱' }}</p><h2>{{ kind==='rules'?'LO规则妙妙小解':'网站使用指南' }}</h2><p v-if="kind==='rules'" class="reading-note">按原稿23页整理为网页，保留原文规则表述与例图。原稿属于入门讲解；具体对局以最新官方规则和卡面为准。</p></header>
      <nav v-if="kind==='guide'&&!q" class="guide-steps" aria-label="开始使用"><NuxtLink to="/concepts/orbit/cards">① 找卡</NuxtLink><span>→</span><a href="#build">② 组卡</a><span>→</span><a href="#account">③ 保存</a><span>→</span><a href="#share">④ 分享</a></nav>
      <p v-if="!filtered.length">没有找到该关键词，清空搜索即可查看全文。</p>
      <section v-for="c in filtered" :id="c.id" :key="c.id" class="rule-chapter"><h3>{{ c.title }}</h3><small v-if="c.pages.length">原稿第{{ c.pages.join('、') }}页</small>
        <div v-for="(part,i) in c.parts" :key="i" class="rule-part"><h4 v-if="part.title">{{ part.title }}</h4>
          <div v-if="part.images" class="rule-figures" :class="{'rule-diagram':c.id==='field'||c.id==='turn'||c.id==='cost'}"><figure v-for="(src,index) in part.images" :key="src"><a :href="src" target="_blank" rel="noopener"><img :src="src" :alt="part.alt+' '+(index+1)" loading="lazy" /></a></figure></div>
          <p v-for="t in part.text" :key="t">{{ t }}</p><ol v-if="part.list"><li v-for="t in part.list" :key="t">{{ t }}</li></ol>
          <div v-if="part.table" class="reading-table"><table><thead><tr><th v-for="h in part.table[0]" :key="h">{{ h }}</th></tr></thead><tbody><tr v-for="(row,index) in part.table.slice(1)" :key="index"><td v-for="(cell,j) in row" :key="j">{{ cell }}</td></tr></tbody></table></div>
        </div>
      </section>
      <a v-if="kind==='rules'" class="p-button" href="https://www.bilibili.com/video/BV1bZy7BkEWt" target="_blank" rel="noopener noreferrer">观看入门视频 ↗</a>
      <NuxtLink v-else to="/concepts/orbit/cards" class="p-button">打开卡牌查询 →</NuxtLink>
    </article>
  </div>
</template>
