<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next';
import OrbitButton from '../OrbitButton.vue';
import { loRules } from '~/content/lo-rules';
import { siteGuide } from '~/content/site-guide';
import '~/assets/css/reading-visual.css';

const props = defineProps<{ kind: 'rules' | 'guide' }>();
const route = useRoute();
const chapters = computed(() => props.kind === 'rules' ? loRules : siteGuide);
const q = ref('');
const downloadingRules = ref(false), downloadError = ref('');
async function downloadRules(event: MouseEvent) {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  if (downloadingRules.value) return;
  downloadingRules.value = true; downloadError.value = '';
  try {
    const response = await fetch('/downloads/rules-original?raw=1');
    if (!response.ok || response.status === 204) throw new Error('Download failed');
    const pdf = await response.blob();
    if (!pdf.size) throw new Error('Download was empty');
    const url = URL.createObjectURL(pdf), link = document.createElement('a');
    link.href = url; link.download = 'LO规则妙妙小解.pdf';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch { downloadError.value = '原稿下载失败，请重试。'; }
  finally { downloadingRules.value = false; }
}
const filtered = computed(() => chapters.value.filter(chapter => JSON.stringify(chapter).toLowerCase().includes(q.value.trim().toLowerCase())));
const reader = ref<HTMLElement>();
const tocOpen = ref(false);
const activeChapter = ref('');
const currentTitle = computed(() => filtered.value.find(chapter => chapter.id === activeChapter.value)?.title || filtered.value[0]?.title || '暂无章节');
const directoryId = computed(() => 'reading-directory-' + props.kind);
let frame = 0;

function updateCurrentChapter() {
  frame = 0;
  const sections = [...(reader.value?.querySelectorAll<HTMLElement>('.rule-chapter') || [])];
  const threshold = (document.querySelector('.p-header')?.getBoundingClientRect().bottom || 82) + 32;
  activeChapter.value = sections.filter(section => section.getBoundingClientRect().top <= threshold).at(-1)?.id || sections[0]?.id || '';
}
function queueChapterUpdate() {
  if (!frame) frame = requestAnimationFrame(updateCurrentChapter);
}
function hashChapter() {
  try { return decodeURIComponent(route.hash.slice(1)); } catch { return ''; }
}
async function restoreAnchor() {
  await nextTick();
  const id = hashChapter();
  const target = id && [...(reader.value?.querySelectorAll<HTMLElement>('.rule-chapter') || [])].find(section => section.id === id);
  if (target) {
    activeChapter.value = target.id;
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
  } else updateCurrentChapter();
}
async function chooseChapter(event: MouseEvent, id: string) {
  event.preventDefault();
  tocOpen.value = false;
  await navigateTo({ path: route.path, query: route.query, hash: '#' + id });
  await restoreAnchor();
}
watch(() => route.hash, restoreAnchor);
watch(filtered, async () => { await nextTick(); updateCurrentChapter(); });
onMounted(() => {
  window.addEventListener('scroll', queueChapterUpdate, { passive: true });
  window.addEventListener('resize', queueChapterUpdate, { passive: true });
  void restoreAnchor();
});
onBeforeUnmount(() => {
  window.removeEventListener('scroll', queueChapterUpdate);
  window.removeEventListener('resize', queueChapterUpdate);
  if (frame) cancelAnimationFrame(frame);
});
</script>

<template>
  <div ref="reader" class="rule-reader">
    <details v-if="kind === 'rules'" class="reading-source">
      <summary>原稿来源与说明：</summary>
      <p class="reading-note">原作lo官方，译者姬松人（赞美姬哥）</p>
    </details>
    <a v-if="kind === 'rules'" class="reading-source-download" href="/downloads/rules-original" download="LO规则妙妙小解.pdf" :aria-busy="downloadingRules || undefined" :aria-disabled="downloadingRules || undefined" @click="downloadRules">下载原稿 PDF</a>
    <p v-if="downloadError" class="reading-download-error" role="alert">{{ downloadError }}</p>
    <aside class="reading-toc">
      <label>搜索本篇<input v-model="q" type="search" placeholder="章节、能力或关键词" /></label>
      <button class="reading-toc-toggle" :aria-expanded="tocOpen" :aria-controls="directoryId" :aria-label="tocOpen ? '收起本篇目录' : '展开本篇目录'" @click="tocOpen = !tocOpen">
        <span>本篇目录 · {{ filtered.length }}章</span><span class="reading-current">{{ currentTitle }}</span><ChevronDown :size="17" aria-hidden="true" />
      </button>
      <nav :id="directoryId" :data-open="tocOpen" aria-label="文章目录">
        <a v-for="chapter in filtered" :key="chapter.id" :href="'#' + chapter.id" :aria-current="activeChapter === chapter.id ? 'location' : undefined" @click="chooseChapter($event, chapter.id)">{{ chapter.title }}</a>
      </nav>
    </aside>
    <article class="reading-prose" :aria-label="kind === 'rules' ? 'LO规则妙妙小解正文' : '网站使用指南正文'">
      <nav v-if="kind === 'guide' && !q" class="guide-steps" aria-label="开始使用"><NuxtLink to="/concepts/orbit/cards">① 找卡</NuxtLink><span>→</span><a href="#build" @click="chooseChapter($event, 'build')">② 组卡</a><span>→</span><a href="#account" @click="chooseChapter($event, 'account')">③ 保存</a><span>→</span><a href="#share" @click="chooseChapter($event, 'share')">④ 分享</a></nav>
      <p v-if="!filtered.length" class="reading-empty-result" role="status">没有找到该关键词。<OrbitButton variant="ghost" tone="neutral" @click="q = ''">清空搜索</OrbitButton></p>
      <section v-for="chapter in filtered" :id="chapter.id" :key="chapter.id" class="rule-chapter">
        <h2>{{ chapter.title }}</h2><small v-if="chapter.pages.length">原稿第{{ chapter.pages.join('、') }}页</small>
        <div v-for="(part, i) in chapter.parts" :key="i" class="rule-part">
          <h3 v-if="part.title">{{ part.title }}</h3>
          <div v-if="part.images" class="rule-figures" :class="{ 'rule-diagram': chapter.id === 'field' || chapter.id === 'turn' || chapter.id === 'cost' }"><figure v-for="(src, index) in part.images" :key="src"><a :href="src" target="_blank" rel="noopener"><img :src="src" :alt="part.alt + ' ' + (index + 1)" loading="lazy" /></a></figure></div>
          <p v-for="text in part.text" :key="text">{{ text }}</p>
          <ol v-if="part.list"><li v-for="text in part.list" :key="text">{{ text }}</li></ol>
          <div v-if="part.table" class="reading-table"><table><thead><tr><th v-for="heading in part.table[0]" :key="heading">{{ heading }}</th></tr></thead><tbody><tr v-for="(row, index) in part.table.slice(1)" :key="index"><td v-for="(cell, j) in row" :key="j">{{ cell }}</td></tr></tbody></table></div>
        </div>
      </section>
      <OrbitButton as-child variant="outline" tone="neutral"><a v-if="kind === 'rules'" href="https://www.bilibili.com/video/BV1bZy7BkEWt" target="_blank" rel="noopener noreferrer">观看入门视频 ↗</a>
      <NuxtLink v-else to="/concepts/orbit/cards">打开卡牌查询 →</NuxtLink></OrbitButton>
    </article>
  </div>
</template>
