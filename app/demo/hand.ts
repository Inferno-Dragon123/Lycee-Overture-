import type { ShowcaseCard } from "./collection";
export type PracticeDeck = {
  id: string;
  name: string;
  quantities: Record<string, number>;
  example?: boolean;
  description?: string;
  cover?: string;
};
export function expandDeck(
  quantities: Record<string, number>,
  catalog: ShowcaseCard[],
) {
  const byCode = new Map(catalog.map((c) => [c.code, c]));
  const cards: ShowcaseCard[] = [];
  for (const [code, n] of Object.entries(quantities)) {
    if (
      !Number.isSafeInteger(n) ||
      n < 0 ||
      n > 60 ||
      (n > 0 && !byCode.has(code))
    )
      throw new Error("卡组含无效卡牌或数量。");
    if (n) cards.push(...Array<ShowcaseCard>(n).fill(byCode.get(code)!));
  }
  if (cards.length !== 60) throw new Error("仅可导入恰好 60 张的卡组。");
  return cards;
}
/** Each physical copy is sampled at most once; the input deck is unchanged. */
export function drawHand(
  deck: ShowcaseCard[],
  amount: number,
  random = Math.random,
) {
  if (![1, 7].includes(amount) || deck.length < amount)
    throw new Error("剩余卡牌不足，请重新洗牌。");
  const remaining = [...deck],
    hand: ShowcaseCard[] = [];
  for (let i = 0; i < amount; i++) {
    const index = Math.max(
      0,
      Math.min(remaining.length - 1, Math.floor(random() * remaining.length)),
    );
    hand.push(remaining.splice(index, 1)[0]!);
  }
  return { hand, remaining };
}
