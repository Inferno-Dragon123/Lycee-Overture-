/** One delegated listener also covers teleported dialogs and dynamic Listbox options. */
export function useInteractionFeedback() {
  const { motion } = useShowcase();
  const route = useRoute();
  let clean = () => {};
  onMounted(() => {
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const selector =
      "button,a[href],input:not([type=hidden]),textarea,summary,[role=option],[role=tab],[role=switch]";
    let target: HTMLElement | null = null,
      frame = 0;
    let point = { x: 0, y: 0 };
    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      target?.removeAttribute("data-feedback-hover");
      target?.style.removeProperty("--pointer-x");
      target?.style.removeProperty("--pointer-y");
      target = null;
    }
    function move(event: PointerEvent) {
      if (
        !fine.matches ||
        reduced.matches ||
        !motion.value ||
        event.pointerType !== "mouse" ||
        event.buttons
      )
        return reset();
      const next = (event.target as Element)?.closest<HTMLElement>(selector);
      if (
        !next?.closest(".concept,.p-card-modal") ||
        next.matches(":disabled,[aria-disabled=true]") ||
        next.closest(".is-dragging,.is-coasting")
      )
        return reset();
      if (next !== target) {
        reset();
        target = next;
        target.setAttribute("data-feedback-hover", "true");
      }
      point = { x: event.clientX, y: event.clientY };
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (!target?.isConnected) return reset();
          const box = target.getBoundingClientRect();
          target.style.setProperty(
            "--pointer-x",
            `${Math.max(0, Math.min(100, ((point.x - box.left) / box.width) * 100))}%`,
          );
          target.style.setProperty(
            "--pointer-y",
            `${Math.max(0, Math.min(100, ((point.y - box.top) / box.height) * 100))}%`,
          );
        });
    }
    const stop = watch([motion, () => route.fullPath], reset);
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerdown", reset, { passive: true });
    document.addEventListener("scroll", reset, true);
    document.addEventListener("visibilitychange", reset);
    document.documentElement.addEventListener("pointerleave", reset);
    window.addEventListener("blur", reset);
    fine.addEventListener("change", reset);
    reduced.addEventListener("change", reset);
    clean = () => {
      reset();
      stop();
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerdown", reset);
      document.removeEventListener("scroll", reset, true);
      document.removeEventListener("visibilitychange", reset);
      document.documentElement.removeEventListener("pointerleave", reset);
      window.removeEventListener("blur", reset);
      fine.removeEventListener("change", reset);
      reduced.removeEventListener("change", reset);
    };
  });
  onBeforeUnmount(() => clean());
}
