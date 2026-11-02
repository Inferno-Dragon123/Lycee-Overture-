import { get, set } from "idb-keyval";
import { decodeDeck } from "#shared/domain/deck";

export default defineNuxtPlugin((nuxtApp) => {
  const route = useRoute();
  if (route.path === '/' || route.path.startsWith('/concepts')) return;
  const { deck, ready, storageStatus } = useDeck();
  const key = "lycee:m0:deck:v1";
  let queue = Promise.resolve();
  let revision = 0;
  nuxtApp.hook("app:mounted", async () => {
    try {
      const value = await get(key);
      if (value !== undefined) {
        try {
          deck.value = decodeDeck(value);
        } catch {
          storageStatus.value = "invalid";
          ready.value = true;
          return;
        }
      }
      storageStatus.value = "saved";
    } catch {
      storageStatus.value = "error";
    }
    ready.value = true;
    watch(
      deck,
      (value) => {
        const snapshot = JSON.parse(JSON.stringify(value));
        const current = ++revision;
        storageStatus.value = "saving";
        queue = queue.then(async () => {
          try {
            await set(key, snapshot);
            if (current === revision) storageStatus.value = "saved";
          } catch {
            if (current === revision) storageStatus.value = "error";
          }
        });
      },
      { deep: true, flush: "sync" },
    );
  });
});
