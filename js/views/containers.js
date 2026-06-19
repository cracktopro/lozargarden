import * as db from "../db.js";
import * as catalog from "../catalog.js";
import { uid, nowISO, escapeHtml, CONTAINER_TYPES, debounce } from "../utils.js";
import {
  pageHeader, emptyState, searchInput, showModal, hideModal,
  showToast, confirmDialog,
} from "../ui.js";
import { ICONS, iconImg } from "../icons.js";
import { renderMacetadoraHtml, initMacetadora } from "../macetadora.js";

const TABS = [
  { key: "mis-macetas", label: "Mis macetas", icon: ICONS.page.containers },
  { key: "macetadora", label: "Macetadora", icon: ICONS.macetadora.calculator },
];

let activeTab = "mis-macetas";
let pendingNewContainer = null;

function renderTabs() {
  return `
    <ul class="nav nav-pills nav-pills-kawaii flex-wrap gap-2 mb-4" role="tablist">
      ${TABS.map(
        (t) => `
        <li class="nav-item" role="presentation">
          <button class="nav-link d-inline-flex align-items-center gap-2 ${activeTab === t.key ? "active" : ""}" data-containers-tab="${t.key}" type="button" role="tab" aria-selected="${activeTab === t.key}">
            ${t.icon ? iconImg(t.icon, "catalog-tab-icon", t.label) : ""}
            <span>${escapeHtml(t.label)}</span>
          </button>
        </li>`
      ).join("")}
    </ul>`;
}

async function renderMisMacetasTab() {
  const containers = (await db.getAll("containers")).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es")
  );

  const gridHtml = containers.length
    ? `<div class="row g-3" id="containers-grid">${await Promise.all(containers.map(renderContainerCard)).then((h) => h.join(""))}</div>`
    : emptyState(ICONS.page.containers, "Sin contenedores", "Registra tus macetas, jardineras y semilleros");

  return `
    ${searchInput("containers-search", "Buscar contenedor...")}
    ${gridHtml}`;
}

function renderMacetadoraTab() {
  return `
    <div class="kawaii-card kawaii-card-accent">
      <div class="card-body">
        ${renderMacetadoraHtml({ showHeader: false })}
      </div>
    </div>`;
}

function containerFormHtml(container = null, allPlants = []) {
  const c = container || {
    nombre: "",
    tipo: "maceta",
    ubicacion: "",
    capacidad: "",
    notas: "",
    plantIds: [],
  };

  const typeOptions = CONTAINER_TYPES.map(
    (t) => `<option value="${t.id}" ${c.tipo === t.id ? "selected" : ""}>${escapeHtml(t.label)}</option>`
  ).join("");

  return `
    <form id="container-form">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label" for="container-nombre">Nombre *</label>
          <input type="text" class="form-control" id="container-nombre" value="${escapeHtml(c.nombre)}" required placeholder="Maceta terraza norte">
        </div>
        <div class="col-md-6">
          <label class="form-label" for="container-tipo">Tipo *</label>
          <select class="form-select" id="container-tipo" required>${typeOptions}</select>
        </div>
        <div class="col-md-6">
          <label class="form-label" for="container-ubicacion">Ubicación</label>
          <input type="text" class="form-control" id="container-ubicacion" value="${escapeHtml(c.ubicacion)}" placeholder="Terraza, invernadero...">
        </div>
        <div class="col-md-6">
          <label class="form-label" for="container-capacidad">Capacidad / tamaño</label>
          <input type="text" class="form-control" id="container-capacidad" value="${escapeHtml(c.capacidad)}" placeholder="30 cm, 5L...">
        </div>
        <div class="col-12">
          <label class="form-label" for="container-plantas">Plantas / semillas en este contenedor</label>
          <select class="form-select" id="container-plantas" multiple size="5">
            ${allPlants.map((p) => {
              const label = p.apodo || p.catalogName || "Planta";
              return `<option value="${p.id}" ${(c.plantIds || []).includes(p.id) ? "selected" : ""}>${escapeHtml(label)}</option>`;
            }).join("")}
          </select>
          <small class="text-muted">También puedes asignar desde la ficha de cada planta</small>
        </div>
        <div class="col-12">
          <label class="form-label" for="container-notas">Notas</label>
          <textarea class="form-control" id="container-notas" rows="2">${escapeHtml(c.notas)}</textarea>
        </div>
      </div>
    </form>`;
}

async function enrichPlantsForSelect() {
  const plants = await db.getAll("plants");
  return Promise.all(
    plants.map(async (p) => {
      const cat = await catalog.findPlantaById(p.catalogPlantId);
      return { ...p, catalogName: cat?.nombre };
    })
  );
}

async function syncPlantContainerAssignments(containerId, selectedPlantIds, previousPlantIds = []) {
  const allPlants = await db.getAll("plants");
  const selected = new Set(selectedPlantIds);
  const previous = new Set(previousPlantIds);

  for (const plant of allPlants) {
    const wasSelected = previous.has(plant.id);
    const isSelected = selected.has(plant.id);

    if (isSelected && plant.containerId !== containerId) {
      plant.containerId = containerId;
      plant.updatedAt = nowISO();
      await db.put("plants", plant);
    } else if (wasSelected && !isSelected && plant.containerId === containerId) {
      plant.containerId = null;
      plant.updatedAt = nowISO();
      await db.put("plants", plant);
    }
  }
}

async function openContainerModal(container = null, defaults = {}) {
  const allPlants = await enrichPlantsForSelect();

  if (container) {
    const assigned = allPlants.filter((p) => p.containerId === container.id).map((p) => p.id);
    container.plantIds = assigned;
  }

  const formDefaults = container || {
    nombre: "",
    tipo: "maceta",
    ubicacion: "",
    capacidad: defaults.capacidad || "",
    notas: "",
    plantIds: [],
  };

  showModal(
    container ? "✏️ Editar contenedor" : "Nuevo contenedor",
    containerFormHtml(formDefaults, allPlants),
    `
      <button type="button" class="btn btn-kawaii-outline" data-bs-dismiss="modal">Cancelar</button>
      <button type="button" class="btn btn-kawaii" id="save-container-btn">Guardar</button>
    `
  );

  document.getElementById("save-container-btn").addEventListener("click", async () => {
    const nombre = document.getElementById("container-nombre").value.trim();
    if (!nombre) {
      showToast("El nombre es obligatorio", "error");
      return;
    }

    const plantSelect = document.getElementById("container-plantas");
    const selectedPlantIds = [...plantSelect.selectedOptions].map((o) => o.value);

    const data = {
      id: container?.id || uid(),
      nombre,
      tipo: document.getElementById("container-tipo").value,
      ubicacion: document.getElementById("container-ubicacion").value.trim(),
      capacidad: document.getElementById("container-capacidad").value.trim(),
      notas: document.getElementById("container-notas").value.trim(),
      plantIds: selectedPlantIds,
      createdAt: container?.createdAt || nowISO(),
      updatedAt: nowISO(),
    };

    await db.put("containers", data);
    await syncPlantContainerAssignments(data.id, selectedPlantIds, container?.plantIds || []);

    hideModal();
    showToast(container ? "Contenedor actualizado" : "Contenedor creado");
    document.dispatchEvent(new CustomEvent("view-refresh"));
  });
}

async function renderContainerCard(container) {
  const typeInfo = CONTAINER_TYPES.find((t) => t.id === container.tipo) || CONTAINER_TYPES[0];
  const plants = (await db.getAll("plants")).filter((p) => p.containerId === container.id);
  const plantNames = await Promise.all(
    plants.map(async (p) => {
      const cat = await catalog.findPlantaById(p.catalogPlantId);
      return p.apodo || cat?.nombre || "Planta";
    })
  );

  return `
    <div class="col-md-6 col-xl-4">
      <article class="kawaii-card h-100">
        <div class="card-body text-center">
          <div class="container-type-icon mb-2">${iconImg(typeInfo.icon, "container-type-icon-img", typeInfo.label)}</div>
          <h3 class="h5 fw-bold">${escapeHtml(container.nombre)}</h3>
          <span class="badge badge-kawaii mb-2">${escapeHtml(typeInfo.label)}</span>
          ${container.ubicacion ? `<p class="small mb-1"><i class="bi bi-geo-alt"></i> ${escapeHtml(container.ubicacion)}</p>` : ""}
          ${container.capacidad ? `<p class="small text-muted mb-2">${escapeHtml(container.capacidad)}</p>` : ""}
          <div class="text-start mt-3">
            <strong class="small">Plantas (${plants.length}):</strong>
            ${plantNames.length
              ? `<ul class="small mb-0 ps-3">${plantNames.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
              : `<p class="small text-muted mb-0">Sin plantas asignadas</p>`}
          </div>
        </div>
        <div class="card-footer bg-transparent border-0 d-flex gap-2 pb-3 px-3">
          <button class="btn btn-sm btn-kawaii-outline flex-fill" data-edit-container="${container.id}">Editar</button>
          <button class="btn btn-sm btn-kawaii btn-kawaii-danger" data-delete-container="${container.id}">🗑</button>
        </div>
      </article>
    </div>`;
}

export async function render() {
  const isMacetadora = activeTab === "macetadora";
  const tabContent = isMacetadora ? renderMacetadoraTab() : await renderMisMacetasTab();

  return `
    ${pageHeader(
      "Macetas y contenedores",
      isMacetadora
        ? "Calcula cuántos litros de tierra caben en tu maceta"
        : "Macetas, jardineras y semilleros con sus plantas",
      isMacetadora
        ? ""
        : `<button class="btn btn-kawaii" id="add-container-btn"><i class="bi bi-plus-lg"></i> Nuevo contenedor</button>`,
      ICONS.page.containers
    )}
    ${renderTabs()}
    <div id="containers-tab-content">${tabContent}</div>`;
}

export function bindEvents(container) {
  container.querySelectorAll("[data-containers-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.containersTab;
      document.dispatchEvent(new CustomEvent("view-refresh"));
    });
  });

  const macetadoraRoot = container.querySelector(".macetadora-panel");
  if (macetadoraRoot) {
    initMacetadora(macetadoraRoot, {
      onApplyCapacity: (capacidad) => {
        pendingNewContainer = { capacidad };
        activeTab = "mis-macetas";
        document.dispatchEvent(new CustomEvent("view-refresh"));
      },
    });
  }

  if (pendingNewContainer) {
    const defaults = pendingNewContainer;
    pendingNewContainer = null;
    openContainerModal(null, defaults);
  }

  container.querySelector("#add-container-btn")?.addEventListener("click", () => openContainerModal());

  container.querySelectorAll("[data-edit-container]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const c = await db.getById("containers", btn.dataset.editContainer);
      if (c) openContainerModal(c);
    });
  });

  container.querySelectorAll("[data-delete-container]").forEach((btn) => {
    btn.addEventListener("click", () => {
      confirmDialog("Eliminar contenedor", "Las plantas no se borrarán, solo se desvincularán.", async () => {
        const id = btn.dataset.deleteContainer;
        const plants = await db.getAll("plants");
        for (const p of plants.filter((pl) => pl.containerId === id)) {
          p.containerId = null;
          await db.put("plants", p);
        }
        await db.remove("containers", id);
        showToast("Contenedor eliminado");
        document.dispatchEvent(new CustomEvent("view-refresh"));
      });
    });
  });

  const search = container.querySelector("#containers-search");
  if (search) {
    search.addEventListener(
      "input",
      debounce((e) => {
        const q = e.target.value.toLowerCase().trim();
        container.querySelectorAll("#containers-grid .col-md-6").forEach((card) => {
          card.style.display = !q || card.textContent.toLowerCase().includes(q) ? "" : "none";
        });
      })
    );
  }
}
