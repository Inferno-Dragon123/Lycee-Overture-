import { createCardWaveController } from "~/demo/card-wave";
/** Measure fixed wrappers, transform their children: no feedback from displaced bounds. */
export function useCardWave(root: Ref<HTMLElement | undefined>) {
  const { motion } = useShowcase();
  let clean = () => {};
  onMounted(() => {
    const el = root.value;
    if (!el) return;
    const controller = createCardWaveController(el, {
      enabled: () => motion.value,
      reduced: matchMedia("(prefers-reduced-motion: reduce)"),
      fine: matchMedia("(hover: hover) and (pointer: fine)"),
      window,
      requestFrame: (callback) => requestAnimationFrame(callback),
      cancelFrame: (frame) => cancelAnimationFrame(frame),
    });
    const stop = watch(motion, controller.sync);
    clean = () => {
      stop();
      controller.dispose();
    };
  });
  onBeforeUnmount(() => clean());
}
