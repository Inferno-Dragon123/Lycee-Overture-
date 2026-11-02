import {strategyRefs,type StrategyBody,type StrategySnapshot} from '../../shared/domain/strategy';
import {loadLegacyWorkflow,type LegacyItem} from './workflow-legacy';
import {strategyStore} from './strategy-store';
export async function strategySnapshots(body:StrategyBody,owner:string,publicView=false){
  const result:Record<string,StrategySnapshot>={};
  for(const id of strategyRefs(body.doc).snapshots){
    const data=strategyStore().snapshotData(id,owner);if(!data)continue;
    if(publicView&&data.source!=='personal'){
      let available=false;
      try{available=data.source==='community'?!!workflowStore().get(data.sourceId):!!await loadLegacyWorkflow({id:data.sourceId},false);}catch{/* Source withdrawn or unavailable: keep stored snapshot private. */}
      if(!available){result[id]={...data,quantities:{},unavailable:true};continue;}
    }
    result[id]=data;
  }
  return result;
}
export async function validateStrategyCards(body:StrategyBody){
  const cards=(await getCatalog()).byCode;
  if(strategyRefs(body.doc).codes.some(code=>!cards.has(code)))throw createError({statusCode:400,message:'攻略引用了未收录的卡牌'});
}
