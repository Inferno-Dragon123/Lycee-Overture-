import type { Card } from "#shared/domain/catalog";
import { cardTextureSource } from "#shared/domain/card-artwork";
import fixtures from "~/demo/fixtures.json";
let pending: Promise<void> | undefined;
export function useOrbitCatalog() {
  const series = useCatalogSeries();
  const cards = useState<Card[]>("orbit-full-catalog", () => fixtures.cards as Card[]);
  const ready = useState("orbit-catalog-ready", () => false);
  const loading = useState("orbit-catalog-loading", () => false);
  const error = useState("orbit-catalog-error", () => "");
  const byCode = computed(() => new Map(cards.value.map(card => [card.code, card])));
  async function load() {
    if (!import.meta.client || ready.value) return;
    if (pending) return pending;
    loading.value = true; error.value = "";
    pending = (async () => {
      try {
        const data = await $fetch<Card[]>("/api/catalog/cards");
        if (!Array.isArray(data) || !data.length || !data.every(card => /^LO-\d+[A-Za-z0-9-]*$/.test(card.code) && typeof card.name === "string" && typeof card.img === "string")) throw new Error("invalid catalog");
        const artwork = new Map(fixtures.cards.map(card => [card.code, card.img]));
        cards.value = markRaw(data.map(card => ({ ...card, img: artwork.get(card.code) || cardTextureSource(card.img) })));
        ready.value = true;
        await series.load();
      } catch { error.value = "完整卡库暂时无法读取。当前卡组记录已保留，请重试。"; }
      finally { loading.value = false; pending = undefined; }
    })();
    return pending;
  }
  return { cards, byCode, ready, loading, error, load };
}
