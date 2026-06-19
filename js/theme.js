/** Tema claro / oscuro — persistencia y toggle */

const STORAGE_KEY = "lozargarden-theme";

export function getStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getPreferredTheme() {
  const stored = getStoredTheme();
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === "dark" ? "#3a3248" : "#b8e6c8";
}

export function initTheme() {
  applyTheme(getPreferredTheme());
}

export function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  applyTheme(next);
  updateThemeToggleLabels();
  return next;
}

export function isDarkTheme() {
  return document.documentElement.dataset.theme === "dark";
}

export function updateThemeToggleLabels() {
  const dark = isDarkTheme();
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    const icon = btn.querySelector("i");
    const label = btn.querySelector("[data-theme-label]");
    if (icon) icon.className = dark ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
    if (label) label.textContent = dark ? "Modo claro" : "Modo oscuro";
    btn.setAttribute("aria-pressed", dark ? "true" : "false");
    btn.setAttribute("aria-label", dark ? "Activar modo claro" : "Activar modo oscuro");
  });
}

export function bindThemeToggle(container) {
  container?.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    if (btn.dataset.themeBound) return;
    btn.dataset.themeBound = "1";
    btn.addEventListener("click", () => toggleTheme());
  });
  updateThemeToggleLabels();
}
