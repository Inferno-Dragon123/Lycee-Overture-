// Port of lycee-toolbox codex/search-filters, lib/basic-abilities.js.
// Preserve leading-block parsing, nested brackets, stable Japanese IDs and dated labels.
export const basicAbilityTerms = [
  ["step", "ステップ", "移动"], ["side-step", "サイドステップ", "横向侧移"],
  ["order-step", "オーダーステップ", "纵向移动"], ["order-change", "オーダーチェンジ", "位置交换"],
  ["jump", "ジャンプ", "跳跃"], ["penalty", "ペナルティ", "离场惩罚"],
  ["aggressive", "アグレッシブ", "进取心"], ["assist", "アシスト", "辅助"],
  ["engage", "エンゲージ", "结合"], ["recovery", "リカバリー", "补正"],
  ["guts", "ガッツ", "斗志"], ["leader", "リーダー", "领导"],
  ["supporter", "サポーター", "支援者"], ["bonus", "ボーナス", "奖励"],
  ["charge", "チャージ", "充能"], ["turn-recovery", "ターンリカバリー", "回合补正"],
  ["principal", "プリンシパル", "主演"], ["surprise", "サプライズ", "突袭"],
  ["convert", "コンバート", "换装"],
].map(([id, japanese, label]) => ({ id: id!, japanese: japanese!, label: label! }));
export interface BasicAbility { id: string; detail: string; value: string }
export interface AbilityFacet {
  value: string; label: string; japanese: string;
  options: { value: string; label: string; original: string; count: number }[];
}
export function readBracket(text: string, start: number) {
  if (text[start] !== "[") return null;
  let depth = 1, end = start + 1;
  while (end < text.length && depth) {
    if (text[end] === "[") depth++;
    if (text[end] === "]") depth--;
    end++;
  }
  return depth ? null : { content: text.slice(start + 1, end - 1), end };
}
function unwrapDetail(detail: string): string {
  while (detail.startsWith("[") && detail.endsWith("]")) {
    const block = readBracket(detail, 0);
    if (!block || block.end !== detail.length) break;
    detail = block.content.trim();
  }
  return detail;
}
export function extractBasicAbilities(input: unknown, chinese = false): BasicAbility[] {
  const text = String(input || "").normalize("NFKC");
  const terms = new Map(basicAbilityTerms.map(t => [chinese ? t.label : t.japanese, t]));
  const result: BasicAbility[] = [];
  let position = 0;
  while (position < text.length) {
    while (position < text.length && /[\s|]/.test(text[position]!)) position++;
    const block = readBracket(text, position);
    if (!block) break;
    position = block.end;
    const colon = block.content.indexOf(":"), name = (colon < 0 ? block.content : block.content.slice(0, colon)).trim();
    const term = terms.get(name);
    if (!term) break;
    let detail = (colon < 0 ? "" : block.content.slice(colon + 1)).trim().replace(/\s+/g, " ");
    const unwrapped = unwrapDetail(detail);
    detail = term.id === "charge" || !/^(?:[CD]?\d+|[雪月花宙日無]+)$/.test(unwrapped)
      ? unwrapped : `[${unwrapped}]`;
    if (!unwrapped) detail = "";
    result.push({ id: term.id, detail, value: `${term.id}:${detail}` });
  }
  return result;
}
export function buildAbilityIndex(cards: { code: string; effect: string; effectZh?: string; translatedAt?: string | null }[]) {
  const index = new Map<string, BasicAbility[]>();
  const facets: AbilityFacet[] = basicAbilityTerms.map(t => ({ value: t.id, label: t.label, japanese: t.japanese, options: [] }));
  const labelDates = new Map<string, number>();
  for (const card of cards) {
    const abilities = extractBasicAbilities(card.effect), translated = extractBasicAbilities(card.effectZh, true);
    index.set(card.code, abilities);
    for (const ability of new Map(abilities.map(a => [a.value, a])).values()) {
      const options = facets.find(f => f.value === ability.id)!.options;
      let option = options.find(o => o.value === ability.value);
      const aligned = abilities.length === translated.length && abilities.every((a, i) => a.id === translated[i]!.id);
      const label = aligned ? translated[abilities.findIndex(a => a.value === ability.value)]!.detail : "";
      const date = Date.parse(card.translatedAt || "") || 0;
      if (option) option.count++;
      else {
        option = { value: ability.value, label: ability.detail || "无附加代价／效果", original: ability.detail, count: 1 };
        options.push(option);
      }
      if (label && (!labelDates.has(ability.value) || date > labelDates.get(ability.value)!)) {
        option.label = label;
        labelDates.set(ability.value, date);
      }
    }
  }
  for (const facet of facets) facet.options.sort((a, b) => a.original.localeCompare(b.original, "ja", { numeric: true }));
  return { index, facets };
}
