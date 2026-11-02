import { categoryLabels } from "./catalog";
import type { LoomCard } from "./deck-loom";

export interface VisualLoomCard extends LoomCard {
  version?: string;
  rarity?: string;
  visualFocus?: { x?: number; y?: number };
}
export interface VisualLoomEntry { card: VisualLoomCard; count: number }
export type LoomGrouping = "none" | "attribute" | "category";
export const loomCategories = ["キャラクター", "イベント", "アイテム", "エリア"] as const;

/** Round-robin categories, then full attribute values, without merging printings. */
export function mixedLoomSample(cards: VisualLoomCard[], limit = 60) {
  const seen = new Set<string>();
  const categories = new Map<string, Map<string, VisualLoomCard[]>>();
  for (const card of cards) {
    if (seen.has(card.code)) continue;
    seen.add(card.code);
    if (!categories.has(card.category)) categories.set(card.category, new Map());
    const attributes = categories.get(card.category)!;
    if (!attributes.has(card.attribute)) attributes.set(card.attribute, []);
    attributes.get(card.attribute)!.push(card);
  }
  const pools = [...categories.values()].map(attributes => ({ buckets: [...attributes.values()], cursor: 0 }));
  const result: VisualLoomCard[] = [];
  while (result.length < limit) {
    let added = false;
    for (const pool of pools) {
      for (let attempt = 0; attempt < pool.buckets.length; attempt++) {
        const bucket = pool.buckets[pool.cursor++ % pool.buckets.length]!;
        const card = bucket.shift();
        if (!card) continue;
        result.push(card); added = true; break;
      }
      if (result.length >= limit) break;
    }
    if (!added) break;
  }
  return result;
}
export function groupLoomEntries(entries: VisualLoomEntry[], grouping: LoomGrouping) {
  const groups = new Map<string, VisualLoomEntry[]>();
  for (const entry of entries) {
    const key = grouping === "none" ? "全部卡牌" : entry.card[grouping] || "未标注";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }
  return [...groups].map(([key, items]) => ({ key, label: grouping === "category" ? categoryLabels[key] || key : key, entries: items }));
}
export function loomNeighborhood(entries: VisualLoomEntry[], code: string, count: number) {
  const index = Math.max(0, entries.findIndex(entry => entry.card.code === code));
  const start = Math.max(0, Math.min(index - Math.floor(count / 2), entries.length - count));
  return entries.slice(start, start + count);
}
export function updateLoomRecent(previous: string[], code: string, quantities: Record<string, number>) {
  return [...new Set([code, ...previous])].filter(id => (quantities[id] ?? 0) > 0).slice(0, 5);
}
export function adjacentLoomFocus(previous: string[], next: string[], code: string) {
  if (next.includes(code)) return code;
  return next[Math.max(0, Math.min(previous.indexOf(code), next.length - 1))] ?? "";
}
export interface LoomHitRect { code: string; left: number; right: number; top: number; bottom: number }
/** Actual DOM geometry supports grouped, horizontally scrolled, column-major grids. */
export function closestLoomCard(rects: LoomHitRect[], x: number, y: number) {
  let nearest = "", best = Infinity;
  for (const rect of rects) {
    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);
    const distance = dx * dx + dy * dy;
    if (distance < best) { best = distance; nearest = rect.code; }
  }
  return nearest;
}
export function mockLoomV2Cards(): VisualLoomCard[] {
  return Array.from({ length: 60 }, (_, i) => ({
    code: `MOCK-${String(i + 1).padStart(3, "0")}`, name: `模拟卡牌 ${i + 1}`, img: "",
    category: loomCategories[i % 4]!, attribute: ["日", "月", "雪", "宙", "花", "雪花"][i % 6]!,
    ex: 2, ap: i % 6, dp: i % 5, sp: i % 3, dmg: 1, cost: "日日", version: "模拟版本", rarity: "模拟",
    textZh: "仅用于交互测试的模拟效果，不代表真实卡牌。", textJa: "テスト用の模擬カード。",
  }));
}
