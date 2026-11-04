<script setup lang="ts">
import {strategyRequest} from '~/utils/strategy-api';

import {strategyCategories,validateStrategy} from '#shared/domain/strategy';
import ChoiceListbox from '../ChoiceListbox.vue';
import RuleReader from './RuleReader.vue';
import WorkflowDialog from '../WorkflowDialog.vue';
import OrbitButton from '../OrbitButton.vue';
import { Trash2 } from 'lucide-vue-next';
const route=useRoute(),account=useWorkflowAccount(),state=useShowcase(),scope=usePersonalScope();
const tab=ref(['rules','guide','articles','mine'].includes(String(route.query.tab))?String(route.query.tab):'rules');
const reading=computed(()=>tab.value==='rules'||tab.value==='guide');
const readingTitle=computed(()=>tab.value==='guide'?'网站使用指南':'LO规则妙妙小解');
const q=ref(''),category=ref(''),page=ref(1),pages=ref(1),items=ref<any[]>([]),local=ref<any[]>([]),guest=ref<any[]>([]),busy=ref(false),error=ref(''),deleting=ref<any|null>(null),confirmDelete=ref(false);
const deleteBusy=ref(false),deleteError=ref('');
function requestDelete(article:any){if(deleteBusy.value)return;deleting.value=article;deleteError.value='';confirmDelete.value=true;}
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
watch(tab,()=>{page.value=1;if(String(route.query.tab||'rules')!==tab.value)void navigateTo({path:route.path,query:{tab:tab.value}},{replace:true});void load();});
watch(()=>route.query.tab,value=>{const next=['rules','guide','articles','mine'].includes(String(value))?String(value):'rules';if(tab.value!==next)tab.value=next;});
watch(page,()=>void load());
async function remove(){if(!deleting.value||deleteBusy.value)return;const target=deleting.value;deleteBusy.value=true;deleteError.value='';try{
  if(!target.local||target.revision)await strategyRequest('/api/strategy/articles',{method:'DELETE',body:{id:target.id,revision:target.revision}});
  localStorage.removeItem(scope.key('strategy-draft-v1:'+target.id));confirmDelete.value=false;await load();
}catch(e){deleteError.value=(e as {data?:{message?:string}}).data?.message||'删除失败，攻略仍保留，请重试。';}finally{deleteBusy.value=false;}}
async function importGuest(g:any){const id='a_'+crypto.randomUUID();localStorage.setItem(scope.key('strategy-draft-v1:'+id),JSON.stringify({body:validateStrategy(g),revision:0,dirty:true,snapshots:{}}));await navigateTo('/concepts/orbit/learn/write?draft='+id);}
onMounted(()=>{localDrafts();void load();});
</script>
<template>
  <section class="learn-hub" :class="{'is-reading':reading}"><header v-if="reading" class="learn-reading-heading"><h1>{{ readingTitle }}</h1><OrbitButton class="reading-write-link" @click="create" variant="ghost" tone="neutral" size="sm">写攻略</OrbitButton></header><header v-else class="learn-heading"><div><h1>攻略</h1></div><OrbitButton  @click="create" variant="default" tone="brand" size="default">写下我的攻略 ＋</OrbitButton></header>
    <nav class="learn-tabs" aria-label="攻略栏目"><button type="button" v-for="t in [{id:'rules',label:'LO规则妙妙小解'},{id:'guide',label:'网站使用指南'},{id:'articles',label:'玩家攻略'},{id:'mine',label:'我的攻略'}]" :key="t.id" :aria-pressed="tab===t.id" @click="tab=t.id">{{ t.label }}</button></nav>
    <RuleReader v-if="tab==='rules'||tab==='guide'" :key="tab" :kind="tab as 'rules'|'guide'" />
    <template v-else>
      <p v-if="tab==='mine'&&!account.user.value" class="reading-note">未登录时的草稿只在当前浏览器保存。<OrbitButton @click="state.utility.value='account'" variant="ghost" tone="neutral" size="sm">登录同步云端攻略</OrbitButton></p>
      <form class="article-search" @submit.prevent="page=1;load()"><label>搜索攻略<input v-model="q" type="search" placeholder="标题、作者或标签" maxlength="100" /></label><ChoiceListbox v-model="category" label="分类" :options="[{value:'',label:'全部分类'},...strategyCategories.map(c=>({value:c,label:c}))]" /><OrbitButton  type="submit" variant="outline" tone="neutral" size="default" :busy="busy">查找</OrbitButton></form>
      <p v-if="busy" role="status">正在读取攻略…</p><p v-if="error" role="alert">{{ error }}<OrbitButton @click="load" variant="ghost" tone="neutral" size="sm">重试</OrbitButton></p>
      <div class="article-grid"><article v-for="a in displayed" :key="a.id"><NuxtLink class="article-cover-link" :to="tab==='mine'?'/concepts/orbit/learn/write?draft='+a.id:'/concepts/orbit/learn/'+a.id"><img v-if="a.cover" :src="a.cover" alt="" loading="lazy" /><div><small>{{ a.category }} · {{ a.author||'本机草稿' }}</small><h3>{{ a.title||'未命名草稿' }}</h3><p>{{ a.summary }}</p><div class="article-tags"><span v-for="t in a.tags" :key="t">{{ t }}</span></div><small v-if="tab==='mine'">{{ a.local?(a.dirty?'本机有修改待同步':'本机副本'):a.hasPublished?'已有公开版本':'草稿' }}</small></div></NuxtLink><footer v-if="tab==='mine'" class="article-actions"><OrbitButton variant="ghost" tone="danger" :disabled="deleteBusy" @click="requestDelete(a)"><Trash2 aria-hidden="true" />删除攻略</OrbitButton></footer></article></div>
      <div v-if="!busy&&!error&&!displayed.length" class="reading-empty"><h3>{{ tab==='mine'?'还没有攻略':'这里等待第一篇玩家攻略' }}</h3><p>可以先写一段构筑思路，随时保存、预览，再决定是否公开。</p><OrbitButton  @click="create" variant="default" tone="brand" size="default">开始写作</OrbitButton></div>
      <nav class="p-pagination"><OrbitButton :disabled="page<=1||busy" @click="page--" variant="ghost" tone="neutral" size="sm">上一页</OrbitButton><span>{{ page }} / {{ pages }}</span><OrbitButton :disabled="page>=pages||busy" @click="page++" variant="ghost" tone="neutral" size="sm">下一页</OrbitButton></nav>
      <section v-if="tab==='mine'&&account.user.value&&guest.length" class="guest-articles"><h3>未登录时的本机草稿</h3><p>只在你主动选择后，才会复制到当前账号；原游客草稿保留。</p><OrbitButton v-for="g in guest" :key="g.id" @click="importGuest(g)" variant="ghost" tone="neutral" size="sm">导入：{{ g.title||'未命名草稿' }}</OrbitButton></section>
    </template>
    <WorkflowDialog v-model:open="confirmDelete" :title="deleting?.hasPublished?'删除攻略':'删除攻略草稿'" :description="deleting?.hasPublished?'将删除这篇攻略的草稿及公开版本，无法通过撤销恢复；其他人的卡组不受影响。':'将删除这篇攻略草稿，无法通过撤销恢复；其他人的卡组不受影响。'"><p class="strategy-delete-name">{{ deleting?.title||'未命名草稿' }}</p><p v-if="deleteError" role="alert">{{ deleteError }}</p><template #footer><OrbitButton variant="outline" tone="neutral" :disabled="deleteBusy" @click="confirmDelete=false">取消</OrbitButton><OrbitButton tone="danger" :busy="deleteBusy" @click="remove"><Trash2 aria-hidden="true" />确认删除攻略</OrbitButton></template></WorkflowDialog>
  </section>
</template>
