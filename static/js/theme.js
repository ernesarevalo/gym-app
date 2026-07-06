// static/js/theme.js
// -----------------------------------------------------------------
// Maneja 4 estados de tema: "light", "dark", "beast-light", "beast-dark".
//
// Reglas:
// - El tema elegido se guarda en localStorage y se mantiene hasta que el
//   usuario lo cambie (persiste entre páginas y recargas).
// - El botón de tema normal SOLO alterna entre claro <-> oscuro
//   (o, si estás en modo bestia, entre beast-light <-> beast-dark).
// - El modo "bestia" se activa haciendo 5 clics rápidos (en menos de
//   2 segundos) sobre el logo/título de la app. Arranca en su variante
//   clara (beast-light).
// - Estando en bestia, NO hay forma de "salir" con el botón de tema:
//   ese botón pasa a alternar entre las dos variantes de bestia.
//   Para volver a la app normal, hay que hacer los 5 clics de nuevo
//   sobre el logo (vuelve al último tema normal usado).
// -----------------------------------------------------------------

const THEME_KEY = "gymapp_theme";
const LAST_NORMAL_THEME_KEY = "gymapp_last_normal_theme";

function esBestia(theme) {
  return theme === "beast-light" || theme === "beast-dark";
}

function aplicarTema(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  if (!esBestia(theme)) {
    localStorage.setItem(LAST_NORMAL_THEME_KEY, theme);
  }
  actualizarIconoToggle(theme);
}

function actualizarIconoToggle(theme) {
  const btn = document.getElementById("themeToggleBtn");
  if (!btn) return;
  if (theme === "beast-dark") {
    btn.textContent = "☀️";
  } else if (theme === "beast-light") {
    btn.textContent = "🌙";
  } else if (theme === "dark") {
    btn.textContent = "☀️";
  } else {
    btn.textContent = "🌙";
  }
}

function inicializarTema() {
  const guardado = localStorage.getItem(THEME_KEY) || "light";
  aplicarTema(guardado);
}

function toggleTema() {
  const actual = localStorage.getItem(THEME_KEY) || "light";

  if (esBestia(actual)) {
    // Dentro de bestia, el botón alterna entre su claro y su oscuro
    aplicarTema(actual === "beast-light" ? "beast-dark" : "beast-light");
    return;
  }

  // Modo normal: alterna entre claro y oscuro
  aplicarTema(actual === "light" ? "dark" : "light");
}

// ---------- EASTER EGG: 5 clics rápidos sobre el logo ----------
let clicks = [];
const VENTANA_MS = 2000;
const CLICS_NECESARIOS = 5;

function registrarClicLogo() {
  const ahora = Date.now();
  clicks.push(ahora);
  clicks = clicks.filter(t => ahora - t <= VENTANA_MS);

  if (clicks.length >= CLICS_NECESARIOS) {
    clicks = [];
    const actual = localStorage.getItem(THEME_KEY) || "light";

    if (esBestia(actual)) {
      // Ya estaba en bestia -> vuelve al último tema normal
      const ultimo = localStorage.getItem(LAST_NORMAL_THEME_KEY) || "light";
      aplicarTema(ultimo);
      mostrarToast("Volviste a la normalidad 🙂");
    } else {
      // Activa modo bestia (arranca en su variante clara)
      aplicarTema("beast-light");
      mostrarToast("⚡ MODO BESTIA ACTIVADO ⚡");
    }
  }
}

function mostrarToast(texto) {
  let toast = document.getElementById("beastToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "beastToast";
    document.body.appendChild(toast);
  }
  toast.textContent = texto;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

// ---------- INIT ----------
document.addEventListener("DOMContentLoaded", () => {
  inicializarTema();

  const btnToggle = document.getElementById("themeToggleBtn");
  if (btnToggle) btnToggle.addEventListener("click", toggleTema);

  const logo = document.getElementById("appLogo");
  if (logo) logo.addEventListener("click", registrarClicLogo);
});
