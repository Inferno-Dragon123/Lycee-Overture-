export default defineEventHandler(async () => (await getCatalog()).facets);
