import { normalizeCode } from "../../../../shared/domain/catalog";

export default defineEventHandler(async (event) => {
  const code = normalizeCode(getRouterParam(event, "code") ?? "");
  const card = (await getCatalog()).byCode.get(code);
  if (!card) throw createError({ statusCode: 404, statusMessage: "Card not found" });
  try {
    const artwork = await loadCardArtwork(card.img);
    setResponseHeader(event, "Content-Type", artwork.contentType);
    setResponseHeader(event, "Cache-Control", "public, max-age=3600");
    setResponseHeader(event, "X-Content-Type-Options", "nosniff");
    return artwork.body;
  } catch {
    setResponseHeader(event, "Cache-Control", "no-store");
    throw createError({ statusCode: 502, statusMessage: "Card artwork temporarily unavailable" });
  }
});
