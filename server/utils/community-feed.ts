import { createError } from 'h3';
import type { Card } from '../../shared/domain/catalog';
import { matchesDeck, deckComposition, type DeckSearch } from '../../shared/domain/deck-library';
import { loadLegacyWorkflow, type LegacyItem, type LegacyPage } from './workflow-legacy';

export interface FeedItem extends LegacyItem {
  quantities?: Record<string, number>;
  cover?: string;
  author?: string;
  updatedAt?: string;
  legacy?: boolean;
}
type LegacyLoader = (query: Record<string, unknown>, hydrate?: boolean) => Promise<LegacyPage | LegacyItem>;
export function legacyFeedQuery(filters: DeckSearch, codes: string[], match: string) {
  const query: Record<string, unknown> = { q: filters.q, color: filters.color };
  if (filters.type) query.deckType = filters.type;
  if (filters.type === 'single' && filters.series) query.series = filters.series;
  if (codes.length) { query.codes = codes.join(','); query.match = match; }
  if (filters.color && filters.color !== 'mix') {
    for (const a of ['雪', '月', '花', '宙', '日', '他']) query[`attr_${a}_${a === filters.color ? 'min' : 'max'}`] = a === filters.color ? 1 : 0;
  } else if (filters.color === 'mix') {
    for (const [a, range] of Object.entries(filters.ranges)) {
      if (range.min !== null) query[`attr_${a}_min`] = range.min;
      if (range.max !== null) query[`attr_${a}_max`] = range.max;
    }
  }
  return query;
}
export function feedMatches(item: FeedItem, filters: DeckSearch, codes: string[], match: string, catalog: Map<string, Card>) {
  const quantities = item.quantities || item.cards || {};
  return matchesDeck({ ...item, quantities }, filters, deckComposition(quantities, catalog)) && (!codes.length ||
    (match === 'any' ? codes.some(code => Object.keys(quantities).some(c => c.slice(0, 7) === code)) : codes.every(code => Object.keys(quantities).some(c => c.slice(0, 7) === code))));
}
async function bounded<T, R>(values: T[], map: (value: T) => Promise<R>) {
  const results: R[] = new Array(values.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, values.length) }, async () => { while (next < values.length) { const i = next++; results[i] = await map(values[i]!); } }));
  return results;
}
const time = (item: FeedItem) => Date.parse(item.updatedAt || item.updated_at || item.created_at || '') || 0;
export async function communityFeed(options: {
  source: string; page: number; local: FeedItem[]; suppressed: string[]; filters: DeckSearch; codes: string[]; match: string; catalog: Map<string, Card>;
}, load: LegacyLoader = loadLegacyWorkflow) {
  const { source, filters, codes, match, catalog } = options;
  const query = legacyFeedQuery(filters, codes, match);
  if (source === 'official_tournament' || source === 'official_user') {
    const result = await load({ ...query, source, page: options.page }) as LegacyPage;
    return { ...result, pages: Math.max(1, result.pages), page: Math.max(1, result.page), items: result.items.filter(item => item.source !== 'community').map(item => ({ ...item, canEdit: false, legacy: true })) };
  }
  const local = options.local.filter(item => feedMatches(item, filters, codes, match, catalog))
    .map(item => ({ ...item, legacy: false, source: 'community' }));
  // Old submissions lack a verified private-original link. Only official legacy
  // sources remain readable until users explicitly publish their private decks.
  if (source === 'community' || source === 'local') {
    const total = local.length, pages = Math.max(1, Math.ceil(total / 20)), page = Math.min(options.page, pages);
    return { items: local.sort((a, b) => time(b) - time(a)).slice((page - 1) * 20, page * 20), total, pages, page };
  }
  const sources = ['official_user', 'official_tournament'];
  const first = await Promise.all(sources.map(source => load({ ...query, source, page: 1 }, false) as Promise<LegacyPage>));
  if (first.some(result => !Array.isArray(result.items) || !Number.isSafeInteger(result.total) || result.total < 0))
    throw createError({ statusCode: 502, message: '卡组来源返回了无效数据，请重试。' });
  const total = local.length + first.reduce((sum, result) => sum + result.total, 0);
  const pages = Math.max(1, Math.ceil(total / 20)), page = Math.min(options.page, pages);
  if (page > 200) throw createError({ statusCode: 422, message: '结果过多，请先缩小系列或卡牌条件。' });
  const requests = first.flatMap((result, index) => Array.from({ length: Math.max(0, Math.min(page, result.pages) - 1) }, (_, i) => ({ source: sources[index]!, page: i + 2 })));
  const rest = await bounded(requests, request => load({ ...query, ...request }, false) as Promise<LegacyPage>);
  const legacy = [...new Map([...first, ...rest].flatMap(result => result.items).filter(item => item.source !== 'community').map(item => [item.id, { ...item, canEdit: false, legacy: true }])).values()];
  // Stable sort preserves the upstream's ordering for equal legacy timestamps.
  const selected = [...local, ...legacy].sort((a, b) => time(b) - time(a) || Number(a.legacy) - Number(b.legacy)).slice((page - 1) * 20, page * 20);
  const items = await bounded(selected, async item => {
    if (!item.legacy) return item;
    const detail = await load({ id: item.id }, false) as LegacyItem;
    if (detail.source === 'community') throw createError({ statusCode: 404, message: '旧用户发布已下架' });
    return { ...item, cover_code: Object.keys(detail.cards || {})[0] };
  });
  return { items, total, pages, page };
}
