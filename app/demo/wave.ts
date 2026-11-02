export function proximity(distance: number, radius = 240) {
  const t = Math.max(0, 1 - Math.max(0, distance) / radius);
  return t * t * (3 - 2 * t);
}
