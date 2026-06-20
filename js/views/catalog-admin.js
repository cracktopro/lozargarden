import * as catalog from "../catalog.js";
import { uid, escapeHtml, debounce, isToxicForCats, renderToxicityBadge } from "../utils.js";
import {
  pageHeader, searchInput, showModal, hideModal, showToast, confirmDialog,
} from "../ui.js";
import { ICONS, iconImg } from "../icons.js";

const TABS = [
  { key: "plantas", label: "Plantas", icon: ICONS.catalog.plantas },
  { key: "plagas", label: "Plagas", icon: ICONS.catalog.plagas },
  { key: "enfermedades", label: "Enfermedades", icon: ICONS.catalog.enfermedades },
  { key: "estados", label: "Estados", icon: ICONS.catalog.estados },
  { key: "productos", label: "Tratamientos", icon: ICONS.catalog.productos },
];

let activeTab = "plantas";
let catalogClickBound = false;

function ensureCatalogDelegation(container) {
  if (catalogClickBound) return;
  catalogClickBound = true;
  container.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-edit-catalog]");
    if (editBtn) {
      const item = await catalog.getCatalogItem(editBtn.dataset.editCatalog, editBtn.dataset.id);
      if (item) openCatalogItemModal(editBtn.dataset.editCatalog, item);
      return;
    }
    const delBtn = e.target.closest("[data-delete-catalog]");
    if (delBtn) {
      confirmDialog("Eliminar entrada", "¿Eliminar esta entrada del catálogo?", async () => {
        await catalog.deleteCatalogItem(delBtn.dataset.deleteCatalog, delBtn.dataset.id);
        showToast("Entrada eliminada");
        document.dispatchEvent(new CustomEvent("view-refresh"));
      });
    }
  });
}

function renderTabs() {
  return `
    <ul class="nav nav-pills nav-pills-kawaii flex-wrap gap-2 mb-4" role="tablist">
      ${TABS.map(
        (t) => `
        <li class="nav-item" role="presentation">
          <button class="nav-link d-inline-flex align-items-center gap-2 ${activeTab === t.key ? "active" : ""}" data-catalog-tab="${t.key}" type="button" role="tab">
            ${iconImg(t.icon, "catalog-tab-icon", t.label)}
            <span>${escapeHtml(t.label)}</span>
          </button>
        </li>`
      ).join("")}
    </ul>`;
}

async function renderPlantasTable(items) {
  if (!items.length) return `<p class="text-muted mb-0">No hay plantas en el catálogo.</p>`;
  return `
    <div class="table-responsive">
      <table class="table table-hover catalog-table mb-0">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Nombre latín</th>
            <th>${iconImg(ICONS.toxicity.safe, "toxicity-icon", "Toxicidad gatos")} Toxicidad gatos</th>
            <th class="text-end">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (p) => `
            <tr data-catalog-row="${p.id}">
              <td>${escapeHtml(p.nombre)}</td>
              <td class="fst-italic text-muted">${escapeHtml(p.nombreLatin)}</td>
              <td>${renderToxicityBadge(p.toxicidadGatos)}</td>
              <td class="text-end text-nowrap">
                <button class="btn btn-sm btn-kawaii-outline" data-edit-catalog="plantas" data-id="${p.id}"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-kawaii btn-kawaii-danger" data-delete-catalog="plantas" data-id="${p.id}"><i class="bi bi-trash"></i></button>
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

async function renderEstadosTable(items) {
  if (!items.length) return `<p class="text-muted mb-0">No hay estados en el catálogo.</p>`;
  return `
    <div class="table-responsive">
      <table class="table table-hover catalog-table mb-0">
        <thead>
          <tr>
            <th>Nivel</th>
            <th>Orden</th>
            <th>Estado</th>
            <th class="text-end">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `
            <tr data-catalog-row="${item.id}">
              <td>${item.nivel ?? "—"}</td>
              <td>${item.orden ?? "—"}</td>
              <td>${escapeHtml(item.nombre)}</td>
              <td class="text-end text-nowrap">
                <button class="btn btn-sm btn-kawaii-outline" data-edit-catalog="estados" data-id="${item.id}"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-kawaii btn-kawaii-danger" data-delete-catalog="estados" data-id="${item.id}"><i class="bi bi-trash"></i></button>
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

async function renderSimpleTable(key, items) {
  if (!items.length) return `<p class="text-muted mb-0">No hay entradas.</p>`;
  const label = TABS.find((t) => t.key === key)?.label || key;
  return `
    <div class="table-responsive">
      <table class="table table-hover catalog-table mb-0">
        <thead><tr><th>${escapeHtml(label)}</th><th class="text-end">Acciones</th></tr></thead>
        <tbody>
          ${items
            .map(
              (item) => `
            <tr data-catalog-row="${item.id}">
              <td>${escapeHtml(item.nombre)}</td>
              <td class="text-end text-nowrap">
                <button class="btn btn-sm btn-kawaii-outline" data-edit-catalog="${key}" data-id="${item.id}"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-kawaii btn-kawaii-danger" data-delete-catalog="${key}" data-id="${item.id}"><i class="bi bi-trash"></i></button>
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function plantaForm(item = null) {
  const p = item || { nombre: "", nombreLatin: "", toxicidadGatos: "Seguro" };
  return `
    <form id="catalog-form">
      <div class="mb-3">
        <label class="form-label" for="cat-nombre">Nombre común *</label>
        <input type="text" class="form-control" id="cat-nombre" value="${escapeHtml(p.nombre)}" required>
      </div>
      <div class="mb-3">
        <label class="form-label" for="cat-latin">Nombre latín *</label>
        <input type="text" class="form-control" id="cat-latin" value="${escapeHtml(p.nombreLatin)}" required>
      </div>
      <div class="mb-3">
        <label class="form-label" for="cat-toxicidad">Toxicidad para gatos *</label>
        <select class="form-select" id="cat-toxicidad" required>
          <option value="Seguro" ${!isToxicForCats(p.toxicidadGatos) ? "selected" : ""}>Seguro</option>
          <option value="Tóxico" ${isToxicForCats(p.toxicidadGatos) ? "selected" : ""}>Tóxico</option>
        </select>
      </div>
    </form>`;
}

function estadoForm(item = null) {
  const p = item || { nombre: "", nivel: 1, orden: 1 };
  return `
    <form id="catalog-form">
      <div class="mb-3">
        <label class="form-label" for="cat-nombre">Estado *</label>
        <input type="text" class="form-control" id="cat-nombre" value="${escapeHtml(p.nombre)}" required>
      </div>
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label" for="cat-nivel">Nivel *</label>
          <select class="form-select" id="cat-nivel" required>
            ${[1, 2, 3, 4].map((n) => `<option value="${n}" ${Number(p.nivel) === n ? "selected" : ""}>Nivel ${n}</option>`).join("")}
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label" for="cat-orden">Orden *</label>
          <input type="number" class="form-control" id="cat-orden" min="1" value="${escapeHtml(String(p.orden ?? 1))}" required>
        </div>
      </div>
    </form>`;
}

function simpleForm(item = null, label = "Nombre") {
  const p = item || { nombre: "" };
  return `
    <form id="catalog-form">
      <div class="mb-3">
        <label class="form-label" for="cat-nombre">${escapeHtml(label)} *</label>
        <input type="text" class="form-control" id="cat-nombre" value="${escapeHtml(p.nombre)}" required>
      </div>
    </form>`;
}

async function openCatalogItemModal(key, item = null) {
  const isPlantas = key === "plantas";
  const isEstados = key === "estados";
  const tabLabel = TABS.find((t) => t.key === key)?.label || key;

  showModal(
    item ? `✏️ Editar ${tabLabel.toLowerCase()}` : `➕ Nueva entrada en ${tabLabel.toLowerCase()}`,
    isPlantas ? plantaForm(item) : isEstados ? estadoForm(item) : simpleForm(item, tabLabel),
    `
      <button type="button" class="btn btn-kawaii-outline" data-bs-dismiss="modal">Cancelar</button>
      <button type="button" class="btn btn-kawaii" id="save-catalog-btn">Guardar</button>
    `
  );

  document.getElementById("save-catalog-btn").addEventListener("click", async () => {
    const nombre = document.getElementById("cat-nombre").value.trim();
    if (!nombre) {
      showToast("El nombre es obligatorio", "error");
      return;
    }

    let data;
    if (isPlantas) {
      const nombreLatin = document.getElementById("cat-latin").value.trim();
      if (!nombreLatin) {
        showToast("El nombre latín es obligatorio", "error");
        return;
      }
      data = {
        id: item?.id || uid(),
        nombre,
        nombreLatin,
        toxicidadGatos: document.getElementById("cat-toxicidad").value,
      };
    } else if (isEstados) {
      const nivel = parseInt(document.getElementById("cat-nivel").value, 10);
      const orden = parseInt(document.getElementById("cat-orden").value, 10);
      if (!nivel || !orden) {
        showToast("Nivel y orden son obligatorios", "error");
        return;
      }
      data = { id: item?.id || uid(), nombre, nivel, orden };
    } else {
      data = { id: item?.id || uid(), nombre };
    }

    await catalog.saveCatalogItem(key, data);
    hideModal();
    showToast("Catálogo actualizado");
    document.dispatchEvent(new CustomEvent("view-refresh"));
  });
}

async function renderTabContent(key, searchQuery = "") {
  let items = await catalog.getCatalog(key);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    items = items.filter((i) => {
      if (key === "plantas") {
        return (
          i.nombre.toLowerCase().includes(q) ||
          i.nombreLatin.toLowerCase().includes(q) ||
          i.toxicidadGatos.toLowerCase().includes(q)
        );
      }
      return i.nombre.toLowerCase().includes(q);
    });
  }

  if (key === "plantas") return renderPlantasTable(items);
  if (key === "estados") return renderEstadosTable(items);
  return renderSimpleTable(key, items);
}

export async function render() {
  const tabContent = await renderTabContent(activeTab);
  const activeTabInfo = TABS.find((t) => t.key === activeTab) || TABS[0];

  return `
    ${pageHeader(
      "Catálogos",
      "Plantas, plagas, enfermedades, estados y tratamientos compartidos en Firebase para todos los usuarios",
      `<button class="btn btn-kawaii btn-sm" id="add-catalog-btn"><i class="bi bi-plus-lg"></i> Añadir</button>`,
      ICONS.catalog[activeTab]
    )}
    ${renderTabs()}
    <div class="kawaii-card mb-3">
      <div class="card-body">
        ${searchInput("catalog-search", `Buscar en ${activeTabInfo.label.toLowerCase()}...`)}
        <div id="catalog-content">${tabContent}</div>
      </div>
    </div>`;
}

export function bindEvents(container) {
  container.querySelectorAll("[data-catalog-tab]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      activeTab = btn.dataset.catalogTab;
      document.dispatchEvent(new CustomEvent("view-refresh"));
    });
  });

  container.querySelector("#add-catalog-btn")?.addEventListener("click", () => {
    openCatalogItemModal(activeTab);
  });

  const search = container.querySelector("#catalog-search");
  if (search) {
    search.addEventListener(
      "input",
      debounce(async (e) => {
        const content = document.getElementById("catalog-content");
        if (content) content.innerHTML = await renderTabContent(activeTab, e.target.value.trim());
      })
    );
  }

  ensureCatalogDelegation(container);
}
