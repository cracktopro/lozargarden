import * as db from "../db.js";
import * as catalog from "../catalog.js";
import { countStore } from "../db.js";
import { formatDate, escapeHtml } from "../utils.js";
import { pageHeader } from "../ui.js";
import { ICONS, iconImg, statIconImg } from "../icons.js";

export async function render() {
  const [plantCount, diaryCount, containerCount, treatmentCount] = await Promise.all([
    countStore("plants"),
    countStore("diary"),
    countStore("containers"),
    countStore("treatments"),
  ]);

  const plants = await db.getAll("plants");
  const recentDiary = (await db.getAll("diary"))
    .sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`))
    .slice(0, 3);

  const catalogPlantas = await catalog.getCatalog("plantas");
  const enfermas = plants.filter((p) => p.enfermedadIds?.length || p.plagaIds?.length).length;

  let recentHtml = "";
  if (recentDiary.length) {
    recentHtml = recentDiary
      .map(
        (e) => `
      <div class="timeline-item">
        <div class="timeline-date">${escapeHtml(formatDate(e.fecha))} · ${escapeHtml(e.hora)}</div>
        <p class="mb-0 mt-1">${escapeHtml(e.detalle)}</p>
      </div>`
      )
      .join("");
  } else {
    recentHtml = `<p class="text-muted mb-0">Aún no hay entradas en el diario. ¡Empieza a registrar tu huerto!</p>`;
  }

  return `
    ${pageHeader("Bienvenido a LozarGarden", "Tu compañero kawaii para cuidar el huerto", "", ICONS.logo)}
    <div class="row g-3 mb-4">
      <div class="col-6 col-md-3">
        <a href="#plants" class="kawaii-card stat-card stat-card-link text-decoration-none text-reset" data-view="plants">
          <div class="stat-icon">${statIconImg("plants")}</div>
          <div class="stat-value">${plantCount}</div>
          <div class="stat-label">Plantas</div>
        </a>
      </div>
      <div class="col-6 col-md-3">
        <a href="#diary" class="kawaii-card stat-card stat-card-link text-decoration-none text-reset" data-view="diary">
          <div class="stat-icon">${statIconImg("diary")}</div>
          <div class="stat-value">${diaryCount}</div>
          <div class="stat-label">Entradas diario</div>
        </a>
      </div>
      <div class="col-6 col-md-3">
        <a href="#containers" class="kawaii-card stat-card stat-card-link text-decoration-none text-reset" data-view="containers">
          <div class="stat-icon">${statIconImg("containers")}</div>
          <div class="stat-value">${containerCount}</div>
          <div class="stat-label">Contenedores</div>
        </a>
      </div>
      <div class="col-6 col-md-3">
        <a href="#treatments" class="kawaii-card stat-card stat-card-link text-decoration-none text-reset" data-view="treatments">
          <div class="stat-icon">${statIconImg("treatments")}</div>
          <div class="stat-value">${treatmentCount}</div>
          <div class="stat-label">Tratamientos</div>
        </a>
      </div>
    </div>
    <div class="row g-3">
      <div class="col-lg-7">
        <div class="kawaii-card">
          <div class="card-header d-flex align-items-center gap-2">
            ${iconImg(ICONS.page.diary, "card-header-icon", "")}
            <span>Actividad reciente</span>
          </div>
          <div class="card-body">${recentHtml}</div>
        </div>
      </div>
      <div class="col-lg-5">
        <div class="kawaii-card kawaii-card-accent mb-3">
          <div class="card-header">Resumen rápido</div>
          <div class="card-body">
            <ul class="list-unstyled mb-0">
              <li class="mb-2"><span class="badge badge-kawaii-green">${catalogPlantas.length}</span> especies en catálogo</li>
              <li class="mb-2"><span class="badge badge-kawaii">${enfermas}</span> plantas con plaga o enfermedad</li>
            </ul>
          </div>
        </div>
        <div class="kawaii-card">
          <div class="card-header">Accesos rápidos</div>
          <div class="card-body d-grid gap-2">
            <button class="btn btn-kawaii" data-view="plants">+ Añadir planta</button>
            <button class="btn btn-kawaii btn-kawaii-pink" data-view="diary">+ Nueva entrada diario</button>
            <button class="btn btn-kawaii-outline" data-view="treatments">+ Registrar tratamiento</button>
          </div>
        </div>
      </div>
    </div>`;
}
