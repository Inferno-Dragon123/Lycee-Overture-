/** Keep native card detail without allocating unbounded full-screen GPU buffers. */
export function scenePixelRatio(width: number, height: number, deviceRatio: number) {
  const pixels = Math.max(1, width) * Math.max(1, height);
  return Math.min(Math.max(1, deviceRatio || 1), 3, Math.sqrt(2_000_000 / pixels));
}

/** Center navigation in the visible space below the fixed site header. */
export function navigationScrollTop(
  scrollTop: number, targetTop: number, targetHeight: number,
  viewportHeight: number, headerBottom: number,
) {
  return Math.max(0, scrollTop + targetTop + targetHeight / 2 -
    (viewportHeight + Math.max(0, headerBottom)) / 2);
}
