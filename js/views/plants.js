import * as db from "../db.js";
import * as catalog from "../catalog.js";
import { uid, nowISO, todayDate, nowTime, escapeHtml, debounce, renderToxicityBadge, formatDateTime, getTreatmentPlantIds } from "../utils.js";
import {
  normalizePlantStates,
  getAvailableEstados,
  validateStateSelection,
  defaultSpecialStates,
  getCurrentStateEntry,
  canChangePlantState,
  resetProgressFromIndex,
  isProgressBarReset,
  syncPlantEstadoId,
  getStateHistoryEntry,
  removeStateHistoryEntry,
  validateEstadoCatalogSelection,
  resolveEstado,
  renderSpecialStateBadges,
  renderPlantProgressBarHtml,
  renderPlantHealthBarHtml,
  renderStateHistoryModalBody,
  PLANT_STATE_LEVELS,
} from "../plant-states.js";
import {
  pageHeader, emptyState, searchInput, showModal, hideModal,
  showToast, confirmDialog, renderPhotoUploadHtml,
  renderSearchablePickerHtml, bindSearchablePicker, getSearchablePickerValues,
  bindPhotoUpload, encodePhotoGallery, bindPhotoGalleryClicks,
} from "../ui.js";
import { ICONS, iconImg } from "../icons.js";

let pendingPhotos = [];

async function loadPlantPhotos(plantId) {
  return db.getPhotosByOwner("plant", plantId);
}

async function getPlantCardData(plant) {
  const [planta, estados, container, photos, plagas, enfermedades] = await Promise.all([
    catalog.findPlantaById(plant.catalogPlantId),
    catalog.getCatalog("estados"),
    plant.containerId ? db.getById("containers", plant.containerId) : null,
    loadPlantPhotos(plant.id),
    catalog.getCatalog("plagas"),
    catalog.getCatalog("enfermedades"),
  ]);
  return { planta, estados, container, photos, plagas, enfermedades };
}

function countPlantTreatments(plantId, allTreatments) {
  return allTreatments.filter((t) => getTreatmentPlantIds(t).includes(plantId)).length;
}

function getPlantTreatments(plantId, allTreatments) {
  return allTreatments
    .filter((t) => getTreatmentPlantIds(t).includes(plantId))
    .sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`));
}

async function openIncidencesModal(plant) {
  const [plagas, enfermedades] = await Promise.all([
    catalog.getCatalog("plagas"),
    catalog.getCatalog("enfermedades"),
  ]);
  const plagaNames = (plant.plagaIds || [])
    .map((id) => {
      const item = plagas.find((p) => p.id === id);
      return item ? catalog.formatPlagaLabel(item) : null;
    })
    .filter(Boolean);
  const enfermedadNames = (plant.enfermedadIds || [])
    .map((id) => {
      const item = enfermedades.find((e) => e.id === id);
      return item ? catalog.formatEnfermedadLabel(item) : null;
    })
    .filter(Boolean);

  const body = `
    <div class="row g-3">
      <div class="col-md-6">
        <h3 class="h6 fw-bold text-danger"><i class="bi bi-bug"></i> Plagas</h3>
        ${
          plagaNames.length
            ? `<ul class="mb-0 ps-3">${plagaNames.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
            : `<p class="text-muted small mb-0">Sin plagas registradas</p>`
        }
      </div>
      <div class="col-md-6">
        <h3 class="h6 fw-bold text-danger"><i class="bi bi-virus"></i> Enfermedades</h3>
        ${
          enfermedadNames.length
            ? `<ul class="mb-0 ps-3">${enfermedadNames.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
            : `<p class="text-muted small mb-0">Sin enfermedades registradas</p>`
        }
      </div>
    </div>`;

  showModal("Incidencias de la planta", body, `<button type="button" class="btn btn-kawaii-outline" data-bs-dismiss="modal">Cerrar</button>`);
}

async function openPlantTreatmentsModal(plant, allTreatments) {
  const { planta } = await getPlantCardData(plant);
  const displayName = plant.apodo || planta?.nombre || "Planta";
  const items = getPlantTreatments(plant.id, allTreatments);

  const body = items.length
    ? `<div class="d-flex flex-column gap-3">${items
        .map(
          (t) => `
        <div class="plant-history-item">
          <div class="small text-muted mb-1">${escapeHtml(formatDateTime(t.fecha, t.hora))}</div>
          ${t.producto ? `<div class="small fw-semibold mb-1"><i class="bi bi-droplet"></i> ${escapeHtml(t.producto)}</div>` : ""}
          <p class="mb-0">${escapeHtml(t.detalle)}</p>
        </div>`
        )
        .join("")}</div>`
    : `<p class="text-muted mb-0">Esta planta aún no tiene tratamientos registrados.</p>`;

  showModal(
    `Tratamientos — ${displayName}`,
    body,
    `<button type="button" class="btn btn-kawaii-outline" data-bs-dismiss="modal">Cerrar</button>`
  );
  document.getElementById("appModalLabel").innerHTML = `
    <span class="d-inline-flex align-items-center gap-2">
      ${iconImg(ICONS.page.treatments, "modal-title-icon", "")}
      <span>Tratamientos — ${escapeHtml(displayName)}</span>
    </span>`;
}

function plantFormHtml(plant = null, catalogPlantas, plagas, enfermedades, containers) {
  const p = plant || {
    apodo: "",
    catalogPlantId: "",
    containerId: "",
    plagaIds: [],
    enfermedadIds: [],
    notas: "",
  };

  return `
    <form id="plant-form">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label" for="plant-apodo">Apodo (opcional)</label>
          <input type="text" class="form-control" id="plant-apodo" value="${escapeHtml(p.apodo)}" placeholder="Mi tomate favorito">
        </div>
        <div class="col-md-6">
          <label class="form-label">Especie *</label>
          ${renderSearchablePickerHtml({
            id: "plant-catalog-picker",
            items: catalogPlantas,
            selectedIds: p.catalogPlantId ? [p.catalogPlantId] : [],
            singleSelect: true,
            searchPlaceholder: "Buscar especie...",
          })}
        </div>
        <div class="col-md-6">
          <label class="form-label" for="plant-container">Contenedor</label>
          <select class="form-select" id="plant-container">
            <option value="">— Sin asignar —</option>
            ${containers.map((c) => `<option value="${c.id}" ${p.containerId === c.id ? "selected" : ""}>${escapeHtml(c.nombre)} (${escapeHtml(c.tipo)})</option>`).join("")}
          </select>
        </div>
        <div class="col-md-6">
          <p class="form-label mb-1">Estado de la planta</p>
          <p class="small text-muted mb-0">Gestiona el progreso con el botón «Cambiar estado» en la tarjeta de la planta.</p>
        </div>
        <div class="col-md-6">
          <label class="form-label">Plagas</label>
          ${renderSearchablePickerHtml({
            id: "plant-plagas-picker",
            items: plagas.map((p) => ({
              id: p.id,
              nombre: catalog.formatPlagaLabel(p),
            })),
            selectedIds: p.plagaIds || [],
            searchPlaceholder: "Buscar plaga...",
          })}
        </div>
        <div class="col-md-6">
          <label class="form-label">Enfermedades</label>
          ${renderSearchablePickerHtml({
            id: "plant-enfermedades-picker",
            items: enfermedades.map((e) => ({
              id: e.id,
              nombre: catalog.formatEnfermedadLabel(e),
            })),
            selectedIds: p.enfermedadIds || [],
            searchPlaceholder: "Buscar enfermedad...",
          })}
        </div>
        <div class="col-12">
          <label class="form-label" for="plant-notas">Notas</label>
          <textarea class="form-control" id="plant-notas" rows="2">${escapeHtml(p.notas)}</textarea>
        </div>
        <div class="col-12">
          <label class="form-label">Fotos</label>
          ${renderPhotoUploadHtml("plant-photo-input")}
        </div>
      </div>
    </form>`;
}

function bindPlantForm(plantId = null) {
  pendingPhotos = [];
  return bindPhotoUpload("plant-photo-input", {
    ownerType: "plant",
    ownerId: plantId,
    getPhotos: () => pendingPhotos,
    setPhotos: (photos) => {
      pendingPhotos = photos;
    },
  });
}

async function openChangeStateModal(plant) {
  const estados = await catalog.getCatalog("estados");
  const { specialStates } = normalizePlantStates(plant, estados);
  const available = getAvailableEstados(plant, estados);
  const current = getCurrentStateEntry(plant, estados);

  if (!available.length) {
    showToast(
      specialStates.muerta
        ? "La planta está marcada como muerta. Desactiva ese sub-estado para registrar cambios."
        : "No hay estados disponibles para esta planta",
      "error"
    );
    return;
  }

  const pickerItems = available.map((e) => ({
    id: e.id,
    nombre: `Nivel ${e.nivel} · ${e.nombre} (${PLANT_STATE_LEVELS[e.nivel]})`,
  }));

  showModal(
    "Cambiar estado",
    `
      <form id="plant-change-state-form">
        <p class="small text-muted mb-3">
          ${current?.estado
            ? `Estado actual: <strong>${escapeHtml(current.estado.nombre)}</strong> (Nivel ${current.estado.nivel})`
            : "Registra el primer estado de la planta."}
        </p>
        <div class="mb-3">
          <label class="form-label">Nuevo estado *</label>
          ${renderSearchablePickerHtml({
            id: "plant-state-picker",
            items: pickerItems,
            selectedIds: [],
            singleSelect: true,
            searchPlaceholder: "Buscar estado...",
          })}
          <small class="text-muted">En nivel 1 avanza al siguiente; desde nivel 2 también puedes volver a estados anteriores.</small>
        </div>
        <div class="row g-3 mb-3">
          <div class="col-md-6">
            <label class="form-label" for="plant-state-fecha">Fecha *</label>
            <input type="date" class="form-control" id="plant-state-fecha" value="${todayDate()}" required>
          </div>
          <div class="col-md-6">
            <label class="form-label" for="plant-state-hora">Hora *</label>
            <input type="time" class="form-control" id="plant-state-hora" value="${nowTime()}" required>
          </div>
        </div>
        <div class="mb-3">
          <label class="form-label" for="plant-state-detalle">Detalle (opcional)</label>
          <textarea class="form-control" id="plant-state-detalle" rows="3" placeholder="Observaciones sobre el cambio de estado..."></textarea>
        </div>
        <div class="mb-2">
          <p class="form-label mb-2">Sub-estados especiales</p>
          <div class="d-flex flex-column gap-2" id="plant-special-states">
            <label class="kawaii-check-item${specialStates.reposoInvernal ? " is-selected" : ""}">
              <input type="checkbox" id="plant-state-reposo" ${specialStates.reposoInvernal ? "checked" : ""}>
              <span class="kawaii-check-mark" aria-hidden="true"></span>
              <span class="kawaii-check-label">Reposo invernal</span>
            </label>
            <label class="kawaii-check-item${specialStates.muerta ? " is-selected" : ""}">
              <input type="checkbox" id="plant-state-muerta" ${specialStates.muerta ? "checked" : ""}>
              <span class="kawaii-check-mark" aria-hidden="true"></span>
              <span class="kawaii-check-label">Muerta</span>
            </label>
          </div>
        </div>
      </form>`,
    `
      <div class="d-flex flex-wrap gap-2 w-100 justify-content-between align-items-center">
        <button type="button" class="btn btn-kawaii-outline btn-sm" id="reset-plant-progress-btn">Reiniciar barra</button>
        <div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn btn-kawaii-outline" data-bs-dismiss="modal">Cancelar</button>
          <button type="button" class="btn btn-kawaii" id="save-plant-state-btn">Guardar cambio</button>
        </div>
      </div>
    `
  );

  bindSearchablePicker("plant-state-picker");

  document.querySelectorAll("#plant-special-states input[type='checkbox']").forEach((input) => {
    input.addEventListener("change", () => {
      input.closest(".kawaii-check-item")?.classList.toggle("is-selected", input.checked);
    });
  });

  document.getElementById("reset-plant-progress-btn").addEventListener("click", () => {
    if (isProgressBarReset(plant, estados)) {
      showToast("La barra de progreso ya está reiniciada", "info");
      return;
    }
    confirmDialog(
      "Reiniciar barra de progreso",
      "La barra quedará vacía para un nuevo ciclo. El historial completo se conservará al pulsar sobre ella.",
      async () => {
        const normalized = normalizePlantStates(plant, estados);
        await db.put("plants", {
          ...plant,
          ...normalized,
          progressFromIndex: resetProgressFromIndex(plant, estados),
          estadoId: null,
          updatedAt: nowISO(),
        });
        hideModal();
        showToast("Barra de progreso reiniciada");
        document.dispatchEvent(new CustomEvent("view-refresh"));
      }
    );
  });

  document.getElementById("save-plant-state-btn").addEventListener("click", async () => {
    const saveBtn = document.getElementById("save-plant-state-btn");
    const estadoId = getSearchablePickerValues("plant-state-picker")[0] || "";
    const fecha = document.getElementById("plant-state-fecha").value;
    const hora = document.getElementById("plant-state-hora").value;
    const detalle = document.getElementById("plant-state-detalle").value.trim();
    const validation = validateStateSelection(plant, estadoId, estados);

    if (!estadoId || !fecha || !hora) {
      showToast("Selecciona un estado y completa fecha y hora", "error");
      return;
    }
    if (!validation.ok) {
      showToast(validation.message, "error");
      return;
    }

    const { stateHistory, progressFromIndex } = normalizePlantStates(plant, estados);
    const newSpecialStates = {
      reposoInvernal: document.getElementById("plant-state-reposo").checked,
      muerta: document.getElementById("plant-state-muerta").checked,
    };

    saveBtn.disabled = true;
    try {
      await db.put("plants", {
        ...plant,
        stateHistory: [
          ...stateHistory,
          { id: uid(), estadoId, fecha, hora, detalle },
        ],
        progressFromIndex,
        specialStates: newSpecialStates,
        estadoId,
        updatedAt: nowISO(),
      });
      hideModal();
      showToast("Estado actualizado");
      document.dispatchEvent(new CustomEvent("view-refresh"));
    } catch (err) {
      showToast(err.message || "Error al guardar el estado", "error");
    } finally {
      saveBtn.disabled = false;
    }
  });
}

async function openEditStateEntryModal(plant, entryId, estados) {
  const entry = getStateHistoryEntry(plant, entryId, estados);
  if (!entry) {
    showToast("Entrada no encontrada", "error");
    return;
  }

  const pickerItems = estados.map((e) => ({
    id: e.id,
    nombre: `Nivel ${e.nivel} · ${e.nombre} (${PLANT_STATE_LEVELS[e.nivel]})`,
  }));

  showModal(
    "Editar entrada de estado",
    `
      <form id="plant-edit-state-form">
        <div class="mb-3">
          <label class="form-label">Estado *</label>
          ${renderSearchablePickerHtml({
            id: "plant-edit-state-picker",
            items: pickerItems,
            selectedIds: [entry.estadoId],
            singleSelect: true,
            searchPlaceholder: "Buscar estado...",
          })}
        </div>
        <div class="row g-3 mb-3">
          <div class="col-md-6">
            <label class="form-label" for="plant-edit-state-fecha">Fecha *</label>
            <input type="date" class="form-control" id="plant-edit-state-fecha" value="${escapeHtml(entry.fecha)}" required>
          </div>
          <div class="col-md-6">
            <label class="form-label" for="plant-edit-state-hora">Hora *</label>
            <input type="time" class="form-control" id="plant-edit-state-hora" value="${escapeHtml(entry.hora)}" required>
          </div>
        </div>
        <div class="mb-0">
          <label class="form-label" for="plant-edit-state-detalle">Detalle (opcional)</label>
          <textarea class="form-control" id="plant-edit-state-detalle" rows="3" placeholder="Observaciones...">${escapeHtml(entry.detalle || "")}</textarea>
        </div>
      </form>`,
    `
      <div class="d-flex flex-wrap gap-2 w-100 justify-content-between align-items-center">
        <button type="button" class="btn btn-kawaii-outline btn-kawaii-danger-outline" id="delete-edit-state-entry-btn">
          <i class="bi bi-trash me-1" aria-hidden="true"></i>Eliminar entrada
        </button>
        <div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn btn-kawaii-outline" id="cancel-edit-state-entry-btn">Volver al historial</button>
          <button type="button" class="btn btn-kawaii" id="save-edit-state-entry-btn">Guardar</button>
        </div>
      </div>
    `
  );

  bindSearchablePicker("plant-edit-state-picker");

  document.getElementById("cancel-edit-state-entry-btn").addEventListener("click", () => {
    openStateHistoryModal(plant);
  });

  document.getElementById("delete-edit-state-entry-btn").addEventListener("click", () => {
    const estado = resolveEstado(entry.estadoId, estados);
    const label = estado?.nombre || "esta entrada";
    confirmDialog(
      "Eliminar entrada",
      `¿Eliminar «${label}» del historial? Se actualizarán la barra de progreso y la salud.`,
      async () => {
        const normalized = normalizePlantStates(plant, estados);
        const removed = removeStateHistoryEntry(normalized.stateHistory, normalized.progressFromIndex, entryId);
        if (!removed) {
          showToast("Entrada no encontrada", "error");
          return;
        }

        const updated = {
          ...plant,
          ...normalized,
          ...removed,
          estadoId: syncPlantEstadoId({ ...plant, ...normalized, ...removed }, estados),
          updatedAt: nowISO(),
        };
        await db.put("plants", updated);
        showToast("Entrada eliminada");
        document.dispatchEvent(new CustomEvent("view-refresh"));

        if (removed.stateHistory.length) {
          openStateHistoryModal(updated);
        } else {
          hideModal();
        }
      }
    );
  });

  document.getElementById("save-edit-state-entry-btn").addEventListener("click", async () => {
    const saveBtn = document.getElementById("save-edit-state-entry-btn");
    const estadoId = getSearchablePickerValues("plant-edit-state-picker")[0] || "";
    const fecha = document.getElementById("plant-edit-state-fecha").value;
    const hora = document.getElementById("plant-edit-state-hora").value;
    const detalle = document.getElementById("plant-edit-state-detalle").value.trim();
    const validation = validateEstadoCatalogSelection(estadoId, estados);

    if (!estadoId || !fecha || !hora) {
      showToast("Completa estado, fecha y hora", "error");
      return;
    }
    if (!validation.ok) {
      showToast(validation.message, "error");
      return;
    }

    const normalized = normalizePlantStates(plant, estados);
    const idx = normalized.stateHistory.findIndex((e) => e.id === entryId);
    if (idx === -1) {
      showToast("Entrada no encontrada", "error");
      return;
    }

    const stateHistory = normalized.stateHistory.map((e, i) =>
      i === idx ? { ...e, estadoId, fecha, hora, detalle } : e
    );

    saveBtn.disabled = true;
    try {
      const updated = {
        ...plant,
        ...normalized,
        stateHistory,
        estadoId: syncPlantEstadoId({ ...plant, ...normalized, stateHistory }, estados),
        updatedAt: nowISO(),
      };
      await db.put("plants", updated);
      showToast("Entrada actualizada");
      document.dispatchEvent(new CustomEvent("view-refresh"));
      openStateHistoryModal(updated);
    } catch (err) {
      showToast(err.message || "Error al guardar la entrada", "error");
    } finally {
      saveBtn.disabled = false;
    }
  });
}

async function openStateHistoryModal(plant) {
  const [estados, cardData] = await Promise.all([
    catalog.getCatalog("estados"),
    getPlantCardData(plant),
  ]);
  const displayName = plant.apodo || cardData.planta?.nombre || "Planta";
  const { stateHistory } = normalizePlantStates(plant, estados);

  showModal(
    `Historial de estados — ${displayName}`,
    renderStateHistoryModalBody(plant, estados),
    `
      <div class="d-flex flex-wrap gap-2 w-100 justify-content-between align-items-center">
        <button type="button" class="btn btn-kawaii btn-kawaii-danger btn-sm" id="delete-plant-state-history-btn" ${stateHistory.length ? "" : "disabled"}>
          <i class="bi bi-trash me-1" aria-hidden="true"></i>Borrar historial
        </button>
        <button type="button" class="btn btn-kawaii-outline" data-bs-dismiss="modal">Cerrar</button>
      </div>
    `
  );
  document.getElementById("appModalLabel").innerHTML = `
    <span class="d-inline-flex align-items-center gap-2">
      ${iconImg(ICONS.catalog.estados, "modal-title-icon", "")}
      <span>Historial — ${escapeHtml(displayName)}</span>
    </span>`;

  document.getElementById("delete-plant-state-history-btn")?.addEventListener("click", () => {
    if (!stateHistory.length) return;
    confirmDialog(
      "Borrar historial de estados",
      "Se eliminarán todos los registros de cambios de estado. La barra de progreso y la salud quedarán vacías.",
      async () => {
        await db.put("plants", {
          ...plant,
          stateHistory: [],
          progressFromIndex: 0,
          estadoId: null,
          updatedAt: nowISO(),
        });
        hideModal();
        showToast("Historial eliminado");
        document.dispatchEvent(new CustomEvent("view-refresh"));
      }
    );
  });

  document.getElementById("appModalBody")?.querySelectorAll("[data-edit-state-entry]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openEditStateEntryModal(plant, btn.dataset.editStateEntry, estados);
    });
  });
}

async function openPlantModal(plant = null) {
  const [catalogPlantas, estados, plagas, enfermedades, containers] = await Promise.all([
    catalog.getCatalog("plantas"),
    catalog.getCatalog("estados"),
    catalog.getCatalog("plagas"),
    catalog.getCatalog("enfermedades"),
    db.getAll("containers"),
  ]);

  showModal(
    plant ? "✏️ Editar planta" : "🌱 Nueva planta",
    plantFormHtml(plant, catalogPlantas, plagas, enfermedades, containers),
    `
      <button type="button" class="btn btn-kawaii-outline" data-bs-dismiss="modal">Cancelar</button>
      <button type="button" class="btn btn-kawaii" id="save-plant-btn">Guardar</button>
    `
  );

  bindSearchablePicker("plant-catalog-picker");
  bindSearchablePicker("plant-plagas-picker");
  bindSearchablePicker("plant-enfermedades-picker");

  const photoUpload = bindPlantForm(plant?.id);

  if (plant) {
    pendingPhotos = await loadPlantPhotos(plant.id);
    photoUpload.refresh();
  }

  document.getElementById("save-plant-btn").addEventListener("click", async () => {
    const saveBtn = document.getElementById("save-plant-btn");
    const catalogPlantId = getSearchablePickerValues("plant-catalog-picker")[0] || "";
    if (!catalogPlantId) {
      showToast("Completa los campos obligatorios", "error");
      return;
    }

    const { stateHistory, specialStates, progressFromIndex } = plant
      ? normalizePlantStates(plant, estados)
      : {
          stateHistory: [],
          specialStates: defaultSpecialStates(),
          progressFromIndex: 0,
        };
    const currentEstadoId = getCurrentStateEntry(
      { ...plant, stateHistory, progressFromIndex },
      estados
    )?.entry?.estadoId || null;

    const data = {
      id: plant?.id || uid(),
      apodo: document.getElementById("plant-apodo").value.trim(),
      catalogPlantId,
      containerId: document.getElementById("plant-container").value || null,
      plagaIds: getSearchablePickerValues("plant-plagas-picker"),
      enfermedadIds: getSearchablePickerValues("plant-enfermedades-picker"),
      notas: document.getElementById("plant-notas").value.trim(),
      stateHistory,
      progressFromIndex,
      specialStates,
      estadoId: currentEstadoId,
      createdAt: plant?.createdAt || nowISO(),
      updatedAt: nowISO(),
    };

    saveBtn.disabled = true;
    try {
      await db.put("plants", data);
      await db.syncPhotosByOwner("plant", data.id, pendingPhotos);

      hideModal();
      showToast(plant ? "Planta actualizada" : "Planta añadida al huerto");
      document.dispatchEvent(new CustomEvent("view-refresh"));
    } catch (err) {
      showToast(err.message || "Error al guardar la planta", "error");
    } finally {
      saveBtn.disabled = false;
    }
  });
}

async function buildPlantCardHtml(plant, allTreatments, { preview = false } = {}) {
  const { planta, estados, container, photos } = await getPlantCardData(plant);
  const { specialStates } = normalizePlantStates(plant, estados);
  const current = getCurrentStateEntry(plant, estados);
  const displayName = plant.apodo || planta?.nombre || "Planta sin nombre";
  const progressHtml = renderPlantProgressBarHtml(plant, estados);
  const healthHtml = renderPlantHealthBarHtml(plant, estados);
  const specialBadgesHtml = renderSpecialStateBadges(specialStates);
  const canChangeState = canChangePlantState(plant, estados);
  const imgHtml = photos.length
    ? `<button type="button" class="plant-card-photo-btn w-100 border-0 p-0 bg-transparent" data-photo-gallery="${encodePhotoGallery(photos)}" data-photo-start="0" data-photo-title="${escapeHtml(displayName)}" aria-label="Ver fotos de ${escapeHtml(displayName)}">
        <img src="${photos[0].dataUrl || photos[0].downloadUrl}" class="card-img-top plant-card-img" alt="">
        ${photos.length > 1 ? `<span class="plant-card-photo-count"><i class="bi bi-images"></i> ${photos.length}</span>` : ""}
      </button>`
    : `<div class="plant-card-placeholder">${iconImg(ICONS.page.plants, "plant-card-placeholder-icon", "")}</div>`;

  const incidenceCount = (plant.plagaIds?.length || 0) + (plant.enfermedadIds?.length || 0);
  const treatmentCount = countPlantTreatments(plant.id, allTreatments);

  const containerHtml = container
    ? `<button type="button" class="entity-link-btn small" data-preview-container="${container.id}" aria-label="Ver contenedor ${escapeHtml(container.nombre)}">
        <i class="bi bi-flower2"></i> ${escapeHtml(container.nombre)}
      </button>`
    : "";

  const footerHtml = preview
    ? ""
    : `
        <div class="card-footer bg-transparent border-0 d-flex flex-column gap-2 pb-3 px-3">
          <button class="btn btn-sm btn-kawaii w-100" data-change-plant-state="${plant.id}" ${canChangeState ? "" : "disabled"}>Cambiar estado</button>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-kawaii-outline flex-fill" data-edit-plant="${plant.id}">Editar</button>
            <button class="btn btn-sm btn-kawaii btn-kawaii-danger" data-delete-plant="${plant.id}" aria-label="Eliminar">🗑</button>
          </div>
        </div>`;

  const article = `
      <article class="kawaii-card h-100${preview ? " entity-preview-card" : ""}">
        ${imgHtml}
        <div class="card-body">
          <h3 class="h6 fw-bold mb-1">${escapeHtml(displayName)}</h3>
          ${planta ? `<p class="small text-muted mb-1 fst-italic">${escapeHtml(planta.nombreLatin)}</p>` : ""}
          ${specialBadgesHtml}
          ${progressHtml}
          ${healthHtml}
          ${current?.estado ? `<p class="small mb-2"><strong>Actual:</strong> ${escapeHtml(current.estado.nombre)}</p>` : ""}
          ${containerHtml}
          <div class="d-flex flex-wrap gap-2 mt-2">
            ${
              incidenceCount
                ? `<button type="button" class="badge badge-incidence border-0" data-plant-incidences="${plant.id}" aria-label="Ver incidencias">
                    <i class="bi bi-bug"></i> ${incidenceCount} incidencia(s)
                  </button>`
                : ""
            }
            ${
              treatmentCount
                ? `<button type="button" class="badge badge-treatment border-0" data-plant-treatments="${plant.id}" aria-label="Ver tratamientos">
                    ${iconImg(ICONS.page.treatments, "badge-treatment-icon", "")} ${treatmentCount} tratamiento(s)
                  </button>`
                : ""
            }
          </div>
          ${planta?.toxicidadGatos ? `<div class="small mt-2">${renderToxicityBadge(planta.toxicidadGatos)}</div>` : ""}
        </div>
        ${footerHtml}
      </article>`;

  return preview ? article : `<div class="col-sm-6 col-lg-4">${article}</div>`;
}

let plantPreviewAbort = null;

async function bindPlantCardInteractions(root, allTreatments, { preview = false } = {}) {
  if (preview) {
    plantPreviewAbort?.abort();
    plantPreviewAbort = new AbortController();
  }
  const signal = preview ? plantPreviewAbort.signal : undefined;

  bindPhotoGalleryClicks(root);

  root.querySelectorAll("[data-preview-container]").forEach((btn) => {
    btn.addEventListener(
      "click",
      async (e) => {
        e.preventDefault();
        if (btn.closest(".entity-preview-modal")) hideModal();
        const { openContainerPreviewModal } = await import("./containers.js");
        openContainerPreviewModal(btn.dataset.previewContainer);
      },
      signal ? { signal } : undefined
    );
  });

  root.querySelectorAll("[data-plant-incidences]").forEach((btn) => {
    btn.addEventListener(
      "click",
      async (e) => {
        e.preventDefault();
        const plant = await db.getById("plants", btn.dataset.plantIncidences);
        if (plant) openIncidencesModal(plant);
      },
      signal ? { signal } : undefined
    );
  });

  root.querySelectorAll("[data-plant-treatments]").forEach((btn) => {
    btn.addEventListener(
      "click",
      async (e) => {
        e.preventDefault();
        const plant = await db.getById("plants", btn.dataset.plantTreatments);
        if (plant) openPlantTreatmentsModal(plant, allTreatments);
      },
      signal ? { signal } : undefined
    );
  });

  root.querySelectorAll("[data-plant-state-history]").forEach((btn) => {
    btn.addEventListener(
      "click",
      async (e) => {
        e.preventDefault();
        const plant = await db.getById("plants", btn.dataset.plantStateHistory);
        if (plant) openStateHistoryModal(plant);
      },
      signal ? { signal } : undefined
    );
  });

  root.querySelectorAll("[data-change-plant-state]").forEach((btn) => {
    btn.addEventListener(
      "click",
      async (e) => {
        e.preventDefault();
        const plant = await db.getById("plants", btn.dataset.changePlantState);
        if (plant) openChangeStateModal(plant);
      },
      signal ? { signal } : undefined
    );
  });
}

export async function openPlantPreviewModal(plantId) {
  const [plant, allTreatments] = await Promise.all([
    db.getById("plants", plantId),
    db.getAll("treatments"),
  ]);
  if (!plant) {
    showToast("Planta no encontrada", "error");
    return;
  }

  const { planta } = await getPlantCardData(plant);
  const estados = await catalog.getCatalog("estados");
  const displayName = plant.apodo || planta?.nombre || "Planta";

  showModal(
    displayName,
    `<div class="entity-preview-modal">${await buildPlantCardHtml(plant, allTreatments, { preview: true })}</div>`,
    `
      <button type="button" class="btn btn-kawaii-outline" data-bs-dismiss="modal">Cerrar</button>
      <button type="button" class="btn btn-kawaii-outline" id="preview-change-plant-state-btn" ${canChangePlantState(plant, estados) ? "" : "disabled"}>Cambiar estado</button>
      <button type="button" class="btn btn-kawaii" id="preview-edit-plant-btn">Editar</button>
    `
  );
  document.getElementById("appModalLabel").innerHTML = `
    <span class="d-inline-flex align-items-center gap-2">
      ${iconImg(ICONS.page.plants, "modal-title-icon", "")}
      <span>${escapeHtml(displayName)}</span>
    </span>`;

  const body = document.getElementById("appModalBody");
  await bindPlantCardInteractions(body, allTreatments, { preview: true });

  document.getElementById("preview-edit-plant-btn").addEventListener("click", () => {
    hideModal();
    openPlantModal(plant);
  });

  document.getElementById("preview-change-plant-state-btn")?.addEventListener("click", () => {
    hideModal();
    openChangeStateModal(plant);
  });
}

async function renderPlantCard(plant, allTreatments) {
  return buildPlantCardHtml(plant, allTreatments);
}

export async function render() {
  const [plants, allTreatments] = await Promise.all([db.getAll("plants"), db.getAll("treatments")]);
  const sortedPlants = plants.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  const cardsHtml = sortedPlants.length
    ? `<div class="row g-3" id="plants-grid">${await Promise.all(sortedPlants.map((p) => renderPlantCard(p, allTreatments))).then((h) => h.join(""))}</div>`
    : emptyState(ICONS.page.plants, "Sin plantas registradas", "Añade tu primera planta del huerto");

  return `
    ${pageHeader(
      "Mis plantas",
      "Registro de las plantas de tu huerto",
      `<button class="btn btn-kawaii" id="add-plant-btn"><i class="bi bi-plus-lg"></i> Nueva planta</button>`,
      ICONS.page.plants
    )}
    ${searchInput("plants-search", "Buscar por nombre, especie o estado...")}
    ${cardsHtml}`;
}

export function bindEvents(container) {
  let treatmentsCache = null;
  db.getAll("treatments").then((items) => {
    treatmentsCache = items;
  });

  container.querySelector("#add-plant-btn")?.addEventListener("click", () => openPlantModal());

  container.addEventListener("click", async (e) => {
    const containerBtn = e.target.closest("[data-preview-container]");
    if (containerBtn && containerBtn.closest("#view-container")) {
      e.preventDefault();
      if (containerBtn.closest(".entity-preview-modal")) hideModal();
      const { openContainerPreviewModal } = await import("./containers.js");
      openContainerPreviewModal(containerBtn.dataset.previewContainer);
      return;
    }

    const incBtn = e.target.closest("[data-plant-incidences]");
    if (incBtn) {
      e.preventDefault();
      const plant = await db.getById("plants", incBtn.dataset.plantIncidences);
      if (plant) openIncidencesModal(plant);
      return;
    }

    const treatBtn = e.target.closest("[data-plant-treatments]");
    if (treatBtn) {
      e.preventDefault();
      const plant = await db.getById("plants", treatBtn.dataset.plantTreatments);
      if (plant) {
        const allTreatments = treatmentsCache || (await db.getAll("treatments"));
        openPlantTreatmentsModal(plant, allTreatments);
      }
      return;
    }

    const historyBtn = e.target.closest("[data-plant-state-history]");
    if (historyBtn) {
      e.preventDefault();
      const plant = await db.getById("plants", historyBtn.dataset.plantStateHistory);
      if (plant) openStateHistoryModal(plant);
      return;
    }

    const changeStateBtn = e.target.closest("[data-change-plant-state]");
    if (changeStateBtn) {
      e.preventDefault();
      const plant = await db.getById("plants", changeStateBtn.dataset.changePlantState);
      if (plant) openChangeStateModal(plant);
    }
  });

  container.querySelectorAll("[data-edit-plant]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const plant = await db.getById("plants", btn.dataset.editPlant);
      if (plant) openPlantModal(plant);
    });
  });

  container.querySelectorAll("[data-delete-plant]").forEach((btn) => {
    btn.addEventListener("click", () => {
      confirmDialog("Eliminar planta", "¿Seguro que quieres eliminar esta planta del registro?", async () => {
        await db.deletePhotosByOwner("plant", btn.dataset.deletePlant);
        await db.remove("plants", btn.dataset.deletePlant);
        showToast("Planta eliminada");
        document.dispatchEvent(new CustomEvent("view-refresh"));
      });
    });
  });

  const search = container.querySelector("#plants-search");
  if (search) {
    search.addEventListener(
      "input",
      debounce(async (e) => {
        const q = e.target.value.toLowerCase().trim();
        const grid = container.querySelector("#plants-grid");
        if (!grid) return;
        const cards = grid.querySelectorAll(".col-sm-6");
        for (const card of cards) {
          const text = card.textContent.toLowerCase();
          card.style.display = !q || text.includes(q) ? "" : "none";
        }
      })
    );
  }
}
