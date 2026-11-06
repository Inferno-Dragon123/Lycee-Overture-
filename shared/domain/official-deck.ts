export function officialDeckUrl(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > 2000) throw new Error('请输入 Lycee 官网卡组链接');
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new Error('请输入 Lycee 官网卡组链接'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port)
    throw new Error('无效的官网卡组链接');
  let id: string | null = null;
  if (['lycee-tcg.com', 'www.lycee-tcg.com'].includes(url.hostname) && /^\/d\/?$/.test(url.pathname)) {
    if (url.searchParams.getAll('d').length === 1) id = url.searchParams.get('d');
  } else if (['lycee-tcg.com', 'www.lycee-tcg.com'].includes(url.hostname) && /^\/blog\/article_\d{1,10}\.html$/.test(url.pathname)) {
    return `https://lycee-tcg.com${url.pathname}`;
  } else if (url.hostname === 'lyc.ee' && /^\/d[A-Za-z0-9_-]{1,40}$/.test(url.pathname)) {
    id = url.pathname.slice(2);
  }
  if (!id || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) throw new Error('仅支持 Lycee 官网卡组、攻略文章链接或 lyc.ee 短链接');
  return `https://lycee-tcg.com/d/?d=${encodeURIComponent(id)}`;
}
