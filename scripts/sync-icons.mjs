import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "public", "icons");
const dest = resolve(root, "icons");

if (!existsSync(src)) {
  console.warn("[sync-icons] No existe public/icons — omitiendo.");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("[sync-icons] public/icons → icons/");
