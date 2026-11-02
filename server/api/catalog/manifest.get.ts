export default defineEventHandler(
  async () => await useStorage("assets:catalog").getItem("manifest.json"),
);
