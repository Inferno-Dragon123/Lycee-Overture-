import type { Card } from "./catalog";
import { normalize } from "./catalog";
import { buildAbilityIndex, basicAbilityTerms } from "./basic-abilities";
import {
  extractSpecialAbilities,
  specialAbilityTerms,
} from "./special-abilities";
export type MatchMode = "or" | "and";
export interface NumberRange {
  min: number | null;
  max: number | null;
}
export const rangeFields = ["costTotal", "ap", "dp", "sp", "dmg"] as const;
export const multiFields = [
  "attribute",
  "category",
  "ex",
  "costAttribute",
  "ability",
  "special",
  "brand",
  "version",
  "rarity",
  "trait",
] as const;
export const modeFields = [
  "attributeMode",
  "costMode",
  "abilityMode",
  "specialMode",
  "traitMode",
] as const;
export const textFields = ["q", "code", "effect", "illustrator"] as const;
export type MultiField = (typeof multiFields)[number];
export interface FilterModel {
  q: string;
  code: string;
  effect: string;
  illustrator: string;
  attribute: string[];
  category: string[];
  ex: string[];
  costAttribute: string[];
  ability: string[];
  special: string[];
  brand: string[];
  version: string[];
  rarity: string[];
  trait: string[];
  attributeMode: MatchMode;
  costMode: MatchMode;
  abilityMode: MatchMode;
  specialMode: MatchMode;
  traitMode: MatchMode;
  costTotal: NumberRange;
  ap: NumberRange;
  dp: NumberRange;
  sp: NumberRange;
  dmg: NumberRange;
  position: "any" | "yes" | "no";
  sort: "code-desc" | "code-asc" | "name";
  page: number;
  excludeConstruction: boolean;
  excludeTitle: boolean;
  uniqueIdentity: boolean;
}
export function emptyFilters(): FilterModel {
  return {
    q: "",
    code: "",
    effect: "",
    illustrator: "",
    attribute: [],
    category: [],
    ex: [],
    costAttribute: [],
    ability: [],
    special: [],
    brand: [],
    version: [],
    rarity: [],
    trait: [],
    attributeMode: "or",
    costMode: "or",
    abilityMode: "or",
    specialMode: "or",
    traitMode: "or",
    costTotal: { min: null, max: null },
    ap: { min: null, max: null },
    dp: { min: null, max: null },
    sp: { min: null, max: null },
    dmg: { min: null, max: null },
    position: "any",
    sort: "code-desc",
    page: 1,
    excludeConstruction: false,
    excludeTitle: false,
    uniqueIdentity: false,
  };
}
export const cloneFilters = (f: FilterModel): FilterModel =>
  JSON.parse(JSON.stringify(f));
export function filterParams(f: FilterModel): URLSearchParams {
  const p = new URLSearchParams();
  for (const key of textFields) if (f[key].trim()) p.set(key, f[key].trim());
  for (const key of multiFields)
    for (const value of [...new Set(f[key])].sort()) p.append(key, value);
  for (const key of modeFields) if (f[key] !== "or") p.set(key, f[key]);
  for (const key of rangeFields)
    for (const bound of ["min", "max"] as const)
      if (f[key][bound] !== null)
        p.set(`${key}_${bound}`, String(f[key][bound]));
  if (f.position !== "any") p.set("position", f.position);
  if (f.sort !== "code-desc") p.set("sort", f.sort);
  if (f.page !== 1) p.set("page", String(f.page));
  for (const key of [
    "excludeConstruction",
    "excludeTitle",
    "uniqueIdentity",
  ] as const)
    if (f[key]) p.set(key, "1");
  return p;
}
export function parseFilterParams(p: URLSearchParams): FilterModel {
  const f = emptyFilters();
  const allowed = new Set([
    "view",
    "series",
    "seriesPage",
    ...textFields,
    ...multiFields,
    ...modeFields,
    ...rangeFields.flatMap((k) => [`${k}_min`, `${k}_max`]),
    "position",
    "sort",
    "page",
    "excludeConstruction",
    "excludeTitle",
    "uniqueIdentity",
  ]);
  for (const key of p.keys())
    if (!allowed.has(key)) throw new Error(`未知筛选参数：${key}`);
  for (const key of textFields) f[key] = p.get(key) || "";
  for (const key of multiFields)
    f[key] = [...new Set(p.getAll(key).filter(Boolean))];
  for (const key of modeFields) {
    const v = p.get(key);
    if (v && v !== "or" && v !== "and")
      throw new Error(`无效的匹配模式：${key}`);
    if (v) f[key] = v as MatchMode;
  }
  for (const key of rangeFields)
    for (const bound of ["min", "max"] as const) {
      const raw = p.get(`${key}_${bound}`);
      if (raw !== null && raw !== "") {
        if (!/^\d+$/.test(raw)) throw new Error(`无效的数值：${key}`);
        f[key][bound] = Number(raw);
      }
    }
  const pos = p.get("position");
  if (pos && !["any", "yes", "no"].includes(pos))
    throw new Error("无效的配置限制");
  if (pos) f.position = pos as FilterModel["position"];
  const sort = p.get("sort");
  if (sort && !["code-desc", "code-asc", "name"].includes(sort))
    throw new Error("无效的排序方式");
  if (sort) f.sort = sort as FilterModel["sort"];
  if (p.has("page")) {
    if (!/^\d+$/.test(p.get("page")!)) throw new Error("无效的页码");
    f.page = Number(p.get("page"));
  }
  for (const key of [
    "excludeConstruction",
    "excludeTitle",
    "uniqueIdentity",
  ] as const) {
    const v = p.get(key);
    if (v && v !== "0" && v !== "1") throw new Error(`无效的开关：${key}`);
    f[key] = v === "1";
  }
  return f;
}
export function toggleAbility(values: string[], value: string) {
  if (values.includes(value)) return values.filter((v) => v !== value);
  const family = value.split(":")[0]!;
  return [
    ...values.filter((v) =>
      value === family ? !v.startsWith(`${family}:`) : v !== family,
    ),
    value,
  ];
}
export function positionRestriction(position: string): boolean | null {
  if (!position.trim()) return false;
  const cells = position.normalize("NFKC").replace(/\s/g, "");
  return /^[●-]{6}$/.test(cells)
    ? cells.includes("-") && cells.includes("●")
    : null;
}
export const traitValues = (s: string) =>
  s
    .split(/[\s／/]+/)
    .filter((v) => v && !["-", "なし", "イベント", "アイテム"].includes(v));
export function createFilterEngine(cards: Card[]) {
  const abilities = buildAbilityIndex(
    cards.map((c) => ({ code: c.code, effect: c.textJa, effectZh: c.textZh })),
  );
  const texts = new Map(
    cards.map((c) => [
      c.code,
      normalize(
        [
          c.code,
          c.name,
          c.textJa,
          c.textZh,
          c.trait,
          c.team,
          c.illustrator,
        ].join("\n"),
      ),
    ]),
  );
  const specials = new Map(
    cards.map((c) => [c.code, extractSpecialAbilities(c.textJa)]),
  );
  const translatedSpecials = new Map(
    cards.map((c) => [c.code, extractSpecialAbilities(c.textZh)]),
  );
  const values = (key: "brand" | "version" | "rarity" | "category" | "ex") =>
    [
      ...new Set(
        cards
          .map((c) => c[key])
          .filter((v) => v !== null && v !== "")
          .map(String),
      ),
    ].sort((a, b) => a.localeCompare(b, "ja", { numeric: true }));
  const facets = {
    attribute: [..."雪月花宙日無"],
    category: ["キャラクター", "イベント", "アイテム", "エリア"],
    ex: [...new Set(["0", ...values("ex")])].sort(),
    costAttribute: [..."雪月花宙日無"],
    brand: values("brand"),
    version: values("version"),
    rarity: values("rarity"),
    trait: [...new Set(cards.flatMap((c) => traitValues(c.trait)))].sort(),
    ability: abilities.facets.flatMap((f) => [
      f.value,
      ...f.options.map((o) => o.value),
    ]),
    special: specialAbilityTerms.map((t) => t.value),
  };
  function validate(f: FilterModel) {
    for (const key of textFields)
      if (typeof f[key] !== "string" || f[key].length > 200)
        throw new Error(`${key} 最多 200 字`);
    for (const key of multiFields)
      if (
        f[key].length > 200 ||
        f[key].some(
          (v) =>
            !facets[key].includes(v) &&
            !(key === "attribute" && /^[雪月花宙日無]+$/.test(v)),
        )
      )
        throw new Error(`无效的筛选条件：${key}`);
    for (const key of modeFields)
      if (!["and", "or"].includes(f[key])) throw new Error("无效的匹配模式");
    for (const key of rangeFields) {
      const { min, max } = f[key];
      if (
        [min, max].some(
          (v) => v !== null && (!Number.isSafeInteger(v) || v < 0),
        )
      )
        throw new Error(`${key} 请输入非负整数`);
      if (min !== null && max !== null && min > max)
        throw new Error(`${key.toUpperCase()} 下限不能大于上限`);
    }
    if (!Number.isSafeInteger(f.page) || f.page < 1 || f.page > 10000)
      throw new Error("页码须为 1 至 10000 的整数");
    if (
      !["any", "yes", "no"].includes(f.position) ||
      !["code-desc", "code-asc", "name"].includes(f.sort)
    )
      throw new Error("无效的高级条件或排序");
    if (f.excludeConstruction || f.excludeTitle || f.uniqueIdentity)
      throw new Error(
        "当前快照缺少经核验的构筑限制及同编号关系，暂不能使用此条件",
      );
  }
  const match = (
    selected: string[],
    predicate: (v: string) => boolean,
    mode: MatchMode = "or",
  ) =>
    !selected.length ||
    (mode === "and" ? selected.every(predicate) : selected.some(predicate));
  function search(
    f: FilterModel,
    scope = "",
    allowedCodes?: ReadonlySet<string>,
  ) {
    validate(f);
    const words = normalize(f.q).split(/\s+/).filter(Boolean);
    const codeQuery = normalize(f.code)
      .toUpperCase()
      .replace(/^(?=\d)/, "LO-");
    const matched = cards
      .filter((c) => {
        const text = texts.get(c.code)!;
        return (
          (!allowedCodes || allowedCodes.has(c.code)) &&
          (!scope || c.brand === scope) &&
          (!codeQuery || c.code.startsWith(codeQuery)) &&
          words.every((w) => {
            if (w.startsWith("-") && w.length > 1)
              return !text.includes(w.slice(1));
            if (/^(?:lo-)?\d+(?:-?[a-z]+)?$/.test(w))
              return c.code.startsWith(
                w.toUpperCase().replace(/^(?=\d)/, "LO-"),
              );
            return text.includes(w);
          }) &&
          match(
            f.attribute,
            (v) => [...v].every((a) => c.attribute.includes(a)),
            f.attributeMode,
          ) &&
          match(
            f.costAttribute,
            (v) => c.cost.normalize("NFKC").includes(v),
            f.costMode,
          ) &&
          (["category", "rarity", "brand", "version", "ex"] as const).every(
            (k) => match(f[k], (v) => String(c[k]) === v),
          ) &&
          match(
            f.ability,
            (v) =>
              abilities.index
                .get(c.code)!
                .some((a) => a.id === v || a.value === v),
            f.abilityMode,
          ) &&
          match(
            f.special,
            (v) => specials.get(c.code)!.some((a) => a.type === v),
            f.specialMode,
          ) &&
          (!f.effect ||
            normalize(
              f.special.length
                ? [...specials.get(c.code)!, ...translatedSpecials.get(c.code)!]
                    .filter((a) => f.special.includes(a.type))
                    .map((a) => a.text)
                    .join("\n")
                : `${c.textJa}\n${c.textZh}\n${c.team}`,
            ).includes(normalize(f.effect))) &&
          match(
            f.trait,
            (v) => traitValues(c.trait).includes(v),
            f.traitMode,
          ) &&
          (!f.illustrator ||
            normalize(c.illustrator).includes(normalize(f.illustrator))) &&
          (f.position === "any" ||
            positionRestriction(c.position) === (f.position === "yes")) &&
          rangeFields.every((k) => {
            const { min, max } = f[k],
              value = c[k];
            return (
              (min === null && max === null) ||
              (value !== null &&
                (min === null || value >= min) &&
                (max === null || value <= max))
            );
          })
        );
      })
      .sort((a, b) =>
        f.sort === "name"
          ? a.name.localeCompare(b.name, "ja")
          : (f.sort === "code-asc" ? 1 : -1) *
            a.code.localeCompare(b.code, "en", { numeric: true }),
      );
    const pages = Math.max(1, Math.ceil(matched.length / 12)),
      page = Math.min(f.page, pages);
    return {
      cards: matched.slice((page - 1) * 12, page * 12),
      total: matched.length,
      pages,
      page,
    };
  }
  return { search, validate, facets, abilities: abilities.facets };
}
export const fieldLabels: Record<string, string> = {
  q: "关键词",
  code: "卡号",
  effect: "效果关键词",
  illustrator: "画师",
  attribute: "属性",
  category: "类别",
  ex: "EX",
  costAttribute: "费用属性",
  ability: "基础能力",
  special: "特殊能力",
  brand: "品牌",
  version: "版本",
  rarity: "稀有度",
  trait: "类型",
  costTotal: "费用",
  ap: "AP",
  dp: "DP",
  sp: "SP",
  dmg: "DMG",
  position: "配置限制",
};
export function filterChips(
  f: FilterModel,
  label: (key: string, value: string) => string = (_, v) => v,
) {
  const chips: { key: string; value: string; label: string }[] = [];
  for (const key of textFields)
    if (f[key])
      chips.push({ key, value: "", label: `${fieldLabels[key]}：${f[key]}` });
  for (const key of multiFields)
    for (const value of f[key])
      chips.push({
        key,
        value,
        label: `${fieldLabels[key]}：${label(key, value)}`,
      });
  for (const key of rangeFields)
    if (f[key].min !== null || f[key].max !== null)
      chips.push({
        key,
        value: "",
        label: `${fieldLabels[key]}：${f[key].min ?? "不限"}～${f[key].max ?? "不限"}`,
      });
  if (f.position !== "any")
    chips.push({
      key: "position",
      value: "",
      label: `配置限制：${f.position === "yes" ? "有" : "无"}`,
    });
  return chips;
}
