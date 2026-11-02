export default defineEventHandler((event) => {
  const id = getRouterParam(event, "id") || "";
  if (!/^[a-f0-9-]{36}$/.test(id)) throw createError({ statusCode: 404 });
  const bytes = workflowStore().image(id);
  if (!bytes) throw createError({ statusCode: 404 });
  setHeaders(event, {
    "Content-Type": "image/png",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=3600",
  });
  return bytes;
});
