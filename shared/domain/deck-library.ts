import type { Card } from "./catalog";
import { validateOrbitQuantities } from "./deck-loom-v3";
export interface LibraryDeck {
  id: string;
  name: string;
  quantities: Record<string, number>;
  description?: string;
  cover?: string;
  example?: boolean;
}
export interface DeckDraft extends LibraryDeck {
  resume: string;
  editingId?: string;
}
export interface DeckLibrary {
  version: 2;
  saved: LibraryDeck[];
  draft: DeckDraft | null;
}
export const totalCards = (q: Record<string, number>) =>
  Object.values(q).reduce((a, b) => a + b, 0);
export function validateLibraryDeck(
  raw: unknown,
  complete = false,
): LibraryDeck {
  if (!raw || typeof raw !== "object") throw new Error("无效卡组");
  const d = raw as LibraryDeck;
  if (
    typeof d.id !== "string" ||
    typeof d.name !== "string" ||
    !d.name.trim() ||
    d.name.length > 100 ||
    (d.description !== undefined &&
      (typeof d.description !== "string" || d.description.length > 2000))
  )
    throw new Error("卡组名称或简介无效");
  const quantities = validateOrbitQuantities(d.quantities),
    total = totalCards(quantities);
  if (!total || (complete && total !== 60))
    throw new Error(complete ? "保存卡组需要 60 张" : "草稿需要 1～60 张");
  if (d.cover && !quantities[d.cover]) throw new Error("封面必须来自卡组");
  return {
    id: d.id,
    name: d.name.trim(),
    description: d.description || "",
    cover: d.cover || Object.keys(quantities)[0],
    quantities,
  };
}
export function safeResume(path: unknown) {
  return typeof path === "string" &&
    /^\/concepts\/orbit\/cards(?:\?|$)/.test(path)
    ? path
    : "/concepts/orbit/cards?view=all";
}
export function parseLibrary(raw: string): DeckLibrary {
  const data = JSON.parse(raw);
  if (data.version !== 2 || !Array.isArray(data.saved))
    throw new Error("卡组记录格式无效");
  const saved = data.saved.map((d: unknown) => validateLibraryDeck(d, true));
  if (new Set(saved.map((d: LibraryDeck) => d.id)).size !== saved.length)
    throw new Error("重复卡组编号");
  const draft = data.draft
    ? {
        ...validateLibraryDeck(data.draft),
        resume: safeResume(data.draft.resume),
        editingId:
          typeof data.draft.editingId === "string"
            ? data.draft.editingId
            : undefined,
      }
    : null;
  return { version: 2, saved, draft };
}
export const deckAttributes = ["雪", "月", "花", "宙", "日", "他"];
export function deckComposition(
  quantities: Record<string, number>,
  catalog: Map<string, Card>,
) {
  const counts: Record<string, number> = Object.fromEntries(
    deckAttributes.map((a) => [a, 0]),
  );
  let shared: Set<string> | null = null,
    unknown = false;
  for (const [code, n] of Object.entries(quantities)) {
    if (!n) continue;
    const c = catalog.get(code);
    if (!c) {
      unknown = true;
      continue;
    }
    const attribute = c.attribute.normalize("NFKC").trim();
    if (deckAttributes.slice(0, 5).includes(attribute)) counts[attribute]! += n;
    else if (/^[雪月花宙日無]+$/.test(attribute)) counts["他"]! += n;
    else unknown = true;
    const brands = c.brand
      .trim()
      .toUpperCase()
      .split(/\s+/)
      .filter((v) => /^[A-Z][A-Z0-9]*$/.test(v));
    if (!brands.length) unknown = true;
    shared =
      shared === null
        ? new Set(brands)
        : new Set(brands.filter((b) => shared!.has(b)));
  }
  const series = unknown ? [] : [...(shared ?? [])].sort();
  return {
    type: unknown ? "unknown" : series.length ? "single" : "mix",
    series,
    counts,
    complete: !unknown,
  };
}
export interface DeckSearch {
  q: string;
  type: string;
  series: string;
  color: string;
  ranges: Record<string, { min: number | null; max: number | null }>;
}
export const emptyDeckSearch = (): DeckSearch => ({
  q: "",
  type: "",
  series: "",
  color: "",
  ranges: {},
});
export function matchesDeck(
  d: LibraryDeck,
  f: DeckSearch,
  c: ReturnType<typeof deckComposition>,
) {
  const text = `${d.name} ${d.description || ""}`
    .normalize("NFKC")
    .toLowerCase();
  if (
    !f.q
      .normalize("NFKC")
      .toLowerCase()
      .split(/\s+/)
      .every((w) => text.includes(w))
  )
    return false;
  if (f.type && c.type !== f.type) return false;
  if (f.type === "single" && f.series && !c.series.includes(f.series))
    return false;
  const colors = Object.entries(c.counts)
    .filter(([, n]) => n > 0)
    .map(([a]) => a);
  if (f.color && !c.complete) return false;
  if (f.color === "mix" && colors.length < 2) return false;
  if (
    f.color &&
    f.color !== "mix" &&
    (colors.length !== 1 || colors[0] !== f.color)
  )
    return false;
  if (f.color === "mix")
    for (const [a, r] of Object.entries(f.ranges)) {
      const n = c.counts[a] ?? 0;
      if ((r.min !== null && n < r.min) || (r.max !== null && n > r.max))
        return false;
    }
  return true;
}
