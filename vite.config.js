import { defineConfig } from "vite";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

function mirrorIconsToRoot() {
  const src = resolve("public/icons");
  const dest = resolve("icons");
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
}

export default defineConfig({
  root: ".",
  publicDir: "public",
  server: {
    port: 8080,
    open: true,
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: "index.html",
    },
  },
  plugins: [
    {
      name: "mirror-icons",
      configureServer() {
        mirrorIconsToRoot();
      },
      buildStart() {
        mirrorIconsToRoot();
      },
    },
  ],
});
