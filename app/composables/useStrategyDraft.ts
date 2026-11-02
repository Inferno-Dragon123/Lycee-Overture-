import {strategyRequest} from '~/utils/strategy-api';
import {emptyStrategy,validateStrategy,type StrategyArticle,type StrategyBody,type StrategySnapshot} from '#shared/domain/strategy';
export function useStrategyDraft(id:string){
  const scope=usePersonalScope(),account=useWorkflowAccount();
  const body=ref<StrategyBody>(emptyStrategy()),revision=ref(0),ready=ref(false),dirty=ref(false),published=ref(false);
  const snapshots=ref<Record<string,StrategySnapshot>>({}),status=ref('正在读取'),error=ref(''),conflict=ref(false);
  const key=()=>scope.key('strategy-draft-v1:'+id),writer=crypto.randomUUID();
  let disk:string|null=null,generation=0,timer:ReturnType<typeof setTimeout>|undefined,maxTimer:ReturnType<typeof setTimeout>|undefined,running:Promise<boolean>|null=null,loading=true;
  function cache(){
    const current=localStorage.getItem(key());
    if(current!==disk){conflict.value=true;status.value='保存冲突';error.value='另一页面已修改本机副本。当前编辑仍保留，请另存或重新读取。';localStorage.setItem(key()+':conflict:'+writer,JSON.stringify({body:body.value,revision:revision.value,snapshots:snapshots.value}));return false;}
    const serialized=JSON.stringify({body:body.value,revision:revision.value,dirty:dirty.value,snapshots:snapshots.value,writer});localStorage.setItem(key(),serialized);disk=serialized;return true;
  }
  function changed(){
    if(loading||!ready.value)return;generation++;dirty.value=true;
    let cached=true;
    try{if(!cache())return;}catch{cached=false;error.value='本机恢复副本未能保存，请检查浏览器存储并保持当前页面。';}
    if(conflict.value)return;
    if(!scope.owner.value){status.value=cached?'已保存在本机':'本机保存失败';return;}
    status.value='有修改待同步';clearTimeout(timer);timer=setTimeout(()=>void flush(),700);
    maxTimer??=setTimeout(()=>void flush(),4000);
  }
  watch(body,changed,{deep:true});
  async function flush(){
    clearTimeout(timer);clearTimeout(maxTimer);maxTimer=undefined;
    if(running)return running;
    if(conflict.value||!ready.value)return false;
    if(!scope.owner.value){try{return cache();}catch{error.value='未能保存本机草稿';return false;}}
    if(!dirty.value)return true;
    const sent=generation;
    running=(async()=>{
      status.value='正在保存';
      try{
        const result=await strategyRequest<StrategyArticle>('/api/strategy/articles',{method:'POST',body:{id,revision:revision.value,body:validateStrategy(body.value)}});
        revision.value=result.revision;published.value=!!result.hasPublished;dirty.value=generation!==sent;
        status.value=dirty.value?'有修改待同步':'已保存到云端';error.value='';
        try{cache();}catch{error.value='云端已保存，但本机恢复副本未能更新，请检查浏览器存储。';}
        if(dirty.value)timer=setTimeout(()=>void flush(),700);return !dirty.value;
      }catch(e){
        const x=e as {statusCode?:number;status?:number;data?:{message?:string;statusCode?:number}};
        conflict.value=(x.statusCode||x.status||x.data?.statusCode)===409;
        status.value=conflict.value?'保存冲突':'保存失败';error.value=x.data?.message||'未能同步，修改已保留在本机。恢复网络后重试。';return false;
      }finally{running=null;}
    })();return running;
  }
  async function load(forceCloud=false){
    loading=true;error.value='';
    try{
      const raw=localStorage.getItem(key());disk=raw;
      let local: {body:StrategyBody;revision:number;dirty:boolean;snapshots:Record<string,StrategySnapshot>}|null=null;
      if(raw){try{const parsed=JSON.parse(raw);local={...parsed,body:validateStrategy(parsed.body)};}catch(e){if(!forceCloud)throw e;localStorage.setItem(key()+':damaged:'+Date.now(),raw);}}
      let remote:(StrategyArticle&{snapshots:Record<string,StrategySnapshot>})|null=null;
      if(scope.owner.value){
        try{remote=await strategyRequest('/api/strategy/articles',{query:{id}});}
        catch(e){if(Number((e as {statusCode?:number;status?:number}).statusCode||(e as {status?:number}).status)!==404){if(!local)throw e;status.value='离线编辑';error.value='未能读取云端，已恢复本机副本。';}}
      }
      if(remote&&!remote.canEdit)throw new Error('无权编辑此攻略');
      const chosen=forceCloud&&remote?{body:remote,revision:remote.revision,dirty:false,snapshots:remote.snapshots}:local?.dirty?local:remote?{body:remote,revision:remote.revision,dirty:false,snapshots:remote.snapshots}:local;
      body.value=chosen?validateStrategy(chosen.body):emptyStrategy();revision.value=chosen?.revision||0;snapshots.value=chosen?.snapshots||{};dirty.value=!!chosen?.dirty;published.value=!!remote?.hasPublished;
      conflict.value=!!(local?.dirty&&remote&&local.revision!==remote.revision&&!forceCloud);
      ready.value=true;await nextTick();loading=false;
      if(conflict.value){status.value='保存冲突';error.value='云端已有更新，本机修改已保留。请选择另存或读取云端。';}
      else if(!error.value)status.value=scope.owner.value?(dirty.value?'有修改待同步':remote||local?.revision?'已保存到云端':'新草稿，输入后自动保存'):'仅保存在本机';
      try{cache();}catch{error.value='本机恢复副本未能更新，请检查浏览器存储并保持联网。';}
      if(dirty.value&&!conflict.value&&scope.owner.value)timer=setTimeout(()=>void flush(),700);
    }catch(e){error.value=(e as {data?:{message?:string};message?:string}).data?.message||(e as Error).message||'草稿读取失败，原副本已保留。';status.value='读取失败';ready.value=false;loading=false;}
  }
  async function readCloud(){
    if(!scope.owner.value)return;
    localStorage.setItem(key()+':recovery:'+Date.now(),JSON.stringify({body:body.value,revision:revision.value,snapshots:snapshots.value}));
    await load(true);
  }
  async function fork(){const next='a_'+crypto.randomUUID();localStorage.setItem(scope.key('strategy-draft-v1:'+next),JSON.stringify({body:body.value,revision:0,dirty:true,snapshots:snapshots.value}));await navigateTo('/concepts/orbit/learn/write?draft='+next);}
  async function publish(){
    if(!scope.owner.value){error.value='请先登录后发布。';return false;}
    let saved=await flush();
    // A request started before the publish dialog may contain an older edit.
    if(!saved&&dirty.value&&!conflict.value&&!error.value)saved=await flush();
    if(!saved||dirty.value||conflict.value)return false;
    try{validateStrategy(body.value,true);const r=await strategyRequest<StrategyArticle>('/api/strategy/articles',{method:'PATCH',body:{id,revision:revision.value,action:'publish'}});revision.value=r.revision;published.value=true;status.value='已发布';cache();return true;}
    catch(e){error.value=(e as {data?:{message?:string}}).data?.message||(e as Error).message;return false;}
  }
  function online(){if(dirty.value&&!conflict.value)void flush();}
  function beforeUnload(e:BeforeUnloadEvent){if(dirty.value){e.preventDefault();e.returnValue='';}}
  function storage(e:StorageEvent){if(e.key===key()&&e.newValue!==disk){conflict.value=true;status.value='保存冲突';error.value='另一页面已修改这篇草稿，当前编辑仍保留。';}}
  onMounted(()=>{void load();window.addEventListener('online',online);window.addEventListener('beforeunload',beforeUnload);window.addEventListener('storage',storage);});
  onBeforeUnmount(()=>{clearTimeout(timer);clearTimeout(maxTimer);window.removeEventListener('online',online);window.removeEventListener('beforeunload',beforeUnload);window.removeEventListener('storage',storage);});
  return {body,revision,ready,dirty,published,snapshots,status,error,conflict,flush,publish,readCloud,fork,changed,account};
}
