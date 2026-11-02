import { fetchOfficialArtwork } from "./artwork-transport";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_CACHE_BYTES = 24 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 24;
const CACHE_TTL = 60 * 60 * 1000;
type Artwork = { body: Buffer; contentType: string; expires: number };

type ArtworkFetcher = (source: string, options: { credentials: "omit"; redirect: "error"; signal: AbortSignal }) => Promise<{
  ok: boolean;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}>;
export function createCardArtworkLoader(fetchImage: ArtworkFetcher = fetch) {
  const cache = new Map<string, Artwork>();
  const pending = new Map<string, Promise<Artwork>>();
  let bytes = 0;
  return async function load(source: string) {
    if (!/^https:\/\/lycee-tcg\.com\/card\/image\/LO-\d+[A-Za-z0-9-]*\.png$/.test(source))
      throw new Error("Unsupported card artwork source");
    const hit = cache.get(source);
    if (hit) {
      cache.delete(source);
      if (hit.expires > Date.now()) { cache.set(source, hit); return hit; }
      bytes -= hit.body.length;
    }
    if (pending.has(source)) return pending.get(source)!;
    const request = (async () => {
      const response = await fetchImage(source, {
        credentials: "omit", redirect: "error", signal: AbortSignal.timeout(15000),
      });
      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "";
      if (!response.ok || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(contentType))
        throw new Error("Card artwork unavailable");
      if (Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES)
        throw new Error("Card artwork too large");
      const body = Buffer.from(await response.arrayBuffer());
      if (!body.length || body.length > MAX_IMAGE_BYTES) throw new Error("Invalid card artwork size");
      const artwork = { body, contentType, expires: Date.now() + CACHE_TTL };
      cache.set(source, artwork); bytes += body.length;
      while (cache.size > MAX_CACHE_ENTRIES || bytes > MAX_CACHE_BYTES) {
        const oldest = cache.keys().next().value!;
        bytes -= cache.get(oldest)!.body.length; cache.delete(oldest);
      }
      return artwork;
    })();
    pending.set(source, request);
    try { return await request; } finally { pending.delete(source); }
  };
}

export const loadCardArtwork = createCardArtworkLoader(fetchOfficialArtwork);
