import { categoryLabels, type Card } from './catalog';

export interface DeckListRow { card: Card; lines: string[]; y: number; height: number; continued: boolean }
export const deckListLayout = { top: 30, bottom: 287, lineHeight: 4.2, minHeight: 29, textWidth: 166 };

export function wrapDeckText(text: string, measure: (text: string) => number, width = deckListLayout.textWidth): string[] {
  return text.replace(/\r\n?/g, '\n').split('\n').flatMap(paragraph => {
    const lines: string[] = [];
    let line = '';
    for (const char of paragraph) {
      if (line && measure(line + char) > width) { lines.push(line); line = ''; }
      line += char;
    }
    lines.push(line);
    return lines;
  });
}

export function paginateDeckList(cards: Card[], quantities: Record<string, number>, measure: (text: string) => number): DeckListRow[][] {
  const pages: DeckListRow[][] = [[]];
  let y = deckListLayout.top;
  const nextPage = () => { pages.push([]); y = deckListLayout.top; };
  for (const card of cards) {
    const lines = [
      `${card.code} × ${quantities[card.code]}  ${card.name}`,
      `${categoryLabels[card.category] || card.category} · ${card.attribute} · 费用 ${card.cost || '—'} · EX ${card.ex ?? '—'}`,
      `${card.version} · ${card.rarity}`,
      `中文翻译：${card.textZh?.trim() || '暂无中文翻译'}`,
    ].flatMap(text => wrapDeckText(text, measure));
    const fullHeight = Math.max(deckListLayout.minHeight, lines.length * deckListLayout.lineHeight + 5);
    if (y > deckListLayout.top && (fullHeight > deckListLayout.bottom - y)) nextPage();
    let offset = 0;
    while (offset < lines.length) {
      const capacity = Math.floor((deckListLayout.bottom - y - 5) / deckListLayout.lineHeight);
      const part = lines.slice(offset, offset + capacity);
      const height = Math.max(deckListLayout.minHeight, part.length * deckListLayout.lineHeight + 5);
      pages.at(-1)!.push({ card, lines: part, y, height, continued: offset > 0 });
      y += height;
      offset += part.length;
      if (offset < lines.length) nextPage();
    }
  }
  return pages;
}
