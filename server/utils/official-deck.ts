import { load, type CheerioAPI } from 'cheerio';
import { officialDeckUrl } from '../../shared/domain/official-deck';
import { fetchOfficialArtwork } from './artwork-transport';

function deckQuantities($: CheerioAPI, table: ReturnType<CheerioAPI>, plainQuantity = false) {
  const quantities: Record<string, number> = {};
  table.find('tr').each((_, row) => {
    const cells = $(row).children('td');
    if (!cells.length) return;
    const code = cells.eq(1).text().normalize('NFKC').trim().toUpperCase();
    const match = (plainQuantity ? /^(\d+)(?:枚)?$/ : /^(\d+)枚$/).exec(cells.eq(0).text().normalize('NFKC').trim());
    const quantity = Number(match?.[1]);
    if (!/^LO-\d{4}[A-Z0-9-]{0,16}$/.test(code) || !match || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 60 || Object.hasOwn(quantities, code))
      throw new Error('官网卡组卡号或数量无法完整解析');
    quantities[code] = quantity;
  });
  return quantities;
}

function deckName(name: string) {
  if (name.length > 100) throw new Error('官网卡组名称过长');
  return name || '官网卡组';
}

export function parseOfficialDeck(html: string) {
  const $ = load(html);
  const tables = $('table').filter((_, table) => {
    const headings = $(table).find('th').map((_, h) => $(h).text().trim()).get();
    return headings.includes('枚数') && headings.includes('カード番号');
  });
  if (tables.length !== 1) throw new Error('官网卡组不存在或页面格式已改变');
  const quantities = deckQuantities($, tables);
  const total = Object.values(quantities).reduce((a, b) => a + b, 0);
  const declared = /合計\s*[:：]\s*(\d+)/.exec($('#contents').text());
  if (!declared || Number(declared[1]) !== total || total < 1 || total > 200)
    throw new Error('官网卡组总张数校验失败，未导入任何卡牌');
  const nameRow = $('tr').filter((_, row) => $(row).children('th').first().text().trim() === 'デッキ名').first();
  const name = deckName(nameRow.children('td').first().text().trim());
  return { name, quantities };
}

export function parseOfficialBlog(html: string, sourceUrl: string) {
  const $ = load(html);
  const content = $('.txt_area');
  if (content.length !== 1) throw new Error('官网攻略正文无法识别，未导入任何卡牌');
  const tables = content.find('table').filter((_, table) => {
    const headings = $(table).find('th').map((_, heading) => $(heading).text().trim()).get();
    return $(table).hasClass('decklist') || (headings.includes('枚数') && headings.some(heading => ['番号', 'カード番号'].includes(heading)));
  });
  const links = new Set<string>();
  content.find('a[href], iframe[src]').each((_, element) => {
    const target = $(element).attr('href') || $(element).attr('src');
    try {
      const url = officialDeckUrl(new URL(target!, sourceUrl).href);
      if (new URL(url).pathname === '/d/') links.add(url);
    } catch { /* Only supported official deck links may become a second request. */ }
  });
  if (tables.length + links.size > 1)
    throw new Error('官网攻略包含多个卡组，请使用需要导入的具体官网卡组链接；未导入任何卡牌');
  if (!tables.length) {
    if (links.size === 1) return { url: [...links][0]! };
    throw new Error('官网攻略中未找到可完整解析的卡组表或官网卡组链接');
  }
  const headings = tables.find('tr').first().children('th').map((_, heading) => $(heading).text().trim()).get();
  if (headings[0] !== '枚数' || !['番号', 'カード番号'].includes(headings[1] || ''))
    throw new Error('官网攻略卡组表格式已改变，未导入任何卡牌');
  const quantities = deckQuantities($, tables, true);
  const total = Object.values(quantities).reduce((a, b) => a + b, 0);
  // Blog recipe tables omit a declared total; only a complete 60-card deck is accepted.
  const declared = [...content.text().matchAll(/合計\s*[:：]\s*(\d+)/g)];
  if (total !== 60 || declared.some(match => Number(match[1]) !== total))
    throw new Error('官网卡组总张数校验失败，未导入任何卡牌');
  const title = content.closest('.main_inner').find('.headline .title').first().text().trim() || $('h1').first().text().trim();
  return { name: deckName(title), quantities };
}

async function fetchOfficialPage(url: string, signal: AbortSignal) {
  const response = await fetchOfficialArtwork(url, { credentials: 'omit', redirect: 'error', signal });
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
  return Buffer.concat(chunks).toString('utf8');
}

export async function fetchOfficialDeck(raw: unknown) {
  const url = officialDeckUrl(raw);
  const signal = AbortSignal.timeout(18000);
  const html = await fetchOfficialPage(url, signal);
  if (new URL(url).pathname === '/d/') return parseOfficialDeck(html);
  const recipe = parseOfficialBlog(html, url);
  return 'url' in recipe
    ? parseOfficialDeck(await fetchOfficialPage(recipe.url!, signal))
    : recipe;
}
