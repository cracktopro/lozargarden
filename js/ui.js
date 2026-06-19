/** Helpers de interfaz */

import { escapeHtml, uid } from "./utils.js";
import { compressImageFile, formatBytes } from "./image-utils.js";
import { iconImg } from "./icons.js";

let modalInstance = null;

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
  document.getElementById("appModalLabel").textContent = title;
  document.getElementById("appModalBody").innerHTML = bodyHtml;
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

export function renderPhotoUploadHtml(inputId, hint = "Toca para añadir foto (se optimiza automáticamente)") {
  return `
    <div class="photo-upload-zone position-relative mb-3" role="button" tabindex="0" onclick="document.getElementById('${inputId}').click()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();document.getElementById('${inputId}').click();}">
      <input type="file" id="${inputId}" accept="image/*" capture="environment" multiple aria-label="Subir fotos">
      <i class="bi bi-camera fs-2 text-success d-block mb-2" aria-hidden="true"></i>
      <span class="fw-semibold">${escapeHtml(hint)}</span>
    </div>
    <div id="${inputId}-preview" class="d-flex flex-wrap gap-2"></div>`;
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

export function renderPhotoThumbs(photos, onDelete = null) {
  if (!photos.length) return "";
  return photos
    .map((p) => {
      const src = p.dataUrl || p.downloadUrl || "";
      return `
    <div class="position-relative d-inline-block">
      <img src="${src}" alt="Foto" class="photo-thumb" loading="lazy">
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
