<script setup lang="ts">
import { Sun, Moon } from "lucide-vue-next";
import DeckLoom from "~/components/concepts/deck/DeckLoom.vue";
import DeckLoomV2 from "~/components/concepts/deck/DeckLoomV2.vue";
import LoomArtwork from "~/components/concepts/deck/LoomArtwork.vue";
import type { LoomGrouping, VisualLoomCard } from "#shared/domain/deck-loom-v2";
import "~/assets/css/concepts.css";
import "~/assets/css/orbit.css";
import "~/assets/css/deck-loom-v2.css";
const { size, source, loading, error, entries, total, order, focused, recent, history, reset, loadReal, useMock, change, undo, clear } = useLoomV2Prototype();
useLoomV2Images();
const ready = ref(false), light = ref(false);
const view = ref<"v1" | "v2" | "list">("v2");
const grouping = ref<LoomGrouping>("none"), navigatorMode = ref<"nearby" | "recent">("nearby");
const settings = ref<HTMLDetailsElement>();
const detail = ref<VisualLoomCard | null>(null), dialog = ref<HTMLDialogElement>();
let returnFocus: HTMLElement | null = null;
async function showDetail(card: VisualLoomCard) {
  returnFocus = document.activeElement as HTMLElement;
  detail.value = card;
  await nextTick(); dialog.value?.showModal();
}
function modifyScene(count: number) { reset(count); settings.value?.removeAttribute("open"); }
onMounted(() => { ready.value = true; });
useSeoMeta({ title: "Deck Loom V2 视觉原型 | Lycee" });
</script>
<template>
  <main class="concept concept-orbit v2-prototype" :class="{ 'a-light': light }" :data-ready="ready" :data-source="source" :data-loading="loading">
    <header class="v2-page-heading"><div><h1>卡组织机 V2</h1><p>{{ loading ? '正在读取真实卡库…' : source === 'api' ? '真实混合样本 · 测试编辑不写入当前构筑' : '模拟样本 · 测试编辑不写入当前构筑' }}</p></div>
      <button :aria-label="light ? '切换夜晚模式' : '切换日间模式'" @click="light = !light"><Sun v-if="!light" :size="19" /><Moon v-else :size="19" /></button>
    </header>
    <div class="v2-scenarios" aria-label="卡种测试场景"><button v-for="count in [20,40,60]" :key="count" :aria-pressed="size === count" :disabled="loading || !entries.length && !history.length" @click="modifyScene(count)">{{ count }} 种</button>
      <details ref="settings" class="v2-settings"><summary>测试设置</summary><div class="v2-settings-menu">
        <button :disabled="loading" @click="loadReal(); settings?.removeAttribute('open')">重新读取真实卡库</button>
        <button @click="useMock(); settings?.removeAttribute('open')">使用模拟数据</button>
        <button :disabled="!total" @click="clear(); settings?.removeAttribute('open')">清空测试卡组</button>
        <button :disabled="loading" @click="reset(); settings?.removeAttribute('open')">重置当前场景</button>
        <NuxtLink to="/concepts/orbit/deck-loom">打开原 V1 页面</NuxtLink>
      </div></details>
    </div>
    <p v-if="error" class="v2-error" role="alert">{{ error }} <button :disabled="loading" @click="loadReal">重试</button></p>
    <nav class="v2-view-modes" aria-label="原型对照视图"><button :aria-pressed="view === 'v1'" @click="view = 'v1'">V1 图谱</button><button :aria-pressed="view === 'v2'" @click="view = 'v2'">V2 视觉图谱</button><button :aria-pressed="view === 'list'" @click="view = 'list'">传统列表</button></nav>
    <section class="v2-workspace" aria-label="独立测试工作台">
      <div class="v2-workspace-heading"><strong data-testid="v2-total">{{ total }} / 60 张 · {{ entries.length }} 种</strong><button :disabled="!history.length" @click="undo">撤销</button></div>
      <DeckLoomV2 v-if="view === 'v2'" v-model:focused="focused" v-model:order="order" v-model:grouping="grouping" v-model:navigator="navigatorMode" :entries="entries" :total="total" :recent="recent" @change="change" @detail="showDetail" />
      <div v-else-if="view === 'v1'" class="v2-reference"><DeckLoom v-model:focused="focused" v-model:order="order" :entries="entries" :total="total" @change="change" @detail="showDetail" /></div>
      <div v-else class="v2-reference v2-list" aria-label="完整卡牌列表"><div v-for="entry in entries" :key="entry.card.code">
        <button @click="focused = entry.card.code; showDetail(entry.card)"><span>{{ entry.card.name }}<small>{{ entry.card.code }}</small></span></button>
        <button :aria-label="`减少 ${entry.card.code}`" @click="change(entry.card,-1)">−</button><b>{{ entry.count }}</b><button :aria-label="`增加 ${entry.card.code}`" :disabled="total >= 60" @click="change(entry.card,1)">＋</button>
      </div><p v-if="!entries.length" class="v2-empty">测试卡组为空。</p></div>
    </section>
    <dialog ref="dialog" class="v2-dialog" aria-label="完整卡牌详情" @close="returnFocus?.focus({ preventScroll: true })">
      <template v-if="detail"><button @click="dialog?.close()">关闭详情</button><div class="v2-detail-art"><LoomArtwork :card="detail" :priority="0" /></div>
        <h2>{{ detail.name }}</h2><p>{{ detail.code }} · {{ detail.rarity || '—' }} · {{ detail.version || '—' }}</p>
        <p>{{ detail.attribute }} · EX {{ detail.ex ?? '—' }} · 费用 {{ detail.cost || '—' }}</p><p>AP {{ detail.ap ?? '—' }} / DP {{ detail.dp ?? '—' }} / SP {{ detail.sp ?? '—' }} / DMG {{ detail.dmg ?? '—' }}</p>
        <h3>中文能力与效果</h3><p>{{ detail.textZh || '暂无中文效果' }}</p><h3>日文原文</h3><p>{{ detail.textJa || '暂无日文效果' }}</p>
      </template>
    </dialog>
  </main>
</template>
