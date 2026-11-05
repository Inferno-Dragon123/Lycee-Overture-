import type { ShowcaseCard } from "../demo/collection";

export const HERO_MOTION_CONFIG = {
  introDuration: 3,
  autoDelayMs: 8000,
  cardWidth: 1.9,
  cardHeight: 2.65,
  cardThickness: 0.026,
  fov: 34,
  parallaxX: 0.055,
  parallaxY: 0.095,
  damping: 7,
  hoverDepth: 0.14,
  idleAmplitude: 0.045,
  idlePeriod: 5.2,
  impactScale: 1.045,
  glowIntensity: 0.12,
  orbitDuration: 1.65,
  orbitDepth: 2.8,
  orbitLift: 0.28,
  orbitLateral: 0.55,
} as const;

export type HeroPhase =
  | "loading"
  | "intro"
  | "transitioning"
  | "recovering"
  | "idle"
  | "fallback";
export function heroOrder(cards: ShowcaseCard[], index: number) {
  const unique = [...new Map(cards.map((card) => [card.code, card])).values()];
  if (!unique.length) return [];
  const start = ((index % unique.length) + unique.length) % unique.length;
  return unique.slice(0, 3).map((_, i) => unique[(start + i) % unique.length]!);
}

export function heroLayout(count: number, compact: boolean) {
  return [
    {
      x: count === 1 ? 0 : 0.16,
      y: 0.02,
      z: 0.9,
      rx: -0.035,
      ry: -0.045,
      rz: -0.015,
      scale: 1,
    },
    {
      x: compact ? -1.1 : -1.47,
      y: compact ? -0.12 : -0.18,
      z: -0.95,
      rx: 0.035,
      ry: 0.26,
      rz: 0.16,
      scale: compact ? 0.76 : 0.84,
    },
    {
      x: compact ? 1.2 : 1.58,
      y: 0.23,
      z: -1.45,
      rx: -0.06,
      ry: -0.29,
      rz: -0.19,
      scale: compact ? 0.71 : 0.8,
    },
  ].slice(0, Math.max(0, Math.min(3, count)));
}

export function heroOrbitPose(
  from: ReturnType<typeof heroLayout>[number],
  to: ReturnType<typeof heroLayout>[number],
  progress: number,
) {
  const p = Math.max(0, Math.min(1, progress)),
    arc = Math.sin(Math.PI * p);
  const direction = to.x < from.x ? -1 : 1;
  const mix = (a: number, b: number) => a + (b - a) * p;
  return {
    x: mix(from.x, to.x) + direction * arc * HERO_MOTION_CONFIG.orbitLateral,
    y: mix(from.y, to.y) + arc * HERO_MOTION_CONFIG.orbitLift,
    z: mix(from.z, to.z) - arc * HERO_MOTION_CONFIG.orbitDepth,
    rx: mix(from.rx, to.rx),
    ry: mix(from.ry, to.ry) + direction * arc * Math.PI,
    rz: mix(from.rz, to.rz),
    scale: mix(from.scale, to.scale),
  };
}

// Explicit palette from existing card attributes; no image readback or per-frame sampling.
export function heroColor(attribute?: string) {
  const colors: Record<string, string> = {
    雪: "#82cfea",
    月: "#a998ed",
    花: "#edaccb",
    宙: "#88bde6",
    日: "#eac579",
  };
  return colors[attribute || ""] || "#b8f36b";
}

/** A single replaceable pending request, never a growing animation queue. */
export function latestRequest<T>() {
  let pending: T | undefined;
  return {
    put(value: T) {
      pending = value;
    },
    take() {
      const value = pending;
      pending = undefined;
      return value;
    },
    clear() {
      pending = undefined;
    },
  };
}
