/** Utilidades compartidas */

import { iconPath } from "./icons.js";

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

export function isToxicForCats(toxicidad) {
  if (!toxicidad) return false;
  const t = toxicidad.toLowerCase().trim();
  return t === "tóxico" || (t.includes("tóxico") && !t.startsWith("no"));
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
