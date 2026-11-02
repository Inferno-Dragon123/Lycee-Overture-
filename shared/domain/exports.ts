import type { Card } from "./catalog";
export interface PrintSettings {
  pageWidth: number;
  pageHeight: number;
  cardWidth: number;
  cardHeight: number;
  margin: number;
  gap: number;
}
export const defaultPrintSettings: PrintSettings = {
  pageWidth: 210,
  pageHeight: 297,
  cardWidth: 63,
  cardHeight: 88,
  margin: 7,
  gap: 1,
};
export function printLayout(s: PrintSettings) {
  if (
    Object.values(s).some(
      (v) => typeof v !== "number" || !Number.isFinite(v),
    ) ||
    s.pageWidth < 50 ||
    s.pageHeight < 50 ||
    s.pageWidth > 420 ||
    s.pageHeight > 420 ||
    s.cardWidth < 10 ||
    s.cardHeight < 10 ||
    s.margin < 0 ||
    s.gap < 0 ||
    s.margin > 100 ||
    s.gap > 50
  )
    throw new Error("请输入有效的纸张、卡面、边距和间距尺寸");
  const columns = Math.floor(
      (s.pageWidth - 2 * s.margin + s.gap) / (s.cardWidth + s.gap),
    ),
    rows = Math.floor(
      (s.pageHeight - 2 * s.margin + s.gap) / (s.cardHeight + s.gap),
    );
  if (columns < 1 || rows < 1) throw new Error("当前尺寸放不下一张卡牌");
  return {
    columns,
    rows,
    perPage: columns * rows,
    x: (s.pageWidth - (columns * s.cardWidth + (columns - 1) * s.gap)) / 2,
    y: (s.pageHeight - (rows * s.cardHeight + (rows - 1) * s.gap)) / 2,
  };
}
export function printCards(
  q: Record<string, number>,
  catalog: Map<string, Card>,
) {
  const cards: Card[] = [];
  for (const [code, n] of Object.entries(q)) {
    if (!Number.isSafeInteger(n) || n < 0 || n > 60 || !catalog.has(code))
      throw new Error("打印卡牌或数量无效");
    if (cards.length + n > 200) throw new Error("每次最多打印 200 张");
    cards.push(...Array<Card>(n).fill(catalog.get(code)!));
  }
  return cards;
}
export const officialBack = "https://lycee-tcg.com/about/images/card.png";
export function makeTts(
  name: string,
  q: Record<string, number>,
  catalog: Map<string, Card>,
  back = officialBack,
) {
  const cards = printCards(q, catalog),
    custom: Record<number, unknown> = {},
    objects: Record<string, unknown>[] = [];
  const transform = {
    posX: 0,
    posY: 1,
    posZ: 0,
    rotX: 0,
    rotY: 180,
    rotZ: 180,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
  };
  let index = 100;
  for (const code of [...new Set(cards.map((c) => c.code))]) {
    const c = catalog.get(code)!;
    const face = {
      FaceURL: c.img.startsWith("/")
        ? `https://lycee-tcg.com/card/image/${code}.png`
        : c.img,
      BackURL: back,
      NumWidth: 1,
      NumHeight: 1,
      BackIsHidden: true,
      UniqueBack: false,
      Type: 0,
    };
    custom[index] = face;
    for (let n = 0; n < q[code]!; n++)
      objects.push({
        Name: "CardCustom",
        Transform: { ...transform },
        Nickname: code,
        Description: c.name,
        CardID: index * 100,
        CustomDeck: { [index]: face },
        Hands: true,
        SidewaysCard: false,
      });
    index++;
  }
  return {
    SaveName: name,
    GameMode: "",
    Date: "",
    ObjectStates:
      objects.length < 2
        ? objects
        : [
            {
              Name: "DeckCustom",
              Nickname: name,
              Transform: transform,
              Hands: true,
              DeckIDs: objects.map((o) => o.CardID),
              CustomDeck: custom,
              ContainedObjects: objects,
            },
          ],
  };
}
