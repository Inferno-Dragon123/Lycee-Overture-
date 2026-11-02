import { categoryLabels, normalize } from "./catalog";
import { DECK_CARD_LIMIT } from "./deck";

export interface LoomCard {
  code: string;
  name: string;
  img: string;
  category: string;
  attribute: string;
  ex: number | null;
  ap: number | null;
  dp: number | null;
  sp: number | null;
  cost?: string;
  dmg?: number | null;
  textZh: string;
  textJa: string;
}
export interface LoomEntry { card: LoomCard; count: number }

// Keep surviving cards in place and append additions, including full printing IDs.
export function reconcileLoomOrder(previous: string[], entries: LoomEntry[]) {
  const codes = new Set(entries.map(entry => entry.card.code));
  const kept = previous.filter(code => codes.has(code));
  return [...kept, ...entries.map(entry => entry.card.code).filter(code => !kept.includes(code))];
}
export function loomMatches(card: LoomCard, query: string) {
  const text = normalize([card.code, card.name, card.attribute, card.category, categoryLabels[card.category]].join(" "));
  return normalize(query).split(/\s+/).filter(Boolean).every(word => text.includes(word));
}
export function loomPointerIndex(x: number, left: number, width: number, length: number) {
  if (length < 1) return -1;
  return Math.min(length - 1, Math.max(0, Math.floor((x - left) / Math.max(1, width) * length)));
}
export function loomAtlasIndex(x: number, y: number, rect: { left: number; top: number; width: number; height: number }, length: number) {
  if (!length) return -1;
  const columns = Math.min(20, length);
  const rows = Math.ceil(length / columns);
  const row = loomPointerIndex(y, rect.top, rect.height, rows);
  return Math.min(length - 1, row * columns + loomPointerIndex(x, rect.left, rect.width, columns));
}
export function updateShowcaseQuantity(source: Record<string, number>, code: string, delta: number) {
  const next = (source[code] ?? 0) + delta;
  const total = Object.values(source).reduce((sum, value) => sum + value, 0);
  if (!Number.isInteger(delta) || !Number.isSafeInteger(next) || next < 0 || total + delta > DECK_CARD_LIMIT)
    return null;
  return { ...source, [code]: next };
}
