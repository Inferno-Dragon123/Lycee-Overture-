export interface Card {
  code: string;
  printingId: string;
  identityId: string | null;
  name: string;
  img: string;
  category: string;
  rarity: string;
  attribute: string;
  ex: number | null;
  cost: string;
  costTotal: number | null;
  position: string;
  ap: number | null;
  dp: number | null;
  sp: number | null;
  dmg: number | null;
  trait: string;
  version: string;
  brand: string;
  series: string;
  illustrator: string;
  team: string;
  textJa: string;
  textZh: string;
}

export interface SearchQuery {
  q?: string;
  series?: string;
  version?: string;
  category?: string;
  attribute?: string;
  rarity?: string;
  page?: number;
  pageSize?: number;
}
export interface SearchResult {
  cards: Card[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}
export interface CatalogFacets {
  series: { name: string; count: number; image: string; versions: string[] }[];
  categories: string[];
  attributes: string[];
  rarities: string[];
  total: number;
}
export const categoryLabels: Record<string, string> = {
  キャラクター: "角色",
  イベント: "事件",
  アイテム: "道具",
  エリア: "场地",
};
export const normalize = (value: string) =>
  value.normalize("NFKC").trim().toLowerCase();
export const cardText = (card: Card) =>
  normalize(
    [
      card.code,
      card.name,
      card.textJa,
      card.textZh,
      card.trait,
      card.team,
      card.illustrator,
    ].join("\n"),
  );
export function normalizeCode(query: string) {
  const value = normalize(query).toUpperCase();
  const numeric = /^(\d{1,4})(-[A-Z0-9]+)?$/.exec(value);
  return numeric
    ? `LO-${numeric[1]!.padStart(4, "0")}${numeric[2] || ""}`
    : value;
}
