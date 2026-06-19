import * as db from "../db.js";
import { uid, nowISO, todayDate, nowTime, formatDate, formatDateTime, escapeHtml, debounce } from "../utils.js";
import {
  pageHeader, emptyState, searchInput, showModal, hideModal,
  showToast, confirmDialog, renderPhotoUploadHtml, bindPhotoUpload, renderPhotoThumbs,
} from "../ui.js";
import { ICONS } from "../icons.js";

let pendingPhotos = [];

function diaryFormHtml(entry = null) {
  const e = entry || { fecha: todayDate(), hora: nowTime(), detalle: "" };
  return `
    <form id="diary-form">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label" for="diary-fecha">Fecha *</label>
          <input type="date" class="form-control" id="diary-fecha" value="${escapeHtml(e.fecha)}" required>
        </div>
        <div class="col-md-6">
          <label class="form-label" for="diary-hora">Hora *</label>
          <input type="time" class="form-control" id="diary-hora" value="${escapeHtml(e.hora)}" required>
        </div>
        <div class="col-12">
          <label class="form-label" for="diary-detalle">Actividad *</label>
          <textarea class="form-control" id="diary-detalle" rows="4" required placeholder="Hoy regué los tomates, trasplanté albahaca...">${escapeHtml(e.detalle)}</textarea>
        </div>
        <div class="col-12">
          <label class="form-label">Fotos del día</label>
          ${renderPhotoUploadHtml("diary-photo-input")}
        </div>
      </div>
    </form>`;
}

function bindDiaryPhotos(entryId = null) {
  pendingPhotos = [];
  return bindPhotoUpload("diary-photo-input", {
    ownerType: "diary",
    ownerId: entryId,
    getPhotos: () => pendingPhotos,
    setPhotos: (photos) => {
      pendingPhotos = photos;
    },
  });
}

async function openDiaryModal(entry = null) {
  showModal(
    entry ? "✏️ Editar entrada" : "📔 Nueva entrada",
    diaryFormHtml(entry),
    `
      <button type="button" class="btn btn-kawaii-outline" data-bs-dismiss="modal">Cancelar</button>
      <button type="button" class="btn btn-kawaii" id="save-diary-btn">Guardar</button>
    `
  );

  const photoUpload = bindDiaryPhotos(entry?.id);

  if (entry) {
    pendingPhotos = await db.getPhotosByOwner("diary", entry.id);
    photoUpload.refresh();
  }

  document.getElementById("save-diary-btn").addEventListener("click", async () => {
    const saveBtn = document.getElementById("save-diary-btn");
    const fecha = document.getElementById("diary-fecha").value;
    const hora = document.getElementById("diary-hora").value;
    const detalle = document.getElementById("diary-detalle").value.trim();
    if (!fecha || !hora || !detalle) {
      showToast("Completa todos los campos", "error");
      return;
    }

    const data = {
      id: entry?.id || uid(),
      fecha,
      hora,
      detalle,
      createdAt: entry?.createdAt || nowISO(),
      updatedAt: nowISO(),
    };

    saveBtn.disabled = true;
    try {
      await db.put("diary", data);

      if (entry) await db.deletePhotosByOwner("diary", entry.id);
      for (const photo of pendingPhotos) {
        photo.ownerId = data.id;
        await db.put("photos", photo);
      }

      hideModal();
      showToast(entry ? "Entrada actualizada" : "Entrada añadida al diario");
      document.dispatchEvent(new CustomEvent("view-refresh"));
    } catch (err) {
      showToast(err.message || "Error al guardar la entrada", "error");
    } finally {
      saveBtn.disabled = false;
    }
  });
}

async function renderEntry(entry) {
  const photos = await db.getPhotosByOwner("diary", entry.id);
  return `
    <article class="list-item-kawaii">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <div class="timeline-date">${escapeHtml(formatDateTime(entry.fecha, entry.hora))}</div>
          <p class="mb-2 mt-1">${escapeHtml(entry.detalle)}</p>
          ${photos.length ? `<div class="d-flex flex-wrap gap-2">${renderPhotoThumbs(photos)}</div>` : ""}
        </div>
        <div class="d-flex gap-1 flex-shrink-0">
          <button class="btn btn-sm btn-kawaii-outline" data-edit-diary="${entry.id}" aria-label="Editar"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-kawaii btn-kawaii-danger" data-delete-diary="${entry.id}" aria-label="Eliminar"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    </article>`;
}

export async function render() {
  const entries = (await db.getAll("diary")).sort((a, b) =>
    `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`)
  );

  const listHtml = entries.length
    ? `<div id="diary-list">${await Promise.all(entries.map(renderEntry)).then((h) => h.join(""))}</div>`
    : emptyState(ICONS.page.diary, "Diario vacío", "Registra lo que haces cada día en el huerto");

  return `
    ${pageHeader(
      "Diario del huerto",
      "Fecha, hora y detalle de tus actividades diarias",
      `<button class="btn btn-kawaii" id="add-diary-btn"><i class="bi bi-plus-lg"></i> Nueva entrada</button>`,
      ICONS.page.diary
    )}
    ${searchInput("diary-search", "Buscar en el diario...")}
    ${listHtml}`;
}

export function bindEvents(container) {
  container.querySelector("#add-diary-btn")?.addEventListener("click", () => openDiaryModal());

  container.querySelectorAll("[data-edit-diary]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const entry = await db.getById("diary", btn.dataset.editDiary);
      if (entry) openDiaryModal(entry);
    });
  });

  container.querySelectorAll("[data-delete-diary]").forEach((btn) => {
    btn.addEventListener("click", () => {
      confirmDialog("Eliminar entrada", "¿Eliminar esta entrada del diario?", async () => {
        await db.deletePhotosByOwner("diary", btn.dataset.deleteDiary);
        await db.remove("diary", btn.dataset.deleteDiary);
        showToast("Entrada eliminada");
        document.dispatchEvent(new CustomEvent("view-refresh"));
      });
    });
  });

  const search = container.querySelector("#diary-search");
  if (search) {
    search.addEventListener(
      "input",
      debounce((e) => {
        const q = e.target.value.toLowerCase().trim();
        container.querySelectorAll("#diary-list .list-item-kawaii").forEach((item) => {
          item.style.display = !q || item.textContent.toLowerCase().includes(q) ? "" : "none";
        });
      })
    );
  }
}
