import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  compatibilityDate: "2026-10-07",
  devtools: { enabled: false },
  runtimeConfig: {
    workflowDatabasePath: '.data/workflow.sqlite',
    workflowAuthOrigin: '',
    workflowAuthMode: 'local',
    legacyDatabaseUrl: '',
    workflowLegacySource: 'remote',
    catalogSource: 'assets',
    workflowAuthPublicOrigin: '',
    workflowLegacyIdentitySocket: '',
    workflowPublicOrigin: '',
    workflowLegacyOrigin: 'https://lycee-toolbox.top',
  },
  modules: ["shadcn-nuxt"],
  shadcn: { prefix: "Ui", componentDir: "./app/components/ui" },
  css: ["~/assets/css/main.css"],
  vite: { plugins: [tailwindcss()], worker: { format: "es" } },
  nitro: {
    serverAssets: [
      {
        baseName: "catalog",
        dir: fileURLToPath(new URL("./data", import.meta.url)),
      },
    ],
    compressPublicAssets: true,
  },
  app: {
    head: {
      htmlAttrs: { lang: "zh-CN" },
      title: "Lycee Overture · 卡查工具箱",
      meta: [
        {
          name: "description",
          content: "查询 Lycee Overture 中日文卡牌，构筑并保留你的本地卡组。",
        },
        { name: "robots", content: "noindex, nofollow" },
      ],
      link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    },
  },
  typescript: { strict: true },
});
