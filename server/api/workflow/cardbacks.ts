import sharp from "sharp";
export default defineEventHandler(async (event) => {
  setHeader(event, "Cache-Control", "no-store");
  const user = await workflowUser(event),
    store = workflowStore();
  const origin =
    String(useRuntimeConfig().workflowPublicOrigin || "") ||
    getRequestURL(event).origin;
  const url = (id: string) => `${origin}/api/workflow/cardbacks/${id}/image`;
  if (event.method === "GET")
    return store
      .backs(user!.id)
      .map((back) => ({ ...back, url: url(back.id) }));
  workflowOriginCheck(event);
  if (event.method === "DELETE") {
    const id = String(getQuery(event).id || "");
    try {
      store.removeBack(user!.id, id);
      return { deleted: true };
    } catch {
      throw createError({ statusCode: 404, message: "卡背不存在或无权删除" });
    }
  }
  if (event.method !== "POST") throw createError({ statusCode: 405 });
  await assertWorkflowBodySize(event, 5 * 1024 * 1024 + 4096);
  const files = await readMultipartFormData(event);
  const file = files?.find((f) => f.name === "image");
  if (
    !file?.data.length ||
    file.data.length > 5 * 1024 * 1024 ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type || "")
  )
    throw createError({
      statusCode: 400,
      message: "请上传不超过 5 MiB 的 PNG、JPEG 或 WebP 图片",
    });
  try {
    const pipeline = sharp(file.data, { limitInputPixels: 16000000 });
    const meta = await pipeline.metadata();
    if (!meta.width || !meta.height || (meta.pages && meta.pages > 1))
      throw new Error("不支持动画卡背");
    const bytes = await pipeline
      .resize({
        width: 1200,
        height: 1800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
    if (bytes.length > 5 * 1024 * 1024) throw new Error("处理后的图片过大");
    const id = store.upload(user!.id, bytes);
    return { id, url: url(id) };
  } catch (e) {
    throw createError({
      statusCode: 400,
      message: (e as Error).message.includes("最多上传")
        ? (e as Error).message
        : "图片无效，或超过尺寸限制",
    });
  }
});
