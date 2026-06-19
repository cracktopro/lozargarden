/** Punto de entrada — navegación, autenticación y orquestación */

import { NAV_ITEMS } from "./utils.js";
import { initCatalogs } from "./catalog.js";
import { onAuthChange, logout, getCurrentUser } from "./auth.js";
import { closeOffcanvasNav, showToast, bindPhotoGalleryClicks } from "./ui.js";
import { navIconImg } from "./icons.js";
import * as dashboard from "./views/dashboard.js";
import * as plants from "./views/plants.js";
import * as diary from "./views/diary.js";
import * as containers from "./views/containers.js";
import * as treatments from "./views/treatments.js";
import * as catalogAdmin from "./views/catalog-admin.js";
import * as authView from "./views/auth.js";

const VIEWS = {
  dashboard,
  plants,
  diary,
  containers,
  treatments,
  catalog: catalogAdmin,
};

let currentView = "dashboard";
let appReady = false;

function showAuthScreen() {
  document.getElementById("auth-screen")?.classList.remove("d-none");
  document.getElementById("app-shell")?.classList.add("d-none");
  const authContainer = document.getElementById("auth-container");
  authContainer.innerHTML = authView.render();
  authView.bindEvents(authContainer);
}

function showAppShell() {
  document.getElementById("auth-screen")?.classList.add("d-none");
  document.getElementById("app-shell")?.classList.remove("d-none");
}

function buildNav(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const user = getCurrentUser();
  const userLabel = user?.displayName || user?.email || "";

  el.innerHTML = `
    ${NAV_ITEMS.map(
      (item) => `
      <li class="nav-item">
        <a class="nav-link ${item.id === currentView ? "active" : ""}" href="#" data-view="${item.id}">
          ${navIconImg(item.id, item.label)}
          <span>${item.label}</span>
        </a>
      </li>`
    ).join("")}
    <li class="nav-item mt-3 pt-3 border-top">
      <div class="px-3 mb-2 small text-muted text-truncate" title="${userLabel}">${userLabel}</div>
      <button type="button" class="nav-link w-100 text-start border-0 bg-transparent" id="logout-btn">
        <i class="bi bi-box-arrow-right" aria-hidden="true"></i>
        <span>Cerrar sesión</span>
      </button>
    </li>`;

  el.querySelectorAll("[data-view]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo(link.dataset.view);
    });
  });

  el.querySelector("#logout-btn")?.addEventListener("click", async () => {
    await logout();
    showToast("Sesión cerrada");
  });
}

async function renderView(viewId) {
  const view = VIEWS[viewId];
  if (!view) return;

  const container = document.getElementById("view-container");
  container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-success" role="status"><span class="visually-hidden">Cargando...</span></div></div>`;

  try {
    container.innerHTML = await view.render();
    if (view.bindEvents) view.bindEvents(container);
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div class="alert alert-danger">
        <strong>Error al cargar la vista.</strong> ${err.message}
      </div>`;
  }

  document.title = `${NAV_ITEMS.find((n) => n.id === viewId)?.label || "LozarGarden"} — LozarGarden`;
}

function updateNavActive() {
  document.querySelectorAll("#sidebar-nav [data-view], #mobile-nav [data-view]").forEach((link) => {
    const isActive = link.dataset.view === currentView;
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

export function navigateTo(viewId) {
  if (!VIEWS[viewId] || !appReady) return;
  currentView = viewId;
  updateNavActive();
  closeOffcanvasNav();
  renderView(viewId);
  window.location.hash = viewId;
  document.getElementById("main-content")?.focus();
}

async function startApp() {
  showAppShell();
  buildNav("sidebar-nav");
  buildNav("mobile-nav");

  if (!document.querySelector(".brand")?.dataset.bound) {
    document.querySelector(".brand").dataset.bound = "1";
    document.querySelector(".brand").addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo("dashboard");
    });
  }

  await initCatalogs();
  appReady = true;

  const hash = window.location.hash.replace("#", "");
  navigateTo(VIEWS[hash] ? hash : "dashboard");
}

function bindGlobalEvents() {
  document.addEventListener("view-refresh", () => {
    if (appReady) renderView(currentView);
  });

  document.getElementById("view-container")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-view]");
    if (btn && btn.closest("#view-container")) {
      e.preventDefault();
      navigateTo(btn.dataset.view);
    }
  });

  const viewContainer = document.getElementById("view-container");
  if (viewContainer) bindPhotoGalleryClicks(viewContainer);

  window.addEventListener("hashchange", () => {
    const h = window.location.hash.replace("#", "");
    if (appReady && VIEWS[h] && h !== currentView) navigateTo(h);
  });
}

function init() {
  bindGlobalEvents();

  onAuthChange(async (user) => {
    if (user) {
      await startApp();
    } else {
      appReady = false;
      currentView = "dashboard";
      showAuthScreen();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
