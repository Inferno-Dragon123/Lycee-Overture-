<script setup lang="ts">
import CommunityWorkbench from './CommunityWorkbench.vue';
import ToolWorkbench from './ToolWorkbench.vue';
import DeckLibrary from './library/DeckLibrary.vue';
import DeckDetail from './library/DeckDetail.vue';
import LearnHub from './learn/LearnHub.vue';
import PlayerGroups from './PlayerGroups.vue';
import WorkflowAccount from './WorkflowAccount.vue';
import Announcements from './Announcements.vue';
const props=defineProps<{variant:string;section:string}>();
const titles:Record<string,string>={decks:'我的卡组',deck:'卡组展示',tools:'工具箱',community:'卡组社区',groups:'玩家社群',learn:'攻略',account:'账号管理',announcements:'公告'};
</script>
<template><div class="p-inner-page p-section"><div v-if="!['learn','groups','decks'].includes(section)" class="p-inner-heading"><h1>{{ titles[section]||'页面不存在' }}</h1></div>
  <DeckLibrary v-if="section==='decks'" />
  <DeckDetail v-else-if="section==='deck'" />
  <ToolWorkbench v-else-if="section==='tools'" />
  <CommunityWorkbench v-else-if="section==='community'" />
  <LearnHub v-else-if="section==='learn'" />
  <PlayerGroups v-else-if="section==='groups'" />
  <WorkflowAccount v-else-if="section==='account'" />
  <Announcements v-else-if="section==='announcements'" />
</div></template>
