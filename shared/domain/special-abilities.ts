import { basicAbilityTerms, readBracket } from "./basic-abilities";
export const specialAbilityTerms = [
  { value: "declare", label: "宣言", japanese: "宣言" },
  { value: "trigger", label: "诱发", japanese: "誘発" },
  { value: "constant", label: "常时", japanese: "常時" },
  { value: "cost", label: "费用能力", japanese: "コスト" },
  { value: "hand", label: "手牌宣言", japanese: "手札宣言" },
  { value: "trump", label: "切札", japanese: "切札" },
];
// Only heading blocks at a logical line start (or after leading innate blocks).
// A quoted/granted [誘発] in effect prose cannot start a new category.
export function extractSpecialAbilities(input: string) {
  const result: { type: string; text: string }[] = [];
  for (const raw of input.normalize("NFKC").split(/\r?\n/)) {
    let line = raw.trim(), block = readBracket(line, 0);
    while (block && basicAbilityTerms.some(t => [t.japanese, t.label].includes(block!.content.split(":")[0]!))) {
      line = line.slice(block.end).trimStart();
      block = readBracket(line, 0);
    }
    const term = specialAbilityTerms.find(t => [t.japanese, t.label, ...(t.value === "cost" ? ["COST能力"] : [])].includes(block?.content || ""));
    if (term && block) result.push({ type: term.value, text: line.slice(block.end).trim() });
    else if (result.length) result.at(-1)!.text += `\n${line}`;
  }
  return result;
}
