// static/js/gamification.js
// Motor de Gamificación: GymCoins, Trofeos, Evaluación de Condiciones
// =====================================================================
// ESQUEMA FIRESTORE DEL USUARIO (extensión):
// usuarios/{uid} = {
//   ...camposExistentes,
//   gymcoins: 0,
//   trofeos_obtenidos: ["rompiendo_hielo", ...],  // IDs
//   inventario: [
//     { item_id: "banda_sudor_oro", tipo: "accesorio", equipado: false },
//   ],
//   avatar: {
//     especie: "perro",          // "perro" | "gato" | "conejo"
//     mascota_premium: null,     // "husky" | "shiba" | null
//     accesorio_equipado: null,
//     estado_animo: "normal",    // "on_fire" | "recuperacion" | "sedentario" | "normal"
//     morfologia: "normal",      // "fuerza" | "agil" | "normal"
//     energia_sesion: 0,         // 0-100, sube por serie completada
//   },
//   stats_gamificacion: {
//     rutinas_completadas: 0,
//     dias_semana_actual: 0,
//     max_peso_kg: 0,
//     primer_compuesto: false,
//     rutina_manual: false,
//     live_swap_usado: false,
//     modo_bestia_activado: false,
//     modo_express_usado: false,
//   }
// }
// =====================================================================

// ---- CATÁLOGO (se carga una vez desde el API) ----
let CATALOGO_TROFEOS = [];
let CATALOGO_TIENDA = [];

async function cargarCatalogos() {
  try {
    const [trof, tienda] = await Promise.all([
      fetch("/api/trofeos").then(r => r.json()),
      fetch("/api/tienda").then(r => r.json()).catch(() => [])
    ]);
    CATALOGO_TROFEOS = trof;
    CATALOGO_TIENDA = tienda;
  } catch (e) {
    console.warn("gamification: error cargando catálogos", e);
  }
}

// =====================================================================
// ECONOMÍA — GymCoins
// 1 coin por serie completada
// 5 coins por rutina completada
// 20 coins por trofeo desbloqueado (base; rareza multiplica)
// =====================================================================
const MULTIPLICADOR_RAREZA = { bronce: 1, plata: 1.5, oro: 2.5, diamante: 5 };

function coinsRecompensaTrofeo(trofeo) {
  const base = trofeo.recompensa_puntos || 20;
  const mult = MULTIPLICADOR_RAREZA[trofeo.rareza] || 1;
  return Math.round(base * mult);
}

async function otorgarCoins(uid, cantidad, motivo) {
  const ref = db.collection("usuarios").doc(uid);
  await ref.update({
    gymcoins: firebase.firestore.FieldValue.increment(cantidad)
  });
  // Guardar en historial de transacciones (no bloquea la UI)
  db.collection("usuarios").doc(uid).collection("coins_historial").add({
    cantidad,
    motivo,
    fecha: firebase.firestore.FieldValue.serverTimestamp()
  });
  return cantidad;
}

// Llamar 1 vez por serie completada
async function registrarSerieCoin(uid) {
  return otorgarCoins(uid, 1, "serie_completada");
}

// Llamar al marcar sesión como completada
async function registrarRutinaCoin(uid) {
  return otorgarCoins(uid, 5, "rutina_completada");
}

// =====================================================================
// TROFEOS — Evaluación de condiciones
// =====================================================================
async function evaluarYOtorgarTrofeos(uid, statsNuevas) {
  const snap = await db.collection("usuarios").doc(uid).get();
  const data = snap.data() || {};
  const yaObtenidos = new Set(data.trofeos_obtenidos || []);
  const stats = { ...(data.stats_gamificacion || {}), ...statsNuevas };

  const trofeosPendientes = CATALOGO_TROFEOS.filter(t => !yaObtenidos.has(t.id));
  const nuevos = [];

  for (const trofeo of trofeosPendientes) {
    if (evaluarCondicion(trofeo.condicion, stats, data)) {
      nuevos.push(trofeo);
    }
  }

  if (nuevos.length === 0) return [];

  // Batch write: guardar trofeos + coins + stats en una sola operación
  const batch = db.batch();
  const ref = db.collection("usuarios").doc(uid);

  const idsNuevos = nuevos.map(t => t.id);
  const coinsTotal = nuevos.reduce((acc, t) => acc + coinsRecompensaTrofeo(t), 0);

  batch.update(ref, {
    trofeos_obtenidos: firebase.firestore.FieldValue.arrayUnion(...idsNuevos),
    gymcoins: firebase.firestore.FieldValue.increment(coinsTotal),
    stats_gamificacion: stats
  });

  await batch.commit();
  return nuevos; // devuelve array de trofeos nuevos para mostrar notificación
}

function evaluarCondicion(condicion, stats, userData) {
  const { tipo, valor } = condicion;
  switch (tipo) {
    case "rutinas_completadas":
      return (stats.rutinas_completadas || 0) >= valor;
    case "dias_semana":
      return (stats.dias_semana_actual || 0) >= valor;
    case "piernas_inicio_semana":
      return stats.piernas_lunes_martes === true;
    case "primer_compuesto":
      return stats.primer_compuesto === true;
    case "max_peso_kg":
      return (stats.max_peso_kg || 0) >= valor;
    case "tonelaje_semanal_kg":
      return (stats.tonelaje_semanal || 0) >= valor;
    case "rutina_manual":
      return stats.rutina_manual === true;
    case "live_swap":
      return stats.live_swap_usado === true;
    case "modo_bestia_activado":
      return stats.modo_bestia_activado === true;
    case "racha_dias":
      return (userData.racha_dias || 0) >= valor;
    case "modo_express_usado":
      return stats.modo_express_usado === true;
    default:
      return false;
  }
}

// =====================================================================
// AVATAR — Morfología y Estado de Ánimo
// =====================================================================

// Mapeo especie → imágenes por estado morfológico y ánimo
// Las imágenes se servían con emojis/SVG en modo Beast (characters.js)
// En modo normal usamos emoji compuestos de texto por simplicidad
// (se pueden reemplazar por <img> cuando haya assets reales)
const AVATAR_SPRITES = {
  perro: {
    fuerza:      { normal:"🐕‍🦺", on_fire:"🐕‍🦺✨", sedentario:"🐾", recuperacion:"💤🐕" },
    agil:        { normal:"🐩", on_fire:"🐩✨", sedentario:"😴🐩", recuperacion:"🛀🐩" },
    normal:      { normal:"🐶", on_fire:"🐶🔥", sedentario:"😴🐶", recuperacion:"💤🐶" }
  },
  gato: {
    fuerza:      { normal:"🦁", on_fire:"🦁✨", sedentario:"😴🦁", recuperacion:"💤🦁" },
    agil:        { normal:"😸", on_fire:"😸✨", sedentario:"😾", recuperacion:"😴😺" },
    normal:      { normal:"🐱", on_fire:"🐱🔥", sedentario:"😴🐱", recuperacion:"💤🐱" }
  },
  conejo: {
    fuerza:      { normal:"🐰💪", on_fire:"🐰🔥", sedentario:"😴🐰", recuperacion:"💤🐰" },
    agil:        { normal:"🐇", on_fire:"🐇✨", sedentario:"😴🐇", recuperacion:"💤🐇" },
    normal:      { normal:"🐰", on_fire:"🐰🔥", sedentario:"😴🐰", recuperacion:"💤🐰" }
  },
  // Mascotas premium (desbloqueo por racha/coins)
  husky:         { normal:"🐺", on_fire:"🐺🔥", sedentario:"😴🐺", recuperacion:"💤🐺" },
  shiba:         { normal:"🦊", on_fire:"🦊🔥", sedentario:"😴🦊", recuperacion:"💤🦊" }
};

// ---- MORFOLOGÍA ----
// Analiza las últimas 4 semanas de sesiones y calcula si predomina fuerza o resistencia
async function calcularMorfologia(uid) {
  const cuatroSemanasAtras = new Date();
  cuatroSemanasAtras.setDate(cuatroSemanasAtras.getDate() - 28);

  const snap = await db.collection("usuarios").doc(uid)
    .collection("progreso").get();

  let repsBajas = 0; // fuerza: 1-5 reps
  let repsAltas = 0; // resistencia/definicion: 12+
  let repsMedia = 0; // hipertrofia: 6-12

  snap.docs.forEach(doc => {
    const d = doc.data();
    if (!d.fecha) return;
    const fecha = d.fecha.toDate ? d.fecha.toDate() : new Date(d.fecha);
    if (fecha < cuatroSemanasAtras) return;

    (d.sets || []).filter(s => s.is_completed).forEach(s => {
      const r = s.repeticiones || 0;
      if (r <= 5) repsBajas++;
      else if (r <= 11) repsMedia++;
      else repsAltas++;
    });
  });

  const total = repsBajas + repsMedia + repsAltas || 1;
  if (repsBajas / total > 0.4) return "fuerza";
  if (repsAltas / total > 0.4) return "agil";
  return "normal";
}

// ---- ESTADO DE ÁNIMO ----
async function calcularEstadoAnimo(uid) {
  const snap = await db.collection("usuarios").doc(uid).get();
  const data = snap.data() || {};

  if (data.descarga_activa) return "recuperacion";

  const ultimaFecha = data.ultima_sesion_fecha;
  if (!ultimaFecha) return "sedentario";

  const diffDias = Math.floor(
    (new Date() - new Date(ultimaFecha)) / 86400000
  );

  if (diffDias > 3) return "sedentario";
  if ((data.racha_dias || 0) >= 7) return "on_fire";
  return "normal";
}

// ---- OBTENER SPRITE ACTUAL ----
function obtenerSprite(avatarData) {
  const especie = avatarData.mascota_premium || avatarData.especie || "perro";
  const morfologia = avatarData.morfologia || "normal";
  const animo = avatarData.estado_animo || "normal";

  const sprites = AVATAR_SPRITES[especie];
  if (!sprites) return "🐶";

  // Las mascotas premium no tienen variantes morfológicas
  if (avatarData.mascota_premium) {
    return sprites[animo] || sprites.normal || "🐺";
  }

  return (sprites[morfologia] && sprites[morfologia][animo])
    || sprites.normal?.normal
    || "🐶";
}

// ---- ACTUALIZAR AVATAR EN FIRESTORE ----
async function actualizarAvatar(uid) {
  const [morfologia, animo] = await Promise.all([
    calcularMorfologia(uid),
    calcularEstadoAnimo(uid)
  ]);

  await db.collection("usuarios").doc(uid).set(
    { avatar: { morfologia, estado_animo: animo } },
    { merge: true }
  );

  return { morfologia, animo };
}

// =====================================================================
// BARRA DE ENERGÍA DE SESIÓN
// Sube 10 puntos por serie completada, máximo 100
// =====================================================================
let energiaSesion = 0;

function subirEnergia(series_completadas = 1) {
  energiaSesion = Math.min(100, energiaSesion + 10 * series_completadas);
  renderEnergia();
}

function renderEnergia() {
  const barra = document.getElementById("avatarEnergyBar");
  const fill = document.getElementById("avatarEnergyFill");
  if (!barra || !fill) return;
  fill.style.width = energiaSesion + "%";
  fill.style.backgroundColor = energiaSesion >= 80 ? "#ff5c39"
    : energiaSesion >= 40 ? "#f59e0b" : "#22c55e";
}

// =====================================================================
// PANTALLA DE RESUMEN POST-SESIÓN
// =====================================================================
async function mostrarResumenSesion(uid, coinsGanadosHoy, trofeosNuevos) {
  const snap = await db.collection("usuarios").doc(uid).get();
  const data = snap.data() || {};
  const avatarData = data.avatar || { especie: "perro" };
  const sprite = obtenerSprite({ ...avatarData, estado_animo: "on_fire" });

  const modal = document.getElementById("modalResumen");
  if (!modal) return;

  document.getElementById("resumenSprite").textContent = sprite;
  document.getElementById("resumenCoins").textContent = coinsGanadosHoy;
  document.getElementById("resumenTonelaje").textContent = data.tonelaje_hoy_kg || 0;
  document.getElementById("resumenRacha").textContent = data.racha_dias || 1;

  const listaTrofeos = document.getElementById("resumenTrofeos");
  listaTrofeos.innerHTML = trofeosNuevos.length
    ? trofeosNuevos.map(t => `<div class="trofeo-badge rareza-${t.rareza}">${t.icono} ${t.nombre}</div>`).join("")
    : "<span class='text-secondary small'>Sin trofeos nuevos hoy</span>";

  new bootstrap.Modal(modal).show();
  lanzarConfeti();
}

function lanzarConfeti() {
  // Confeti CSS puro — sin librerías externas
  const colores = ["#ff5c39","#fbbf24","#34d399","#60a5fa","#c084fc"];
  for (let i = 0; i < 40; i++) {
    const el = document.createElement("div");
    el.className = "confeti-particle";
    el.style.cssText = `
      position:fixed; width:8px; height:8px; border-radius:50%;
      background:${colores[i % colores.length]};
      left:${Math.random()*100}vw; top:-10px; z-index:9999;
      animation: confetiFall ${1 + Math.random()*2}s linear forwards;
      animation-delay: ${Math.random()*0.8}s;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }
}

// =====================================================================
// NOTIFICACIÓN DE NUEVO TROFEO (toast no bloqueante)
// =====================================================================
function notificarTrofeos(trofeos) {
  trofeos.forEach((t, i) => {
    setTimeout(() => {
      const toast = document.createElement("div");
      toast.className = `trofeo-toast rareza-${t.rareza}`;
      toast.innerHTML = `
        <span class="trofeo-icono">${t.icono}</span>
        <div>
          <div class="trofeo-nombre">${t.nombre}</div>
          <div class="trofeo-desc small">${t.descripcion}</div>
          <div class="trofeo-coins">+${coinsRecompensaTrofeo(t)} GymCoins</div>
        </div>
      `;
      document.body.appendChild(toast);
      setTimeout(() => toast.classList.add("visible"), 50);
      setTimeout(() => {
        toast.classList.remove("visible");
        setTimeout(() => toast.remove(), 400);
      }, 4000);
    }, i * 800);
  });
}

// =====================================================================
// MINI-AVATAR EN ESQUINA DURANTE ENTRENAMIENTO
// =====================================================================
function renderMiniAvatar(avatarData) {
  const cont = document.getElementById("miniAvatarContainer");
  if (!cont) return;
  const sprite = obtenerSprite(avatarData);
  const tema = localStorage.getItem("gymapp_theme") || "light";
  const esBestia = tema.startsWith("beast");

  cont.innerHTML = `
    <div class="mini-avatar ${esBestia ? 'beast-anim' : ''}">
      <div class="avatar-sprite">${sprite}</div>
      <div class="energy-bar-wrap">
        <div id="avatarEnergyFill" class="energy-bar-fill" style="width:${energiaSesion}%"></div>
      </div>
      <div class="gymcoins-badge">🪙 <span id="coinsDisplay">${avatarData.gymcoins || 0}</span></div>
    </div>
  `;
}

// Exports
window.Gamification = {
  cargarCatalogos,
  otorgarCoins, registrarSerieCoin, registrarRutinaCoin,
  evaluarYOtorgarTrofeos, notificarTrofeos,
  calcularMorfologia, calcularEstadoAnimo, obtenerSprite,
  actualizarAvatar, renderMiniAvatar,
  subirEnergia, renderEnergia,
  mostrarResumenSesion, lanzarConfeti,
  CATALOGO_TROFEOS, CATALOGO_TIENDA,
  coinsRecompensaTrofeo
};
