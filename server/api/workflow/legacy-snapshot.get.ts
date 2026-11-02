import { tencentDatabase } from '../../utils/tencent-database';
export default defineEventHandler(async event=>{
  setHeader(event,'Cache-Control','no-store');
  const id=String(getQuery(event).id||'');
  if(!/^d_[A-Za-z0-9_-]{1,100}$/.test(id))throw createError({statusCode:400,message:'无效快照编号'});
  if(useRuntimeConfig().workflowLegacySource!=='postgres')throw createError({statusCode:503,message:'旧卡组快照尚未接入'});
  const row=(await tencentDatabase().query('SELECT id,name,cards,created_at FROM toolbox_decks WHERE id=$1',[id])).rows[0];
  if(!row)throw createError({statusCode:404,message:'卡组快照不存在'});
  return {...row,quantities:row.cards,description:'',cover:Object.keys(row.cards)[0]||''};
});
