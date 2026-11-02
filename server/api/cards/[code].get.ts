import { normalizeCode } from "../../../shared/domain/catalog";

export default defineEventHandler(async (event) => {
  const code = normalizeCode(getRouterParam(event, "code") ?? "");
  const card = (await getCatalog()).byCode.get(code);
  if (!card)
    throw createError({ statusCode: 404, statusMessage: "Card not found" });
  return card;
});
