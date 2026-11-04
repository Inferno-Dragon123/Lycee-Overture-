import { fetchOfficialDeck } from '../../utils/official-deck';
import { officialDeckUrl } from '../../../shared/domain/official-deck';
import { getCatalog } from '../../utils/catalog';

export default defineEventHandler(async event => {
  const body = await readBody(event);
  let url: string;
  try { url = officialDeckUrl(body?.url); }
  catch (error) { throw createError({ statusCode: 400, message: (error as Error).message }); }
  try {
    const deck = await fetchOfficialDeck(url);
    const catalog = await getCatalog();
    const missing = Object.keys(deck.quantities).filter(code => !catalog.byCode.has(code));
    if (missing.length) throw new Error(`当前卡库缺少 ${missing.join('、')}，未导入任何卡牌`);
    setHeader(event, 'Cache-Control', 'no-store');
    return deck;
  } catch (error) {
    throw createError({ statusCode: 502, message: error instanceof Error && !/fetch|connect|ENOT|ECONN|timeout/i.test(error.message) ? error.message : '暂时无法读取官网卡组，请稍后重试' });
  }
});
