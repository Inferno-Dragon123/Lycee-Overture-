import type { SearchQuery } from "../../../shared/domain/catalog";

export default defineEventHandler(async (event) => {
  const raw = getQuery(event);
  const query: SearchQuery = {};
  for (const key of [
    "q",
    "series",
    "version",
    "category",
    "attribute",
    "rarity",
  ] as const) {
    if (
      raw[key] !== undefined &&
      (typeof raw[key] !== "string" || raw[key].length > 200)
    )
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid search parameter",
      });
    query[key] = raw[key] as string | undefined;
  }
  for (const key of ["page", "pageSize"] as const) {
    if (
      raw[key] !== undefined &&
      (!/^\d+$/.test(String(raw[key])) ||
        !Number.isSafeInteger(Number(raw[key])))
    )
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid pagination",
      });
    query[key] = raw[key] === undefined ? undefined : Number(raw[key]);
  }
  return (await getCatalog()).search(query);
});
