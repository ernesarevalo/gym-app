// static/js/beast-mascot.js
// Inyecta el personaje pixel-art "Capitán Beast" (tomado tal cual de
// https://github.com/ernesarevalo/gymroutine, characters.js) como mascota
// decorativa cuando el tema activo es "beast-light" o "beast-dark".
// Se actualiza cada vez que cambia el atributo data-theme del <html>.

const CAPITAN_BEAST_SVG = `<svg viewBox="0 0 200 340" xmlns="http://www.w3.org/2000/svg" style="width:90px;height:auto;">
  <ellipse cx="100" cy="334" rx="55" ry="8" fill="#000" opacity=".2"/>
  <rect x="55" y="4" width="90" height="12" rx="3" fill="#1a1a2e"/>
  <rect x="65" y="2" width="70" height="16" rx="5" fill="#2D1B69"/>
  <text x="78" y="14" font-size="9" fill="#FFD700" font-family="monospace">⚓ ★ ⚓</text>
  <rect x="60" y="16" width="80" height="62" rx="12" fill="#FBBF9F"/>
  <rect x="70" y="30" width="18" height="14" rx="4" fill="#1a1a2e"/>
  <rect x="112" y="30" width="18" height="14" rx="4" fill="#1a1a2e"/>
  <rect x="72" y="32" width="7" height="7" rx="2" fill="white" opacity=".6"/>
  <rect x="114" y="32" width="7" height="7" rx="2" fill="white" opacity=".6"/>
  <rect x="68" y="26" width="22" height="5" rx="2" fill="#1C0E08" transform="rotate(-8,79,28)"/>
  <rect x="110" y="26" width="22" height="5" rx="2" fill="#1C0E08" transform="rotate(8,121,28)"/>
  <rect x="88" y="38" width="3" height="18" rx="1" fill="#CC6666" opacity=".7"/>
  <rect x="75" y="58" width="50" height="10" rx="5" fill="#CC4444"/>
  <rect x="77" y="59" width="10" height="8" rx="2" fill="white"/>
  <rect x="90" y="59" width="10" height="8" rx="2" fill="white"/>
  <rect x="103" y="59" width="10" height="8" rx="2" fill="white"/>
  <rect x="116" y="59" width="8" height="8" rx="2" fill="white"/>
  <rect x="62" y="64" width="76" height="16" rx="8" fill="#2C1810" opacity=".4"/>
  <rect x="82" y="78" width="36" height="16" rx="6" fill="#FBBF9F"/>
  <rect x="40" y="92" width="120" height="100" rx="14" fill="#E63946"/>
  <rect x="55" y="92" width="30" height="50" rx="6" fill="#C1121F"/>
  <rect x="115" y="92" width="30" height="50" rx="6" fill="#C1121F"/>
  <text x="82" y="148" font-size="28" fill="white" font-family="monospace" font-weight="bold">1</text>
  <rect x="0" y="90" width="44" height="90" rx="22" fill="#FBBF9F"/>
  <rect x="156" y="90" width="44" height="90" rx="22" fill="#FBBF9F"/>
  <rect x="4" y="108" width="34" height="5" rx="2" fill="#D97706" opacity=".5"/>
  <rect x="162" y="108" width="34" height="5" rx="2" fill="#D97706" opacity=".5"/>
  <rect x="10" y="70" width="180" height="10" rx="5" fill="#6B7280"/>
  <rect x="10" y="67" width="22" height="16" rx="5" fill="#374151"/>
  <rect x="168" y="67" width="22" height="16" rx="5" fill="#374151"/>
  <rect x="4" y="62" width="28" height="28" rx="5" fill="#1F2937"/>
  <rect x="168" y="62" width="28" height="28" rx="5" fill="#1F2937"/>
  <rect x="34" y="72" width="26" height="22" rx="8" fill="#FBBF9F"/>
  <rect x="140" y="72" width="26" height="22" rx="8" fill="#FBBF9F"/>
  <rect x="42" y="190" width="116" height="70" rx="12" fill="#1D3557"/>
  <rect x="92" y="190" width="16" height="70" rx="6" fill="#152944"/>
  <rect x="44" y="256" width="50" height="58" rx="12" fill="#FBBF9F"/>
  <rect x="106" y="256" width="50" height="58" rx="12" fill="#FBBF9F"/>
  <rect x="36" y="306" width="64" height="16" rx="7" fill="#E63946"/>
  <rect x="100" y="306" width="64" height="16" rx="7" fill="#E63946"/>
  <rect x="38" y="307" width="22" height="5" rx="2" fill="white" opacity=".3"/>
  <rect x="102" y="307" width="22" height="5" rx="2" fill="white" opacity=".3"/>
  <text x="85" y="70" font-size="14" opacity=".8">🔥</text>
</svg>`;

function actualizarMascotaBestia() {
  const theme = document.documentElement.getAttribute("data-theme");
  let mascota = document.getElementById("beastMascot");

  if (theme === "beast-light" || theme === "beast-dark") {
    if (!mascota) {
      mascota = document.createElement("div");
      mascota.id = "beastMascot";
      mascota.style.position = "fixed";
      mascota.style.bottom = "10px";
      mascota.style.left = "10px";
      mascota.style.zIndex = "500";
      mascota.style.pointerEvents = "none";
      mascota.style.filter = "drop-shadow(0 4px 10px rgba(0,0,0,0.3))";
      mascota.innerHTML = CAPITAN_BEAST_SVG;
      document.body.appendChild(mascota);
    }
  } else if (mascota) {
    mascota.remove();
  }
}

// Observa cambios en data-theme (lo cambia theme.js) para mostrar/ocultar
new MutationObserver(actualizarMascotaBestia).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
document.addEventListener("DOMContentLoaded", actualizarMascotaBestia);
