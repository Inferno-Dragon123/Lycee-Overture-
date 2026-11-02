export type DragSample = { x: number; time: number };
export const GALLERY_INERTIA = {
  maxSpeed: 3.4,
  damping: 0.0032,
  sampleMs: 90,
} as const;
export function releaseVelocity(samples: DragSample[], now: number) {
  const last = samples.at(-1);
  if (!last || now - last.time > GALLERY_INERTIA.sampleMs) return 0;
  const first = samples.find(
    (s) => s.time >= last.time - GALLERY_INERTIA.sampleMs,
  );
  if (!first || last.time <= first.time) return 0;
  return Math.max(
    -GALLERY_INERTIA.maxSpeed,
    Math.min(
      GALLERY_INERTIA.maxSpeed,
      -(last.x - first.x) / (last.time - first.time),
    ),
  );
}
/** Exact exponential integration makes the glide independent of refresh rate. */
export function inertiaStep(velocity: number, milliseconds: number) {
  const decay = Math.exp(-GALLERY_INERTIA.damping * Math.max(0, milliseconds));
  return {
    distance: (velocity * (1 - decay)) / GALLERY_INERTIA.damping,
    velocity: velocity * decay,
  };
}
