import {strategyStore} from '../../utils/strategy-store';
import {loadLegacyWorkflow,type LegacyItem} from '../../utils/workflow-legacy';
export default defineEventHandler(async event=>{
  workflowOriginCheck(event);const user=(await workflowUser(event))!;await assertWorkflowBodySize(event,2048);const body=await readBody(event);
  if(typeof body.id!=='string'||body.id.length>160)throw createError({statusCode:400,message:'卡组标识无效'});
  let deck:{name:string;quantities:Record<string,number>;author?:string;author_name?:string}|undefined;
  let sourceUrl='';
  if(body.source==='personal'){
    if(body.acknowledgePrivate!==true)throw createError({statusCode:400,message:'请确认被引用的私人构筑会随攻略公开。'});
    const d=workflowStore().personal(user.id).data.library.saved.find(d=>d.id===body.id);if(d)deck={...d,author:user.name};
  }else if(body.source==='community'){
    deck=workflowStore().get(body.id)||undefined;sourceUrl='/concepts/orbit/deck?publication='+encodeURIComponent(body.id);
  }else if(body.source==='legacy'){
    const d=await loadLegacyWorkflow({id:body.id},false) as LegacyItem & {author_name?:string};
    if(d.cards)deck={name:d.name,quantities:d.cards,author_name:d.author_name};sourceUrl='/concepts/orbit/deck?legacy=1&publication='+encodeURIComponent(body.id);
  }else throw createError({statusCode:400,message:'卡组来源无效'});
  if(!deck||!Object.keys(deck.quantities).length)throw createError({statusCode:404,message:'卡组不存在、尚未同步或没有公开'});
  const catalog=(await getCatalog()).byCode;
  if(Object.keys(deck.quantities).some(code=>!catalog.has(code)))throw createError({statusCode:400,message:'卡组含未收录卡牌，暂不能引用'});
  return strategyStore().snapshot(user.id,{source:body.source,sourceId:body.id,name:deck.name,author:deck.author||deck.author_name||'原卡组作者',quantities:deck.quantities,sourceUrl});
});
