import {strategyStore} from '../../utils/strategy-store';
import {strategySnapshots,validateStrategyCards} from '../../utils/strategy-access';
import {validateStrategy,strategyNeedsLayoutEditor} from '../../../shared/domain/strategy';
export default defineEventHandler(async event=>{
  setHeader(event,'Cache-Control','no-store');const q=getQuery(event),method=event.method;
  const user=await workflowUser(event,method!=='GET'||q.mine==='1');const store=strategyStore();
  if(method==='GET'){
    if(q.id){const article=store.article(String(q.id),q.view==='public'?undefined:user?.id);if(!article)throw createError({statusCode:404,message:'攻略不存在或未公开'});return {...article,canEdit:store.owner(article.id)===user?.id,snapshots:await strategySnapshots(article,store.owner(article.id)!,q.view==='public'||!article.canEdit)};}
    const page=Number(q.page||1);if(!Number.isSafeInteger(page)||page<1||String(q.q||'').length>100)throw createError({statusCode:400,message:'检索条件无效'});
    return store.list(q.mine==='1'?user!.id:undefined,String(q.q||''),String(q.category||''),page);
  }
  workflowOriginCheck(event);await assertWorkflowBodySize(event,750000);const body=await readBody(event);
  try{
    if(method==='POST'){
      const previous=store.article(String(body.id),user!.id);
      if(previous?.canEdit&&strategyNeedsLayoutEditor(previous.doc)&&getHeader(event,'x-lycee-editor-version')!=='2')throw createError({statusCode:409,message:'这篇攻略使用了新版排版，请刷新编辑器后再保存。本机修改仍保留。'});
      const valid=validateStrategy(body.body);await validateStrategyCards(valid);return store.save(user!.id,user!.name,body.id,body.revision,valid);
    }
    if(method==='PATCH'){
      if(body.action==='publish'){
        const article=store.article(body.id,user!.id);if(!article?.canEdit)throw createError({statusCode:403,message:'无权发布'});
        await validateStrategyCards(article);
        const snapshots=await strategySnapshots(article,user!.id,true);if(Object.values(snapshots).some(s=>s.unavailable))throw createError({statusCode:400,message:'引用的社区卡组已撤回或暂时不可读取，请处理该引用后发布。'});
        return store.publish(user!.id,body.id,body.revision);
      }
      if(body.action==='unpublish')return store.unpublish(user!.id,body.id,body.revision);
    }
    if(method==='DELETE'){store.remove(user!.id,body.id,body.revision);return {deleted:true};}
    throw createError({statusCode:405});
  }catch(e){const error=e as {statusCode?:number;message:string};throw createError({statusCode:error.statusCode||400,message:error.message});}
});
