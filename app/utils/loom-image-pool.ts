export type LoomImageStatus = "loading" | "ready" | "error";
export function createLoomImagePool(
  load: (src: string, signal: AbortSignal) => Promise<void>,
  update: (src: string, status: LoomImageStatus) => void,
  limit = 4,
) {
  const known = new Set<string>();
  const pending = new Map<string, number>();
  const controller = new AbortController();
  let active = 0, scheduled = false;
  function pump() {
    scheduled = false;
    if (controller.signal.aborted) return;
    while (active < limit && pending.size) {
      const [src] = [...pending].sort((a, b) => a[1] - b[1])[0]!;
      pending.delete(src); active++;
      void Promise.resolve().then(() => load(src, controller.signal)).then(
        () => { if (!controller.signal.aborted) update(src, "ready"); },
        () => { if (!controller.signal.aborted) update(src, "error"); },
      ).finally(() => { active--; pump(); });
    }
  }
  return {
    request(src: string, priority = 2) {
      if (!src || controller.signal.aborted) return;
      if (known.has(src)) {
        if (pending.has(src)) pending.set(src, Math.min(priority, pending.get(src)!));
        return;
      }
      known.add(src); pending.set(src, priority); update(src, "loading");
      if (!scheduled) { scheduled = true; queueMicrotask(pump); }
    },
    dispose() { controller.abort(); pending.clear(); },
  };
}
