// static/js/theme.js
// -----------------------------------------------------------------
// Maneja 3 temas: "light" (default), "dark" y "beast" (easter egg).
//
// Reglas:
// - El tema elegido se guarda en localStorage y se mantiene hasta
//   que el usuario lo cambie (persiste entre páginas y recargas).
// - El botón de tema SOLO alterna entre claro <-> oscuro.
// - El modo "bestia" se activa haciendo 5 clics rápidos (en menos de
//   2 segundos) sobre el logo/título de la app.
// - Estando en modo "bestia", tocar el botón de tema (claro/oscuro)
//   te saca de bestia y vuelve al último tema normal usado.
// -----------------------------------------------------------------

const THEME_KEY = "gymapp_theme";
const LAST_NORMAL_THEME_KEY = "gymapp_last_normal_theme";

function aplicarTema(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  if (theme === "light" || theme === "dark") {
    localStorage.setItem(LAST_NORMAL_THEME_KEY, theme);
  }
  actualizarIconoToggle(theme);
}

function actualizarIconoToggle(theme) {
  const btn = document.getElementById("themeToggleBtn");
  if (!btn) return;
  if (theme === "beast") {
    btn.textContent = "🌗 Salir de Modo Bestia";
  } else if (theme === "dark") {
    btn.textContent = "☀️ Modo Claro";
  } else {
    btn.textContent = "🌙 Modo Oscuro";
  }
}

function inicializarTema() {
  const guardado = localStorage.getItem(THEME_KEY) || "light";
  aplicarTema(guardado);
}

function toggleTema() {
  const actual = localStorage.getItem(THEME_KEY) || "light";

  if (actual === "beast") {
    // Salir de bestia, volver al último tema normal (o claro por defecto)
    const ultimo = localStorage.getItem(LAST_NORMAL_THEME_KEY) || "light";
    aplicarTema(ultimo);
    return;
  }

  // Alterna entre claro y oscuro
  aplicarTema(actual === "light" ? "dark" : "light");
}

// ---------- EASTER EGG: 5 clics rápidos sobre el logo ----------
let clicks = [];
const VENTANA_MS = 2000;
const CLICS_NECESARIOS = 5;

function registrarClicLogo() {
  const ahora = Date.now();
  clicks.push(ahora);
  // Descarta clics fuera de la ventana de tiempo
  clicks = clicks.filter(t => ahora - t <= VENTANA_MS);

  if (clicks.length >= CLICS_NECESARIOS) {
    clicks = [];
    activarModoBestia();
  }
}

function activarModoBestia() {
  aplicarTema("beast");
  mostrarToastBestia();
}

function mostrarToastBestia() {
  let toast = document.getElementById("beastToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "beastToast";
    document.body.appendChild(toast);
  }
  toast.textContent = "⚡ MODO BESTIA ACTIVADO ⚡";
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
