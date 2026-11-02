import type { ShowcaseCard } from "~/demo/collection";
import { cardTextureSource } from "#shared/domain/card-artwork";
import { demoCards } from "./useShowcase";
export function useDisplayCatalog() {
  const catalogSeries = useCatalogSeries();
  const catalog = useState<ShowcaseCard[]>("display-catalog", () => [
    ...demoCards,
  ]);
  const ready = useState("display-catalog-ready", () => false);
  const error = useState("display-catalog-error", () => "");
  const loading = useState("display-catalog-loading", () => false);
  async function load() {
    if (ready.value || loading.value) return;
    loading.value = true;
    try {
      const response = await fetch("/api/catalog/display");
      if (!response.ok) throw new Error("catalog");
      const cards = (await response.json()) as ShowcaseCard[];
      if (
        !Array.isArray(cards) ||
        !cards.length ||
        !cards.every(
          (c) =>
            /^LO-\d+[A-Za-z0-9-]*$/.test(c.code) &&
            typeof c.name === "string" &&
            typeof c.img === "string",
        )
      )
        throw new Error("catalog");
      catalog.value = cards.map(card => ({ ...card, img: cardTextureSource(card.img) }));
      ready.value = true;
      await catalogSeries.load();
      error.value = "";
    } catch {
      error.value = "卡库加载失败，请重试。";
    } finally {
      loading.value = false;
    }
  }
  return { catalog, ready, loading, error, load };
}
