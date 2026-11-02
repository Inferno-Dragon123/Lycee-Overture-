import {strategyStore} from '../../utils/strategy-store';
export default defineEventHandler(async event=>{
  setHeader(event,'Cache-Control','no-store');const user=(await workflowUser(event))!,id=String(getQuery(event).id||'');
  const data=strategyStore().snapshotData(id,user.id);if(!data)throw createError({statusCode:404,message:'引用快照不存在'});return data;
});
