export const DRAW_CONFIG = {
  fov: 38,
  cardWidth: 1.9,
  cardHeight: 2.65,
  cardThickness: 0.048,
  duration: 2.8,
  stagger: 0.085,
  margin: 1.13,
  handColumns: 4,
  handSpacing: 1.08,
  handScale: 0.54,
  upperRowY: 0.94,
  lowerRowY: -0.86,
};
export function drawCameraDistance(aspect: number, count: number) {
  const halfX = count > 1 ? 3.1 : 1.8,
    halfY = 2.2,
    maxZ = 1.25;
  const tangent = Math.tan((DRAW_CONFIG.fov * Math.PI) / 360);
  return (
    maxZ +
    Math.max(halfY / tangent, halfX / (tangent * Math.max(0.25, aspect))) *
      DRAW_CONFIG.margin
  );
}
export function drawTargets(count: number) {
  const columns = count === 7 ? DRAW_CONFIG.handColumns : 5;
  return Array.from({ length: count }, (_, i) =>
    count === 1
      ? { x: 0.38, y: 0, z: 0.85, scale: 1, rx: -0.095, ry: -0.24, rz: -0.045 }
      : {
          x:
            ((i % columns) -
              ((i < columns ? columns : count - columns) - 1) / 2) *
            DRAW_CONFIG.handSpacing,
          y: i < columns ? DRAW_CONFIG.upperRowY : DRAW_CONFIG.lowerRowY,
          z: 0.65 + i * 0.006,
          scale: DRAW_CONFIG.handScale,
          rx: -0.075,
          ry: -0.16 + (i % 5) * 0.04,
          rz: ((i % 5) - 2) * -0.012,
        },
  );
}
