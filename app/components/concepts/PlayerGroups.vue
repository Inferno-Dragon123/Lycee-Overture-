<script setup lang="ts">
import { Trash2, Plus } from 'lucide-vue-next';
import { strategyRequest } from '~/utils/strategy-api';
import type { StrategyGroup } from '#shared/domain/strategy';
import WorkflowDialog from './WorkflowDialog.vue';
import ChoiceListbox from './ChoiceListbox.vue';
import OrbitButton from './OrbitButton.vue';

const account = useWorkflowAccount(), state = useShowcase(), route = useRoute();
const isOrbit = computed(() => route.path.startsWith('/concepts/orbit'));
const Action = computed(() => isOrbit.value ? OrbitButton : 'button');
const root = ref<HTMLElement>();
const items = ref<StrategyGroup[]>([]), mine = ref(false), q = ref(''), platform = ref('');
const busy = ref(false), saving = ref(false), removing = ref(false), error = ref('');
const open = ref(false), deleting = ref<StrategyGroup | null>(null), deleteOpen = ref(false);
const empty = () => ({ id: undefined as string | undefined, revision: 0, name: '', region: '', platform: 'QQ', description: '', contact: '', url: '', expiresAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), public: true, consent: false });
const form = reactive(empty());
const visible = computed(() => items.value.filter(g => [g.name, g.region, g.description].join(' ').toLowerCase().includes(q.value.toLowerCase()) && (!platform.value || g.platform === platform.value)));

async function load() {
  busy.value = true;
  error.value = '';
  try {
    const data = await strategyRequest<{ items: StrategyGroup[] }>('/api/workflow/groups', { query: mine.value ? { mine: '1' } : {} });
    items.value = data.items;
  } catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message || '社群读取失败';
  } finally {
    busy.value = false;
  }
}
function create() {
  if (saving.value || removing.value) return;
  if (!account.user.value) { state.utility.value = 'account'; return; }
  Object.assign(form, empty());
  open.value = true;
}
function edit(group: StrategyGroup) {
  if (saving.value || removing.value) return;
  Object.assign(form, group, { expiresAt: group.expiresAt.slice(0, 10), consent: false });
  open.value = true;
}
async function save() {
  if (saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    await strategyRequest('/api/workflow/groups', { method: 'POST', body: { ...form, expiresAt: form.expiresAt + 'T23:59:59+08:00' } });
    open.value = false;
    await load();
  } catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message || '发布失败，请检查资料';
  } finally {
    saving.value = false;
  }
}
async function remove() {
  if (!deleting.value || removing.value) return;
  removing.value = true;
  error.value = '';
  let removed = false;
  try {
    await strategyRequest('/api/workflow/groups', { method: 'DELETE', body: { id: deleting.value.id, revision: deleting.value.revision } });
    await load();
    deleteOpen.value = false;
    deleting.value = null;
    removed = true;
  } catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message || '删除失败';
  } finally {
    removing.value = false;
  }
  if (removed) {
    await nextTick();
    root.value?.querySelector<HTMLButtonElement>('[data-group-create]')?.focus({ preventScroll: true });
  }
}
watch(mine, () => void load());
onMounted(() => void load());
</script>

<template>
  <section ref="root" class="player-groups">
    <header class="learn-heading">
      <h1>玩家社群</h1>
      <component :is="Action" :class="{ 'p-button': !isOrbit }" data-group-create aria-label="发布我的社群 ＋" :disabled="saving || removing" @click="create"><Plus v-if="isOrbit" :size="16" />发布我的社群<span v-if="!isOrbit"> ＋</span></component>
    </header>
    <div class="article-search">
      <label>地区或名称<input v-model="q" type="search" placeholder="城市、线上或社群名称" /></label>
      <ChoiceListbox v-model="platform" label="平台" :options="[{ value: '', label: '全部平台' }, ...['QQ', '微信', 'Discord', '其他'].map(p => ({ value: p, label: p }))]" />
      <button :aria-pressed="mine" :disabled="!account.user.value" @click="mine = !mine">{{ mine ? '查看全部社群' : '我的发布' }}</button>
    </div>
    <p v-if="busy" role="status">正在读取…</p>
    <p v-if="error" role="alert">{{ error }}<component :is="Action" variant="ghost" tone="neutral" :busy="busy" :disabled="busy" @click="load">重试</component></p>
    <div class="player-groups-grid">
      <article v-for="group in visible" :key="group.id">
        <small>{{ group.region }} · {{ group.platform }}</small><h3>{{ group.name }}</h3><p>{{ group.description }}</p>
        <details><summary>查看加入方式</summary><p class="group-contact">{{ group.contact }}</p><a v-if="group.url" :href="group.url" target="_blank" rel="noopener noreferrer">打开邀请链接 ↗</a></details>
        <footer>
          <small>{{ group.author }} · 有效至{{ new Date(group.expiresAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }) }}{{ !group.public ? ' · 已撤回' : '' }}</small>
          <template v-if="group.canEdit">
            <component :is="Action" variant="outline" tone="neutral" :disabled="saving || removing" @click="edit(group)">编辑／撤回</component>
            <component :is="Action" variant="ghost" tone="danger" :disabled="saving || removing" @click="deleting = group; error = ''; deleteOpen = true"><Trash2 v-if="isOrbit" :size="16" />删除</component>
          </template>
        </footer>
      </article>
    </div>
    <div v-if="!busy && !error && !visible.length" class="reading-empty"><h3>暂无符合条件的社群</h3><p>发布真实的社群名片，让同好找到你。</p><component :is="Action" :class="{ 'p-button': !isOrbit }" variant="outline" tone="neutral" @click="create">发布社群</component></div>

    <WorkflowDialog v-model:open="open" title="社群名片" description="加入方式仅展示在这张公开名片上，不会写入账号公开资料。">
      <form class="workflow-form" @submit.prevent="save">
        <label>社群名称<input v-model="form.name" maxlength="60" required /></label>
        <label>地区<input v-model="form.region" maxlength="40" placeholder="例如：上海、线上" required /></label>
        <ChoiceListbox v-model="form.platform" label="平台" :options="['QQ', '微信', 'Discord', '其他'].map(p => ({ value: p, label: p }))" />
        <label>简介<textarea v-model="form.description" maxlength="1000" rows="4" required /></label>
        <label>加入方式<input v-model="form.contact" maxlength="300" placeholder="群号、验证说明或联系办法" required /></label>
        <label>邀请链接（可选）<input v-model="form.url" type="url" maxlength="2000" /></label>
        <label>有效期<input v-model="form.expiresAt" type="date" required /></label>
        <label class="strategy-consent"><input v-model="form.public" type="checkbox" />公开展示</label>
        <label class="strategy-consent"><input v-model="form.consent" type="checkbox" required />我确认这些加入信息可以随名片公开</label>
        <p v-if="error" role="alert">{{ error }}</p>
        <component :is="Action" :class="{ 'p-button': !isOrbit }" type="submit" :busy="saving" :disabled="saving">保存名片</component>
      </form>
    </WorkflowDialog>
    <WorkflowDialog v-model:open="deleteOpen" title="删除社群名片" :description="isOrbit ? '删除后，这张名片及加入方式将不再显示；此操作无法撤销。' : undefined">
      <p class="delete-object-name">{{ deleting?.name }}</p>
      <p v-if="isOrbit && error" role="alert">{{ error }}</p>
      <button v-if="!isOrbit" class="p-button" @click="remove">确认删除</button>
      <template v-if="isOrbit" #footer>
        <component :is="Action" variant="outline" tone="neutral" :disabled="removing" @click="deleteOpen = false">取消</component>
        <component :is="Action" :class="{ 'p-button': !isOrbit }" tone="danger" :busy="removing" :disabled="removing" @click="remove">确认删除</component>
      </template>
    </WorkflowDialog>
  </section>
</template>
