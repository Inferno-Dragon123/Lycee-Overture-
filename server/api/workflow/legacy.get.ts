import { loadLegacyWorkflow } from '../../utils/workflow-legacy';
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store');
  const query = getQuery(event);
  if (query.id) {
    const deck = await loadLegacyWorkflow(query);
    if ('source' in deck && deck.source === 'community') throw createError({ statusCode: 404, message: '旧用户发布已下架，请从我的卡组重新发布。' });
    return { ...deck, canEdit: false };
  }
  if (!['official_user', 'official_tournament', 'official'].includes(String(query.source || '')))
    return { items: [], total: 0, pages: 1, page: 1 };
  return loadLegacyWorkflow(query);
});
