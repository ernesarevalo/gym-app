// static/js/dashboard.js

const ADMIN_EMAIL = "ernestoarevalo@gmail.com";

const PRIORIDAD_BADGE = {
  1: { label: "P1 · Fuerza/SNC",         color: "#ef4444" },
  2: { label: "P2 · Hipertrofia",         color: "#f59e0b" },
  3: { label: "P3 · Estrés metabólico",   color: "#3b82f6" },
  4: { label: "P4 · Core/Articular",      color: "#22c55e" },
};

const ICONOS_GRUPO = {
  "Pecho": "🎯", "Espalda": "🦴", "Piernas": "🦵",
  "Hombros": "🤷", "Brazos": "💪", "Core": "🔥"
};

let usuarioActual = null;
let datosUsuario = null;
let rutinaActual = [];
let diaSeleccionado = 0;
let grupoParaReemplazo = null;
let indexEjercicioParaReemplazo = null;
let chartProgreso = null;
let catalogoCompleto = [];

const tabsDias = document.getElementById("tabsDias");
const contenidoDia = document.getElementById("contenidoDia");
const selectEjercicioProgreso = document.getElementById("selectEjercicioProgreso");
const modalCambiar = new bootstrap.Modal(document.getElementById("modalCambiar"));
const listaReemplazos = document.getElementById("listaReemplazos");

// ---------- AUTENTICACIÓN ----------

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "/";
    return;
  }
  usuarioActual = user;
  catalogoCompleto = await obtenerCatalogoEjercicios();
  await cargarRutina();
});

// ---------- CARGAR RUTINA ----------

async function cargarRutina() {
  const docSnap = await db.collection("usuarios").doc(usuarioActual.uid).get();
  const data = docSnap.data();

  if (!data || !data.disclaimers_aceptados) { window.location.href = "/disclaimers"; return; }
  datosUsuario = data;

  const navNombre = document.getElementById("navNombreUsuario");
  if (navNombre) navNombre.textContent = data.username || data.nombre || "Mi perfil";

  if (!data.rutina) { window.location.href = "/onboarding"; return; }

  rutinaActual = data.rutina;
  renderTabsDias();
  renderDia(0);
  poblarSelectorProgreso();
  verificarCumpleanos(data);
  document.getElementById("btnVolverAnterior")?.classList.toggle("d-none", !data.rutina_anterior);

  // --- Racha info ---
  if (data.racha_dias) {
    const rachaEl = document.getElementById("rachaInfo");
    if (rachaEl) {
      rachaEl.textContent = `🔥 Racha: ${data.racha_dias} días consecutivos`;
      rachaEl.classList.remove("d-none");
    }
  }

  // --- Mapa de calor muscular ---
  inicializarMapaCalor();

  // --- Tonelaje semanal ---
  inicializarTonelaje();

  // --- Gamificación: cargar catálogos ---
  await Gamification.cargarCatalogos();

  // --- Companion Virtual: inicializar con estado calculado ---
  const companionResult = await Companion.inicializar(usuarioActual.uid);
  if (companionResult?.mascota) {
    const nombreEl = document.querySelector(".companion-nombre");
    if (nombreEl) nombreEl.textContent = companionResult.mascota.nombre;
  }

  // Clic en el widget abre diálogo contextual
  document.getElementById("companionWidget")?.addEventListener("click", () => {
    const { estado, mascota } = Companion.obtenerEstado();
    const data = datosUsuario || {};
    if (estado === "on_fire") Companion.dialogoContextual("on_fire", { racha: data.racha_dias || 0 });
    else if (estado === "sedentario") Companion.dialogoContextual("sedentario", { dias: Math.floor((new Date() - new Date(data.ultima_sesion_fecha)) / 86400000) || 0 });
    else Companion.dialogoContextual("neutral", {});
  });

  // --- Verificar descarga propuesta ---
  const descarga = await GymEngine.verificarDescarga(usuarioActual.uid);
  if (descarga.proponer) {
    document.getElementById("mensajeDescarga").textContent = " " + descarga.mensaje;
    document.getElementById("bannnerDescarga").classList.remove("d-none");
  }

  // --- Triage de molestias (modal al abrir, solo si no se preguntó hoy) ---
  const hoy = new Date().toDateString();
  const triageHoy = sessionStorage.getItem("triage_" + hoy);
  if (!triageHoy) {
    new bootstrap.Modal(document.getElementById("triageModal")).show();
  }
}

// ---------- TRIAGE DE MOLESTIAS ----------

document.querySelectorAll(".btnZonaDolor").forEach(btn => {
  btn.addEventListener("click", async () => {
    const zona = btn.dataset.zona;
    const hoy = new Date().toDateString();
    sessionStorage.setItem("triage_" + hoy, zona);

    bootstrap.Modal.getInstance(document.getElementById("triageModal"))?.hide();

    if (zona !== "ninguno") {
      const { ejercicios: ajustados, reemplazos } =
        await GymEngine.aplicarTriage(rutinaActual[diaSeleccionado].ejercicios, zona, catalogoCompleto);

      rutinaActual[diaSeleccionado].ejercicios = ajustados;
      renderDia(diaSeleccionado);

      // Companion reacciona al triage
      Companion.onTriage(zona);

      if (reemplazos.length) {
        const res = document.getElementById("triageResultado");
        res.innerHTML = reemplazos.map(r =>
          `⚠️ <strong>${r.original}</strong> → reemplazado por <strong>${r.reemplazo}</strong>. ${r.motivo}`
        ).join("<br>");
        res.classList.remove("d-none");
        setTimeout(() => document.getElementById("triageModal").classList.add("show"), 100);
      }
    }
  });
});

// ---------- DESCARGA ----------

document.getElementById("btnAceptarDescarga")?.addEventListener("click", async () => {
  rutinaActual[diaSeleccionado].ejercicios =
    GymEngine.aplicarDescarga(rutinaActual[diaSeleccionado].ejercicios);
  await db.collection("usuarios").doc(usuarioActual.uid)
    .set({ descarga_activa: true }, { merge: true });
  document.getElementById("bannnerDescarga").classList.add("d-none");
  renderDia(diaSeleccionado);
});

document.getElementById("btnRechazarDescarga")?.addEventListener("click", () => {
  document.getElementById("bannnerDescarga").classList.add("d-none");
});

// ---------- MODO EXPRESS ----------

document.getElementById("btnExpress")?.addEventListener("click", () => {
  const dia = rutinaActual[diaSeleccionado];
  const express = GymEngine.modoExpress(dia.ejercicios);
  rutinaActual[diaSeleccionado].ejercicios = express;
  renderDia(diaSeleccionado);
  alert(`⚡ Modo Express activado: ${express.length} ejercicios para una sesión de 30 min.`);

  // Trigger trofeo "Siempre Hay Tiempo"
  Gamification.evaluarYOtorgarTrofeos(usuarioActual.uid, { modo_express_usado: true })
    .then(nuevos => { if (nuevos.length) Gamification.notificarTrofeos(nuevos); })
    .catch(() => {});
});

// ---------- MAPA DE CALOR ----------

async function inicializarMapaCalor() {
  try {
    const mapa = await GymEngine.calcularMapaCalor(usuarioActual.uid);
    if (!Object.keys(mapa).length) return;

    const card = document.getElementById("mapaCalor");
    const cont = document.getElementById("mapaCalorContent");
    card.classList.remove("d-none");

    const grupos = ["Pecho","Espalda","Piernas","Hombros","Brazos","Core"];
    cont.innerHTML = grupos.map(g => {
      const nivel = mapa[g] || 0;
      const { color, label } = GymEngine.colorCalor(nivel);
      return `<span class="badge p-2" style="background:${color}22; color:${color}; border:1px solid ${color};"
                    title="${label}">${ICONOS_GRUPO[g]} ${g}</span>`;
    }).join("");
  } catch(e) { console.warn("Mapa de calor:", e); }
}

// ---------- TONELAJE ----------

async function inicializarTonelaje() {
  try {
    const { total_kg } = await GymEngine.calcularTonelajeSemanal(usuarioActual.uid);
    if (total_kg > 0) {
      document.getElementById("tonelajeCard").classList.remove("d-none");
      document.getElementById("tonelajeTotal").textContent = total_kg.toLocaleString();
    }
  } catch(e) { console.warn("Tonelaje:", e); }
}

// ---------- SESIÓN COMPLETADA + GAMIFICACIÓN ----------

let coinsGanadosEnSesion = 0;

document.getElementById("btnSesionCompletada")?.addEventListener("click", async () => {
  const dia = rutinaActual[diaSeleccionado];
  const btn = document.getElementById("btnSesionCompletada");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  // 1. Guardar sesión en historial (mapa de calor + racha)
  const resultadoRacha = await GymEngine.guardarSesionCompletada(usuarioActual.uid, dia);

  // 2. Coins por rutina completada
  await Gamification.registrarRutinaCoin(usuarioActual.uid);
  coinsGanadosEnSesion += 5;

  // 3. Calcular tonelaje del día para el resumen
  const { total_kg: tonelajeHoy } = await GymEngine.calcularTonelajeSemanal(usuarioActual.uid);

  // 4. Construir stats para evaluar trofeos
  const snap = await db.collection("usuarios").doc(usuarioActual.uid).get();
  const userData = snap.data() || {};
  const statsActuales = userData.stats_gamificacion || {};

  // Detectar "piernas inicio de semana" (lunes=1, martes=2 en JS)
  const diaSemana = new Date().getDay();
  const grupHoy = new Set(dia.ejercicios.map(e => e.grupo_muscular));
  const piernasPrimerossDias = grupHoy.has("Piernas") && (diaSemana === 1 || diaSemana === 2);

  const statsNuevas = {
    ...statsActuales,
    rutinas_completadas: (statsActuales.rutinas_completadas || 0) + 1,
    dias_semana_actual: (statsActuales.dias_semana_actual || 0) + 1,
    tonelaje_semanal: tonelajeHoy,
    piernas_lunes_martes: piernasPrimerossDias || statsActuales.piernas_lunes_martes || false
  };

  // 5. Evaluar y otorgar trofeos
  const trofeosNuevos = await Gamification.evaluarYOtorgarTrofeos(usuarioActual.uid, statsNuevas);
  if (trofeosNuevos.length) {
    coinsGanadosEnSesion += trofeosNuevos.reduce((acc, t) => acc + Gamification.coinsRecompensaTrofeo(t), 0);
    Gamification.notificarTrofeos(trofeosNuevos);
  }

  // 6. Actualizar avatar (morfología + ánimo)
  const { morfologia, animo } = await Gamification.actualizarAvatar(usuarioActual.uid);

  // 7. Racha info
  const rachaEl = document.getElementById("rachaInfo");
  if (rachaEl && resultadoRacha) {
    rachaEl.textContent = `🔥 Racha: ${resultadoRacha.racha} días consecutivos`;
    rachaEl.classList.remove("d-none");
  }

  // 8. Modo Bestia desbloqueado por racha
  if (resultadoRacha?.bestiaDesbloqueada) {
    // También se evalúa el trofeo correspondiente
    await Gamification.evaluarYOtorgarTrofeos(usuarioActual.uid, {
      ...statsNuevas, modo_bestia_activado: true
    });
    setTimeout(() => {
      alert("🔥 ¡21 días consecutivos! ¡MODO BESTIA DESBLOQUEADO!");
      window.location.reload();
    }, 2000);
  }

  // 9. Actualizar tonelaje en pantalla
  inicializarTonelaje();

  // 10. Mostrar modal de resumen
  await Gamification.mostrarResumenSesion(
    usuarioActual.uid,
    coinsGanadosEnSesion,
    trofeosNuevos
  );

  // 11. Companion: celebración post-sesión
  Companion.onSesionCompletada(resultadoRacha?.racha || 0);
  if (resultadoRacha?.racha) Companion.onRacha(resultadoRacha.racha);

  btn.textContent = "✅ ¡Sesión guardada!";
  coinsGanadosEnSesion = 0;
});

// ---------- CALENTAMIENTO Y MOVILIDAD ESPECÍFICOS POR DÍA ----------
// En vez de un bloque genérico, se calcula según los grupos musculares
// que realmente se entrenan ese día (formato inspirado en daBeast).

const CALENTAMIENTO_POR_GRUPO = {
  "Pecho": "10-12 flexiones de pecho lentas sin peso (o apoyadas en rodillas)",
  "Espalda": "15 remos con banda elástica liviana + 20-30 seg colgado de una barra (dead hang)",
  "Piernas": "15 sentadillas con peso corporal + 10 zancadas caminando por pierna",
  "Hombros": "Círculos de brazos amplios ×10 por sentido + 15 rotaciones externas con banda liviana",
  "Brazos": "15 curl con banda elástica liviana + 15 extensiones de tríceps sin peso",
  "Core": "20-30 seg de plancha abdominal + 10 dead bugs por lado"
};

const MOVILIDAD_POR_GRUPO = {
  "Pecho": "Apertura de pecho en marco de puerta, 30 seg por lado",
  "Espalda": "Gato-camello (flexión/extensión de columna) ×8 repeticiones lentas",
  "Piernas": "Círculos de cadera ×10 por lado + rotaciones de tobillo ×10 por pie",
  "Hombros": "Círculos de hombro amplios ×10 adelante y ×10 atrás",
  "Brazos": "Rotaciones de muñeca ×10 por lado + estiramiento de antebrazo 20 seg",
  "Core": "Rotaciones de torso suaves de pie ×10 por lado"
};

function renderCalentamientoYMovilidadDelDia(dia) {
  const gruposDelDia = [...new Set(dia.ejercicios.map(e => e.grupo_muscular))];

  if (gruposDelDia.length === 0) {
    document.getElementById("seccionCalentamiento").innerHTML = "";
    document.getElementById("seccionMovilidad").innerHTML = "";
    return;
  }

  const itemsCalentamiento = gruposDelDia
    .filter(g => CALENTAMIENTO_POR_GRUPO[g])
    .map(g => `<li><strong>${ICONOS_GRUPO[g] || ""} ${g}:</strong> ${CALENTAMIENTO_POR_GRUPO[g]}</li>`)
    .join("");

  const itemsMovilidad = gruposDelDia
    .filter(g => MOVILIDAD_POR_GRUPO[g])
    .map(g => `<li><strong>${ICONOS_GRUPO[g] || ""} ${g}:</strong> ${MOVILIDAD_POR_GRUPO[g]}</li>`)
    .join("");

  document.getElementById("seccionCalentamiento").innerHTML = `
    <h5>🔥 Calentamiento específico para ${dia.titulo}</h5>
    <p class="small text-secondary mb-2">Antes de tus ejercicios principales, 5-7 minutos:</p>
    <ul class="mb-0">
      <li>1-2 min de cardio suave general (caminata rápida, bicicleta o cuerda).</li>
      ${itemsCalentamiento}
    </ul>
  `;

  document.getElementById("seccionMovilidad").innerHTML = `
    <h5>🧘 Movilidad articular para ${dia.titulo}</h5>
    <ul class="mb-0">${itemsMovilidad}</ul>
    <p class="small text-secondary mt-2 mb-0">
      Esta movilidad está pensada para los grupos musculares de este día específico.
      Es orientativa; si tenés alguna lesión o limitación, consultá con tu profesional
      antes de realizarla (ver disclaimers).
    </p>
  `;
}

// ---------- CUMPLEAÑOS ----------

function verificarCumpleanos(data) {
  if (!data.fecha_nacimiento) return;
  const hoy = new Date();
  const nacimiento = new Date(data.fecha_nacimiento);
  if (hoy.getDate() === nacimiento.getDate() && hoy.getMonth() === nacimiento.getMonth()) {
    const yaMostrado = sessionStorage.getItem("cumple_mostrado_" + hoy.toDateString());
    if (!yaMostrado) {
      new bootstrap.Modal(document.getElementById("modalCumple")).show();
      sessionStorage.setItem("cumple_mostrado_" + hoy.toDateString(), "1");
    }
  }
}

// ---------- TABS Y RENDER DE EJERCICIOS ----------

function renderTabsDias() {
  tabsDias.innerHTML = "";
  rutinaActual.forEach((dia, idx) => {
    const btn = document.createElement("button");
    btn.className = "btn btn-sm btn-outline-light dia-tab" + (idx === diaSeleccionado ? " active" : "");
    btn.textContent = `Día ${dia.dia}`;
    btn.addEventListener("click", () => renderDia(idx));
    tabsDias.appendChild(btn);
  });
}

function renderTecnica(ej, idGen) {
  if (!ej.tecnica) return "";
  return `
    <button class="btn btn-sm btn-outline-light mt-2" type="button" data-bs-toggle="collapse" data-bs-target="#${idGen}">
      📖 Ver técnica completa
    </button>
    <div class="collapse mt-2" id="${idGen}">
      <div class="small">
        <p class="mb-1"><strong>🧍 Postura:</strong> ${ej.tecnica.postura}</p>
        <p class="mb-1"><strong>⚠️ Errores comunes:</strong> ${ej.tecnica.errores_comunes}</p>
        <p class="mb-0"><strong>🛡️ Seguridad:</strong> ${ej.tecnica.seguridad}</p>
      </div>
    </div>
  `;
}

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const aunNoCumplio = (hoy.getMonth() < nac.getMonth()) ||
    (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate());
  if (aunNoCumplio) edad--;
  return edad;
}

const IDS_LUMBAR_EXIGENTE = new Set(["piernas_1", "piernas_7"]); // Sentadilla con Barra, Peso Muerto Convencional

function mostrarAvisoLumbarPorEdad(dia) {
  const cont = document.getElementById("avisoLumbarEdad");
  if (!cont) return;

  const edad = datosUsuario ? calcularEdad(datosUsuario.fecha_nacimiento) : null;
  const tieneLumbarExigente = dia.ejercicios.some(e => IDS_LUMBAR_EXIGENTE.has(e.ejercicio_id));

  if (edad !== null && edad >= 39 && tieneLumbarExigente) {
    cont.classList.remove("d-none");
    cont.innerHTML = `⚠️ Este día incluye sentadilla o peso muerto pesado. A partir de los 39 años la zona lumbar tarda más en recuperarse: evitá programar estas variantes pesadas en días consecutivos y prestá especial atención a la técnica. Consultá con tu profesional si tenés dudas.`;
  } else {
    cont.classList.add("d-none");
  }
}

function renderDia(idx) {
  diaSeleccionado = idx;
  renderTabsDias();

  const dia = rutinaActual[idx];
  renderCalentamientoYMovilidadDelDia(dia);
  mostrarAvisoLumbarPorEdad(dia);
  contenidoDia.innerHTML = `<h5 class="mb-3">${dia.titulo}</h5>`;

  dia.ejercicios.forEach((ej, ejIdx) => {
    const idGen = `tecnica_${idx}_${ejIdx}`;
    const card = document.createElement("div");
    card.className = "ejercicio-card";

    // Nota de triage o express si fue ajustado
    const notaExtra = [ej.nota_triage, ej.nota_express, ej.nota_descarga]
      .filter(Boolean).map(n => `<p class="small alert alert-warning py-1 mb-1">${n}</p>`).join("");

    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start flex-wrap">
        <div style="flex:1;">
          <h5>${ICONOS_GRUPO[ej.grupo_muscular] || "🏋️"} ${ej.nombre}
            ${ej.bodyweight ? '<span class="badge bg-secondary ms-1">Peso corporal</span>' : ""}
            ${ej.modo_circuito ? '<span class="badge bg-warning text-dark ms-1">Circuito</span>' : ""}
          </h5>
          ${notaExtra}
          <p class="mb-1 small text-secondary">${ej.grupo_muscular} · ${ej.series} series x ${ej.repeticiones} reps ${ej.tipo_entrenamiento ? "(" + ej.tipo_entrenamiento + ")" : ""}${ej.patron_movimiento ? " · 🧩 " + ej.patron_movimiento : ""}</p>
          ${ej.prioridad_orden ? (() => { const b = PRIORIDAD_BADGE[ej.prioridad_orden]; return b ? `<span class="badge mb-1" style="background:${b.color}22;color:${b.color};border:1px solid ${b.color};font-size:0.72rem;">${b.label}</span>` : ""; })() : ""}
          <p class="mb-1">${ej.descripcion || ""}</p>
          ${ej.tips && ej.tips.length ? `<p class="mb-1 small">💡 ${ej.tips[0]}</p>` : ""}
          ${ej.peso_recomendado ? `<p class="mb-1 small text-secondary">🏋️ Principiante: ${ej.peso_recomendado.principiante} · Intermedio: ${ej.peso_recomendado.intermedio} · Avanzado: ${ej.peso_recomendado.avanzado}</p>` : ""}
          <div class="d-flex gap-3 small mb-2">
            <a href="${ej.video_url}" target="_blank">▶ YouTube</a>
            ${ej.tiktok_url ? `<a href="${ej.tiktok_url}" target="_blank">🎵 TikTok</a>` : ""}
          </div>
          ${renderTecnica(ej, idGen)}
          <!-- Tracker por serie se monta aquí -->
          <div class="tracker-contenedor mt-3" id="tracker_${idx}_${ejIdx}"></div>
        </div>
        <button class="btn btn-sm btn-outline-light btnCambiar ms-2" data-idx="${ejIdx}">Cambiar</button>
      </div>
    `;

    card.querySelector(".btnCambiar").addEventListener("click", () => abrirModalCambio(idx, ejIdx));
    contenidoDia.appendChild(card);

    // Montar el tracker por serie async
    const trackerCont = card.querySelector(`#tracker_${idx}_${ejIdx}`);
    renderTrackerSeries(usuarioActual.uid, ej, trackerCont);
  });
}

// ---------- CAMBIAR EJERCICIO ----------

async function abrirModalCambio(diaIdx, ejIdx) {
  indexEjercicioParaReemplazo = { diaIdx, ejIdx };
  const grupo = rutinaActual[diaIdx].ejercicios[ejIdx].grupo_muscular;
  grupoParaReemplazo = grupo;

  const opciones = await obtenerCatalogoEjerciciosPorGrupo(grupo);

  listaReemplazos.innerHTML = "";
  opciones.forEach(op => {
    const item = document.createElement("button");
    item.className = "list-group-item list-group-item-action bg-dark text-white mb-2";
    item.style.borderRadius = "8px";
    item.innerHTML = `<strong>${op.nombre}</strong><br><span class="small text-secondary">${(op.descripcion || "").slice(0, 90)}</span>`;
    item.addEventListener("click", () => reemplazarEjercicio(op));
    listaReemplazos.appendChild(item);
  });

  modalCambiar.show();
}

async function reemplazarEjercicio(nuevoEjercicio) {
  const { diaIdx, ejIdx } = indexEjercicioParaReemplazo;
  const anterior = rutinaActual[diaIdx].ejercicios[ejIdx];

  rutinaActual[diaIdx].ejercicios[ejIdx] = {
    ...anterior,
    ejercicio_id: nuevoEjercicio.id,
    nombre: nuevoEjercicio.nombre,
    descripcion: nuevoEjercicio.descripcion,
    tecnica: nuevoEjercicio.tecnica || null,
    tips: nuevoEjercicio.tips || [],
    peso_recomendado: nuevoEjercicio.peso_recomendado || null,
    video_url: nuevoEjercicio.video_url,
    tiktok_url: nuevoEjercicio.tiktok_url || null,
    imagen_url: nuevoEjercicio.imagen_url || null,
    patron_movimiento: nuevoEjercicio.patron_movimiento || null,
    grupo_muscular: nuevoEjercicio.grupo_muscular,
    peso_actual: null
  };

  await db.collection("usuarios").doc(usuarioActual.uid).update({
    rutina: rutinaActual
  });

  // Trigger trofeo "Adaptación Táctica"
  Gamification.evaluarYOtorgarTrofeos(usuarioActual.uid, { live_swap_usado: true })
    .then(nuevos => { if (nuevos.length) Gamification.notificarTrofeos(nuevos); })
    .catch(() => {});

  modalCambiar.hide();
  renderDia(diaIdx);
  poblarSelectorProgreso();
}

// ---------- REGISTRO DE PROGRESIÓN ----------

async function guardarPeso(diaIdx, ejIdx, peso) {
  const pesoNum = parseFloat(peso);
  if (isNaN(pesoNum)) return;

  rutinaActual[diaIdx].ejercicios[ejIdx].peso_actual = pesoNum;
  const ejercicioId = rutinaActual[diaIdx].ejercicios[ejIdx].ejercicio_id;

  await db.collection("usuarios").doc(usuarioActual.uid).update({
    rutina: rutinaActual
  });

  await db.collection("usuarios").doc(usuarioActual.uid)
    .collection("progreso").add({
      ejercicio_id: ejercicioId,
      nombre: rutinaActual[diaIdx].ejercicios[ejIdx].nombre,
      peso: pesoNum,
      fecha: firebase.firestore.FieldValue.serverTimestamp()
    });

  alert("Peso guardado ✅");
  poblarSelectorProgreso();
}

// ---------- GRÁFICO DE PROGRESO ----------

function obtenerEjerciciosUnicos() {
  const mapa = new Map();
  rutinaActual.forEach(dia => {
    dia.ejercicios.forEach(ej => mapa.set(ej.ejercicio_id, ej.nombre));
  });
  return mapa;
}

function poblarSelectorProgreso() {
  const ejerciciosUnicos = obtenerEjerciciosUnicos();
  selectEjercicioProgreso.innerHTML = "";
  ejerciciosUnicos.forEach((nombre, id) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = nombre;
    selectEjercicioProgreso.appendChild(opt);
  });

  if (ejerciciosUnicos.size > 0) {
    const primerId = ejerciciosUnicos.keys().next().value;
    cargarGraficoProgreso(primerId);
  }
}

selectEjercicioProgreso.addEventListener("change", (e) => {
  cargarGraficoProgreso(e.target.value);
});

async function cargarGraficoProgreso(ejercicioId) {
  // Nota: evitamos .orderBy() encadenado a .where() para no necesitar un
  // índice compuesto en Firestore (eso generaba el error "query requires
  // an index" en consola). Ordenamos en el cliente en su lugar.
  const snap = await db.collection("usuarios").doc(usuarioActual.uid)
    .collection("progreso")
    .where("ejercicio_id", "==", ejercicioId)
    .get();

  const registros = [];
  snap.forEach(doc => {
    const d = doc.data();
    const fecha = d.fecha ? d.fecha.toDate() : new Date();
    registros.push({ fecha, peso: d.peso });
  });
  registros.sort((a, b) => a.fecha - b.fecha);

  const labels = registros.map(r => r.fecha.toLocaleDateString());
  const valores = registros.map(r => r.peso);

  const ctx = document.getElementById("progresoChart");
  if (chartProgreso) chartProgreso.destroy();

  chartProgreso = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Peso levantado (kg)",
        data: valores,
        borderColor: "#ff5c39",
        backgroundColor: "rgba(255,92,57,0.2)",
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      plugins: { legend: { labels: { color: "#fff" } } },
      scales: {
        x: { ticks: { color: "#aaa" } },
        y: { ticks: { color: "#aaa" } }
      }
    }
  });
}

// ---------- MEJORAR RUTINA / VOLVER A LA ANTERIOR ----------
// Reglas simples (no IA real): por cada ejercicio, rota al siguiente
// disponible del mismo grupo muscular (variedad), y sube 1 serie extra
// como progresión, hasta un máximo de 5 series.

document.getElementById("btnMejorarRutina")?.addEventListener("click", async () => {
  if (!confirm("Vamos a generar una versión mejorada de tu rutina (más variedad de ejercicios y progresión de series). Vas a poder volver a la actual si no te convence. ¿Continuar?")) {
    return;
  }

  const rutinaMejorada = rutinaActual.map(dia => ({
    ...dia,
    ejercicios: dia.ejercicios.map(ej => {
      const opciones = catalogoCompleto.filter(e => e.grupo_muscular === ej.grupo_muscular);
      let nuevoEjercicio = ej;
      if (opciones.length > 1) {
        const idxActual = opciones.findIndex(o => o.id === ej.ejercicio_id);
        const siguiente = opciones[(idxActual + 1 + opciones.length) % opciones.length];
        nuevoEjercicio = siguiente;
      }
      return {
        ...ej,
        ejercicio_id: nuevoEjercicio.id,
        nombre: nuevoEjercicio.nombre,
        descripcion: nuevoEjercicio.descripcion,
        tecnica: nuevoEjercicio.tecnica || null,
        video_url: nuevoEjercicio.video_url,
        series: Math.min((ej.series || 3) + 1, 5),
        peso_actual: null
      };
    })
  }));

  await db.collection("usuarios").doc(usuarioActual.uid).update({
    rutina: rutinaMejorada,
    rutina_anterior: rutinaActual
  });

  rutinaActual = rutinaMejorada;
  document.getElementById("btnVolverAnterior")?.classList.remove("d-none");
  renderTabsDias();
  renderDia(0);
  poblarSelectorProgreso();
  alert("¡Tu rutina fue actualizada con más variedad y progresión! 💪");
});

document.getElementById("btnVolverAnterior")?.addEventListener("click", async () => {
  if (!datosUsuario || !datosUsuario.rutina_anterior) return;
  if (!confirm("¿Volver a tu rutina anterior? Vas a perder la mejora que se generó.")) return;

  const anterior = datosUsuario.rutina_anterior;

  await db.collection("usuarios").doc(usuarioActual.uid).update({
    rutina: anterior,
    rutina_anterior: firebase.firestore.FieldValue.delete()
  });

  rutinaActual = anterior;
  datosUsuario.rutina_anterior = null;
  document.getElementById("btnVolverAnterior")?.classList.add("d-none");
  renderTabsDias();
  renderDia(0);
  poblarSelectorProgreso();
});
