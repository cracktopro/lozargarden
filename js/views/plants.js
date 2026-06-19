import * as db from "../db.js";
import * as catalog from "../catalog.js";
import { uid, nowISO, escapeHtml, debounce, isToxicForCats } from "../utils.js";
import {
  pageHeader, emptyState, searchInput, showModal, hideModal,
  showToast, confirmDialog, multiSelectOptions, renderPhotoUploadHtml,
  bindPhotoUpload,
} from "../ui.js";
import { ICONS, iconImg } from "../icons.js";

let pendingPhotos = [];

async function loadPlantPhotos(plantId) {
  return db.getPhotosByOwner("plant", plantId);
}

async function getPlantCardData(plant) {
  const [planta, estado, container, photos] = await Promise.all([
    catalog.findPlantaById(plant.catalogPlantId),
    catalog.findEstadoById(plant.estadoId),
    plant.containerId ? db.getById("containers", plant.containerId) : null,
    loadPlantPhotos(plant.id),
  ]);
  return { planta, estado, container, photos };
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
          <label class="form-label" for="plant-catalog">Especie *</label>
          <select class="form-select" id="plant-catalog" required>
            <option value="">— Seleccionar —</option>
            ${catalogPlantas.map((c) => `<option value="${c.id}" ${p.catalogPlantId === c.id ? "selected" : ""}>${escapeHtml(c.nombre)}</option>`).join("")}
          </select>
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
          <label class="form-label" for="plant-plagas">Plagas</label>
          <select class="form-select" id="plant-plagas" multiple size="4">
            ${multiSelectOptions(plagas, p.plagaIds || [])}
          </select>
          <small class="text-muted">Ctrl+clic para varias</small>
        </div>
        <div class="col-md-6">
          <label class="form-label" for="plant-enfermedades">Enfermedades</label>
          <select class="form-select" id="plant-enfermedades" multiple size="4">
            ${multiSelectOptions(enfermedades, p.enfermedadIds || [])}
          </select>
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

  const photoUpload = bindPlantForm(plant?.id);

  if (plant) {
    pendingPhotos = await loadPlantPhotos(plant.id);
    photoUpload.refresh();
  }

  document.getElementById("save-plant-btn").addEventListener("click", async () => {
    const saveBtn = document.getElementById("save-plant-btn");
    const catalogPlantId = document.getElementById("plant-catalog").value;
    const estadoId = document.getElementById("plant-estado").value;
    if (!catalogPlantId || !estadoId) {
      showToast("Completa los campos obligatorios", "error");
      return;
    }

    const plagaSelect = document.getElementById("plant-plagas");
    const enfermedadSelect = document.getElementById("plant-enfermedades");

    const data = {
      id: plant?.id || uid(),
      apodo: document.getElementById("plant-apodo").value.trim(),
      catalogPlantId,
      estadoId,
      containerId: document.getElementById("plant-container").value || null,
      plagaIds: [...plagaSelect.selectedOptions].map((o) => o.value),
      enfermedadIds: [...enfermedadSelect.selectedOptions].map((o) => o.value),
      notas: document.getElementById("plant-notas").value.trim(),
      createdAt: plant?.createdAt || nowISO(),
      updatedAt: nowISO(),
    };

    saveBtn.disabled = true;
    try {
      await db.put("plants", data);

      if (plant) await db.deletePhotosByOwner("plant", plant.id);
      for (const photo of pendingPhotos) {
        photo.ownerId = data.id;
        await db.put("photos", photo);
      }

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

async function renderPlantCard(plant) {
  const { planta, estado, container, photos } = await getPlantCardData(plant);
  const displayName = plant.apodo || planta?.nombre || "Planta sin nombre";
  const imgHtml = photos.length
    ? `<img src="${photos[0].dataUrl}" class="card-img-top plant-card-img" alt="">`
    : `<div class="plant-card-placeholder">${iconImg(ICONS.page.plants, "plant-card-placeholder-icon", "")}</div>`;

  const plagaEnfermedad = (plant.plagaIds?.length || 0) + (plant.enfermedadIds?.length || 0);

  return `
    <div class="col-sm-6 col-lg-4">
      <article class="kawaii-card h-100">
        ${imgHtml}
        <div class="card-body">
          <h3 class="h6 fw-bold mb-1">${escapeHtml(displayName)}</h3>
          ${planta ? `<p class="small text-muted mb-1 fst-italic">${escapeHtml(planta.nombreLatin)}</p>` : ""}
          ${estado ? `<span class="badge badge-kawaii-green mb-2">${escapeHtml(estado.nombre)}</span>` : ""}
          ${container ? `<div class="small"><i class="bi bi-flower2"></i> ${escapeHtml(container.nombre)}</div>` : ""}
          ${plagaEnfermedad ? `<div class="small text-danger mt-1"><i class="bi bi-bug"></i> ${plagaEnfermedad} incidencia(s)</div>` : ""}
          ${planta?.toxicidadGatos ? `<div class="small mt-1"><span class="badge ${isToxicForCats(planta.toxicidadGatos) ? "badge-toxic" : "badge-safe"}">🐱 ${escapeHtml(planta.toxicidadGatos)}</span></div>` : ""}
        </div>
        <div class="card-footer bg-transparent border-0 d-flex gap-2 pb-3 px-3">
          <button class="btn btn-sm btn-kawaii-outline flex-fill" data-edit-plant="${plant.id}">Editar</button>
          <button class="btn btn-sm btn-kawaii btn-kawaii-danger" data-delete-plant="${plant.id}" aria-label="Eliminar">🗑</button>
        </div>
      </article>
    </div>`;
}

export async function render() {
  const plants = (await db.getAll("plants")).sort((a, b) =>
    (b.updatedAt || "").localeCompare(a.updatedAt || "")
  );

  const cardsHtml = plants.length
    ? `<div class="row g-3" id="plants-grid">${await Promise.all(plants.map(renderPlantCard)).then((h) => h.join(""))}</div>`
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
  container.querySelector("#add-plant-btn")?.addEventListener("click", () => openPlantModal());

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
