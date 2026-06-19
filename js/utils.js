/** Utilidades compartidas */

import { iconPath, iconImg } from "./icons.js";

export function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowISO() {
  return new Date().toISOString();
}

export function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatDate(isoDate) {
  if (!isoDate) return "—";
  try {
    const [y, m, d] = isoDate.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

export function formatDateTime(isoDate, time) {
  const datePart = formatDate(isoDate);
  return time ? `${datePart} · ${time}` : datePart;
}

export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function getTreatmentPlantIds(treatment) {
  if (!treatment) return [];
  if (Array.isArray(treatment.plantIds) && treatment.plantIds.length) return treatment.plantIds;
  if (treatment.plantId) return [treatment.plantId];
  return [];
}

export function formatCapacityDisplay(capacidad) {
  if (!capacidad) return "";
  const text = capacidad.trim();
  if (/l\b|litro/i.test(text)) return text;
  const match = text.match(/^(\d+(?:[.,]\d+)?)/);
  if (!match) return text;
  const rest = text.slice(match[0].length).trim();
  return rest ? `${match[1]} L ${rest}` : `${match[1]} L`;
}

export function isToxicForCats(toxicidad) {
  if (!toxicidad) return false;
  const t = toxicidad.toLowerCase().trim();
  if (t === "seguro" || t === "no tóxico") return false;
  return t === "tóxico" || (t.includes("tóxico") && !t.startsWith("no"));
}

export function formatToxicityLabel(toxicidad) {
  if (!toxicidad) return "";
  return isToxicForCats(toxicidad) ? "Tóxico" : "Seguro";
}

export function renderToxicityBadge(toxicidad) {
  if (!toxicidad) return "";
  const toxic = isToxicForCats(toxicidad);
  const badgeClass = toxic ? "badge-toxic" : "badge-safe";
  const icon = iconPath(toxic ? "toxico.png" : "gato.png");
  const label = formatToxicityLabel(toxicidad);
  return `<span class="badge badge-toxicity ${badgeClass}">${iconImg(icon, "toxicity-icon", label)} ${escapeHtml(label)}</span>`;
}

const CONTAINER_ICON = iconPath("macetas.png");

export const CONTAINER_TYPES = [
  { id: "maceta", label: "Maceta", icon: CONTAINER_ICON },
  { id: "jardinera", label: "Jardinera", icon: CONTAINER_ICON },
  { id: "semillero", label: "Semillero", icon: CONTAINER_ICON },
];

export const NAV_ITEMS = [
  { id: "dashboard", label: "Inicio" },
  { id: "plants", label: "Mis plantas" },
  { id: "diary", label: "Diario" },
  { id: "containers", label: "Macetas" },
  { id: "treatments", label: "Tratamientos" },
  { id: "catalog", label: "Catálogos" },
];
