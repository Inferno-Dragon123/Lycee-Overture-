import { Document, Charset } from "flexsearch";
import {
  cardText,
  normalize,
  normalizeCode,
  type Card,
  type SearchQuery,
  type SearchResult,
  type CatalogFacets,
} from "./catalog";

export function createSearchEngine(cards: Card[]) {
  const index = new Document({
    tokenize: "strict",
    encoder: Charset.CJK,
    document: { id: "id", index: ["text"] },
  });
  const texts = new Map(cards.map((card) => [card.code, cardText(card)]));
  for (const card of cards)
    index.add({ id: card.code, text: texts.get(card.code)! });
  const ordered = [...cards].sort((a, b) =>
    b.code.localeCompare(a.code, "en", { numeric: true }),
  );
  return (query: SearchQuery = {}): SearchResult => {
    const text = normalize(query.q ?? "").slice(0, 200);
    const code = normalizeCode(text);
    const isCode = /^(?:LO-)?\d+(?:-[A-Z0-9]+)?$/i.test(text);
    let candidates: Set<string> | undefined;
    if (text && !isCode) {
      candidates = new Set(
        index
          .search(text, { limit: cards.length })
          .flatMap((group) => group.result.map(String)),
      );
      // CJK encoding ignores punctuation. Literal matches remain authoritative for punctuation-only queries.
      if (!/[\p{L}\p{N}]/u.test(text)) candidates = undefined;
    }
    const result = ordered.filter((card) => {
      if (
        text &&
        (isCode
          ? !(
              card.code === code ||
              (/^LO-\d+$/.test(code) && card.code.startsWith(`${code}-`))
            )
          : !(
              texts.get(card.code)!.includes(text) &&
              (!candidates || candidates.has(card.code))
            ))
      )
        return false;
      return (
        (!query.series || card.series === query.series) &&
        (!query.version || card.version === query.version) &&
        (!query.category || card.category === query.category) &&
        (!query.attribute || card.attribute === query.attribute) &&
        (!query.rarity || card.rarity === query.rarity)
      );
    });
    const pageSize = Math.max(
      1,
      Math.min(60, Math.trunc(Number(query.pageSize) || 24)),
    );
    const pages = Math.max(1, Math.ceil(result.length / pageSize));
    const page = Math.max(
      1,
      Math.min(pages, Math.trunc(Number(query.page) || 1)),
    );
    return {
      cards: result.slice((page - 1) * pageSize, page * pageSize),
      total: result.length,
      page,
      pageSize,
      pages,
    };
  };
}

export function getFacets(cards: Card[]): CatalogFacets {
  const groups = new Map<string, Card[]>();
  for (const card of cards)
    groups.set(card.series, [...(groups.get(card.series) ?? []), card]);
  return {
    total: cards.length,
    series: [...groups]
      .map(([name, rows]) => ({
        name,
        count: rows.length,
        image: rows.at(-1)!.img,
        versions: [...new Set(rows.map((c) => c.version))].sort(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "en")),
    categories: [...new Set(cards.map((c) => c.category))]
      .filter(Boolean)
      .sort(),
    attributes: [...new Set(cards.map((c) => c.attribute))]
      .filter(Boolean)
      .sort(),
    rarities: [...new Set(cards.map((c) => c.rarity))].filter(Boolean).sort(),
  };
}
