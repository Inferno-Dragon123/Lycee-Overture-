import { parseLibrary, type DeckLibrary } from './deck-library';

export interface PersonalData {
  schema: 1;
  library: DeckLibrary;
  bag: string[];
  display: string[];
  preferences: { series: string; rarity: string };
}
export interface PersonalSnapshot { revision: number; data: PersonalData; updatedAt: string | null }
export function emptyPersonal(): PersonalData {
  return { schema: 1, library: { version: 2, saved: [], draft: null }, bag: [], display: [], preferences: { series: '', rarity: '' } };
}
export function personalKey(key: string, owner: string | null) {
  return owner ? `lycee-account:${encodeURIComponent(owner)}:${key}` : key;
}
export function validatePersonal(raw: unknown): PersonalData {
  if (!raw || typeof raw !== 'object') throw new Error('个人数据格式无效');
  const d = raw as PersonalData;
  if (d.schema !== 1 || !d.library || !Array.isArray(d.library.saved) || d.library.saved.length > 500)
    throw new Error('最多保存 500 套卡组');
  const library = parseLibrary(JSON.stringify(d.library));
  for (const deck of [...library.saved, ...(library.draft ? [library.draft] : [])])
    if (!deck.id || deck.id.length > 160) throw new Error('卡组标识无效');
  const codes = (value: unknown, max: number) => {
    if (!Array.isArray(value) || value.length > max || value.some(c => typeof c !== 'string' || !/^LO-\d{4}[A-Za-z0-9-]{0,16}$/.test(c)))
      throw new Error('展示卡牌数据无效');
    return [...new Set(value as string[])];
  };
  const bag = codes(d.bag, 12000), display = codes(d.display, 12000);
  if (display.some(code => !bag.includes(code))) throw new Error('展示卡牌不在背包中');
  const p = d.preferences;
  if (!p || typeof p.series !== 'string' || p.series.length > 100 || typeof p.rarity !== 'string' || p.rarity.length > 100)
    throw new Error('展示条件无效');
  return { schema: 1, library, bag, display, preferences: { series: p.series, rarity: p.rarity } };
}
/** Explicit import only: never assume guest data belongs to the next account. */
export function importPersonal(current: PersonalData, incoming: PersonalData, id = () => crypto.randomUUID()): PersonalData {
  const next = structuredClone(validatePersonal(current)), source = validatePersonal(incoming);
  if (next.library.draft && source.library.draft && JSON.stringify(next.library.draft) !== JSON.stringify(source.library.draft))
    throw new Error('两份数据都有未完成草稿，请先保存或处理当前草稿，再导入。');
  for (const deck of source.library.saved) {
    const existing = next.library.saved.find(d => d.id === deck.id);
    if (existing && JSON.stringify(existing) === JSON.stringify(deck)) continue;
    next.library.saved.push(existing ? { ...deck, id: `import-${id()}` } : deck);
  }
  next.library.draft ||= source.library.draft;
  next.bag = [...new Set([...next.bag, ...source.bag])];
  if (!next.display.length) next.display = source.display;
  return validatePersonal(next);
}
