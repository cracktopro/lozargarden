/** Rutas e helpers de iconos PNG — public/icons (respeta base del sitio en dev, build y GitHub Pages) */

function resolveBaseUrl() {
  const viteBase = import.meta.env?.BASE_URL;
  if (viteBase) return viteBase;

  if (typeof window !== "undefined") {
    const { pathname } = window.location;
    if (pathname === "/lozargarden" || pathname.startsWith("/lozargarden/")) {
      return "/lozargarden/";
    }
  }

  return "/";
}

export function iconPath(file) {
  return `${resolveBaseUrl()}icons/${file}`;
}

const BASE = `${resolveBaseUrl()}icons`;

export const ICONS = {
  favicon: `${BASE}/favicon.png`,
  logo: `${BASE}/logo.png`,
  nav: {
    dashboard: `${BASE}/logo.png`,
    plants: `${BASE}/plantas_nav.png`,
    diary: `${BASE}/diario_nav.png`,
    containers: `${BASE}/macetas_nav.png`,
    treatments: `${BASE}/tratamiento_nav.png`,
    catalog: `${BASE}/catalogo_nav.png`,
  },
  page: {
    plants: `${BASE}/plantas.png`,
    diary: `${BASE}/diario.png`,
    containers: `${BASE}/macetas.png`,
    treatments: `${BASE}/tratamiento.png`,
    catalog: `${BASE}/plantas.png`,
  },
  catalog: {
    plantas: `${BASE}/plantas.png`,
    plagas: `${BASE}/plagas.png`,
    enfermedades: `${BASE}/enfermedades.png`,
    estados: `${BASE}/estados.png`,
  },
  macetadora: {
    calculator: `${BASE}/calculadora.png`,
    shape: `${BASE}/forma.png`,
    potType: `${BASE}/tipo_macetas.png`,
  },
  toxicity: {
    safe: `${BASE}/gato.png`,
    toxic: `${BASE}/toxico.png`,
  },
};

export function iconImg(src, className = "app-icon", alt = "") {
  if (!src) return "";
  const safeAlt = alt.replace(/"/g, "");
  return `<img src="${src}" class="${className}" alt="${safeAlt}" loading="lazy" decoding="async">`;
}

export function navIconImg(viewId, label) {
  const src = ICONS.nav[viewId];
  return iconImg(src, "nav-icon-img", label);
}

export function statIconImg(viewId) {
  const src = ICONS.page[viewId];
  return iconImg(src, "stat-icon-img", "");
}
