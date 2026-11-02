import { proximity } from "~/demo/wave";
/** Measure fixed wrappers, transform their children: no feedback from displaced bounds. */
export function useCardWave(root: Ref<HTMLElement | undefined>) {
  const { motion } = useShowcase();
  let clean = () => {};
  onMounted(() => {
    const el = root.value;
    if (!el) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    let frame = 0,
      point: { x: number; y: number } | null = null;
    const items = () => el.querySelectorAll<HTMLElement>("[data-wave-item]");
    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      point = null;
      items().forEach((item) => {
        item.style.setProperty("--wave", "0");
      });
    }
    function update() {
      frame = 0;
      if (!point || !motion.value || media.matches || !fine.matches)
        return reset();
      items().forEach((item) => {
        const bounds = item.getBoundingClientRect();
        const distance = Math.hypot(
          point!.x - bounds.left - bounds.width / 2,
          point!.y - bounds.top - bounds.height / 2,
        );
        item.style.setProperty(
          "--wave",
          proximity(distance, Math.max(180, bounds.width * 1.45)).toFixed(3),
        );
      });
    }
    function move(event: MouseEvent) {
      point = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(update);
    }
    const stop = watch(motion, reset);
    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", reset);
    el.addEventListener("scroll", reset, true);
    window.addEventListener("blur", reset);
    media.addEventListener("change", reset);
    clean = () => {
      reset();
      stop();
      el.removeEventListener("mousemove", move);
      el.removeEventListener("mouseleave", reset);
      el.removeEventListener("scroll", reset, true);
      window.removeEventListener("blur", reset);
      media.removeEventListener("change", reset);
    };
  });
  onBeforeUnmount(() => clean());
}
