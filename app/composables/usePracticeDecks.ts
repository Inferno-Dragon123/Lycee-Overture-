import type { Card } from "#shared/domain/catalog";
import {
  parseLibrary,
  validateLibraryDeck,
  type DeckLibrary,
  type DeckDraft,
  type LibraryDeck,
} from "#shared/domain/deck-library";
import { expandDeck } from "~/demo/hand";
import fixtures from "~/demo/fixtures.json";
export function usePracticeDecks() {
  const scope = usePersonalScope();
  const library = useState<DeckLibrary>("deck-library-v2", () => ({
    version: 2,
    saved: [],
    draft: null,
  }));
  const loaded = useState("deck-library-loaded", () => false);
  const readError = useState("practice-decks-read-error", () => false);
  const error = useState("practice-decks-error", () => "");
  function load() {
    if (!import.meta.client || loaded.value) return;
    loaded.value = true;
    try {
      const raw = localStorage.getItem(scope.key("lycee-deck-library-v2")),
        legacy = scope.owner.value ? null : localStorage.getItem("lycee-practice-decks-v1");
      if (raw) library.value = parseLibrary(raw);
      else if (legacy)
        library.value = parseLibrary(
          JSON.stringify({
            version: 2,
            saved: JSON.parse(legacy),
            draft: null,
          }),
        );
    } catch {
      readError.value = true;
      error.value = "本地卡组记录无法读取，原记录已保留。";
    }
  }
  if (getCurrentInstance()) onMounted(load);
  function commit(next: DeckLibrary) {
    if (!import.meta.client || readError.value) return false;
    try {
      const disk = localStorage.getItem(scope.key('lycee-deck-library-v2'));
      if (scope.owner.value && disk && JSON.stringify(parseLibrary(disk)) !== JSON.stringify(library.value)) {
        error.value = '其他页面已修改本机卡组，请刷新后继续；当前编辑仍保留。';
        return false;
      }
      const checked = parseLibrary(JSON.stringify(next));
      localStorage.setItem(scope.key("lycee-deck-library-v2"), JSON.stringify(checked));
      library.value = checked;
      error.value = "";
      personalChanged();
      return true;
    } catch {
      error.value = "未能保存，请检查浏览器存储；当前卡组仍保留。";
      return false;
    }
  }
  const saved = computed(() => library.value.saved),
    draft = computed(() => library.value.draft);
  const decks = computed(() => saved.value);
  function save(
    quantities: Record<string, number>,
    name = "我的构筑",
    fullCatalog?: Card[],
    metadata: {
      description?: string;
      cover?: string;
      editingId?: string;
      clearDraft?: boolean;
    } = {},
  ) {
    try {
      expandDeck(quantities, fullCatalog ?? fixtures.cards);
      const deck = validateLibraryDeck(
        {
          id: metadata.editingId || `deck-${crypto.randomUUID()}`,
          name,
          quantities,
          description: metadata.description,
          cover: metadata.cover,
        },
        true,
      );
      const next = [...saved.value];
      const index = next.findIndex((d) => d.id === deck.id);
      if (index < 0) next.push(deck);
      else next[index] = deck;
      return commit({
        version: 2,
        saved: next,
        draft: metadata.clearDraft ? null : draft.value,
      });
    } catch (e) {
      error.value = (e as Error).message;
      return false;
    }
  }
  function setDraft(draft: DeckDraft | null) {
    return commit({ ...library.value, draft });
  }
  function remove(id: string) {
    return commit({
      ...library.value,
      saved: saved.value.filter((d) => d.id !== id),
      draft: draft.value?.id === id ? null : draft.value,
    });
  }
  return {
    decks,
    saved,
    draft,
    error,
    readError,
    load,
    save,
    setDraft,
    remove,
  };
}
