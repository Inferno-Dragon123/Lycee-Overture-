<script setup lang="ts">
import CommunityWorkbench from './CommunityWorkbench.vue';
import ToolWorkbench from './ToolWorkbench.vue';
import DeckLibrary from './library/DeckLibrary.vue';
import DeckDetail from './library/DeckDetail.vue';
import LearnHub from './learn/LearnHub.vue';
import PlayerGroups from './PlayerGroups.vue';
import WorkflowAccount from './WorkflowAccount.vue';
const props=defineProps<{variant:string;section:string}>();
const titles:Record<string,string>={decks:'我的卡组',deck:'卡组展示',tools:'工具箱',community:'卡组社区',groups:'玩家社群',learn:'攻略',account:'账号管理',announcements:'公告'};
</script>
<template><div class="p-inner-page p-section"><div class="p-inner-heading"><h1>{{ titles[section]||'页面不存在' }}</h1></div>
  <DeckLibrary v-if="section==='decks'" />
  <DeckDetail v-else-if="section==='deck'" />
  <ToolWorkbench v-else-if="section==='tools'" />
  <CommunityWorkbench v-else-if="section==='community'" />
  <LearnHub v-else-if="section==='learn'" />
  <PlayerGroups v-else-if="section==='groups'" />
  <WorkflowAccount v-else-if="section==='account'" />
  <section v-else-if="section==='announcements'" class="p-announcement"><h2>预览站说明</h2><p>当前使用二代预览站。登录后可同步个人卡组、草稿和展示设置；攻略可单独保存草稿或发布。</p><p>编辑后请确认保存状态。反馈问题时，可附上页面地址和操作步骤。</p></section>
</div></template>
