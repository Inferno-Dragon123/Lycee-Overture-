import type { Card } from "#shared/domain/catalog";
import fixtures from "./fixtures.json";
export type ShowcaseCard = Pick<
  Card,
  | "code"
  | "name"
  | "img"
  | "category"
  | "rarity"
  | "attribute"
  | "brand"
  | "version"
  | "ex"
  | "ap"
  | "dp"
  | "sp"
  | "textJa"
  | "textZh"
>;
export function normalizeCollection(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    fixtures.cards.flatMap((card) => {
      const count = (value as Record<string, unknown>)[card.code];
      return typeof count === "number" &&
        Number.isInteger(count) &&
        count > 0 &&
        count <= 9999
        ? [[card.code, count]]
        : [];
    }),
  );
}
export function collectionCandidates(
  owned: Record<string, number>,
  series = "",
  rarity = "",
) {
  return fixtures.cards.filter(
    (card) =>
      owned[card.code] &&
      (!series || card.brand === series) &&
      (!rarity || card.rarity === rarity),
  );
}
export function chooseDisplay(cards: ShowcaseCard[], random = Math.random) {
  const pool = [...cards];
  const chosen: string[] = [];
  while (pool.length && chosen.length < 3)
    chosen.push(
      pool.splice(
        Math.min(pool.length - 1, Math.floor(random() * pool.length)),
        1,
      )[0]!.code,
    );
  return chosen;
}
