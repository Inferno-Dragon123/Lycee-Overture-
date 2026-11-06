export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store');
  const user = await workflowUser(event, false);
  const image = workflowStore().deckCoverImage(getRouterParam(event, 'id') || '', user?.id);
  if (!image) throw createError({ statusCode: 404, message: '封面不存在或未公开' });
  setHeader(event, 'Content-Type', 'image/webp');
  setHeader(event, 'X-Content-Type-Options', 'nosniff');
  return image;
});
