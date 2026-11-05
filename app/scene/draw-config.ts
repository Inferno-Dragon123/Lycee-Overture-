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
export function drawCameraDistance(aspect: number, count: number, compact = false) {
  const hand = compact && count > 1 ? drawTargets(count, true) : [];
  const halfX = hand.length
      ? Math.max(...hand.map(t => Math.abs(t.x) + DRAW_CONFIG.cardWidth * t.scale / 2)) + 0.1
      : count > 1 ? 3.1 : 1.8,
    halfY = hand.length
      ? Math.max(2.4, ...hand.map(t => Math.abs(t.y) + DRAW_CONFIG.cardHeight * t.scale / 2)) + 0.1
      : 2.2,
    maxZ = 1.25;
  const tangent = Math.tan((DRAW_CONFIG.fov * Math.PI) / 360);
  return (
    maxZ +
    Math.max(halfY / tangent, halfX / (tangent * Math.max(0.25, aspect))) *
      (hand.length ? 1.03 : DRAW_CONFIG.margin)
  );
}
export function drawTargets(count: number, compact = false) {
  if (compact && count > 1) {
    const columns = 3, rows = Math.ceil(count / columns), scale = 0.9;
    return Array.from({ length: count }, (_, i) => {
      const row = Math.floor(i / columns), rowCount = Math.min(columns, count - row * columns);
      return {
        x: ((i % columns) - (rowCount - 1) / 2) * 1.91,
        y: ((rows - 1) / 2 - row) * 2.565,
        z: 0.65 + i * 0.006, scale, rx: -0.025, ry: -0.04, rz: 0,
      };
    });
  }
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
