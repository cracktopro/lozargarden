/** Estados dinámicos de plantas — niveles, historial, barras de progreso y salud */

import { uid, todayDate, nowTime, formatDateTime, escapeHtml } from "./utils.js";
import { ICONS, iconImg } from "./icons.js";

export const PLANT_STATE_LEVELS = {
  1: "Inicio y Siembra",
  2: "Crecimiento y Establecimiento",
  3: "Floración y Fructificación",
  4: "Plenitud y Cosecha",
};

export const SPECIAL_STATE_LABELS = {
  reposoInvernal: "Reposo invernal",
  muerta: "Muerta",
};

export function defaultSpecialStates() {
  return { reposoInvernal: false, muerta: false };
}

export function resolveEstado(estadoId, estados) {
  return estados.find((e) => e.id === estadoId) || null;
}

function normalizeStateName(nombre) {
  return (nombre || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function getEstadoProgressIconSrc(estado) {
  if (!estado?.nivel) return null;
  const name = normalizeStateName(estado.nombre);
  if (estado.nivel === 4 && name === "cosecha") return ICONS.states.nivel4Cosecha;
  if (estado.nivel === 4 && name === "plenitud") return ICONS.states.nivel4Plenitud;
  if (estado.nivel === 1) return ICONS.states.nivel1;
  if (estado.nivel === 2) return ICONS.states.nivel2;
  if (estado.nivel === 3) return ICONS.states.nivel3;
  if (estado.nivel === 4) return ICONS.states.nivel4Plenitud;
  return null;
}

export function normalizePlantStates(plant, estados = []) {
  const specialStates = {
    ...defaultSpecialStates(),
    ...(plant.specialStates || {}),
  };

  let stateHistory = Array.isArray(plant.stateHistory) ? plant.stateHistory.filter((e) => e?.estadoId) : [];

  if (!stateHistory.length && plant.estadoId) {
    const legacyEstado = resolveEstado(plant.estadoId, estados);
    if (legacyEstado) {
      const createdDate = plant.createdAt?.slice(0, 10) || todayDate();
      const createdTime = plant.createdAt?.slice(11, 16) || nowTime();
      stateHistory = [
        {
          id: uid(),
          estadoId: plant.estadoId,
          fecha: createdDate,
          hora: createdTime,
          detalle: "",
        },
      ];
    }
  }

  let progressFromIndex = Number.isInteger(plant.progressFromIndex) ? plant.progressFromIndex : 0;
  if (progressFromIndex < 0) progressFromIndex = 0;
  if (progressFromIndex > stateHistory.length) progressFromIndex = stateHistory.length;

  return { specialStates, stateHistory, progressFromIndex };
}

export function getProgressHistory(plant, estados = []) {
  const { stateHistory, progressFromIndex } = normalizePlantStates(plant, estados);
  return stateHistory
    .slice(progressFromIndex)
    .filter((entry) => resolveEstado(entry.estadoId, estados));
}

export function resetProgressFromIndex(plant, estados = []) {
  const { stateHistory } = normalizePlantStates(plant, estados);
  return stateHistory.length;
}

export function isProgressBarReset(plant, estados = []) {
  const { stateHistory, progressFromIndex } = normalizePlantStates(plant, estados);
  return progressFromIndex >= stateHistory.length;
}

export function getCurrentStateEntry(plant, estados) {
  const progressHistory = getProgressHistory(plant, estados);
  if (!progressHistory.length) return null;
  const entry = progressHistory[progressHistory.length - 1];
  return { entry, estado: resolveEstado(entry.estadoId, estados) };
}

export function getCurrentNivel(plant, estados) {
  const current = getCurrentStateEntry(plant, estados);
  return current?.estado?.nivel || 0;
}

export function getAvailableEstados(plant, estados) {
  const { specialStates } = normalizePlantStates(plant, estados);
  if (specialStates.muerta) return [];

  const currentNivel = getCurrentNivel(plant, estados);
  if (!currentNivel) return estados.filter((e) => e.nivel === 1);

  return estados.filter((e) => e.nivel === currentNivel || e.nivel === currentNivel + 1);
}

export function canChangePlantState(plant, estados) {
  const { specialStates } = normalizePlantStates(plant, estados);
  if (specialStates.muerta) return false;
  return getAvailableEstados(plant, estados).length > 0;
}

export function validateStateSelection(plant, estadoId, estados) {
  const available = getAvailableEstados(plant, estados);
  const selected = available.find((e) => e.id === estadoId);
  if (!selected) {
    return { ok: false, message: "Selecciona un estado válido para el nivel actual de la planta" };
  }
  return { ok: true, estado: selected };
}

export function renderSpecialStateBadges(specialStates) {
  const badges = [];
  if (specialStates.reposoInvernal) {
    badges.push(`<span class="badge badge-kawaii badge-state-special">${escapeHtml(SPECIAL_STATE_LABELS.reposoInvernal)}</span>`);
  }
  if (specialStates.muerta) {
    badges.push(`<span class="badge badge-toxic badge-state-special">${escapeHtml(SPECIAL_STATE_LABELS.muerta)}</span>`);
  }
  return badges.length ? `<div class="d-flex flex-wrap gap-1 mb-2">${badges.join("")}</div>` : "";
}

export function renderPlantProgressBarHtml(plant, estados) {
  const progressHistory = getProgressHistory(plant, estados);
  const { stateHistory } = normalizePlantStates(plant, estados);

  if (!progressHistory.length) {
    if (!stateHistory.length) return "";
    return `
      <button type="button" class="btn btn-link btn-sm p-0 mb-2 plant-history-link" data-plant-state-history="${plant.id}">
        Ver historial (${stateHistory.length})
      </button>`;
  }

  const steps = progressHistory
    .map((entry, index) => {
      const estado = resolveEstado(entry.estadoId, estados);
      if (!estado) return "";
      const label = estado.nombre;
      const iconSrc = getEstadoProgressIconSrc(estado);
      if (!iconSrc) return "";
      const isLast = index === progressHistory.length - 1;
      const stepClass = isLast ? "is-current" : "is-done";

      return `
      <div class="plant-progress-step ${stepClass}">
        <div class="plant-progress-node">${iconImg(iconSrc, "plant-progress-icon", label)}</div>
        <span class="plant-progress-label">${escapeHtml(label)}</span>
      </div>
      ${!isLast ? `<div class="plant-progress-line is-done" aria-hidden="true"></div>` : ""}`;
    })
    .filter(Boolean)
    .join("");

  if (!steps) return "";

  return `
    <button type="button" class="plant-progress-track-btn w-100 border-0 bg-transparent p-0 mb-2" data-plant-state-history="${plant.id}" aria-label="Ver historial de estados">
      <div class="plant-progress-track">${steps}</div>
    </button>`;
}

export function renderPlantHealthBarHtml(plant, estados) {
  const nivel = getCurrentNivel(plant, estados);
  if (!nivel) return "";

  const filled = Math.min(nivel, 4);
  const levelLabel = PLANT_STATE_LEVELS[nivel];

  const segments = [1, 2, 3, 4]
    .map((i) => {
      const active = i <= filled;
      return `<div class="plant-health-segment${active ? ` is-active is-level-${nivel}` : ""}" aria-hidden="true"></div>`;
    })
    .join("");

  return `
    <div class="plant-health-wrap mb-2" aria-label="Salud visual: ${escapeHtml(levelLabel)}">
      <div class="plant-health-bar">${segments}</div>
      <div class="small text-muted plant-health-caption">Nivel ${nivel} · ${escapeHtml(levelLabel)}</div>
    </div>`;
}

export function renderStateHistoryModalBody(plant, estados) {
  const { stateHistory, specialStates } = normalizePlantStates(plant, estados);

  const historyHtml = stateHistory.length
    ? stateHistory
        .slice()
        .reverse()
        .map((entry) => {
          const estado = resolveEstado(entry.estadoId, estados);
          if (!estado) return "";
          const nivel = `Nivel ${estado.nivel}`;
          return `
            <div class="plant-history-item">
              <div class="d-flex flex-wrap justify-content-between gap-2 mb-1">
                <strong>${escapeHtml(estado.nombre)}</strong>
                <span class="small text-muted">${escapeHtml(formatDateTime(entry.fecha, entry.hora))}</span>
              </div>
              <div class="small text-muted mb-1">${escapeHtml(nivel)} · ${escapeHtml(PLANT_STATE_LEVELS[estado.nivel] || "")}</div>
              ${entry.detalle ? `<p class="small mb-0">${escapeHtml(entry.detalle)}</p>` : ""}
            </div>`;
        })
        .filter(Boolean)
        .join("")
    : `<p class="text-muted mb-0">Todavía no hay cambios de estado registrados.</p>`;

  const specialHtml = renderSpecialStateBadges(specialStates);

  return `
    ${specialHtml}
    <div class="d-flex flex-column gap-1">${historyHtml}</div>`;
}

export function groupEstadosByLevel(estados) {
  const grouped = { 1: [], 2: [], 3: [], 4: [] };
  for (const estado of estados) {
    if (grouped[estado.nivel]) grouped[estado.nivel].push(estado);
  }
  return grouped;
}
