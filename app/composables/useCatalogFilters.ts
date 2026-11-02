import type { Card } from "#shared/domain/catalog";
import { categoryLabels } from "#shared/domain/catalog";
import {
  createFilterEngine,
  emptyFilters,
  cloneFilters,
  filterParams,
  parseFilterParams,
  filterChips,
  multiFields,
  rangeFields,
  type FilterModel,
} from "#shared/domain/filters";
import { specialAbilityTerms } from "#shared/domain/special-abilities";
import { demoSeries } from "./useShowcase";

export function useCatalogFilters() {
  const route = useRoute();
  const catalog = useOrbitCatalog();
  const engine = computed(() =>
    createFilterEngine(catalog.cards.value as Card[]),
  );
  const draft = useState<FilterModel>("preview-filter-draft", emptyFilters);
  const applied = useState<FilterModel>("preview-filter-applied", emptyFilters);
  const error = useState("preview-filter-error", () => "");
  const pending = computed(() => {
    const a = cloneFilters(draft.value),
      b = cloneFilters(applied.value);
    a.page = b.page = 1;
    return filterParams(a).toString() !== filterParams(b).toString();
  });
  let ownQuery = "";
  const toParams = () => {
    const p = new URLSearchParams();
    for (const [key, value] of Object.entries(route.query)) {
      for (const item of Array.isArray(value) ? value : [value])
        if (item !== null && item !== undefined) p.append(key, item);
    }
    return p;
  };
  watch(
    [() => route.fullPath, catalog.ready],
    ([path], previous) => {
      const keepDraft = previous?.[0] === path && pending.value;
      const p = toParams();
      if (p.toString() === ownQuery) return;
      try {
        const parsed = parseFilterParams(p);
        if (!catalog.ready.value) {
          if (!keepDraft) draft.value = cloneFilters(parsed);
          return;
        }
        engine.value.validate(parsed);
        applied.value = cloneFilters(parsed);
        if (!keepDraft) draft.value = cloneFilters(parsed);
        error.value = "";
      } catch (e) {
        error.value = (e as Error).message;
      }
    },
    { immediate: true },
  );
  const scope = computed(() => String(route.query.series || ""));
  const result = computed(() =>
    engine.value.search(applied.value, scope.value),
  );
  function label(key: string, value: string) {
    if (key === "brand")
      return demoSeries.find((s) => s.code === value)?.name || value;
    if (key === "category") return categoryLabels[value] || value;
    if (key === "special")
      return specialAbilityTerms.find((s) => s.value === value)?.label || value;
    if (key === "attribute" || key === "costAttribute")
      return value.replaceAll("無", "无");
    if (key === "ability") {
      const family = engine.value.abilities.find(
        (f) => f.value === value.split(":")[0],
      );
      return family
        ? `${family.label}${value === family.value ? "（任意形式）" : `：${family.options.find((o) => o.value === value)?.label || value}`}`
        : value;
    }
    return value;
  }
  const chips = computed(() => filterChips(applied.value, label));
  async function commit(next: FilterModel, resetDraft = true) {
    try {
      engine.value.validate(next);
      error.value = "";
      applied.value = cloneFilters(next);
      if (resetDraft) draft.value = cloneFilters(next);
      const p = filterParams(next);
      if (scope.value) p.set("series", scope.value);
      p.set("view", "all");
      ownQuery = p.toString();
      await navigateTo({
        path: route.path,
        query: Object.fromEntries(
          [...new Set(p.keys())].map((key) => [
            key,
            p.getAll(key).length > 1 ? p.getAll(key) : p.get(key),
          ]),
        ),
      });
      return true;
    } catch (e) {
      error.value = (e as Error).message;
      return false;
    }
  }
  const apply = () => commit({ ...cloneFilters(draft.value), page: 1 });
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  watch(
    () => filterParams(draft.value).toString(),
    () => {
      clearTimeout(refreshTimer);
      if (!pending.value) return;
      refreshTimer = setTimeout(() => {
        if (catalog.ready.value) void apply();
      }, 180);
    },
  );
  watch(catalog.ready, (ready) => {
    if (ready && pending.value) void apply();
  });
  onBeforeUnmount(() => clearTimeout(refreshTimer));
  const clear = () => commit(emptyFilters());
  const pageTo = (page: number) =>
    commit({ ...cloneFilters(applied.value), page }, false);
  const sortBy = (sort: FilterModel["sort"]) =>
    commit({ ...cloneFilters(applied.value), sort, page: 1 });
  function remove(key: string, value: string) {
    const f = cloneFilters(applied.value);
    if ((multiFields as readonly string[]).includes(key))
      f[key as (typeof multiFields)[number]] = f[
        key as (typeof multiFields)[number]
      ].filter((v) => v !== value);
    else if ((rangeFields as readonly string[]).includes(key))
      f[key as (typeof rangeFields)[number]] = { min: null, max: null };
    else if (key === "position") f.position = "any";
    else if (["q", "code", "effect", "illustrator"].includes(key))
      f[key as "q"] = "";
    return commit({ ...f, page: 1 });
  }
  return {
    draft,
    applied,
    pending,
    error,
    result,
    chips,
    apply,
    clear,
    pageTo,
    sortBy,
    remove,
    label,
    engine,
  };
}
