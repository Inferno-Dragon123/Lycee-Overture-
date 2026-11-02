<script setup lang="ts">
import {
  Layers,
  Search,
  Sparkles,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-vue-next";
const { mode, total } = useDeck();
const menu = ref(false);
const motion = useCookie("lycee-motion", {
  default: () => "on",
  sameSite: "lax",
});
const route = useRoute();
watch(
  () => route.path,
  () => {
    menu.value = false;
  },
);
async function toggleMode() {
  mode.value = !mode.value;
  if (mode.value) await navigateTo("/cards?view=cards");
}
</script>
<template>
  <div class="app-shell" :class="{ 'motion-off': motion === 'off' }">
    <a class="skip-link" href="#main-content">跳转到内容</a>
    <header class="site-header">
      <NuxtLink to="/" class="wordmark" aria-label="Lycee Overture 首页"
        ><span class="logo-mark">L<span>✦</span></span
        ><span>LYCÈE <small>OVERTURE</small></span
        ><span class="wordmark-caption">卡查工具箱</span></NuxtLink
      >
      <nav class="desktop-nav" aria-label="主导航">
        <NuxtLink to="/cards"><Search :size="15" />卡牌图鉴</NuxtLink
        ><NuxtLink to="/builder"
          ><Layers :size="15" />本地卡组
          <span v-if="total" class="nav-count">{{ total }}</span></NuxtLink
        >
      </nav>
      <div class="header-actions">
        <button
          class="motion-toggle"
          :aria-pressed="motion === 'off'"
          :aria-label="motion === 'off' ? '开启动效' : '关闭动效'"
          @click="motion = motion === 'on' ? 'off' : 'on'"
        >
          <Sparkles :size="18" /></button
        ><button
          class="mode-switch"
          role="switch"
          :aria-checked="mode"
          @click="toggleMode"
        >
          <span class="switch-track"><span /></span>组卡模式</button
        ><button
          class="mobile-menu-button"
          aria-label="导航菜单"
          :aria-expanded="menu"
          @click="menu = !menu"
        >
          <X v-if="menu" /><Menu v-else />
        </button>
      </div>
    </header>
    <nav v-if="menu" class="mobile-nav" aria-label="手机导航">
      <NuxtLink to="/cards">卡牌图鉴</NuxtLink
      ><NuxtLink to="/builder">本地卡组 · {{ total }} 张</NuxtLink>
    </nav>
    <NuxtPage />
    <footer class="site-footer">
      <span
        >LYCÈE OVERTURE
        <span class="footer-dot">/</span> 为每一次灵感，找到那张卡。</span
      >
      <p>
        同人非官方网站 · 卡牌版权归 Lycee 官方及相应权利人所有 ·
        数据为自收集，第三方素材未经授权不可商用。
      </p>
      <div>
        <span>本地开发预览</span><span>致谢待补充</span
        ><span>ICP备案审核中</span
        ><a
          href="https://lycee-tcg.com"
          target="_blank"
          rel="noopener noreferrer"
          >官方网站 <ArrowUpRight :size="12"
        /></a>
      </div>
    </footer>
  </div>
</template>
