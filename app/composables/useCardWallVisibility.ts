/** Keep the visible card wall moving without compositing ten offscreen tracks. */
export function useCardWallVisibility(root: Ref<HTMLElement | undefined>, generation: Readonly<Ref<string>>) {
  let observer: IntersectionObserver | undefined;
  let preload: IntersectionObserver | undefined;
  function loadRow(row: HTMLElement) {
    row.querySelectorAll<HTMLImageElement>('img[data-wall-src]').forEach(image => {
      const source = image.dataset.wallSrc;
      if (source && image.getAttribute('src') !== source) image.src = source;
    });
  }
  watch(generation, () => {
    // A loaded row must also receive the new Beijing-day selection.
    root.value?.querySelectorAll<HTMLElement>('.a-wall-row[data-wall-loaded=true]').forEach(loadRow);
  }, { flush: 'post' });
  onMounted(() => {
    if (!root.value) return;
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        (entry.target as HTMLElement).dataset.wallActive = String(entry.isIntersecting);
      }
    }, { rootMargin: '120px 0px' });
    preload = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        const row = entry.target as HTMLElement;
        loadRow(row);
        row.dataset.wallLoaded = 'true';
        preload!.unobserve(row);
      }
    }, { rootMargin: '360px 0px' });
    root.value.querySelectorAll('.a-wall-row').forEach(row => {
      observer!.observe(row);
      preload!.observe(row);
    });
  });
  onBeforeUnmount(() => { observer?.disconnect(); preload?.disconnect(); });
}
