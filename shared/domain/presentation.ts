import type { Card } from './catalog';
export function firstSeriesCards(cards: Pick<Card, 'code' | 'brand' | 'img'>[]) {
  const first = new Map<string, Pick<Card, 'code' | 'brand' | 'img'>>();
  for (const card of cards) {
    const old = first.get(card.brand);
    if (!old || card.code.localeCompare(old.code, 'en', { numeric: true }) > 0) first.set(card.brand, card);
  }
  return first;
}
export function chinaDay(time = Date.now()) { return new Date(time + 8 * 3600000).toISOString().slice(0, 10); }
export function dailyWallCodes(codes: string[], day: string, count = 80) {
  const pool = [...new Set(codes)].sort();
  let seed = 2166136261;
  for (const char of `lycee-home-wall:${day}`) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  function random() { seed += 0x6d2b79f5; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j]!, pool[i]!]; }
  return pool.slice(0, Math.max(0, count));
}
export function deckReturnPath(value: unknown, publication: boolean) {
  if (typeof value === 'string' && /^\/concepts\/orbit\/(?:community|decks)(?:\?[^#\r\n]*)?$/.test(value)) return value;
  return `/concepts/orbit/${publication ? 'community' : 'decks'}`;
}
