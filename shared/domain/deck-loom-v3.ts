import type { Card } from "./catalog";
import { categoryLabels, normalize, normalizeCode } from "./catalog";
import { DECK_CARD_LIMIT } from "./deck";
export type DeckWallSort = "default" | "code" | "cost" | "attribute" | "category";
export interface DeckWallFilters { q: string; category: string; attributes: string[]; sort: DeckWallSort }
export function validateOrbitQuantities(raw: unknown, known?: Set<string>) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("卡组记录格式无效，原记录已保留。");
  const result: Record<string, number> = {};
  for (const [code, count] of Object.entries(raw)) {
    if (!/^LO-\d+[A-Za-z0-9-]*$/.test(code) || !Number.isSafeInteger(count) || count < 0 || count > DECK_CARD_LIMIT)
      throw new Error("卡组含无效编号或数量，原记录已保留。");
    if (count > 0) {
      if (known && !known.has(code)) throw new Error(`卡库无法识别 ${code}，原记录已保留。`);
      result[code] = count;
    }
  }
  if (Object.values(result).reduce((sum, n) => sum + n, 0) > DECK_CARD_LIMIT) throw new Error("卡组超过张数上限，原记录已保留。");
  return result;
}
export function deckWallCards(cards: Card[], filters: DeckWallFilters) {
  const q = normalize(filters.q);
  const number = normalizeCode(q);
  const isCode = /^(?:LO-)?\d+(?:-[A-Z0-9]+)?$/i.test(q);
  const result = cards.filter(card =>
    (!filters.category || card.category === filters.category) &&
    (!filters.attributes.length || filters.attributes.some(attribute => card.attribute.includes(attribute))) &&
    (!q || (isCode ? card.code === number || (/^LO-\d+$/.test(number) && card.code.startsWith(`${number}-`))
      : normalize([card.name, card.code].join(" ")).includes(q))));
  if (filters.sort === "default") return result;
  const base = new Map(cards.map((card, index) => [card.code, index]));
  return result.sort((a, b) => {
    let value = 0;
    if (filters.sort === "code") value = a.code.localeCompare(b.code, "en", { numeric: true });
    else if (filters.sort === "cost") value = (a.costTotal ?? Infinity) - (b.costTotal ?? Infinity);
    else if (filters.sort === "attribute") value = a.attribute.localeCompare(b.attribute, "ja");
    else value = (categoryLabels[a.category] || a.category).localeCompare(categoryLabels[b.category] || b.category, "zh");
    return value || base.get(a.code)! - base.get(b.code)!;
  });
}
export function practiceDeckFingerprint(name: string, quantities: Record<string, number>) {
  return JSON.stringify([name, Object.entries(quantities).filter(([, n]) => n > 0).sort(([a], [b]) => a.localeCompare(b))]);
}
