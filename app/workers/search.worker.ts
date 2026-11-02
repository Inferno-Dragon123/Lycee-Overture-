/// <reference lib="webworker" />
import type { Card, SearchQuery } from "../../shared/domain/catalog";
import { createSearchEngine } from "../../shared/domain/search";

let search: ReturnType<typeof createSearchEngine> | undefined;
self.onmessage = async (
  event: MessageEvent<{
    id: number;
    type: "init" | "search";
    query?: SearchQuery;
  }>,
) => {
  const { id, type, query } = event.data;
  try {
    if (type === "init") {
      const response = await fetch("/api/catalog/cards");
      if (!response.ok) throw new Error("卡库下载失败");
      const cards: Card[] = await response.json();
      search = createSearchEngine(cards);
      self.postMessage({ id, ready: true });
    } else {
      if (!search) throw new Error("本地索引未就绪");
      self.postMessage({ id, result: search(query) });
    }
  } catch (error) {
    self.postMessage({ id, error: (error as Error).message });
  }
};
