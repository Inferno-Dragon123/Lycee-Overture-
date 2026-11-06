import sharp from 'sharp';
import { isCustomDeckCover } from '#shared/domain/deck-library';

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store');
  workflowOriginCheck(event);
  const user = (await workflowUser(event))!;
  await assertWorkflowBodySize(event, 5 * 1024 * 1024 + 4096);
  const parts = await readMultipartFormData(event);
  const file = parts?.find(part => part.name === 'image');
  const source = parts?.find(part => part.name === 'sourceCover')?.data.toString('utf8');
  if (!file && isCustomDeckCover(source)) {
    const image = workflowStore().deckCoverImage(source.split('/').at(-1)!, user.id);
    if (!image) throw createError({ statusCode: 404, message: '原封面不存在或未公开' });
    return workflowStore().uploadDeckCover(user.id, image);
  }
  if (!file?.data.length || file.data.length > 5 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type || ''))
    throw createError({ statusCode: 400, message: '请上传不超过 5 MiB 的 PNG、JPEG 或 WebP 图片' });
  try {
    const input = sharp(file.data, { limitInputPixels: 16000000 });
    const metadata = await input.metadata();
    if (!['png', 'jpeg', 'webp'].includes(metadata.format || '') || !metadata.width || !metadata.height || (metadata.pages || 1) > 1)
      throw new Error('图片格式无效');
    const bytes = await input.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
    if (bytes.length > 5 * 1024 * 1024) throw new Error('图片过大');
    return workflowStore().uploadDeckCover(user.id, bytes);
  } catch (error) {
    throw createError({ statusCode: 400, message: (error as Error).message.startsWith('封面图片额度') ? (error as Error).message : '图片无效或过大，请使用 5 MiB、1600 万像素以内的静态 PNG、JPEG 或 WebP 图片。' });
  }
});
