import {
  changeQuantity,
  completeDeck,
  deckTotal,
  emptyDeck,
  type Deck,
  type DeckCard,
} from "#shared/domain/deck";

export function useDeck() {
  const deck = useState<Deck>("local-deck", emptyDeck);
  const ready = useState("deck-ready", () => false);
  const storageStatus = useState<
    "loading" | "saved" | "saving" | "error" | "invalid"
  >("deck-storage-status", () => "loading");
  const notice = useState("deck-notice", () => "");
  const mode = useCookie<boolean>("lycee-builder-mode", { default: () => false, sameSite: "lax" });
  const history = useState<Deck[]>("deck-history", () => []);
  const total = computed(() => deckTotal(deck.value));
  const editable = computed(
    () => ready.value && storageStatus.value !== "invalid",
  );
  function update(next: Deck) {
    history.value = [
      ...history.value.slice(-19),
      JSON.parse(JSON.stringify(deck.value)),
    ];
    deck.value = next;
  }
  function change(card: DeckCard, delta: number) {
    if (!editable.value) return;
    try {
      update(changeQuantity(deck.value, card, delta));
      notice.value = "";
    } catch (error) {
      notice.value = (error as Error).message;
    }
  }
  function save() {
    if (!editable.value) return;
    try {
      update(completeDeck(deck.value));
      notice.value = "已保存为本地卡组，尚未同步到云端。";
    } catch (error) {
      notice.value = (error as Error).message;
    }
  }
  function rename(name: string) {
    if (editable.value)
      deck.value = { ...deck.value, name: name.slice(0, 80), status: "draft" };
  }
  function undo() {
    const previous = history.value.at(-1);
    if (previous && editable.value) {
      deck.value = previous;
      history.value = history.value.slice(0, -1);
      notice.value = "已撤销上一步";
    }
  }
  const count = (code: string) =>
    deck.value.entries.find((entry) => entry.card.code === code)?.quantity ?? 0;
  return {
    deck,
    ready,
    storageStatus,
    notice,
    mode,
    history,
    total,
    editable,
    change,
    save,
    rename,
    undo,
    count,
  };
}
