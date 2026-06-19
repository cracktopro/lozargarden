import * as db from "../db.js";
import * as catalog from "../catalog.js";
import { uid, nowISO, escapeHtml, debounce, renderToxicityBadge, formatDateTime, getTreatmentPlantIds } from "../utils.js";
import {
  pageHeader, emptyState, searchInput, showModal, hideModal,
  showToast, confirmDialog, renderPhotoUploadHtml,
  renderSearchablePickerHtml, bindSearchablePicker, getSearchablePickerValues,
  bindPhotoUpload, encodePhotoGallery,
} from "../ui.js";
import { ICONS, iconImg } from "../icons.js";

let pendingPhotos = [];

async function loadPlantPhotos(plantId) {
  return db.getPhotosByOwner("plant", plantId);
}

async function getPlantCardData(plant) {
  const [planta, estado, container, photos, plagas, enfermedades] = await Promise.all([
    catalog.findPlantaById(plant.catalogPlantId),
    catalog.findEstadoById(plant.estadoId),
    plant.containerId ? db.getById("containers", plant.containerId) : null,
    loadPlantPhotos(plant.id),
    catalog.getCatalog("plagas"),
    catalog.getCatalog("enfermedades"),
  ]);
  return { planta, estado, container, photos, plagas, enfermedades };
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
    .map((id) => plagas.find((p) => p.id === id)?.nombre)
    .filter(Boolean);
  const enfermedadNames = (plant.enfermedadIds || [])
    .map((id) => enfermedades.find((e) => e.id === id)?.nombre)
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

function plantFormHtml(plant = null, catalogPlantas, estados, plagas, enfermedades, containers) {
  const p = plant || {
    apodo: "",
    catalogPlantId: "",
    estadoId: estados[0]?.id || "",
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
          <label class="form-label" for="plant-estado">Estado *</label>
          <select class="form-select" id="plant-estado" required>
            ${estados.map((e) => `<option value="${e.id}" ${p.estadoId === e.id ? "selected" : ""}>${escapeHtml(e.nombre)}</option>`).join("")}
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label" for="plant-container">Contenedor</label>
          <select class="form-select" id="plant-container">
            <option value="">— Sin asignar —</option>
            ${containers.map((c) => `<option value="${c.id}" ${p.containerId === c.id ? "selected" : ""}>${escapeHtml(c.nombre)} (${escapeHtml(c.tipo)})</option>`).join("")}
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label">Plagas</label>
          ${renderSearchablePickerHtml({
            id: "plant-plagas-picker",
            items: plagas,
            selectedIds: p.plagaIds || [],
            searchPlaceholder: "Buscar plaga...",
          })}
        </div>
        <div class="col-md-6">
          <label class="form-label">Enfermedades</label>
          ${renderSearchablePickerHtml({
            id: "plant-enfermedades-picker",
            items: enfermedades,
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
    plantFormHtml(plant, catalogPlantas, estados, plagas, enfermedades, containers),
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
    const estadoId = document.getElementById("plant-estado").value;
    if (!catalogPlantId || !estadoId) {
      showToast("Completa los campos obligatorios", "error");
      return;
    }

    const data = {
      id: plant?.id || uid(),
      apodo: document.getElementById("plant-apodo").value.trim(),
      catalogPlantId,
      estadoId,
      containerId: document.getElementById("plant-container").value || null,
      plagaIds: getSearchablePickerValues("plant-plagas-picker"),
      enfermedadIds: getSearchablePickerValues("plant-enfermedades-picker"),
      notas: document.getElementById("plant-notas").value.trim(),
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

async function renderPlantCard(plant, allTreatments) {
  const { planta, estado, container, photos } = await getPlantCardData(plant);
  const displayName = plant.apodo || planta?.nombre || "Planta sin nombre";
  const imgHtml = photos.length
    ? `<button type="button" class="plant-card-photo-btn w-100 border-0 p-0 bg-transparent" data-photo-gallery="${encodePhotoGallery(photos)}" data-photo-start="0" data-photo-title="${escapeHtml(displayName)}" aria-label="Ver fotos de ${escapeHtml(displayName)}">
        <img src="${photos[0].dataUrl || photos[0].downloadUrl}" class="card-img-top plant-card-img" alt="">
        ${photos.length > 1 ? `<span class="plant-card-photo-count"><i class="bi bi-images"></i> ${photos.length}</span>` : ""}
      </button>`
    : `<div class="plant-card-placeholder">${iconImg(ICONS.page.plants, "plant-card-placeholder-icon", "")}</div>`;

  const incidenceCount = (plant.plagaIds?.length || 0) + (plant.enfermedadIds?.length || 0);
  const treatmentCount = countPlantTreatments(plant.id, allTreatments);

  return `
    <div class="col-sm-6 col-lg-4">
      <article class="kawaii-card h-100">
        ${imgHtml}
        <div class="card-body">
          <h3 class="h6 fw-bold mb-1">${escapeHtml(displayName)}</h3>
          ${planta ? `<p class="small text-muted mb-1 fst-italic">${escapeHtml(planta.nombreLatin)}</p>` : ""}
          ${estado ? `<span class="badge badge-kawaii-green mb-2">${escapeHtml(estado.nombre)}</span>` : ""}
          ${container ? `<div class="small"><i class="bi bi-flower2"></i> ${escapeHtml(container.nombre)}</div>` : ""}
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
        <div class="card-footer bg-transparent border-0 d-flex gap-2 pb-3 px-3">
          <button class="btn btn-sm btn-kawaii-outline flex-fill" data-edit-plant="${plant.id}">Editar</button>
          <button class="btn btn-sm btn-kawaii btn-kawaii-danger" data-delete-plant="${plant.id}" aria-label="Eliminar">🗑</button>
        </div>
      </article>
    </div>`;
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
