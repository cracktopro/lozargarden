import * as db from "../db.js";
import * as catalog from "../catalog.js";
import { uid, nowISO, todayDate, nowTime, formatDateTime, escapeHtml, debounce } from "../utils.js";
import {
  pageHeader, emptyState, searchInput, showModal, hideModal,
  showToast, confirmDialog,
  renderSearchablePickerHtml, bindSearchablePicker, getSearchablePickerValues,
} from "../ui.js";
import { ICONS, iconImg } from "../icons.js";

function resolveProductoName(productos, productoId) {
  if (!productoId) return "";
  return productos.find((p) => p.id === productoId)?.nombre || "";
}

function selectedProductoIds(productos, productoNombre) {
  if (!productoNombre) return [];
  const match = productos.find((p) => p.nombre === productoNombre);
  return match ? [match.id] : [];
}

function treatmentFormHtml(treatment = null, plants = [], productos = []) {
  const t = treatment || {
    plantId: plants[0]?.id || "",
    fecha: todayDate(),
    hora: nowTime(),
    detalle: "",
    producto: "",
  };

  return `
    <form id="treatment-form">
      <div class="row g-3">
        <div class="col-12">
          <label class="form-label" for="treatment-plant">Planta *</label>
          <select class="form-select" id="treatment-plant" required>
            <option value="">— Seleccionar —</option>
            ${plants.map((p) => `<option value="${p.id}" ${t.plantId === p.id ? "selected" : ""}>${escapeHtml(p.label)}</option>`).join("")}
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label" for="treatment-fecha">Fecha *</label>
          <input type="date" class="form-control" id="treatment-fecha" value="${escapeHtml(t.fecha)}" required>
        </div>
        <div class="col-md-6">
          <label class="form-label" for="treatment-hora">Hora *</label>
          <input type="time" class="form-control" id="treatment-hora" value="${escapeHtml(t.hora)}" required>
        </div>
        <div class="col-12">
          <label class="form-label">Producto / método (opcional)</label>
          ${renderSearchablePickerHtml({
            id: "treatment-producto-picker",
            items: productos,
            selectedIds: selectedProductoIds(productos, t.producto),
            singleSelect: true,
            searchPlaceholder: "Buscar producto o método...",
          })}
        </div>
        <div class="col-12">
          <label class="form-label" for="treatment-detalle">Detalle del tratamiento *</label>
          <textarea class="form-control" id="treatment-detalle" rows="4" required placeholder="Pulverización foliar, riego con fungicida...">${escapeHtml(t.detalle)}</textarea>
        </div>
      </div>
    </form>`;
}

async function enrichPlants() {
  const plants = await db.getAll("plants");
  return Promise.all(
    plants.map(async (p) => {
      const cat = await catalog.findPlantaById(p.catalogPlantId);
      return { ...p, label: p.apodo || cat?.nombre || "Planta sin nombre" };
    })
  );
}

async function openTreatmentModal(treatment = null) {
  const [plants, productos] = await Promise.all([enrichPlants(), catalog.getCatalog("productos")]);
  if (!plants.length) {
    showToast("Primero añade plantas al huerto", "error");
    return;
  }

  showModal(
    treatment ? "✏️ Editar tratamiento" : "💧 Nuevo tratamiento",
    treatmentFormHtml(treatment, plants, productos),
    `
      <button type="button" class="btn btn-kawaii-outline" data-bs-dismiss="modal">Cancelar</button>
      <button type="button" class="btn btn-kawaii" id="save-treatment-btn">Guardar</button>
    `
  );

  bindSearchablePicker("treatment-producto-picker");

  document.getElementById("save-treatment-btn").addEventListener("click", async () => {
    const plantId = document.getElementById("treatment-plant").value;
    const fecha = document.getElementById("treatment-fecha").value;
    const hora = document.getElementById("treatment-hora").value;
    const detalle = document.getElementById("treatment-detalle").value.trim();
    if (!plantId || !fecha || !hora || !detalle) {
      showToast("Completa los campos obligatorios", "error");
      return;
    }

    const productoId = getSearchablePickerValues("treatment-producto-picker")[0] || "";

    const data = {
      id: treatment?.id || uid(),
      plantId,
      fecha,
      hora,
      producto: resolveProductoName(productos, productoId),
      detalle,
      createdAt: treatment?.createdAt || nowISO(),
      updatedAt: nowISO(),
    };

    await db.put("treatments", data);
    hideModal();
    showToast(treatment ? "Tratamiento actualizado" : "Tratamiento registrado");
    document.dispatchEvent(new CustomEvent("view-refresh"));
  });
}

async function renderTreatment(treatment, plantLabel) {
  return `
    <article class="list-item-kawaii">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
            <span class="badge badge-kawaii-green">🌿 ${escapeHtml(plantLabel)}</span>
            <span class="timeline-date">${escapeHtml(formatDateTime(treatment.fecha, treatment.hora))}</span>
          </div>
          ${treatment.producto ? `<p class="small fw-semibold mb-1"><i class="bi bi-droplet"></i> ${escapeHtml(treatment.producto)}</p>` : ""}
          <p class="mb-0">${escapeHtml(treatment.detalle)}</p>
        </div>
        <div class="d-flex gap-1 flex-shrink-0">
          <button class="btn btn-sm btn-kawaii-outline" data-edit-treatment="${treatment.id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-kawaii btn-kawaii-danger" data-delete-treatment="${treatment.id}"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    </article>`;
}

export async function render() {
  const treatments = (await db.getAll("treatments")).sort((a, b) =>
    `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`)
  );
  const plants = await enrichPlants();
  const plantMap = Object.fromEntries(plants.map((p) => [p.id, p.label]));

  const listHtml = treatments.length
    ? `<div id="treatments-list">${await Promise.all(treatments.map((t) => renderTreatment(t, plantMap[t.plantId] || "Planta"))).then((h) => h.join(""))}</div>`
    : emptyState(ICONS.page.treatments, "Sin tratamientos", "Registra riegos, abonos, fungicidas y demás cuidados");

  return `
    ${pageHeader(
      "Historial de tratamientos",
      "Qué, cuándo y sobre qué planta se aplicó cada cuidado",
      `<button class="btn btn-kawaii" id="add-treatment-btn"><i class="bi bi-plus-lg"></i> Nuevo tratamiento</button>`,
      ICONS.page.treatments
    )}
    ${searchInput("treatments-search", "Buscar por planta o detalle...")}
    ${listHtml}`;
}

export function bindEvents(container) {
  container.querySelector("#add-treatment-btn")?.addEventListener("click", () => openTreatmentModal());

  container.querySelectorAll("[data-edit-treatment]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const t = await db.getById("treatments", btn.dataset.editTreatment);
      if (t) openTreatmentModal(t);
    });
  });

  container.querySelectorAll("[data-delete-treatment]").forEach((btn) => {
    btn.addEventListener("click", () => {
      confirmDialog("Eliminar tratamiento", "¿Eliminar este registro del historial?", async () => {
        await db.remove("treatments", btn.dataset.deleteTreatment);
        showToast("Tratamiento eliminado");
        document.dispatchEvent(new CustomEvent("view-refresh"));
      });
    });
  });

  const search = container.querySelector("#treatments-search");
  if (search) {
    search.addEventListener(
      "input",
      debounce((e) => {
        const q = e.target.value.toLowerCase().trim();
        container.querySelectorAll("#treatments-list .list-item-kawaii").forEach((item) => {
          item.style.display = !q || item.textContent.toLowerCase().includes(q) ? "" : "none";
        });
      })
    );
  }
}
