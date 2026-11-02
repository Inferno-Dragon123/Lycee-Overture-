export default defineNuxtPlugin((nuxtApp) => {
  // Archived experiments and the old M0 pages must not initialize actual deck cookies.
  const initialPath = window.location.pathname;
  if (
    initialPath !== "/" &&
    (!initialPath.startsWith("/concepts/orbit") ||
      /\/deck-loom(?:-v2)?$/.test(initialPath))
  )
    return;
  const library = usePracticeDecks();
  const state = useShowcase();
  const route = useRouter().currentRoute;
  let started = false;
  function autosave() {
    if (!started || state.storageError.value) return;
    if (state.total.value) state.saveDraft(false);
    else if (library.draft.value) library.setDraft(null);
  }
  function restore() {
    library.load();
    if (started || !state.catalog.ready.value || library.readError.value)
      return;
    if (library.draft.value) {
      const d = library.draft.value;
      if (!state.replace(d.quantities, d.name)) {
        library.readError.value = true;
        library.error.value =
          "草稿含当前卡库无法识别的卡牌，原记录已保留，请先备份并修复。";
        return;
      }
      state.deckDescription.value = d.description || "";
      state.deckCover.value = d.cover || "";
      state.editingId.value = d.editingId;
      state.resumePath.value = d.resume;
    }
    if (/^\/concepts\/orbit\/cards(?:\?|$)/.test(route.value.fullPath))
      state.resumePath.value = route.value.fullPath;
    started = true;
    autosave();
  }
  nuxtApp.hook("app:mounted", async () => {
    library.load();
    await state.catalog.load();
    restore();
  });
  watch(state.catalog.ready, (ready) => {
    if (ready) restore();
  });

  watch(
    [
      state.quantities,
      state.deckName,
      state.deckDescription,
      state.deckCover,
      state.editingId,
    ],
    autosave,
    { deep: true },
  );
  watch(
    () => route.value.fullPath,
    (path) => {
      if (/^\/concepts\/orbit\/cards(?:\?|$)/.test(path))
        state.resumePath.value = path;
      autosave();
    },
  );
  window.addEventListener("pagehide", autosave);
  window.addEventListener("beforeunload", autosave);
});
