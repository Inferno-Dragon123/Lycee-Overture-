import { load } from 'cheerio';
import { officialDeckUrl } from '../../shared/domain/official-deck';
import { fetchOfficialArtwork } from './artwork-transport';

export function parseOfficialDeck(html: string) {
  const $ = load(html);
  const tables = $('table').filter((_, table) => {
    const headings = $(table).find('th').map((_, h) => $(h).text().trim()).get();
    return headings.includes('枚数') && headings.includes('カード番号');
  });
  if (tables.length !== 1) throw new Error('官网卡组不存在或页面格式已改变');
  const quantities: Record<string, number> = {};
  tables.find('tr').each((_, row) => {
    const cells = $(row).children('td');
    if (!cells.length) return;
    const code = cells.eq(1).text().normalize('NFKC').trim().toUpperCase();
    const match = /^(\d+)枚$/.exec(cells.eq(0).text().normalize('NFKC').trim());
    const quantity = Number(match?.[1]);
    if (!/^LO-\d{4}[A-Z0-9-]{0,16}$/.test(code) || !match || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 60 || Object.hasOwn(quantities, code))
      throw new Error('官网卡组卡号或数量无法完整解析');
    quantities[code] = quantity;
  });
  const total = Object.values(quantities).reduce((a, b) => a + b, 0);
  const declared = /合計\s*[:：]\s*(\d+)/.exec($('#contents').text());
  if (!declared || Number(declared[1]) !== total || total < 1 || total > 200)
    throw new Error('官网卡组总张数校验失败，未导入任何卡牌');
  const nameRow = $('tr').filter((_, row) => $(row).children('th').first().text().trim() === 'デッキ名').first();
  const name = nameRow.children('td').first().text().trim() || '官网卡组';
  if (name.length > 100) throw new Error('官网卡组名称过长');
  return { name, quantities };
}

export async function fetchOfficialDeck(raw: unknown) {
  const url = officialDeckUrl(raw);
  const response = await fetchOfficialArtwork(url, { credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(18000) });
  if (!response.ok || !response.body) throw new Error('暂时无法读取官网卡组，请稍后重试');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2_000_000) throw new Error('官网卡组页面过大，未导入任何卡牌');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return parseOfficialDeck(Buffer.concat(chunks).toString('utf8'));
}
