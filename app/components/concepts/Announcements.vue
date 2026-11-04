<script setup lang="ts">
import type { AnnouncementFeed } from '#shared/domain/announcements';
import OrbitButton from './OrbitButton.vue';
const feed = ref<AnnouncementFeed | null>(null), busy = ref(false), error = ref('');
let timer: ReturnType<typeof setInterval> | undefined;
let stopped = false;
async function load() {
  if (busy.value) return;
  busy.value = true; error.value = '';
  try { const result = await $fetch<AnnouncementFeed>('/api/announcements'); if (!stopped) feed.value = result; }
  catch { if (!stopped) error.value = '公告暂时无法读取，请稍后重试。'; }
  finally { if (!stopped) busy.value = false; }
}
function date(raw: string) { return raw ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(raw)) : ''; }
onMounted(() => { void load(); timer = setInterval(() => { if (!document.hidden) void load(); }, 60000); });
onBeforeUnmount(() => { stopped = true; clearInterval(timer); });
</script>
<template>
  <section class="site-announcements" aria-label="站点更新公告">
    <h2>更新公告</h2>
    <p class="announcement-intro">功能调整与修复记录，与项目 GitHub 提交同步更新。</p>
    <p v-if="feed?.release" class="announcement-release">当前已发布 <a :href="feed.release.url" target="_blank" rel="noopener noreferrer">{{ feed.release.sha.slice(0, 7) }}</a><time v-if="feed.release.publishedAt" :datetime="feed.release.publishedAt">{{ date(feed.release.publishedAt) }}</time></p>
    <p v-if="busy && !feed" role="status">正在读取更新公告…</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="feed?.stale" role="status">GitHub 暂时不可用，{{ feed.unavailable ? '可先查看当前已发布版本。' : '暂时显示上次同步的更新记录。' }}</p>
    <OrbitButton v-if="error || feed?.stale" variant="outline" tone="neutral" :busy="busy" @click="load">重试读取公告</OrbitButton>
    <ol v-if="feed?.items.length" class="announcement-list">
      <li v-for="item in feed.items" :key="item.sha">
        <div class="announcement-meta"><time v-if="item.committedAt" :datetime="item.committedAt">{{ date(item.committedAt) }}</time><span>{{ item.state === 'published' ? '已发布' : item.state === 'pending' ? '待发布' : 'GitHub 提交' }}</span></div>
        <h3>{{ item.title }}</h3><p v-if="item.body" class="announcement-body">{{ item.body }}</p>
        <a :href="item.url" target="_blank" rel="noopener noreferrer">查看提交 {{ item.sha.slice(0, 7) }}</a>
      </li>
    </ol>
    <p v-else-if="feed && !feed.unavailable">暂无新的更新记录。</p>
    <a v-if="feed" class="announcement-repository" :href="feed.repositoryUrl" target="_blank" rel="noopener noreferrer">项目完整更新记录</a>
  </section>
</template>
<style scoped>
.site-announcements { min-width: 0; color: var(--ink); }
h2 { font-size: 28px; line-height: 1.35; margin-bottom: 12px; }
.announcement-intro { font-size: 14px; line-height: 1.7; }
.announcement-release { display: flex; flex-wrap: wrap; gap: 8px 12px; padding-block: 16px; border-bottom: 1px solid var(--line); font-size: 13px; }
.announcement-list { list-style: none; padding: 0; margin: 0; }
.announcement-list li { padding-block: 20px; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; }
.announcement-meta { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; font-variant-numeric: tabular-nums; }
h3 { margin-top: 8px; font-size: 17px; line-height: 1.6; }
.announcement-body { white-space: pre-wrap; font-size: 14px; line-height: 1.8; margin-top: 8px; }
a { text-decoration: underline; text-underline-offset: 3px; overflow-wrap: anywhere; }
.announcement-list a { display: inline-block; padding-block: 8px; font-size: 13px; }
.announcement-repository { display: inline-block; margin-top: 16px; padding-block: 8px; font-size: 13px; }
</style>
