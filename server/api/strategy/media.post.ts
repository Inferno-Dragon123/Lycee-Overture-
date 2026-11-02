import sharp from 'sharp';
import {strategyStore} from '../../utils/strategy-store';
export default defineEventHandler(async event=>{
  workflowOriginCheck(event);const user=(await workflowUser(event))!;await assertWorkflowBodySize(event,6*1024*1024);
  const bytes=(event.node.req as typeof event.node.req & {rawBody:Buffer}).rawBody;
  try{
    const input=sharp(bytes,{limitInputPixels:16000000}),meta=await input.metadata();
    if(!['png','jpeg','webp'].includes(meta.format||''))throw new Error('仅支持PNG、JPEG、WebP图片');
    const image=await input.rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true}).webp({quality:88}).toBuffer();
    return strategyStore().media(user.id,image);
  }catch(e){throw createError({statusCode:400,message:(e as Error).message.startsWith('攻略图片')?(e as Error).message:'图片无效或过大，请使用6MB以内、1600万像素以内的PNG/JPEG/WebP图片。'});}
});
