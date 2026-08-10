import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const buildId =
  process.env.GITHUB_SHA?.slice(0, 12) ??
  new Date().toISOString().replace(/\D/g, "").slice(0, 17);

export default defineConfig({
  base: "./",
  define: {
    __NARU_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    {
      name: "narucare-release-manifest",
      apply: "build",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "release.json",
          source: `${JSON.stringify({ buildId })}\n`,
        });
      },
    },
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
