<script setup lang="ts">
import {strategyRequest} from '~/utils/strategy-api';

import {strategyCategories,validateStrategy} from '#shared/domain/strategy';
import ChoiceListbox from '../ChoiceListbox.vue';
import RuleReader from './RuleReader.vue';
import WorkflowDialog from '../WorkflowDialog.vue';
const route=useRoute(),account=useWorkflowAccount(),state=useShowcase(),scope=usePersonalScope();
const tab=ref(['rules','guide','articles','mine'].includes(String(route.query.tab))?String(route.query.tab):'rules');
const q=ref(''),category=ref(''),page=ref(1),pages=ref(1),items=ref<any[]>([]),local=ref<any[]>([]),guest=ref<any[]>([]),busy=ref(false),error=ref(''),deleting=ref<any|null>(null),confirmDelete=ref(false);
function create(){void navigateTo('/concepts/orbit/learn/write?draft=a_'+crypto.randomUUID());}
function localDrafts(){
  const own:any[]=[],guests:any[]=[];
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i)!;const match=/^strategy-draft-v1:(a_[a-f0-9-]{36})$/.exec(key),ownPrefix=scope.key('strategy-draft-v1:');
    const id=key.startsWith(ownPrefix)?key.slice(ownPrefix.length):'';
    if(!match&&!/^a_[a-f0-9-]{36}$/.test(id))continue;
    try{const c=JSON.parse(localStorage.getItem(key)!);const body=validateStrategy(c.body);const item={...body,id:id||match![1],revision:c.revision||0,local:true,dirty:c.dirty};if(key.startsWith(ownPrefix))own.push(item);else if(match)guests.push(item);}catch{/* A damaged recovery copy is retained verbatim. */}
  }
  local.value=own;guest.value=guests;
}
let serial=0;
async function load(){
  if(!['articles','mine'].includes(tab.value))return;const request=++serial;busy.value=true;error.value='';localDrafts();
  try{
    if(tab.value==='mine'&&!account.user.value){items.value=[];return;}
    const result=await strategyRequest<any>('/api/strategy/articles',{query:{q:q.value,category:category.value,page:page.value,...(tab.value==='mine'?{mine:'1'}:{})}});
    if(request===serial){items.value=result.items;pages.value=result.pages;page.value=result.page;}
  }catch(e){if(request===serial)error.value=(e as {data?:{message?:string}}).data?.message||'攻略读取失败，请重试。';}finally{if(request===serial)busy.value=false;}
}
const displayed=computed(()=>tab.value==='mine'?[...local.value.filter(l=>!items.value.some(i=>i.id===l.id)),...items.value]:items.value);
watch(tab,()=>{page.value=1;void navigateTo({path:route.path,query:{tab:tab.value}},{replace:true});void load();});
watch(page,()=>void load());
async function remove(){if(!deleting.value)return;try{
  if(!deleting.value.local||deleting.value.revision)await strategyRequest('/api/strategy/articles',{method:'DELETE',body:{id:deleting.value.id,revision:deleting.value.revision}});
  localStorage.removeItem(scope.key('strategy-draft-v1:'+deleting.value.id));confirmDelete.value=false;await load();
}catch(e){error.value=(e as {data?:{message?:string}}).data?.message||'删除失败';}}
async function importGuest(g:any){const id='a_'+crypto.randomUUID();localStorage.setItem(scope.key('strategy-draft-v1:'+id),JSON.stringify({body:validateStrategy(g),revision:0,dirty:true,snapshots:{}}));await navigateTo('/concepts/orbit/learn/write?draft='+id);}
onMounted(()=>{localDrafts();void load();});
</script>
<template>
  <section class="learn-hub"><header class="learn-heading"><div><p class="reading-kicker">阅读 · 练习 · 分享</p><h2>把经验留给下一位玩家</h2></div><button class="p-button" @click="create">写下我的攻略 ＋</button></header>
    <nav class="learn-tabs" aria-label="攻略栏目"><button v-for="t in [{id:'rules',label:'LO规则妙妙小解'},{id:'guide',label:'网站使用指南'},{id:'articles',label:'玩家攻略'},{id:'mine',label:'我的攻略'}]" :key="t.id" :aria-pressed="tab===t.id" @click="tab=t.id">{{ t.label }}</button></nav>
    <RuleReader v-if="tab==='rules'||tab==='guide'" :key="tab" :kind="tab as 'rules'|'guide'" />
    <template v-else>
      <p v-if="tab==='mine'&&!account.user.value" class="reading-note">未登录时的草稿只在当前浏览器保存。<button @click="state.utility.value='account'">登录同步云端攻略</button></p>
      <form class="article-search" @submit.prevent="page=1;load()"><label>搜索攻略<input v-model="q" type="search" placeholder="标题、作者或标签" maxlength="100" /></label><ChoiceListbox v-model="category" label="分类" :options="[{value:'',label:'全部分类'},...strategyCategories.map(c=>({value:c,label:c}))]" /><button class="p-button" type="submit">查找</button></form>
      <p v-if="busy" role="status">正在读取攻略…</p><p v-if="error" role="alert">{{ error }}<button @click="load">重试</button></p>
      <div class="article-grid"><article v-for="a in displayed" :key="a.id"><NuxtLink class="article-cover-link" :to="tab==='mine'?'/concepts/orbit/learn/write?draft='+a.id:'/concepts/orbit/learn/'+a.id"><img v-if="a.cover" :src="a.cover" alt="" loading="lazy" /><div><small>{{ a.category }} · {{ a.author||'本机草稿' }}</small><h3>{{ a.title||'未命名草稿' }}</h3><p>{{ a.summary }}</p><div class="article-tags"><span v-for="t in a.tags" :key="t">{{ t }}</span></div><small v-if="tab==='mine'">{{ a.local?(a.dirty?'本机有修改待同步':'本机副本'):a.hasPublished?'已有公开版本':'草稿' }}</small></div></NuxtLink><button v-if="tab==='mine'" @click="deleting=a;confirmDelete=true">删除攻略</button></article></div>
      <div v-if="!busy&&!error&&!displayed.length" class="reading-empty"><h3>{{ tab==='mine'?'还没有攻略':'这里等待第一篇玩家攻略' }}</h3><p>可以先写一段构筑思路，随时保存、预览，再决定是否公开。</p><button class="p-button" @click="create">开始写作</button></div>
      <nav class="p-pagination"><button :disabled="page<=1||busy" @click="page--">上一页</button><span>{{ page }} / {{ pages }}</span><button :disabled="page>=pages||busy" @click="page++">下一页</button></nav>
      <section v-if="tab==='mine'&&account.user.value&&guest.length" class="guest-articles"><h3>未登录时的本机草稿</h3><p>只在你主动选择后，才会复制到当前账号；原游客草稿保留。</p><button v-for="g in guest" :key="g.id" @click="importGuest(g)">导入：{{ g.title||'未命名草稿' }}</button></section>
    </template>
    <WorkflowDialog v-model:open="confirmDelete" title="删除攻略" description="会删除草稿及其公开版本，其他人的卡组不受影响。"><p>{{ deleting?.title }}</p><button class="p-button" @click="remove">确认删除攻略</button></WorkflowDialog>
  </section>
</template>
