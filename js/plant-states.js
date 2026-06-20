/** Estados dinámicos de plantas — niveles, historial, barras de progreso y salud */

import { uid, todayDate, nowTime, formatDateTime, escapeHtml } from "./utils.js";

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

export function normalizePlantStates(plant, estados = []) {
  const specialStates = {
    ...defaultSpecialStates(),
    ...(plant.specialStates || {}),
  };

  let stateHistory = Array.isArray(plant.stateHistory) ? plant.stateHistory.filter((e) => e?.estadoId) : [];

  if (!stateHistory.length && plant.estadoId) {
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

  let progressFromIndex = Number.isInteger(plant.progressFromIndex) ? plant.progressFromIndex : 0;
  if (progressFromIndex < 0) progressFromIndex = 0;
  if (progressFromIndex > stateHistory.length) progressFromIndex = stateHistory.length;

  return { specialStates, stateHistory, progressFromIndex };
}

export function getProgressHistory(plant, estados = []) {
  const { stateHistory, progressFromIndex } = normalizePlantStates(plant, estados);
  return stateHistory.slice(progressFromIndex);
}

export function resetProgressFromIndex(plant, estados = []) {
  const { stateHistory } = normalizePlantStates(plant, estados);
  return stateHistory.length;
}

export function isProgressBarReset(plant, estados = []) {
  const { stateHistory, progressFromIndex } = normalizePlantStates(plant, estados);
  return progressFromIndex >= stateHistory.length;
}

export function resolveEstado(estadoId, estados) {
  return estados.find((e) => e.id === estadoId) || null;
}

export function getCurrentStateEntry(plant, estados) {
  const { stateHistory } = normalizePlantStates(plant, estados);
  if (!stateHistory.length) return null;
  const entry = stateHistory[stateHistory.length - 1];
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

export function buildInitialStateHistory(estadoId, fecha = todayDate(), hora = nowTime()) {
  return [
    {
      id: uid(),
      estadoId,
      fecha,
      hora,
      detalle: "",
    },
  ];
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
  const { stateHistory } = normalizePlantStates(plant, estados);
  const progressHistory = getProgressHistory(plant, estados);

  if (!progressHistory.length) {
    const msg = stateHistory.length
      ? "Barra reiniciada. Añade un nuevo estado para iniciar un ciclo."
      : "Sin estados registrados. Usa «Cambiar estado» para empezar el seguimiento.";
    return `
      <button type="button" class="plant-progress-track-btn w-100 border-0 bg-transparent p-0 mb-2" data-plant-state-history="${plant.id}" aria-label="Ver historial de estados">
        <div class="plant-progress-empty small text-muted">${msg}</div>
      </button>`;
  }

  const steps = progressHistory.map((entry, index) => {
    const estado = resolveEstado(entry.estadoId, estados);
    const label = estado?.nombre || "Estado desconocido";
    const isLast = index === progressHistory.length - 1;
    const stepClass = isLast ? "is-current" : "is-done";
    const icon = isLast ? "bi-circle-fill" : "bi-check-lg";

    return `
      <div class="plant-progress-step ${stepClass}">
        <div class="plant-progress-node" aria-hidden="true"><i class="bi ${icon}"></i></div>
        <span class="plant-progress-label">${escapeHtml(label)}</span>
      </div>
      ${!isLast ? `<div class="plant-progress-line is-done" aria-hidden="true"></div>` : ""}`;
  }).join("");

  return `
    <button type="button" class="plant-progress-track-btn w-100 border-0 bg-transparent p-0 mb-2" data-plant-state-history="${plant.id}" aria-label="Ver historial de estados">
      <div class="plant-progress-track">${steps}</div>
    </button>`;
}

export function renderPlantHealthBarHtml(plant, estados) {
  const nivel = getCurrentNivel(plant, estados);
  const filled = Math.min(Math.max(nivel, 0), 4);
  const levelLabel = nivel ? PLANT_STATE_LEVELS[nivel] : "Sin nivel";

  const segments = [1, 2, 3, 4]
    .map((i) => {
      const active = i <= filled && nivel > 0;
      return `<div class="plant-health-segment${active ? ` is-active is-level-${nivel}` : ""}" aria-hidden="true"></div>`;
    })
    .join("");

  return `
    <div class="plant-health-wrap mb-2" aria-label="Salud visual: ${escapeHtml(levelLabel)}">
      <div class="plant-health-bar">${segments}</div>
      <div class="small text-muted plant-health-caption">${nivel ? `Nivel ${nivel} · ${escapeHtml(levelLabel)}` : "Sin estado de salud"}</div>
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
          const nivel = estado?.nivel ? `Nivel ${estado.nivel}` : "";
          return `
            <div class="plant-history-item">
              <div class="d-flex flex-wrap justify-content-between gap-2 mb-1">
                <strong>${escapeHtml(estado?.nombre || "Estado desconocido")}</strong>
                <span class="small text-muted">${escapeHtml(formatDateTime(entry.fecha, entry.hora))}</span>
              </div>
              ${nivel ? `<div class="small text-muted mb-1">${escapeHtml(nivel)}${estado?.nivel ? ` · ${escapeHtml(PLANT_STATE_LEVELS[estado.nivel] || "")}` : ""}</div>` : ""}
              ${entry.detalle ? `<p class="small mb-0">${escapeHtml(entry.detalle)}</p>` : ""}
            </div>`;
        })
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
