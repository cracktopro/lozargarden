/** Calculadora de capacidad de macetas (Macetadora) */

import { ICONS, iconImg } from "./icons.js";

const PI = Math.PI;

const POT_TYPES = {
  standard: { name: "Maceta estándar", usesAdjustments: false },
  terracota: { name: "Macetas Terracota", usesAdjustments: true, exteriorFactor: 0.875, interiorFactor: 0.63 },
  plasticforte: { name: "Macetas decorativas (Plasticforte)", usesAdjustments: true, exteriorFactor: 1, interiorFactor: 0.656 },
};

export function renderMacetadoraHtml({ showHeader = true } = {}) {
  return `
    <section class="macetadora-panel" aria-labelledby="macetadora-title">
      ${showHeader ? `
      <div class="macetadora-header mb-3">
        <h2 class="h5 fw-bold mb-1" id="macetadora-title">Macetadora</h2>
        <p class="small text-muted mb-0">Calcula cuántos litros de tierra caben en tu maceta</p>
      </div>` : `<h2 class="visually-hidden" id="macetadora-title">Macetadora</h2>`}
      <form id="macetadora-form" novalidate>
        <div class="row g-2 g-md-3 macetadora-form-section">
          <div class="col-6">
            <label for="macetadora-shape" class="form-label macetadora-label">
              ${iconImg(ICONS.macetadora.shape, "label-icon-img", "Forma")} Forma del contenedor
            </label>
            <select id="macetadora-shape" class="form-select macetadora-select" required>
              <option value="" selected>Selecciona una opción</option>
              <option value="rectangular">Rectangular</option>
              <option value="round">Redondo</option>
              <option value="truncated-cone">Cono truncado</option>
            </select>
          </div>
          <div class="col-6">
            <label for="macetadora-pot-type" class="form-label macetadora-label">
              ${iconImg(ICONS.macetadora.potType, "label-icon-img", "Tipo de maceta")} Tipo de maceta
            </label>
            <select id="macetadora-pot-type" class="form-select macetadora-select" required>
              <option value="" selected>Selecciona una opción</option>
              <option value="standard">Maceta estándar</option>
              <option value="terracota">Macetas Terracota</option>
              <option value="plasticforte">Macetas decorativas (Plasticforte)</option>
            </select>
          </div>
        </div>
        <div id="macetadora-input-fields" class="macetadora-form-section">
          <p class="text-muted small mb-0 macetadora-placeholder-hint">
            <span class="hint-icon">✨</span> Selecciona forma y tipo de maceta para ver los campos
          </p>
        </div>
        <div class="d-grid macetadora-form-section">
          <button type="submit" class="btn btn-kawaii btn-kawaii-pink" id="macetadora-calc-btn" disabled>
            Calcular capacidad
          </button>
        </div>
      </form>
      <div id="macetadora-result" class="macetadora-result macetadora-form-section d-none" role="status" aria-live="polite">
        <div class="macetadora-result-inner text-center">
          <p class="macetadora-result-label mb-1">Capacidad de tierra</p>
          <p class="macetadora-result-value mb-2">
            <span id="macetadora-result-liters">0</span>
            <span class="macetadora-result-unit">litros</span>
          </p>
          <p id="macetadora-result-detail" class="macetadora-result-detail small text-muted mb-0"></p>
          <button type="button" class="btn btn-sm btn-kawaii-outline mt-3" id="macetadora-apply-btn">
            Usar en nuevo contenedor
          </button>
        </div>
      </div>
      <details class="macetadora-details mt-3">
        <summary>Fórmulas utilizadas</summary>
        <ul class="small mb-0 mt-2">
          <li><strong>Rectangular:</strong> volumen = profundidad × longitud × anchura</li>
          <li><strong>Redondo:</strong> volumen = π × R² × profundidad</li>
          <li><strong>Cono truncado:</strong> volumen = ⅓ × π × prof × (r² + r×R + R²)</li>
        </ul>
      </details>
    </section>`;
}

export function initMacetadora(root, { onApplyCapacity } = {}) {
  if (!root) return;

  const shapeSelect = root.querySelector("#macetadora-shape");
  const potTypeSelect = root.querySelector("#macetadora-pot-type");
  const inputFields = root.querySelector("#macetadora-input-fields");
  const calcForm = root.querySelector("#macetadora-form");
  const calcBtn = root.querySelector("#macetadora-calc-btn");
  const resultPanel = root.querySelector("#macetadora-result");
  const resultLiters = root.querySelector("#macetadora-result-liters");
  const resultDetail = root.querySelector("#macetadora-result-detail");
  const applyBtn = root.querySelector("#macetadora-apply-btn");

  let lastLiters = null;

  function getSelectedShape() {
    return shapeSelect.value;
  }

  function getSelectedPotType() {
    return potTypeSelect.value;
  }

  function isBrandPot(potType) {
    return potType === "terracota" || potType === "plasticforte";
  }

  function canCalculate() {
    return getSelectedShape() !== "" && getSelectedPotType() !== "";
  }

  function updateCalcButton() {
    calcBtn.disabled = !canCalculate();
  }

  function syncShapeLock() {
    const potType = getSelectedPotType();
    if (isBrandPot(potType)) {
      shapeSelect.value = "truncated-cone";
      shapeSelect.disabled = true;
      shapeSelect.classList.add("macetadora-select-locked");
    } else {
      shapeSelect.disabled = false;
      shapeSelect.classList.remove("macetadora-select-locked");
    }
  }

  function createInputField(id, label, icon, placeholder) {
    return `
      <div class="col-6 col-md-4 field-row">
        <label for="${id}" class="form-label macetadora-label">
          <span class="label-icon">${icon}</span> ${label}
        </label>
        <div class="macetadora-input-group">
          <input type="number" id="${id}" class="form-control macetadora-input" min="0.01" step="0.1" placeholder="${placeholder}" required>
          <span class="input-suffix">cm</span>
        </div>
      </div>`;
  }

  function renderInputFields() {
    const shape = getSelectedShape();
    const potType = getSelectedPotType();

    if (!shape || !potType) {
      inputFields.innerHTML = `
        <p class="text-muted small mb-0 macetadora-placeholder-hint">
          <span class="hint-icon">✨</span> Selecciona forma y tipo de maceta para ver los campos
        </p>`;
      return;
    }

    let fieldsHtml = '<div class="row g-3">';

    if (shape === "rectangular") {
      fieldsHtml += createInputField("macetadora-length", "Longitud", "📏", "Ej: 60");
      fieldsHtml += createInputField("macetadora-width", "Anchura", "↔️", "Ej: 30");
      fieldsHtml += createInputField("macetadora-depth", "Profundidad", "⬇️", "Ej: 25");
    } else if (shape === "truncated-cone") {
      if (potType === "standard") {
        fieldsHtml += createInputField("macetadora-diameter", "Diámetro superior", "⭕", "Ej: 60,9");
        fieldsHtml += createInputField("macetadora-bottom-diameter", "Diámetro inferior", "⭕", "Ej: 38,3");
        fieldsHtml += createInputField("macetadora-height", "Profundidad", "⬇️", "Ej: 51,5");
      } else {
        fieldsHtml += createInputField("macetadora-diameter", "Diámetro superior", "⭕", "Ej: 70");
        fieldsHtml += createInputField("macetadora-height", "Profundidad", "⬇️", "Ej: 51,5");
      }
    } else {
      const diameterLabel = potType === "standard" ? "Diámetro" : "Diámetro exterior";
      fieldsHtml += createInputField("macetadora-diameter", diameterLabel, "⭕", "Ej: 40");
      fieldsHtml += createInputField("macetadora-height", "Altura", "⬇️", "Ej: 35");
    }

    fieldsHtml += "</div>";
    inputFields.innerHTML = fieldsHtml;
  }

  function parsePositiveNumber(id) {
    const el = root.querySelector(`#${id}`);
    if (!el) return null;
    const value = parseFloat(el.value);
    if (isNaN(value) || value <= 0) return null;
    return value;
  }

  function getInteriorDiameter(userDiameter, potType) {
    const config = POT_TYPES[potType];
    const realExterior = userDiameter * config.exteriorFactor;
    const interior = realExterior * config.interiorFactor;
    return { realExterior, interior };
  }

  function getConeDiameters(userTopDiameter, potType) {
    const config = POT_TYPES[potType];
    const topDiameter = userTopDiameter * config.exteriorFactor;
    const bottomDiameter = topDiameter * config.interiorFactor;
    return { topDiameter, bottomDiameter };
  }

  function truncatedConeVolume(topDiameter, bottomDiameter, height) {
    const R = topDiameter / 2;
    const r = bottomDiameter / 2;
    return (1 / 3) * PI * height * (r * r + r * R + R * R);
  }

  function formatLiters(liters) {
    if (liters < 1) return liters.toFixed(2);
    if (liters < 100) return liters.toFixed(1);
    return Math.round(liters).toLocaleString("es-ES");
  }

  function calculateRectangular() {
    const length = parsePositiveNumber("macetadora-length");
    const width = parsePositiveNumber("macetadora-width");
    const depth = parsePositiveNumber("macetadora-depth");
    if (length === null || width === null || depth === null) {
      return { error: "Introduce longitud, anchura y profundidad válidas (mayores que 0)." };
    }
    return { volumeCm3: length * width * depth, detail: `Rectangular: ${length} × ${width} × ${depth} cm` };
  }

  function calculateRound(potType) {
    const diameter = parsePositiveNumber("macetadora-diameter");
    const height = parsePositiveNumber("macetadora-height");
    if (diameter === null || height === null) {
      return { error: "Introduce diámetro y altura válidos (mayores que 0)." };
    }
    if (potType === "standard") {
      const radius = diameter / 2;
      return { volumeCm3: PI * radius * radius * height, detail: `Diámetro: ${diameter} cm · Altura: ${height} cm` };
    }
    const { realExterior, interior } = getInteriorDiameter(diameter, potType);
    const radius = interior / 2;
    const detail =
      potType === "terracota"
        ? `Exterior real: ${realExterior.toFixed(1)} cm · Interior: ${interior.toFixed(1)} cm · Altura: ${height} cm`
        : `Diámetro exterior: ${diameter} cm · Interior: ${interior.toFixed(1)} cm · Altura: ${height} cm`;
    return { volumeCm3: PI * radius * radius * height, detail };
  }

  function calculateTruncatedCone(potType) {
    const height = parsePositiveNumber("macetadora-height");
    if (height === null) return { error: "Introduce una profundidad válida (mayor que 0)." };

    if (potType === "standard") {
      const topDiameter = parsePositiveNumber("macetadora-diameter");
      const bottomDiameter = parsePositiveNumber("macetadora-bottom-diameter");
      if (topDiameter === null || bottomDiameter === null) {
        return { error: "Introduce diámetro superior e inferior válidos (mayores que 0)." };
      }
      return {
        volumeCm3: truncatedConeVolume(topDiameter, bottomDiameter, height),
        detail: `Diámetro superior: ${topDiameter} cm · Diámetro inferior: ${bottomDiameter} cm · Profundidad: ${height} cm`,
      };
    }

    const diameter = parsePositiveNumber("macetadora-diameter");
    if (diameter === null) {
      return { error: "Introduce diámetro superior y profundidad válidos (mayores que 0)." };
    }
    const { topDiameter, bottomDiameter } = getConeDiameters(diameter, potType);
    return {
      volumeCm3: truncatedConeVolume(topDiameter, bottomDiameter, height),
      detail: `Diámetro superior: ${topDiameter.toFixed(1)} cm · Diámetro inferior: ${bottomDiameter.toFixed(1)} cm · Profundidad: ${height} cm`,
    };
  }

  function calculate() {
    const shape = getSelectedShape();
    const potType = getSelectedPotType();
    if (!shape || !potType) return { error: "Selecciona la forma del contenedor y el tipo de maceta." };
    switch (shape) {
      case "rectangular": return calculateRectangular();
      case "round": return calculateRound(potType);
      case "truncated-cone": return calculateTruncatedCone(potType);
      default: return { error: "Forma no reconocida." };
    }
  }

  function showResult(liters, detail) {
    lastLiters = liters;
    resultLiters.textContent = formatLiters(liters);
    resultDetail.textContent = detail;
    resultPanel.classList.remove("d-none");
  }

  function hideResult() {
    lastLiters = null;
    resultPanel.classList.add("d-none");
  }

  function onSelectionChange() {
    syncShapeLock();
    updateCalcButton();
    renderInputFields();
    hideResult();
  }

  shapeSelect.addEventListener("change", onSelectionChange);
  potTypeSelect.addEventListener("change", onSelectionChange);

  calcForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!canCalculate()) return;
    const result = calculate();
    if (result.error) {
      hideResult();
      alert(result.error);
      return;
    }
    showResult(result.volumeCm3 / 1000, result.detail);
  });

  applyBtn?.addEventListener("click", () => {
    if (lastLiters == null || !onApplyCapacity) return;
    const detail = resultDetail.textContent || "";
    onApplyCapacity(`${formatLiters(lastLiters)} L (${detail})`);
  });

  updateCalcButton();
}
