// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

const SITE = "https://sachncs.github.io";

export default defineConfig({
  site: SITE,
  base: "/agent-passport",
  output: "static",
  trailingSlash: "ignore",
  build: {
    inlineStylesheets: "auto",
    assets: "_assets",
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: "hover",
  },
  integrations: [sitemap()],
  vite: {
    plugins: [/** @type {any} */ (tailwindcss())],
    resolve: {
      alias: {
        "@": new URL("./src", import.meta.url).pathname,
      },
    },
    build: {
      cssMinify: "lightningcss",
    },
  },
});
