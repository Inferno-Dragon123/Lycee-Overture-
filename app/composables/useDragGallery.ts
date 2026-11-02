import { inertiaStep, releaseVelocity, type DragSample } from "~/demo/inertia";

export function useDragGallery(root: Ref<HTMLElement | undefined>) {
  const { motion } = useShowcase();
  let clean = () => {};
  onMounted(() => {
    const el = root.value;
    if (!el) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let down: { x: number; scroll: number; id: number } | null = null;
    let dragged = false,
      brakeClick = false,
      frame = 0,
      velocity = 0,
      lastFrame = 0;
    let samples: DragSample[] = [];
    function stopGlide() {
      cancelAnimationFrame(frame);
      frame = 0;
      velocity = 0;
      el!.classList.remove("is-coasting");
    }
    function glide(time: number) {
      frame = 0;
      const step = inertiaStep(velocity, Math.min(50, time - lastFrame));
      lastFrame = time;
      const before = el!.scrollLeft;
      const max = el!.scrollWidth - el!.clientWidth;
      el!.scrollLeft = Math.max(0, Math.min(max, before + step.distance));
      velocity = step.velocity;
      if (
        Math.abs(velocity) < 0.025 ||
        el!.scrollLeft <= 0 ||
        el!.scrollLeft >= max
      )
        return stopGlide();
      frame = requestAnimationFrame(glide);
    }
    function release() {
      const pointer = down;
      down = null;
      if (pointer && el!.hasPointerCapture(pointer.id))
        el!.releasePointerCapture(pointer.id);
      el!.classList.remove("is-dragging");
    }
    function cancel() {
      release();
      stopGlide();
      samples = [];
    }
    function start(event: PointerEvent) {
      brakeClick = frame > 0;
      stopGlide();
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      dragged = false;
      down = { x: event.clientX, scroll: el!.scrollLeft, id: event.pointerId };
      samples = [{ x: event.clientX, time: performance.now() }];
    }
    function move(event: PointerEvent) {
      if (!down || event.pointerId !== down.id) return;
      if (!(event.buttons & 1)) return cancel();
      const delta = event.clientX - down.x;
      if (!dragged && Math.abs(delta) > 6) {
        dragged = true;
        el!.setPointerCapture(down.id);
        el!.classList.add("is-dragging");
      }
      if (dragged) {
        event.preventDefault();
        el!.scrollLeft = down.scroll - delta;
        const time = performance.now();
        samples.push({ x: event.clientX, time });
        samples = samples.filter((s) => time - s.time <= 120);
      }
    }
    function end(event: PointerEvent) {
      if (!down || event.pointerId !== down.id) return;
      const speed = releaseVelocity(samples, performance.now());
      release();
      if (
        !dragged ||
        !motion.value ||
        media.matches ||
        document.hidden ||
        Math.abs(speed) < 0.08
      )
        return;
      velocity = speed;
      lastFrame = performance.now();
      el!.classList.add("is-coasting");
      frame = requestAnimationFrame(glide);
    }
    function lost() {
      if (down) cancel();
    }
    function click(event: MouseEvent) {
      if (event.detail === 0) {
        stopGlide();
        dragged = brakeClick = false;
        return;
      }
      if (dragged || brakeClick) {
        event.preventDefault();
        event.stopPropagation();
        dragged = brakeClick = false;
      }
    }
    function nativeDrag(event: DragEvent) {
      event.preventDefault();
    }
    function key(event: KeyboardEvent) {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      cancel();
      event.preventDefault();
      const target =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? el!.scrollWidth
            : el!.scrollLeft +
              (event.key === "ArrowLeft" ? -1 : 1) * el!.clientWidth * 0.7;
      el!.scrollTo({ left: target, behavior: "instant" });
    }
    const stopMotion = watch(motion, cancel);
    const visibility = () => {
      if (document.hidden) cancel();
    };
    const observer = new ResizeObserver(stopGlide);
    observer.observe(el);
    el.addEventListener("pointerdown", start);
    el.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("lostpointercapture", lost);
    el.addEventListener("click", click, true);
    el.addEventListener("dragstart", nativeDrag);
    el.addEventListener("keydown", key);
    el.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", cancel);
    clean = () => {
      cancel();
      observer.disconnect();
      stopMotion();
      el.removeEventListener("pointerdown", start);
      el.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", cancel);
      el.removeEventListener("lostpointercapture", lost);
      el.removeEventListener("click", click, true);
      el.removeEventListener("dragstart", nativeDrag);
      el.removeEventListener("keydown", key);
      el.removeEventListener("wheel", cancel);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", cancel);
    };
  });
  onBeforeUnmount(() => clean());
}
