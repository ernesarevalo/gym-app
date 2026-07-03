// static/js/companion.js
// Motor del Compañero Virtual — Módulos 1-4
// Máquina de Estados, Lógica de Negocio, UI/UX, Diálogos e Inactividad
// =====================================================================

// =====================================================================
// MÓDULO 1 — STATE MACHINE + SPRITESHEET MANAGER
// =====================================================================
// Spritesheet: 1 archivo PNG por mascota, grilla 6 columnas × 3 filas.
// Cada celda mide 120×120px. Total sheet: 720×360px.
// Las coordenadas (col, fila) determinan el background-position CSS.

const SPRITE_CELDA = 120; // px por celda
const SPRITE_COLS  = 6;

// Mapa de pose → posición (col, fila) en la grilla — mismo orden en todas las mascotas
const POSE_COORDS = {
  neutral:            { col: 0, fila: 0 },
  flexionando:        { col: 1, fila: 0 },
  entrenando:         { col: 2, fila: 0 },
  motivando:          { col: 3, fila: 0 },
  sudando:            { col: 4, fila: 0 },
  feliz:              { col: 5, fila: 0 },
  pensativo:          { col: 0, fila: 1 },
  durmiendo:          { col: 1, fila: 1 },
  en_descanso_tablet: { col: 2, fila: 1 },
  analizando:         { col: 3, fila: 1 },
  evolucionado:       { col: 5, fila: 1 },
  on_fire:            { col: 0, fila: 2 },
  en_descanso:        { col: 1, fila: 2 },
  sedentario:         { col: 2, fila: 2 },
  sedentario_extremo: { col: 3, fila: 2 },
};

// Metadata de poses para UI
const COMPANION_POSES = {
  neutral:            { label: "Neutral",           prioridad: 0 },
  flexionando:        { label: "Flexionando",        prioridad: 6 },
  entrenando:         { label: "Entrenando",         prioridad: 7 },
  motivando:          { label: "Motivando",          prioridad: 8 },
  sudando:            { label: "Sudando",            prioridad: 5 },
  feliz:              { label: "Feliz",              prioridad: 9 },
  pensativo:          { label: "Pensativo",          prioridad: 3 },
  durmiendo:          { label: "Durmiendo",          prioridad: 1 },
  analizando:         { label: "Analizando",         prioridad: 4 },
  evolucionado:       { label: "Evolucionado",       prioridad: 10 },
  on_fire:            { label: "On Fire 🔥",         prioridad: 11 },
  en_descanso:        { label: "En Descanso",        prioridad: 2 },
  sedentario:         { label: "Sedentario",         prioridad: -1 },
  sedentario_extremo: { label: "Sedentario Extremo", prioridad: -2 }
};

// Emojis fallback (se usan si la spritesheet no existe todavía)
const POSE_EMOJIS = {
  neutral:            (b) => b,
  flexionando:        (b) => b + "💪",
  entrenando:         (b) => b + "🏋️",
  motivando:          (b) => "⚡" + b + "⚡",
  sudando:            (b) => b + "💦",
  feliz:              (b) => b + "🎉",
  pensativo:          (b) => b + "🤔",
  durmiendo:          (b) => b + "💤",
  en_descanso_tablet: (b) => b + "📱",
  analizando:         (b) => "🔍" + b,
  evolucionado:       (b) => "✨" + b + "✨",
  on_fire:            (b) => b + "🔥",
  en_descanso:        (b) => b + "🧘",
  sedentario:         (b) => b + "😴",
  sedentario_extremo: (b) => "😵" + b
};

// ---- RENDER via SPRITESHEET ----
// Aplica background-position CSS según la posición en la grilla.
// Si la imagen falla (sheet no subida aún), muestra el emoji.
function renderSprite(mascota, pose, contenedor) {
  const coords = POSE_COORDS[pose] || POSE_COORDS["neutral"];
  const posX   = -(coords.col * SPRITE_CELDA);
  const posY   = -(coords.fila * SPRITE_CELDA);
  const sheetUrl = `/static/img/mascotas/${mascota.id}/spritesheet.png`;

  const spriteEl  = contenedor.querySelector(".companion-sprite");
  const emojiEl   = contenedor.querySelector(".companion-emoji");

  if (!spriteEl) return;

  // Intenta cargar la sheet via Image() para detectar si existe
  const tester = new Image();
  tester.onload = () => {
    // Sheet existe: usamos CSS background-position
    spriteEl.style.backgroundImage  = `url('${sheetUrl}')`;
    spriteEl.style.backgroundPosition = `${posX}px ${posY}px`;
    spriteEl.style.backgroundRepeat   = "no-repeat";
    spriteEl.style.backgroundSize     = `${SPRITE_CELDA * SPRITE_COLS}px auto`;
    spriteEl.style.display = "block";
    if (emojiEl) emojiEl.style.display = "none";
  };
  tester.onerror = () => {
    // Sheet no existe todavía: fallback al emoji
    spriteEl.style.display = "none";
    if (emojiEl) {
      emojiEl.style.display = "block";
      const emojiGen = POSE_EMOJIS[pose] || POSE_EMOJIS["neutral"];
      emojiEl.textContent = emojiGen(mascota.emoji_base || "🦊");
    }
  };
  tester.src = sheetUrl;

  // Actualiza data-pose para animaciones CSS
  contenedor.dataset.pose = pose;
}

// =====================================================================
// MÓDULO 2 — CEREBRO: CÁLCULO DE ESTADO
// =====================================================================

// Umbrales de días sin entrenar
const UMBRAL_SEDENTARIO = 3;         // días
const UMBRAL_SEDENTARIO_EXTREMO = 7; // días
const UMBRAL_ON_FIRE = 3;            // días de racha mínima

function calcularEstadoCompanion(userData) {
  const hoy = new Date();
  const ultima = userData.ultima_sesion_fecha
    ? new Date(userData.ultima_sesion_fecha)
    : null;

  const diasSinEntrenar = ultima
    ? Math.floor((hoy - ultima) / 86400000)
    : 999;

  const racha = userData.racha_dias || 0;
  const descargaActiva = userData.descarga_activa || false;

  // Prioridad de estados (de mayor a menor)
  if (racha > UMBRAL_ON_FIRE && diasSinEntrenar <= 1) {
    return { estado: "on_fire", dias: diasSinEntrenar, racha };
  }
  if (diasSinEntrenar > UMBRAL_SEDENTARIO_EXTREMO) {
    return { estado: "sedentario_extremo", dias: diasSinEntrenar, racha };
  }
  if (diasSinEntrenar > UMBRAL_SEDENTARIO) {
    return { estado: "sedentario", dias: diasSinEntrenar, racha };
  }
  if (descargaActiva) {
    return { estado: "en_descanso", dias: diasSinEntrenar, racha };
  }
  return { estado: "neutral", dias: diasSinEntrenar, racha };
}

// Evalúa el estado cada vez que se abre la app o cambia el contexto
async function evaluarEstadoCompanion(uid) {
  const snap = await db.collection("usuarios").doc(uid).get();
  const userData = snap.data() || {};
  const calculo = calcularEstadoCompanion(userData);

  // Guarda el estado calculado en Firestore (para el avatar)
  await db.collection("usuarios").doc(uid).set(
    { avatar: { estado_animo: calculo.estado } },
    { merge: true }
  );

  return { ...calculo, userData };
}

// Estado en tiempo real según contexto de la sesión activa
function determinarPoseSesion(contexto) {
  // contexto: { registrandoSerie, acababdeRomperPR, esperando, triaje }
  if (contexto.acababdeRomperPR) return "evolucionado";
  if (contexto.registrandoSerie && contexto.pesoAlto) return "sudando";
  if (contexto.registrandoSerie) return "entrenando";
  if (contexto.esperando) return "pensativo";
  if (contexto.analisis) return "analizando";
  return "neutral";
}

// =====================================================================
// MÓDULO 3 — UI/UX: CLASES CSS, GLOWS, CONFETI
// =====================================================================

const ESTADO_A_CLASE_CSS = {
  on_fire:            "companion-on-fire",
  en_descanso:        "companion-descanso",
  sedentario:         "companion-sedentario",
  sedentario_extremo: "companion-sedentario-extremo",
  neutral:            "companion-neutral",
  evolucionado:       "companion-evolucionado"
};

function aplicarEstadoVisual(contenedor, estado, mascota) {
  // Limpia todas las clases de estado previas
  Object.values(ESTADO_A_CLASE_CSS).forEach(cls => contenedor.classList.remove(cls));

  const claseEstado = ESTADO_A_CLASE_CSS[estado] || "companion-neutral";
  contenedor.classList.add(claseEstado);

  // Aplica la paleta de color del tipo de mascota como variables CSS
  if (mascota?.paleta) {
    contenedor.style.setProperty("--mascota-primario", mascota.paleta.primario);
    contenedor.style.setProperty("--mascota-secundario", mascota.paleta.secundario);
    contenedor.style.setProperty("--mascota-glow", mascota.paleta.glow);
  }
}

// -- Confeti al PR o sesión completada --
function dispararConfeti(tipo = "normal") {
  // Usa canvas-confetti si está disponible, sino usa el CSS puro de gamification.js
  if (typeof confetti !== "undefined") {
    const configs = {
      pr: [
        { particleCount: 120, spread: 100, origin: { y: 0.5 }, colors: ["#fbbf24","#ff5c39","#60a5fa"] },
        { particleCount: 60, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#fbbf24","#ff5c39"] },
        { particleCount: 60, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#60a5fa","#c084fc"] }
      ],
      sesion: [
        { particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ["#34d399","#60a5fa","#fbbf24"] }
      ]
    };
    (configs[tipo] || configs.sesion).forEach((cfg, i) =>
      setTimeout(() => confetti(cfg), i * 300)
    );
  } else {
    // Fallback: confeti CSS puro del módulo de gamificación
    if (typeof Gamification !== "undefined") Gamification.lanzarConfeti();
  }

  // Cambia a pose feliz sincronizado
  cambiarPose("feliz");
  setTimeout(() => cambiarPose(estadoActualCompanion.estado || "neutral"), 3000);
}

// =====================================================================
// MÓDULO 4-A — SISTEMA DE DIÁLOGOS (SPEECH BUBBLES)
// =====================================================================

const DIALOGOS = {
  on_fire: [
    "🔥 ¡{racha} días seguidos! Somos imparables.",
    "⚡ La racha habla sola. No la rompas ahora.",
    "🏆 ¡Modo bestia activado! El gym nos pertenece."
  ],
  sedentario: [
    "🥱 Hace {dias} días que no entrenamos... ¿Todo bien?",
    "😅 El sofá no cuenta como equipo de gym, te lo juro.",
    "🤔 {dias} días sin mover ni una pesa. ¿Volvemos?"
  ],
  sedentario_extremo: [
    "😵 {dias} días sin aparecer. Me estoy oxidando acá.",
    "🫠 Si seguimos así voy a olvidar cómo se hace una sentadilla.",
    "🆘 ¡EMERGENCIA! {dias} días de inactividad. ¡SOS!"
  ],
  en_descanso: [
    "😴 Semana de descarga. El descanso también es entreno.",
    "💆 Recuperate bien. La semana que viene pegamos más fuerte.",
    "🧘 Descansar es parte del plan. Tu cuerpo lo agradece."
  ],
  neutral: [
    "💪 ¿Listo para hoy?",
    "🎯 ¿Arrancamos?",
    "📋 Tu rutina te espera. ¡Vamos!"
  ],
  pr: [
    "🏆 ¡NUEVO RÉCORD PERSONAL! Eso estuvo ÉPICO.",
    "⚡ ¡{peso}kg! Ni yo me lo esperaba. ¡INCREÍBLE!",
    "🔥 PR en {ejercicio}. Guardalo en el historial, lo vas a querer recordar."
  ],
  serie_pesada: [
    "💪 ¡Esa última serie estuvo pesada! Recordá mantener la espalda recta.",
    "🧠 Técnica ante todo. Más vale menos peso y mejor forma.",
    "⚠️ Peso alto = máxima concentración en la postura."
  ],
  serie_completada: [
    "✅ ¡Serie lista! Descansá lo que necesitás.",
    "💦 Tomá agua entre series. El rendimiento depende de la hidratación.",
    "🎯 Una más y terminamos el bloque. ¡Vamos!"
  ],
  inactividad: [
    "👀 Che... ¿seguimos o qué?",
    "⏱️ Llevas {mins} minutos sin registrar nada. ¿Todo bien?",
    "🤔 ¿Estás descansando o me quedé solo acá?"
  ],
  triage_lumbar: [
    "⚠️ Molestia en la zona lumbar. Ajusté la rutina para protegerte.",
    "🩺 Con dolor lumbar, mejor Prensa que Sentadilla libre. Ya lo cambié.",
    "💡 Recordá: calentar bien la zona lumbar antes de cualquier ejercicio."
  ],
  felicitacion_racha: [
    "🎉 ¡{racha} días consecutivos! Sos un ejemplo.",
    "🔥 ¡{racha} días sin fallar! Tu mascota está orgullosa.",
    "⚡ Racha de {racha} días. Esto ya es un estilo de vida."
  ]
};

function obtenerDialogo(contexto, datos = {}) {
  const opciones = DIALOGOS[contexto] || DIALOGOS.neutral;
  let texto = opciones[Math.floor(Math.random() * opciones.length)];
  // Reemplaza placeholders
  Object.entries(datos).forEach(([k, v]) => {
    texto = texto.replace(new RegExp(`\\{${k}\\}`, "g"), v);
  });
  return texto;
}

let dialogoTimeout = null;

function mostrarDialogo(texto, duracion = 4500) {
  const burbuja = document.getElementById("companionDialogo");
  if (!burbuja) return;

  clearTimeout(dialogoTimeout);
  burbuja.textContent = texto;
  burbuja.classList.add("visible");
  burbuja.classList.remove("saliendo");

  dialogoTimeout = setTimeout(() => {
    burbuja.classList.add("saliendo");
    setTimeout(() => {
      burbuja.classList.remove("visible", "saliendo");
      burbuja.textContent = "";
    }, 400);
  }, duracion);
}

function dialogoContextual(contexto, datos = {}) {
  const texto = obtenerDialogo(contexto, datos);
  mostrarDialogo(texto);
}

// =====================================================================
// MÓDULO 4-B — IDLE TIMER (INACTIVIDAD)
// =====================================================================

const IDLE_MINUTOS = 5;
let idleTimer = null;
let idleMinutosTranscurridos = 0;

function resetIdleTimer() {
  clearInterval(idleTimer);
  idleMinutosTranscurridos = 0;

  idleTimer = setInterval(() => {
    idleMinutosTranscurridos++;
    if (idleMinutosTranscurridos >= IDLE_MINUTOS) {
      clearInterval(idleTimer);
      activarIdleMode();
    }
  }, 60000); // cada minuto
}

function activarIdleMode() {
  cambiarPose("pensativo");
  dialogoContextual("inactividad", { mins: IDLE_MINUTOS });
  // Pulsa la mascota para llamar la atención
  const cont = document.getElementById("companionWidget");
  if (cont) {
    cont.classList.add("idle-pulse");
    setTimeout(() => cont.classList.remove("idle-pulse"), 3000);
  }
}

// Escucha cualquier interacción del usuario para reiniciar el timer
function iniciarIdleDetector() {
  ["click", "touchstart", "keydown", "mousemove"].forEach(ev => {
    document.addEventListener(ev, resetIdleTimer, { passive: true });
  });
  resetIdleTimer();
}

// =====================================================================
// ESTADO GLOBAL DEL COMPANION
// =====================================================================

let estadoActualCompanion = {
  estado: "neutral",
  mascota: null,
  pose: "neutral"
};

let mascotasCatalogo = [];

async function cargarMascotas() {
  try {
    const r = await fetch("/api/mascotas");
    mascotasCatalogo = await r.json();
  } catch { mascotasCatalogo = []; }
}

function obtenerMascotaActiva(userData) {
  const idEquipado = userData.avatar?.mascota_premium
    ? `mascota_${userData.avatar.mascota_premium}`
    : userData.avatar?.mascota_id || "shiba_swole";

  return mascotasCatalogo.find(m => m.id === idEquipado)
    || mascotasCatalogo.find(m => m.desbloqueado_por_defecto)
    || { id: "shiba_swole", nombre: "Shiba-Swole", emoji_base: "🦊",
         paleta: { primario: "#e67e22", secundario: "#f39c12", glow: "#ff6b35" } };
}

function cambiarPose(nuevaPose) {
  if (!COMPANION_POSES[nuevaPose]) return;
  estadoActualCompanion.pose = nuevaPose;
  const cont = document.getElementById("companionWidget");
  if (!cont || !estadoActualCompanion.mascota) return;
  renderSprite(estadoActualCompanion.mascota, nuevaPose, cont);
  cont.dataset.pose = nuevaPose;
}

// =====================================================================
// INICIALIZACIÓN COMPLETA DEL COMPANION
// =====================================================================

async function inicializarCompanion(uid) {
  await cargarMascotas();
  const { estado, dias, racha, userData } = await evaluarEstadoCompanion(uid);

  const mascota = obtenerMascotaActiva(userData);
  estadoActualCompanion = { estado, mascota, pose: estado };

  const cont = document.getElementById("companionWidget");
  if (!cont) return;

  // Aplica visual
  aplicarEstadoVisual(cont, estado, mascota);
  renderSprite(mascota, estado, cont);

  // Diálogo de bienvenida contextual
  setTimeout(() => {
    if (estado === "on_fire") dialogoContextual("on_fire", { racha });
    else if (estado === "sedentario_extremo") dialogoContextual("sedentario_extremo", { dias });
    else if (estado === "sedentario") dialogoContextual("sedentario", { dias });
    else if (estado === "en_descanso") dialogoContextual("en_descanso", {});
    else dialogoContextual("neutral", {});
  }, 1200);

  // Inicia detector de inactividad (solo si hay sesión activa)
  iniciarIdleDetector();

  return { estado, mascota };
}

// =====================================================================
// HOOKS PARA EVENTOS DE ENTRENAMIENTO
// =====================================================================

// Llamar al completar una serie
function companionOnSerie(peso_kg, esPR, nombreEjercicio) {
  resetIdleTimer();

  if (esPR) {
    cambiarPose("evolucionado");
    dialogoContextual("pr", { peso: peso_kg, ejercicio: nombreEjercicio });
    setTimeout(() => dispararConfeti("pr"), 300);
    return;
  }

  // Serie "pesada" = más del 80% del PR histórico
  const esSerieHeavy = peso_kg > 60; // umbral genérico, ajustar por ejercicio
  if (esSerieHeavy) {
    cambiarPose("sudando");
    dialogoContextual("serie_pesada", {});
  } else {
    cambiarPose("entrenando");
    dialogoContextual("serie_completada", {});
  }

  // Vuelve a neutral después de un momento
  setTimeout(() => cambiarPose(estadoActualCompanion.estado), 5000);
}

// Llamar al terminar una sesión
function companionOnSesionCompletada(racha) {
  cambiarPose("feliz");
  dispararConfeti("sesion");
  if (racha >= 7) {
    dialogoContextual("felicitacion_racha", { racha });
  }
  setTimeout(() => cambiarPose("on_fire"), 4000);
}

// Llamar al aplicar triage de molestias
function companionOnTriage(zona) {
  cambiarPose("analizando");
  if (zona === "lumbar") dialogoContextual("triage_lumbar", {});
  setTimeout(() => cambiarPose(estadoActualCompanion.estado), 5000);
}

// Llamar al romper racha con número redondo
function companionOnRacha(dias) {
  if ([7, 14, 21, 30, 50, 100].includes(dias)) {
    cambiarPose("evolucionado");
    dialogoContextual("felicitacion_racha", { racha: dias });
    dispararConfeti("pr");
    setTimeout(() => cambiarPose("on_fire"), 4000);
  }
}

// =====================================================================
// EXPORTS
// =====================================================================
window.Companion = {
  inicializar: inicializarCompanion,
  cambiarPose,
  mostrarDialogo,
  dialogoContextual,
  dispararConfeti,
  onSerie: companionOnSerie,
  onSesionCompletada: companionOnSesionCompletada,
  onTriage: companionOnTriage,
  onRacha: companionOnRacha,
  resetIdle: resetIdleTimer,
  obtenerEstado: () => estadoActualCompanion
};
