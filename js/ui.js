/** Helpers de interfaz */

import { escapeHtml, uid } from "./utils.js";
import { compressImageFile, formatBytes } from "./image-utils.js";
import { iconImg } from "./icons.js";

let modalInstance = null;
let photoGalleryModalInstance = null;
let photoGallerySlideHandler = null;

export function encodePhotoGallery(photos) {
  const urls = photos.map((p) => p.dataUrl || p.downloadUrl || "").filter(Boolean);
  return encodeURIComponent(JSON.stringify(urls));
}

export function openPhotoGallery(sources, startIndex = 0, title = "Fotos") {
  const urls = (Array.isArray(sources) ? sources : []).filter(Boolean);
  if (!urls.length) return;

  const inner = document.getElementById("photoGalleryInner");
  const counter = document.getElementById("photoGalleryCounter");
  const carouselEl = document.getElementById("photoGalleryCarousel");
  const prevBtn = carouselEl?.querySelector(".carousel-control-prev");
  const nextBtn = carouselEl?.querySelector(".carousel-control-next");
  const safeStart = Math.min(Math.max(startIndex, 0), urls.length - 1);

  document.getElementById("photoGalleryLabel").textContent = title;

  inner.innerHTML = urls
    .map(
      (src, i) => `
    <div class="carousel-item${i === safeStart ? " active" : ""}">
      <img src="${escapeHtml(src)}" class="d-block mx-auto photo-gallery-img" alt="Foto ${i + 1} de ${urls.length}">
    </div>`
    )
    .join("");

  const showNav = urls.length > 1;
  prevBtn?.classList.toggle("d-none", !showNav);
  nextBtn?.classList.toggle("d-none", !showNav);
  counter.classList.toggle("d-none", !showNav);
  counter.textContent = showNav ? `${safeStart + 1} / ${urls.length}` : "";

  bootstrap.Carousel.getInstance(carouselEl)?.dispose();
  const carousel = new bootstrap.Carousel(carouselEl, { interval: false, wrap: true, touch: true });

  if (photoGallerySlideHandler) {
    carouselEl.removeEventListener("slid.bs.carousel", photoGallerySlideHandler);
  }
  photoGallerySlideHandler = () => {
    const active = inner.querySelector(".carousel-item.active");
    const idx = active ? [...inner.children].indexOf(active) : 0;
    counter.textContent = `${idx + 1} / ${urls.length}`;
  };
  carouselEl.addEventListener("slid.bs.carousel", photoGallerySlideHandler);

  if (safeStart > 0) carousel.to(safeStart);

  const modalEl = document.getElementById("photoGalleryModal");
  if (!photoGalleryModalInstance) photoGalleryModalInstance = new bootstrap.Modal(modalEl);
  photoGalleryModalInstance.show();
}

export function bindPhotoGalleryClicks(container) {
  if (!container || container.dataset.photoGalleryBound) return;
  container.dataset.photoGalleryBound = "1";
  container.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-photo-gallery]");
    if (!btn) return;
    e.preventDefault();
    const raw = btn.getAttribute("data-photo-gallery");
    if (!raw) return;
    try {
      const urls = JSON.parse(decodeURIComponent(raw));
      const start = parseInt(btn.getAttribute("data-photo-start") || "0", 10);
      const title = btn.getAttribute("data-photo-title") || "Fotos";
      openPhotoGallery(urls, start, title);
    } catch (err) {
      console.warn("No se pudo abrir la galería:", err);
    }
  });
}

export function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const id = `toast-${Date.now()}`;
  const icon = type === "success" ? "bi-check-circle" : type === "error" ? "bi-exclamation-triangle" : "bi-info-circle";
  const html = `
    <div id="${id}" class="toast toast-kawaii" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="toast-header">
        <i class="bi ${icon} me-2"></i>
        <strong class="me-auto">LozarGarden</strong>
        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Cerrar"></button>
      </div>
      <div class="toast-body">${escapeHtml(message)}</div>
    </div>`;
  container.insertAdjacentHTML("beforeend", html);
  const el = document.getElementById(id);
  const toast = new bootstrap.Toast(el, { delay: 3500 });
  toast.show();
  el.addEventListener("hidden.bs.toast", () => el.remove());
}

export function showModal(title, bodyHtml, footerHtml = "") {
  const bodyEl = document.getElementById("appModalBody");
  delete bodyEl?.dataset.photoGalleryBound;
  document.getElementById("appModalLabel").textContent = title;
  bodyEl.innerHTML = bodyHtml;
  document.getElementById("appModalFooter").innerHTML = footerHtml;
  const el = document.getElementById("appModal");
  if (!modalInstance) modalInstance = new bootstrap.Modal(el);
  modalInstance.show();
  return modalInstance;
}

export function hideModal() {
  modalInstance?.hide();
}

export function confirmDialog(title, message, onConfirm) {
  showModal(
    title,
    `<p>${escapeHtml(message)}</p>`,
    `
      <button type="button" class="btn btn-kawaii-outline" data-bs-dismiss="modal">Cancelar</button>
      <button type="button" class="btn btn-kawaii btn-kawaii-danger" id="confirm-btn">Confirmar</button>
    `
  );
  document.getElementById("confirm-btn").addEventListener("click", () => {
    hideModal();
    onConfirm();
  });
}

export function emptyState(icon, title, subtitle = "") {
  const isImage = typeof icon === "string" && (icon.endsWith(".png") || icon.includes("/icons/"));
  const iconHtml = isImage
    ? `<div class="empty-state-icon">${iconImg(icon, "empty-state-icon-img", title)}</div>`
    : `<div class="empty-state-icon" aria-hidden="true">${icon}</div>`;
  return `
    <div class="empty-state kawaii-card">
      <div class="empty-state-body">
        ${iconHtml}
        <h3 class="h5 fw-bold">${escapeHtml(title)}</h3>
        ${subtitle ? `<p class="mb-0">${escapeHtml(subtitle)}</p>` : ""}
      </div>
    </div>`;
}

export function pageHeader(title, subtitle, actionHtml = "", iconSrc = null) {
  const titleHtml = iconSrc
    ? `<span class="page-title-with-icon">${iconImg(iconSrc, "page-title-icon", title)}<span>${escapeHtml(title)}</span></span>`
    : escapeHtml(title);
  return `
    <div class="page-header d-flex flex-wrap align-items-start justify-content-between gap-3">
      <div>
        <h1 class="page-title">${titleHtml}</h1>
        ${subtitle ? `<p class="page-subtitle mb-0">${escapeHtml(subtitle)}</p>` : ""}
      </div>
      ${actionHtml ? `<div class="d-flex gap-2 flex-wrap">${actionHtml}</div>` : ""}
    </div>`;
}

export function searchInput(id, placeholder = "Buscar...") {
  return `
    <div class="search-box mb-3">
      <i class="bi bi-search" aria-hidden="true"></i>
      <input type="search" class="form-control" id="${id}" placeholder="${escapeHtml(placeholder)}" aria-label="${escapeHtml(placeholder)}">
    </div>`;
}

export function multiSelectOptions(items, selectedIds = [], labelKey = "nombre") {
  return items
    .map(
      (item) =>
        `<option value="${escapeHtml(item.id)}" ${selectedIds.includes(item.id) ? "selected" : ""}>${escapeHtml(item[labelKey])}</option>`
    )
    .join("");
}

export function renderSearchablePickerHtml({
  id,
  items,
  selectedIds = [],
  labelKey = "nombre",
  singleSelect = false,
  searchPlaceholder = "Buscar...",
}) {
  const inputType = singleSelect ? "radio" : "checkbox";

  const itemsHtml = items
    .map((item) => {
      const label = item[labelKey] ?? "";
      const checked = selectedIds.includes(item.id) ? "checked" : "";
      const selectedClass = checked ? " is-selected" : "";
      return `
        <label class="kawaii-check-item${selectedClass}" data-label="${escapeHtml(String(label).toLowerCase())}">
          <input type="${inputType}" name="${id}" value="${escapeHtml(item.id)}" ${checked}>
          <span class="kawaii-check-mark" aria-hidden="true"></span>
          <span class="kawaii-check-label">${escapeHtml(label)}</span>
        </label>`;
    })
    .join("");

  return `
    <div class="kawaii-picker" id="${id}" data-single-select="${singleSelect ? "true" : "false"}">
      <div class="kawaii-picker-search-wrap">
        <i class="bi bi-search" aria-hidden="true"></i>
        <input type="search" class="form-control kawaii-picker-search" placeholder="${escapeHtml(searchPlaceholder)}" aria-label="${escapeHtml(searchPlaceholder)}">
      </div>
      <div class="kawaii-picker-list" role="${singleSelect ? "radiogroup" : "group"}">
        ${itemsHtml || `<p class="text-muted small mb-0 px-1">No hay opciones</p>`}
      </div>
      <p class="kawaii-picker-empty text-muted small mb-0 mt-2 d-none">Sin resultados</p>
    </div>`;
}

export function bindSearchablePicker(pickerId) {
  const root = document.getElementById(pickerId);
  if (!root) return;

  const search = root.querySelector(".kawaii-picker-search");
  const list = root.querySelector(".kawaii-picker-list");
  const empty = root.querySelector(".kawaii-picker-empty");
  const single = root.dataset.singleSelect === "true";

  search?.addEventListener("input", () => {
    const q = search.value.toLowerCase().trim();
    let visible = 0;
    list?.querySelectorAll(".kawaii-check-item").forEach((item) => {
      const label = item.dataset.label || item.textContent.toLowerCase();
      const show = !q || label.includes(q);
      item.classList.toggle("d-none", !show);
      if (show) visible += 1;
    });
    empty?.classList.toggle("d-none", visible > 0);
  });

  list?.addEventListener("change", (e) => {
    if (!e.target.matches('input[type="checkbox"], input[type="radio"]')) return;
    if (single) {
      list.querySelectorAll(".kawaii-check-item").forEach((el) => el.classList.remove("is-selected"));
      e.target.closest(".kawaii-check-item")?.classList.add("is-selected");
      return;
    }
    e.target.closest(".kawaii-check-item")?.classList.toggle("is-selected", e.target.checked);
  });
}

export function getSearchablePickerValues(pickerId) {
  const root = document.getElementById(pickerId);
  if (!root) return [];
  return [...root.querySelectorAll(".kawaii-picker-list input:checked")].map((el) => el.value);
}

export function renderPhotoUploadHtml(baseId) {
  return `
    <div class="photo-upload-actions d-flex gap-2 mb-2">
      <button type="button" class="btn btn-kawaii flex-fill" id="${baseId}-btn-camera" aria-label="Hacer foto con la cámara">
        <i class="bi bi-camera me-1" aria-hidden="true"></i>Cámara
      </button>
      <button type="button" class="btn btn-kawaii-outline flex-fill" id="${baseId}-btn-gallery" aria-label="Elegir fotos de la galería">
        <i class="bi bi-images me-1" aria-hidden="true"></i>Galería
      </button>
      <input type="file" id="${baseId}-camera" accept="image/*" capture="environment" class="visually-hidden" aria-hidden="true" tabindex="-1">
      <input type="file" id="${baseId}-gallery" accept="image/*" multiple class="visually-hidden" aria-hidden="true" tabindex="-1">
    </div>
    <p class="form-text mb-3">Las fotos se optimizan automáticamente al subirlas.</p>
    <div id="${baseId}-preview" class="d-flex flex-wrap gap-2"></div>`;
}

export function bindPhotoUpload(baseId, { ownerType, ownerId, getPhotos, setPhotos }) {
  const cameraInput = document.getElementById(`${baseId}-camera`);
  const galleryInput = document.getElementById(`${baseId}-gallery`);
  const preview = document.getElementById(`${baseId}-preview`);

  function renderPreview() {
    if (!preview) return;
    preview.innerHTML = renderPhotoThumbs(getPhotos(), true);
    preview.querySelectorAll("[data-photo-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setPhotos(getPhotos().filter((p) => p.id !== btn.dataset.photoId));
        renderPreview();
      });
    });
  }

  async function handleFiles(files) {
    if (!files?.length) return;
    const newPhotos = await readFilesAsPhotos(files, ownerType, ownerId || "temp");
    if (!newPhotos.length) return;
    setPhotos([...getPhotos(), ...newPhotos]);
    renderPreview();
  }

  cameraInput?.addEventListener("change", async (e) => {
    await handleFiles(e.target.files);
    e.target.value = "";
  });

  galleryInput?.addEventListener("change", async (e) => {
    await handleFiles(e.target.files);
    e.target.value = "";
  });

  document.getElementById(`${baseId}-btn-camera`)?.addEventListener("click", () => cameraInput?.click());
  document.getElementById(`${baseId}-btn-gallery`)?.addEventListener("click", () => galleryInput?.click());

  renderPreview();
  return { refresh: renderPreview };
}

export async function readFilesAsPhotos(files, ownerType, ownerId, { onProgress } = {}) {
  const photos = [];
  const errors = [];

  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    try {
      onProgress?.(`Optimizando ${file.name}...`);
      const compressed = await compressImageFile(file);
      photos.push({
        id: uid(),
        ownerType,
        ownerId,
        dataUrl: compressed.dataUrl,
        filename: compressed.filename,
        mimeType: compressed.mimeType,
        width: compressed.width,
        height: compressed.height,
        bytes: compressed.bytes,
        originalBytes: compressed.originalBytes,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      errors.push(err.message);
    }
  }

  if (errors.length) {
    showToast(errors[0] + (errors.length > 1 ? ` (+${errors.length - 1} más)` : ""), "error");
  }

  if (photos.length && photos.some((p) => p.originalBytes > p.bytes)) {
    const saved = photos.reduce((sum, p) => sum + (p.originalBytes - p.bytes), 0);
    if (saved > 50 * 1024) {
      showToast(`${photos.length} foto(s) optimizada(s), ahorro ~${formatBytes(saved)}`);
    }
  }

  return photos;
}

export function renderPhotoThumbs(photos, onDelete = null, { gallery = false, galleryTitle = "Fotos" } = {}) {
  if (!photos.length) return "";
  const encoded = gallery ? encodePhotoGallery(photos) : "";
  const safeTitle = escapeHtml(galleryTitle);

  return photos
    .map((p, index) => {
      const src = p.dataUrl || p.downloadUrl || "";
      const img = `<img src="${src}" alt="Foto" class="photo-thumb" loading="lazy">`;

      if (gallery && !onDelete) {
        return `
    <button type="button" class="photo-thumb-btn" data-photo-gallery="${encoded}" data-photo-start="${index}" data-photo-title="${safeTitle}" aria-label="Ver foto ${index + 1} de ${photos.length}">
      ${img}
    </button>`;
      }

      return `
    <div class="position-relative d-inline-block">
      ${img}
      ${
        onDelete
          ? `<button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 rounded-circle p-0" style="width:22px;height:22px;font-size:10px;line-height:1" data-photo-id="${p.id}" aria-label="Eliminar foto">&times;</button>`
          : ""
      }
    </div>`;
    })
    .join("");
}

export function closeOffcanvasNav() {
  const el = document.getElementById("navOffcanvas");
  const instance = bootstrap.Offcanvas.getInstance(el);
  instance?.hide();
}
