import {strategyStore} from '../../../utils/strategy-store';
export default defineEventHandler(async event=>{
  const id=getRouterParam(event,'id')||'',store=strategyStore();
  const publicImage=store.mediaImage(id);
  const image=publicImage||store.mediaImage(id,(await workflowUser(event,false))?.id);if(!image)throw createError({statusCode:404});
  setHeader(event,'Cache-Control','private, no-store');setHeader(event,'Content-Type','image/webp');setHeader(event,'X-Content-Type-Options','nosniff');return image;
});
