<script setup lang="ts">
import OrbitButton from '../OrbitButton.vue';
import ChoiceListbox from '../ChoiceListbox.vue';
import {strategyRequest} from '~/utils/strategy-api';

import CardEffectCopy from './CardEffectCopy.vue';
import FilterPanel from '../filters/FilterPanel.vue';
import DeckSearchBar from '../library/DeckSearchBar.vue';
import CardSearch from '../CardSearch.vue';
import WorkflowDialog from '../WorkflowDialog.vue';
import {createFilterEngine,emptyFilters,cloneFilters,filterParams} from '#shared/domain/filters';
import {type StrategySnapshot} from '#shared/domain/strategy';
import {emptyDeckSearch,deckComposition,matchesDeck,type LibraryDeck} from '#shared/domain/deck-library';
import {safeStrategyUrl} from '#shared/domain/strategy';
import {categoryLabels} from '#shared/domain/catalog';
const props=defineProps<{selectedCodes:string[];recent:any[]}>();
const emit=defineEmits<{insert:[node:any,recent:any];batch:[codes:string[]];close:[];snapshot:[snapshot:StrategySnapshot]}>();
const catalog=useOrbitCatalog(),state=useShowcase(),account=useWorkflowAccount(),library=usePracticeDecks();
const tab=ref('cards'),source=ref('personal'),deckPage=ref(1),deckPages=ref(1),busy=ref(false),error=ref(''),result=ref<any[]>([]),selectedDeck=ref<any|null>(null),privateConsent=ref(false);
const external=reactive({url:'',title:'',description:''});
const chosen=ref<string[]>([]);watch(()=>props.selectedCodes,v=>chosen.value=[...v],{immediate:true});
const filters=ref(emptyFilters()),applied=ref(emptyFilters()),filterOpen=ref(false),filterError=ref('');
const engine=computed(()=>createFilterEngine(catalog.cards.value));
const cardResult=computed(()=>engine.value.search(applied.value)),cards=computed(()=>cardResult.value.cards);
const deckFilters=ref(emptyDeckSearch()),deckCodes=ref<string[]>([]),deckMatch=ref('all'),deckPicker=ref(false),communitySource=ref('all'),deckDetails=ref(false);
let filterTimer:ReturnType<typeof setTimeout>|undefined,deckTimer:ReturnType<typeof setTimeout>|undefined;
function applyFilters(){try{engine.value.validate(filters.value);applied.value=cloneFilters(filters.value);filterError.value='';}catch(e){filterError.value=(e as Error).message;}}
watch(()=>filterParams(filters.value).toString(),()=>{clearTimeout(filterTimer);filterTimer=setTimeout(applyFilters,180);});
watch(()=>{const f=cloneFilters(filters.value);f.page=1;return filterParams(f).toString();},()=>filters.value.page=1);
function cardPage(page:number){filters.value.page=page;applyFilters();}
function card(code:string,mode='inline'){
  const node=mode==='inline'?{type:'cardMention',attrs:{code}}:{type:'reference',attrs:{ref:{kind:'card',code,mode}}};
  emit('insert',node,{key:'card:'+code,label:catalog.byCode.value.get(code)?.name||code,kind:'card',code});
}
function toggle(code:string){chosen.value=chosen.value.includes(code)?chosen.value.filter(c=>c!==code):[...chosen.value,code].slice(0,40);}
let requestId=0;
async function decks(){
  const request=++requestId;error.value='';busy.value=true;selectedDeck.value=null;privateConsent.value=false;
  try{
    if(source.value==='personal'){
      if(!account.user.value){result.value=[];return;}
      const data=await strategyRequest<{data:{library:{saved:LibraryDeck[]}}}>('/api/workflow/personal',{headers:{'x-lycee-owner':account.user.value.id}});
      if(request!==requestId)return;await catalog.load();result.value=data.data.library.saved.filter(d=>matchesDeck(d,deckFilters.value,deckComposition(d.quantities,catalog.byCode.value))&&(!deckCodes.value.length||(deckMatch.value==='any'?deckCodes.value.some(code=>Object.keys(d.quantities).some(c=>c.slice(0,7)===code)):deckCodes.value.every(code=>Object.keys(d.quantities).some(c=>c.slice(0,7)===code)))));deckPages.value=1;
    }else{
      const data=await strategyRequest<any>('/api/workflow/community',{query:{source:communitySource.value,page:deckPage.value,filters:JSON.stringify(deckFilters.value),codes:deckCodes.value.join(','),match:deckMatch.value}});
      if(request!==requestId)return;result.value=data.items;deckPages.value=data.pages;
    }
  }catch(e){if(request===requestId)error.value=(e as {data?:{message?:string}}).data?.message||'卡组读取失败，请重试。';}finally{if(request===requestId)busy.value=false;}
}
async function choose(d:any){
  error.value='';busy.value=true;chosen.value=[];privateConsent.value=false;
  try{
    if(source.value==='personal')selectedDeck.value={...d,refSource:'personal',author:account.user.value?.name};
    else if(d.legacy){const detail=await strategyRequest<any>('/api/workflow/legacy',{query:{id:d.id}});selectedDeck.value={...detail,quantities:detail.cards,refSource:'legacy',author:detail.author_name};}
    else{const detail=await strategyRequest<any>('/api/workflow/community',{query:{id:d.id}});selectedDeck.value={...detail,refSource:'community'};}
  }catch(e){error.value=(e as {data?:{message?:string}}).data?.message||'卡组不可读取';}finally{busy.value=false;}
}
async function deck(){
  if(!selectedDeck.value)return;busy.value=true;error.value='';
  try{
    const snapshot=await strategyRequest<StrategySnapshot>('/api/strategy/snapshots',{method:'POST',body:{source:selectedDeck.value.refSource,id:selectedDeck.value.id,acknowledgePrivate:privateConsent.value}});
    emit('snapshot',snapshot);emit('insert',{type:'reference',attrs:{ref:{kind:'deck',snapshotId:snapshot.id}}},{key:'deck:'+snapshot.source+':'+snapshot.sourceId,label:snapshot.name,kind:'deck',snapshotId:snapshot.id});
  }catch(e){error.value=(e as {data?:{message?:string}}).data?.message||'引用失败，请登录后重试';}finally{busy.value=false;}
}
function externalInsert(inline=false){try{const url=safeStrategyUrl(external.url),title=external.title.trim()||new URL(url).hostname;
  const node=inline?{type:'text',text:title,marks:[{type:'link',attrs:{href:url}}]}:{type:'reference',attrs:{ref:{kind:'external',url,title,description:external.description}}};
  emit('insert',node,{key:'external:'+url,label:title,kind:'external',url,title,description:external.description});error.value='';
}catch{error.value='请输入完整的HTTP或HTTPS链接';}}
async function reuse(r:any){
  if(r.kind==='card')card(r.code);
  else if(r.kind==='external'){Object.assign(external,r);externalInsert();}
  else if(r.kind==='gallery')emit('batch',r.codes);
  else if(r.kind==='deck'){
    try{const snapshot=await strategyRequest<StrategySnapshot>('/api/strategy/snapshots',{query:{id:r.snapshotId}});emit('snapshot',snapshot);emit('insert',{type:'reference',attrs:{ref:{kind:'deck',snapshotId:r.snapshotId}}},r);}catch{error.value='原引用不可读取，请重新选择卡组';}
  }
}
function searchCards(){tab.value='cards';nextTick(()=>document.querySelector<HTMLInputElement>('.reference-workspace input[type=search]')?.focus());}
defineExpose({searchCards});
watch([source,deckPage],()=>void decks());
watch([deckFilters,deckCodes,deckMatch,communitySource],()=>{deckPage.value=1;clearTimeout(deckTimer);deckTimer=setTimeout(()=>void decks(),220);},{deep:true});
onBeforeUnmount(()=>{clearTimeout(filterTimer);clearTimeout(deckTimer);requestId++;});
onMounted(()=>{void catalog.load();});
</script>
<template>
  <aside class="reference-workspace" aria-label="资料工作台"><header><h2>资料工作台</h2><OrbitButton type="button" @click="emit('close')" variant="ghost" tone="neutral" size="sm">收起</OrbitButton></header><div class="reference-tabs"><button type="button" v-for="t in [{id:'cards',label:'卡牌'},{id:'decks',label:'卡组'},{id:'external',label:'外部资料'},{id:'recent',label:'最近引用'}]" :key="t.id" :aria-pressed="tab===t.id" @click="tab=t.id;t.id==='decks'&&decks()">{{ t.label }}</button></div>
    <p v-if="error" role="alert">{{ error }}</p>
    <section v-if="tab==='cards'">
      <label class="strategy-search">搜索卡牌<input v-model="filters.q" type="search" placeholder="卡号、名称、中日文效果" /></label><OrbitButton type="button" :aria-expanded="filterOpen" @click="filterOpen=!filterOpen" variant="ghost" tone="neutral" size="sm">详细筛选</OrbitButton>
      <FilterPanel v-if="filterOpen" v-model="filters" embedded :engine="engine" :pending="false" :error="filterError" @close="filterOpen=false" @apply="applyFilters" @clear="applyFilters" /><p v-if="filterError&&!filterOpen" role="alert">{{ filterError }}</p>
      <p v-if="catalog.error.value" role="alert">{{ catalog.error.value }}<OrbitButton @click="catalog.load" variant="ghost" tone="neutral" size="sm">重试</OrbitButton></p>
      <OrbitButton v-if="chosen.length" class="reference-insert-batch" @click="emit('batch',chosen)" variant="default" tone="brand" size="default">插入所选 {{ chosen.length }} 种卡牌</OrbitButton>
      <div class="reference-results"><article v-for="c in cards" :key="c.code"><button type="button" class="reference-art" :aria-label="'预览 '+c.code" @click="state.selected.value=c"><img :src="c.img" :alt="c.name" loading="lazy" /></button><div><strong>{{ c.name }}</strong><small><span class="reference-card-code">{{ c.code }}</span> · {{ c.attribute }} · {{ categoryLabels[c.category] }}</small><div class="reference-actions"><OrbitButton @click="card(c.code)" variant="ghost" tone="neutral" size="sm">行内</OrbitButton><OrbitButton @click="card(c.code,'artwork')" variant="ghost" tone="neutral" size="sm">卡图</OrbitButton><CardEffectCopy :card="c" /><button class="orbit-tool" type="button" :aria-pressed="chosen.includes(c.code)" @click="toggle(c.code)">{{ chosen.includes(c.code)?'取消多选':'多选' }}</button></div></div></article></div>
      <p v-if="!cards.length">没有找到卡牌，请尝试编号或清除筛选。</p><nav class="p-pagination"><OrbitButton :disabled="cardResult.page<=1" @click="cardPage(cardResult.page-1)" variant="ghost" tone="neutral" size="sm">上一页卡牌</OrbitButton><span>{{ cardResult.page }} / {{ cardResult.pages }} · {{ cardResult.total }}种</span><OrbitButton :disabled="cardResult.page>=cardResult.pages" @click="cardPage(cardResult.page+1)" variant="ghost" tone="neutral" size="sm">下一页卡牌</OrbitButton></nav>
    </section>
    <section v-else-if="tab==='decks'">
      <div class="reference-tabs"><button type="button" :aria-pressed="source==='personal'" @click="source='personal'">我的卡组</button><button type="button" :aria-pressed="source==='community'" @click="source='community'">卡组社区</button></div>
      <form class="strategy-search" @submit.prevent="deckPage=1;decks()"><label>搜索卡组<input v-model="deckFilters.q" type="search" placeholder="名称与简介" /></label><OrbitButton type="submit" variant="outline" tone="neutral" size="default" :busy="busy">搜索</OrbitButton></form>
      <OrbitButton type="button" :aria-expanded="deckDetails" @click="deckDetails=!deckDetails" variant="ghost" tone="neutral" size="sm">卡组详细搜索</OrbitButton><div v-if="deckDetails" class="reference-deck-filters"><DeckSearchBar v-model="deckFilters" /><ChoiceListbox v-if="source==='community'" v-model="communitySource" label="社区来源" :options="[{value:'all',label:'全部'},{value:'community',label:'玩家投稿'},{value:'official_tournament',label:'官网赛事'},{value:'official_user',label:'官网玩家'}]" /><OrbitButton @click="deckPicker=true" variant="ghost" tone="neutral" size="sm">添加卡牌检索条件</OrbitButton><ChoiceListbox v-model="deckMatch" label="卡牌匹配" :options="[{value:'all',label:'全部包含'},{value:'any',label:'任意包含'}]" /><button type="button" v-for="code in deckCodes" :key="code" @click="deckCodes=deckCodes.filter(c=>c!==code)">{{ code }} ×</button></div>

      <p v-if="source==='personal'&&!account.user.value">登录后读取自己的云端卡组。<OrbitButton @click="state.utility.value='account'" variant="ghost" tone="neutral" size="sm">登录</OrbitButton></p><p v-if="busy" role="status">正在读取…</p>
      <template v-if="selectedDeck"><OrbitButton @click="selectedDeck=null" variant="ghost" tone="neutral" size="sm">← 返回列表</OrbitButton><h3>{{ selectedDeck.name }}</h3><p>{{ selectedDeck.author||selectedDeck.author_name||'原作者' }} · {{ Object.values(selectedDeck.quantities||{}).reduce((s:any,n:any)=>s+n,0) }}张</p><p>{{ selectedDeck.description }}</p>
        <label v-if="selectedDeck.refSource==='personal'" class="strategy-consent"><input v-model="privateConsent" type="checkbox" />我确认这份私人构筑快照会随攻略公开</label><OrbitButton  :disabled="busy||(selectedDeck.refSource==='personal'&&!privateConsent)" @click="deck" :variant="chosen.length?'outline':'default'" :tone="chosen.length?'neutral':'brand'" size="default" :busy="busy">引用整套卡组</OrbitButton><p class="reading-note">保存引用时的构筑。社区来源撤回后，其引用暂时隐藏。</p>
        <OrbitButton v-if="chosen.length"  @click="emit('batch',chosen)" variant="default" tone="brand" size="default">插入所选 {{ chosen.length }} 种卡牌</OrbitButton>
        <div class="reference-results"><article v-for="(count,code) in selectedDeck.quantities" :key="code"><img v-if="catalog.byCode.value.get(String(code))" :src="catalog.byCode.value.get(String(code))!.img" :alt="String(code)" loading="lazy" /><div><strong>{{ catalog.byCode.value.get(String(code))?.name||code }}</strong><small><span class="reference-card-code">{{ code }}</span> × {{ count }}</small><div class="reference-actions"><OrbitButton @click="card(String(code))" variant="ghost" tone="neutral" size="sm">行内</OrbitButton><OrbitButton @click="card(String(code),'artwork')" variant="ghost" tone="neutral" size="sm">卡图</OrbitButton><CardEffectCopy :card="catalog.byCode.value.get(String(code))" /><button class="orbit-tool" type="button" :aria-pressed="chosen.includes(String(code))" @click="toggle(String(code))">{{ chosen.includes(String(code))?'取消多选':'多选' }}</button></div></div></article></div>
      </template>
      <template v-else><button type="button" v-for="d in result" :key="d.id" class="reference-deck-result" @click="choose(d)"><strong>{{ d.name }}</strong><small>{{ d.author||d.author_name||'我的卡组' }} · 查看构筑</small></button><p v-if="!result.length&&!busy">暂无卡组。自己的卡组需先完成云端同步。</p><nav v-if="source==='community'" class="p-pagination"><OrbitButton :disabled="deckPage<=1||busy" @click="deckPage--" variant="ghost" tone="neutral" size="sm">上一页</OrbitButton><span>{{ deckPage }} / {{ deckPages }}</span><OrbitButton :disabled="deckPage>=deckPages||busy" @click="deckPage++" variant="ghost" tone="neutral" size="sm">下一页</OrbitButton></nav></template>
    </section>
    <section v-else-if="tab==='external'" class="workflow-form"><label>资料链接<input v-model="external.url" type="url" placeholder="https://…" /></label><label>资料标题<input v-model="external.title" maxlength="160" /></label><label>简短描述<textarea v-model="external.description" maxlength="400" rows="3" /></label><p class="reading-note">视频也可以作为链接引用，无需上传。标题可自行填写。</p><OrbitButton  @click="externalInsert(false)" variant="default" tone="brand" size="default">插入资料卡片</OrbitButton><OrbitButton @click="externalInsert(true)" variant="outline" tone="neutral" size="default">插入文字链接</OrbitButton></section>
    <section v-else><p v-if="!recent.length">成功插入过的资料会显示在这里。</p><button type="button" v-for="r in recent" :key="r.key" class="reference-deck-result" @click="reuse(r)"><strong>{{ r.label }}</strong><small>{{ ({card:'卡牌',deck:'卡组',gallery:'多卡',external:'外部资料'} as any)[r.kind] }} · 再次插入</small></button></section>
    <WorkflowDialog v-model:open="deckPicker" title="选择卡组检索卡牌" wide><CardSearch @choose="c=>{const code=c.code.slice(0,7);if(!deckCodes.includes(code)&&deckCodes.length<10)deckCodes.push(code);}" /><template #footer><OrbitButton  @click="deckPicker=false" variant="default" tone="brand" size="default">完成卡牌条件</OrbitButton></template></WorkflowDialog>
  </aside>
</template>
