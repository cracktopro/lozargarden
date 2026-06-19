/** Gestión de catálogos (plantas, plagas, enfermedades, estados) */

import * as db from "./db.js";
import { uid } from "./utils.js";

const CATALOG_MAP = {
  plantas: { store: "catalog_plantas", file: "plantas.txt", type: "plantas" },
  plagas: { store: "catalog_plagas", file: "plagas.txt", type: "line" },
  enfermedades: { store: "catalog_enfermedades", file: "enfermedades.txt", type: "line" },
  estados: { store: "catalog_estados", file: "estados.txt", type: "line" },
};

function parsePlantasLine(line) {
  const parts = line.split(";");
  if (parts.length < 3) return null;
  return {
    id: uid(),
    nombre: parts[0].trim(),
    nombreLatin: parts[1].trim(),
    toxicidadGatos: parts[2].trim(),
  };
}

function parseLineEntry(line) {
  const nombre = line.trim();
  if (!nombre) return null;
  return { id: uid(), nombre };
}

function parseFileContent(key, text) {
  const config = CATALOG_MAP[key];
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (config.type === "plantas") {
    return lines.map(parsePlantasLine).filter(Boolean);
  }
  return lines.map(parseLineEntry).filter(Boolean);
}

function serializePlantas(items) {
  return items
    .map((p) => `${p.nombre};${p.nombreLatin};${p.toxicidadGatos}`)
    .join("\n");
}

function serializeLines(items) {
  return items.map((i) => i.nombre).join("\n");
}

export async function initCatalogs() {
  const initialized = await db.getMeta("catalogs_initialized");
  if (initialized) return;

  for (const [key, config] of Object.entries(CATALOG_MAP)) {
    try {
      const res = await fetch(`./${config.file}`);
      if (!res.ok) throw new Error(`No se pudo cargar ${config.file}`);
      const text = await res.text();
      const items = parseFileContent(key, text);
      await db.putMany(config.store, items);
    } catch (err) {
      console.warn(`Catálogo ${key}:`, err);
      if (key === "estados") {
        const defaults = [
          "No germinada", "Germinando", "Plántula", "Crecimiento activo",
          "Floración", "Enferma", "Muerta",
        ].map((nombre) => ({ id: uid(), nombre }));
        await db.putMany(config.store, defaults);
      }
    }
  }

  await db.setMeta("catalogs_initialized", true);
}

export async function getCatalog(key) {
  const config = CATALOG_MAP[key];
  if (!config) throw new Error(`Catálogo desconocido: ${key}`);
  const items = await db.getAll(config.store);
  if (key === "plantas") {
    return items.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }
  return items.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function getCatalogItem(key, id) {
  const config = CATALOG_MAP[key];
  return db.getById(config.store, id);
}

export async function saveCatalogItem(key, item) {
  const config = CATALOG_MAP[key];
  if (!item.id) item.id = uid();
  await db.put(config.store, item);
  return item;
}

export async function deleteCatalogItem(key, id) {
  const config = CATALOG_MAP[key];
  await db.remove(config.store, id);
}

export async function replaceCatalog(key, items) {
  const config = CATALOG_MAP[key];
  await db.clearStore(config.store);
  await db.putMany(config.store, items);
}

export async function importCatalogFromText(key, text) {
  const items = parseFileContent(key, text);
  await replaceCatalog(key, items);
  return items.length;
}

export async function exportCatalogToText(key) {
  const items = await getCatalog(key);
  const config = CATALOG_MAP[key];
  if (config.type === "plantas") return serializePlantas(items);
  return serializeLines(items);
}

export function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function findPlantaById(id) {
  return getCatalogItem("plantas", id);
}

export async function findEstadoById(id) {
  return getCatalogItem("estados", id);
}

export async function findPlagaById(id) {
  return getCatalogItem("plagas", id);
}

export async function findEnfermedadById(id) {
  return getCatalogItem("enfermedades", id);
}

export { CATALOG_MAP };
