export default defineEventHandler(async (event) => {
  setHeader(event, "Cache-Control", "public, max-age=60");
  return (await getCatalog()).cards;
});
