import type { SearchQuery, SearchResult } from "#shared/domain/catalog";

export function useCardSearch() {
  const engine = ref<"server" | "loading" | "local" | "fallback">("server");
  let worker: Worker | undefined;
  let sequence = 0;
  const pending = new Map<
    number,
    {
      resolve: (value: SearchResult | undefined) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  function stop() {
    worker?.terminate();
    worker = undefined;
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error("本地搜索已停止"));
    }
    pending.clear();
  }
  function request(type: "init" | "search", query?: SearchQuery) {
    return new Promise<SearchResult | undefined>((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(
        () => {
          pending.delete(id);
          reject(new Error("本地搜索超时"));
        },
        type === "init" ? 30000 : 4000,
      );
      pending.set(id, { resolve, reject, timer });
      worker!.postMessage({ id, type, query });
    });
  }
  async function enableLocal() {
    if (engine.value === "loading" || engine.value === "local") return;
    engine.value = "loading";
    try {
      worker = new Worker(
        new URL("../workers/search.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.onmessage = (event) => {
        const item = pending.get(event.data.id);
        if (!item) return;
        clearTimeout(item.timer);
        pending.delete(event.data.id);
        if (event.data.error) item.reject(new Error(event.data.error));
        else item.resolve(event.data.result);
      };
      worker.onerror = () => {
        engine.value = "fallback";
        stop();
      };
      await request("init");
      engine.value = "local";
    } catch {
      engine.value = "fallback";
      stop();
    }
  }
  async function search(query: SearchQuery) {
    if (engine.value === "local" && worker) {
      try {
        return (await request("search", { ...query }))!;
      } catch {
        engine.value = "fallback";
        stop();
      }
    }
    return await $fetch<SearchResult>("/api/cards/search", { query });
  }
  onBeforeUnmount(stop);
  return { engine, enableLocal, search };
}
