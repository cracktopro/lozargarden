import { login, register, authErrorMessage } from "../auth.js";
import { showToast } from "../ui.js";
import { ICONS, iconImg } from "../icons.js";

let mode = "login";

function authCardHtml() {
  const isLogin = mode === "login";
  return `
    <div class="auth-wrapper d-flex align-items-center justify-content-center min-vh-100 py-4">
      <div class="kawaii-card auth-card w-100" style="max-width: 420px">
        <div class="card-body p-4 p-md-5">
          <div class="text-center mb-4">
            <div class="auth-logo mb-2">${iconImg(ICONS.logo, "auth-logo-img", "LozarGarden")}</div>
            <h1 class="h3 fw-bold text-success mb-1">LozarGarden</h1>
            <p class="text-muted mb-0">${isLogin ? "Inicia sesión en tu huerto" : "Crea tu cuenta"}</p>
          </div>
          <form id="auth-form" novalidate>
            ${!isLogin ? `
            <div class="mb-3">
              <label class="form-label" for="auth-name">Nombre</label>
              <input type="text" class="form-control" id="auth-name" autocomplete="name" placeholder="Tu nombre">
            </div>` : ""}
            <div class="mb-3">
              <label class="form-label" for="auth-email">Correo electrónico</label>
              <input type="email" class="form-control" id="auth-email" required autocomplete="email" placeholder="tu@email.com">
            </div>
            <div class="mb-3">
              <label class="form-label" for="auth-password">Contraseña</label>
              <input type="password" class="form-control" id="auth-password" required minlength="6" autocomplete="${isLogin ? "current-password" : "new-password"}" placeholder="Mínimo 6 caracteres">
            </div>
            <div id="auth-error" class="alert alert-danger d-none" role="alert"></div>
            <button type="submit" class="btn btn-kawaii w-100 mb-3" id="auth-submit">
              ${isLogin ? "Entrar" : "Registrarse"}
            </button>
          </form>
          <p class="text-center mb-0 small">
            ${isLogin ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}
            <button type="button" class="btn btn-link p-0 align-baseline" id="auth-toggle">
              ${isLogin ? "Regístrate" : "Inicia sesión"}
            </button>
          </p>
        </div>
      </div>
    </div>`;
}

export function render() {
  return authCardHtml();
}

export function bindEvents(container) {
  const form = container.querySelector("#auth-form");
  const toggle = container.querySelector("#auth-toggle");
  const errorEl = container.querySelector("#auth-error");
  const submitBtn = container.querySelector("#auth-submit");

  toggle?.addEventListener("click", () => {
    mode = mode === "login" ? "register" : "login";
    container.innerHTML = authCardHtml();
    bindEvents(container);
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.add("d-none");

    const email = container.querySelector("#auth-email").value.trim();
    const password = container.querySelector("#auth-password").value;
    const name = container.querySelector("#auth-name")?.value.trim() || "";

    if (!email || !password) {
      errorEl.textContent = "Completa todos los campos obligatorios.";
      errorEl.classList.remove("d-none");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Cargando...";

    try {
      if (mode === "login") {
        await login(email, password);
        showToast("¡Bienvenido de nuevo!");
      } else {
        await register(email, password, name);
        showToast("Cuenta creada correctamente");
      }
    } catch (err) {
      errorEl.textContent = authErrorMessage(err.code, err.message || "");
      errorEl.classList.remove("d-none");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = mode === "login" ? "Entrar" : "Registrarse";
    }
  });
}
