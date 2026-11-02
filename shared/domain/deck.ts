import type { Card } from "./catalog";
export const DECK_CARD_LIMIT = 60;

export type DeckCard = Pick<
  Card,
  "code" | "name" | "img" | "category" | "attribute"
>;
export interface DeckEntry {
  card: DeckCard;
  quantity: number;
}
export interface Deck {
  schemaVersion: 1;
  name: string;
  entries: DeckEntry[];
  status: "draft" | "complete";
}
export const emptyDeck = (): Deck => ({
  schemaVersion: 1,
  name: "我的第一副卡组",
  entries: [],
  status: "draft",
});
export const deckTotal = (deck: Deck) =>
  deck.entries.reduce((sum, entry) => sum + entry.quantity, 0);

export function changeQuantity(
  deck: Deck,
  card: DeckCard,
  delta: number,
): Deck {
  if (!Number.isSafeInteger(delta)) throw new Error("数量必须是整数");
  const entry = deck.entries.find((entry) => entry.card.code === card.code);
  const next = (entry?.quantity ?? 0) + delta;
  if (next < 0) throw new Error("卡牌数量不能小于零");
  if (deckTotal(deck) + delta > DECK_CARD_LIMIT) throw new Error("卡组最多容纳 60 张卡牌");
  if (delta === 0) return deck;
  const entries = deck.entries.filter((entry) => entry.card.code !== card.code);
  if (next > 0)
    entries.push({
      card: {
        code: card.code,
        name: card.name,
        img: card.img,
        category: card.category,
        attribute: card.attribute,
      },
      quantity: next,
    });
  return { ...deck, entries, status: "draft" };
}
export function completeDeck(deck: Deck): Deck {
  if (deckTotal(deck) !== DECK_CARD_LIMIT) throw new Error("需要恰好 60 张卡牌才能正式保存");
  return { ...deck, status: "complete" };
}
export function decodeDeck(value: unknown): Deck {
  if (typeof value !== "object" || value === null)
    throw new Error("草稿格式不正确");
  const deck = value as Deck;
  if (
    deck.schemaVersion !== 1 ||
    typeof deck.name !== "string" ||
    deck.name.length > 80 ||
    !Array.isArray(deck.entries) ||
    deck.entries.length > DECK_CARD_LIMIT ||
    !["draft", "complete"].includes(deck.status)
  )
    throw new Error("草稿格式不正确");
  const codes = new Set<string>();
  for (const entry of deck.entries) {
    if (
      !entry ||
      !Number.isSafeInteger(entry.quantity) ||
      entry.quantity < 1 ||
      entry.quantity > DECK_CARD_LIMIT ||
      !entry.card
    )
      throw new Error("草稿含无效数量");
    const card = entry.card;
    if (
      !["code", "name", "category", "attribute", "img"].every(
        (key) => typeof card[key as keyof DeckCard] === "string",
      )
    )
      throw new Error("草稿卡牌不完整");
    if (
      !/^LO-\d+[A-Za-z0-9-]*$/.test(card.code) ||
      codes.has(card.code) ||
      !/^https:\/\/lycee-tcg\.com\/card\/image\/[A-Za-z0-9.-]+$/.test(card.img)
    )
      throw new Error("草稿含无效卡牌");
    codes.add(card.code);
  }
  if (
    deckTotal(deck) > DECK_CARD_LIMIT ||
    (deck.status === "complete" && deckTotal(deck) !== DECK_CARD_LIMIT)
  )
    throw new Error("草稿超出张数限制或保存状态不一致");
  return structuredClone(deck);
}
