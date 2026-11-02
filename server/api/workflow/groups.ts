import {strategyStore} from '../../utils/strategy-store';
export default defineEventHandler(async event=>{
  setHeader(event,'Cache-Control','no-store');const q=getQuery(event),user=await workflowUser(event,event.method!=='GET'||q.mine==='1'),store=strategyStore();
  if(event.method==='GET')return {items:store.groups(q.mine==='1'?user!.id:undefined)};
  workflowOriginCheck(event);await assertWorkflowBodySize(event,8192);const body=await readBody(event);
  try{
    if(event.method==='POST')return store.saveGroup(user!.id,user!.name,body.id,body.revision??0,body);
    if(event.method==='DELETE'){store.removeGroup(user!.id,body.id,body.revision);return {deleted:true};}
    throw createError({statusCode:405});
  }catch(e){throw createError({statusCode:(e as {statusCode?:number}).statusCode||400,message:(e as Error).message});}
});
