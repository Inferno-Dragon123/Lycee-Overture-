/** Display images and WebGL textures share the same-origin artwork endpoint. */
export function cardTextureSource(source: string) {
  const match = /^https:\/\/lycee-tcg\.com\/card\/image\/(LO-\d+[A-Za-z0-9-]*)\.png$/.exec(source);
  return match ? `/api/cards/${match[1]}/image` : source;
}
