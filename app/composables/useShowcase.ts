import fixtures from "~/demo/fixtures.json";
import type { ShowcaseCard } from "~/demo/collection";
import { updateShowcaseQuantity } from "#shared/domain/deck-loom";
import { validateOrbitQuantities } from "#shared/domain/deck-loom-v3";

export const concepts = [
  {
    id: "orbit",
    name: "流光剧场",
    subtitle: "沉浸、光轨、立体卡片",
    letter: "A",
  },
  {
    id: "paper",
    name: "纸上序曲",
    subtitle: "编辑式排版、朱红、留白",
    letter: "B",
  },
  {
    id: "electric",
    name: "晴空电波",
    subtitle: "明亮、几何、轻快交互",
    letter: "C",
  },
] as const;
export type DemoCard = ShowcaseCard;
export const demoCards = fixtures.cards;
// Public catalog metadata only. Updated on the client after hydration, never per-user.
export const demoSeries = reactive([...fixtures.series]);

export function useShowcase() {
  const scope = usePersonalScope();
  const theme = useCookie<"dark" | "light">("lycee-theme", {
    default: () => "dark",
    sameSite: "lax",
  });
  const utility = useState<"announcements" | "account" | null>(
    "lycee-utility",
    () => null,
  );
  const mode = useCookie<boolean>("lycee-builder-mode", {
    default: () => false,
    sameSite: "lax",
  });
  const deckCookie = useCookie<Record<string, number>>("lycee-design-deck", {
    default: () => ({}),
    sameSite: "lax",
  });
  const quantities = useState<Record<string, number>>(
    "showcase-quantities",
    () => deckCookie.value,
  );
  const nameCookie = useCookie<string>("lycee-design-deck-name", {
    default: () => "我的构筑",
    sameSite: "lax",
  });
  const deckName = useState("showcase-deck-name", () =>
    typeof nameCookie.value === "string" ? nameCookie.value : "我的构筑",
  );
  watch(deckName, (value) => {
    if (!scope.owner.value) nameCookie.value = value.slice(0, 100);
  });
  const catalog = useOrbitCatalog();
  const library = usePracticeDecks();
  const deckDescription = useState("showcase-deck-description", () => "");
  const deckCover = useState("showcase-deck-cover", () => "");
  const editingId = useState<string | undefined>(
    "showcase-editing-id",
    () => undefined,
  );
  const resumePath = useState(
    "showcase-resume-path",
    () => "/concepts/orbit/cards?view=all",
  );
  const motion = useCookie<boolean>("lycee-design-motion", {
    default: () => true,
    sameSite: "lax",
  });
  const panel = useState<"none" | "deck" | "filters">(
    "showcase-panel",
    () => "none",
  );
  const filtersOpen = useState("showcase-filters-open", () => false);
  const selected = useState<DemoCard | null>("showcase-card", () => null);
  const toast = useState("showcase-toast", () => "");
  const history = useState<
    { quantities: Record<string, number>; name: string }[]
  >("showcase-deck-history-v3", () => []);
  const lastEdit = useState<{ code: string; revision: number } | null>(
    "showcase-last-edit",
    () => null,
  );
  const locate = useState<{ code: string; revision: number } | null>(
    "showcase-locate",
    () => null,
  );
  const checked = computed(() => {
    try {
      return {
        values: validateOrbitQuantities(
          quantities.value,
          catalog.ready.value
            ? new Set(catalog.byCode.value.keys())
            : undefined,
        ),
        error: "",
      };
    } catch (error) {
      return {
        values: {} as Record<string, number>,
        error: (error as Error).message,
      };
    }
  });
  const storageError = computed(
    () =>
      checked.value.error ||
      (library.readError.value ? library.error.value : ""),
  );
  const editable = computed(() => catalog.ready.value && !storageError.value);
  const validQuantities = computed(() => {
    return checked.value.values;
  });
  const total = computed(() =>
    Object.values(validQuantities.value).reduce((a, b) => a + b, 0),
  );
  const entries = computed(() =>
    Object.entries(validQuantities.value).flatMap(([code, count]) => {
      const card = catalog.byCode.value.get(code);
      return card ? [{ card, count }] : [];
    }),
  );
  const count = (code: string) => validQuantities.value[code] ?? 0;
  function change(card: DemoCard, delta: number) {
    if (!editable.value || !catalog.byCode.value.has(card.code) || delta === 0)
      return;
    const next = updateShowcaseQuantity(
      validQuantities.value,
      card.code,
      delta,
    );
    if (!next) {
      notify("数量未更改：卡组最多 60 张，数量不能小于零。");
      return;
    }
    history.value = [
      ...history.value.slice(-19),
      { quantities: { ...validQuantities.value }, name: deckName.value },
    ];
    persist(next);
    lastEdit.value = {
      code: card.code,
      revision: (lastEdit.value?.revision ?? 0) + 1,
    };
    if (delta > 0) notify(`已加入 ${card.code}，当前 ${next[card.code]} 张。`);
  }
  function persist(next: Record<string, number>) {
    quantities.value = next;
    if (!scope.owner.value) deckCookie.value = next;
  }
  function replace(raw: unknown, name = deckName.value) {
    if (!catalog.ready.value) return false;
    try {
      const next = validateOrbitQuantities(
        raw,
        new Set(catalog.byCode.value.keys()),
      );
      history.value = [
        ...history.value.slice(-19),
        { quantities: { ...validQuantities.value }, name: deckName.value },
      ];
      persist(next);
      deckName.value = name.slice(0, 100);
      return true;
    } catch (error) {
      notify((error as Error).message);
      return false;
    }
  }
  function undo() {
    const previous = history.value.at(-1);
    if (!previous || !catalog.ready.value) return;
    persist({ ...previous.quantities });
    deckName.value = previous.name;
    history.value = history.value.slice(0, -1);
  }
  function saveDraft(showMessage = true) {
    if (!total.value || storageError.value) return false;
    const ok = library.setDraft({
      id: "draft",
      name: deckName.value.trim() || "我的构筑",
      quantities: { ...validQuantities.value },
      description: deckDescription.value,
      cover: count(deckCover.value)
        ? deckCover.value
        : Object.keys(validQuantities.value)[0],
      resume: resumePath.value,
      editingId: editingId.value,
    });
    if (showMessage)
      notify(ok ? "草稿保存成功，可在我的卡组继续编辑。" : library.error.value);
    return ok;
  }
  function resetCurrent(saved = false) {
    if (!saved && !library.setDraft(null)) {
      notify(library.error.value);
      return false;
    }
    persist({});
    deckName.value = "我的构筑";
    deckDescription.value = "";
    deckCover.value = "";
    editingId.value = undefined;
    history.value = [];
    return true;
  }
  async function editSaved(deck: {
    id: string;
    name: string;
    quantities: Record<string, number>;
    description?: string;
    cover?: string;
    example?: boolean;
  }) {
    if (library.draft.value && total.value) {
      notify("请先保存或删除当前草稿，再编辑其他卡组。");
      mode.value = true;
      panel.value = "deck";
      await navigateTo(resumePath.value);
      return;
    }
    await catalog.load();
    if (!replace(deck.quantities, deck.name)) return;
    deckDescription.value = deck.description || "";
    deckCover.value = deck.cover || "";
    editingId.value = deck.example ? undefined : deck.id;
    mode.value = true;
    panel.value = "deck";
    await navigateTo("/concepts/orbit/cards?view=all");
  }
  function notify(message: string) {
    toast.value = message;
  }
  function locateCard(code: string) {
    mode.value = true;
    panel.value = "deck";
    locate.value = { code, revision: (locate.value?.revision ?? 0) + 1 };
  }
  return {
    theme,
    utility,
    mode,
    quantities,
    motion,
    panel,
    filtersOpen,
    selected,
    toast,
    total,
    entries,
    count,
    change,
    history,
    undo,
    deckName,
    deckDescription,
    deckCover,
    editingId,
    resumePath,
    saveDraft,
    resetCurrent,
    editSaved,
    storageError,
    editable,
    catalog,
    replace,
    lastEdit,
    locate,
    locateCard,
    notify,
  };
}
