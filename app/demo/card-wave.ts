import { proximity } from "./wave";

type WaveOptions = {
  enabled: () => boolean;
  reduced: MediaQueryList;
  fine: MediaQueryList;
  window: Pick<Window, "addEventListener" | "removeEventListener">;
  requestFrame: typeof requestAnimationFrame;
  cancelFrame: typeof cancelAnimationFrame;
};

/** Touch scrolling does no wave work; desktop frames read layout before writing styles. */
export function createCardWaveController(root: HTMLElement, options: WaveOptions) {
  let frame = 0;
  let listening = false;
  let disposed = false;
  let point: { x: number; y: number } | null = null;
  const changed = new Map<HTMLElement, string>();
  const eligible = () => options.enabled() && !options.reduced.matches && options.fine.matches;

  function reset() {
    if (frame) options.cancelFrame(frame);
    frame = 0;
    point = null;
    for (const item of changed.keys()) item.style.setProperty("--wave", "0");
    changed.clear();
  }

  function update() {
    frame = 0;
    if (!point || !eligible()) return reset();
    const cursor = point;
    // Collect every rect first. Interleaving getBoundingClientRect and setProperty
    // forces the browser to resolve the preceding item's style repeatedly.
    const measured = Array.from(root.querySelectorAll<HTMLElement>("[data-wave-item]"), (item) => ({
      item,
      bounds: item.getBoundingClientRect(),
    }));
    const next = new Map<HTMLElement, string>();
    for (const { item, bounds } of measured) {
      const distance = Math.hypot(
        cursor.x - bounds.left - bounds.width / 2,
        cursor.y - bounds.top - bounds.height / 2,
      );
      const value = proximity(distance, Math.max(180, bounds.width * 1.45)).toFixed(3);
      if (value !== "0.000") next.set(item, value);
    }
    for (const item of changed.keys()) {
      if (!next.has(item)) item.style.setProperty("--wave", "0");
    }
    for (const [item, value] of next) {
      if (changed.get(item) !== value) item.style.setProperty("--wave", value);
    }
    changed.clear();
    for (const [item, value] of next) changed.set(item, value);
  }

  function move(event: MouseEvent) {
    point = { x: event.clientX, y: event.clientY };
    if (!frame) frame = options.requestFrame(update);
  }

  function bind(active: boolean) {
    if (active === listening) return;
    listening = active;
    if (active) {
      root.addEventListener("mousemove", move);
      root.addEventListener("mouseleave", reset);
      root.addEventListener("scroll", reset, true);
      options.window.addEventListener("blur", reset);
    } else {
      root.removeEventListener("mousemove", move);
      root.removeEventListener("mouseleave", reset);
      root.removeEventListener("scroll", reset, true);
      options.window.removeEventListener("blur", reset);
      reset();
    }
  }

  function sync() {
    if (!disposed) bind(eligible());
  }
  options.reduced.addEventListener("change", sync);
  options.fine.addEventListener("change", sync);
  sync();
  return {
    sync,
    dispose() {
      if (disposed) return;
      disposed = true;
      bind(false);
      reset();
      options.reduced.removeEventListener("change", sync);
      options.fine.removeEventListener("change", sync);
    },
  };
}
