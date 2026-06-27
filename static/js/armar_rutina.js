// static/js/armar_rutina.js
// Armador manual de rutina: el usuario elige sus ejercicios día por día.
// Cada vez que agrega un ejercicio, la app le muestra:
//  - qué grupo muscular entrena
//  - ejercicios sugeridos para ese mismo día (con el motivo)
//  - un aviso si está sobrecargando el día o un grupo muscular
//  - una explicación del tipo de entrenamiento según series/reps elegidas

let usuarioActual = null;
let ejerciciosCatalogo = [];
let rutinaBuilder = []; // [{dia, titulo, ejercicios:[...]}]
let diaSeleccionado = 0;

// ---------- REGLAS DE SINERGIA ENTRE GRUPOS MUSCULARES ----------
// Para cada grupo, qué otros grupos conviene combinar el mismo día y por qué.
const SINERGIA = {
  "Pecho": [
    { grupo: "Hombros", motivo: "Pecho y hombros empujan en conjunto (press); es un combo clásico de 'día de empuje'." },
    { grupo: "Brazos", motivo: "El tríceps trabaja como músculo secundario en todos los ejercicios de empuje de pecho." }
  ],
  "Espalda": [
    { grupo: "Brazos", motivo: "El bíceps trabaja como secundario en los ejercicios de tracción de espalda." },
    { grupo: "Core", motivo: "El core estabiliza el torso durante los ejercicios de espalda con peso libre." }
  ],
  "Piernas": [
    { grupo: "Core", motivo: "El core estabiliza la zona media durante sentadillas y ejercicios de pierna con carga." }
  ],
  "Hombros": [
    { grupo: "Pecho", motivo: "Comparten el patrón de empuje; es habitual combinarlos el mismo día." },
    { grupo: "Brazos", motivo: "El tríceps colabora activamente en los ejercicios de press de hombro." }
  ],
  "Brazos": [
    { grupo: "Pecho", motivo: "El pecho ya activa el tríceps; sumar pecho complementa bien el estímulo." },
    { grupo: "Espalda", motivo: "La espalda ya activa el bíceps; complementa bien con ejercicios de tracción." }
  ],
  "Core": [
    { grupo: "Piernas", motivo: "El core suele combinarse con piernas para reforzar la estabilidad del tren inferior." }
  ]
};

// ---------- PRESETS DE SERIES/REPETICIONES ----------
const PRESETS = [
  { id: "fuerza", label: "Fuerza", series: 4, reps: "1-5", tipo: "Fuerza",
    explicacion: "Pocas repeticiones con mucho peso. Maximiza la fuerza máxima, pero exige técnica sólida y buen descanso entre series (2-4 min)." },
  { id: "hipertrofia", label: "Hipertrofia", series: 4, reps: "6-12", tipo: "Hipertrofia",
    explicacion: "El rango clásico para estimular el crecimiento muscular (volumen). Descansos de 60-90 seg entre series." },
  { id: "resistencia", label: "Resistencia muscular", series: 3, reps: "15-20", tipo: "Resistencia",
    explicacion: "Series largas con peso moderado o liviano. Mejora la resistencia muscular y la capacidad de trabajo. Descansos cortos (30-45 seg)." },
  { id: "personalizado", label: "Personalizado", series: null, reps: null, tipo: null,
    explicacion: "Elegí tus propios números de series y repeticiones." }
];

// ---------- INIT ----------
auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = "/"; return; }
  const snap = await db.collection("usuarios").doc(user.uid).get();
  const data = snap.data();
  if (!data || !data.disclaimers_aceptados) { window.location.href = "/disclaimers"; return; }

  usuarioActual = user;

  const res = await fetch("/api/ejercicios");
  ejerciciosCatalogo = await res.json();

  const diasGuardados = (data.perfil && data.perfil.dias) || 3;
  document.getElementById("selectCantidadDias").value = diasGuardados;

  // Si ya tiene una rutina guardada, la usamos como punto de partida
  if (data.rutina && data.rutina.length > 0) {
    rutinaBuilder = JSON.parse(JSON.stringify(data.rutina));
  } else {
    inicializarDias(diasGuardados);
  }

  renderTabsDias();
  renderEjerciciosDelDia();
  renderPresets();
  cargarGruposEnSelect();
});

function inicializarDias(cantidad) {
  rutinaBuilder = [];
  for (let i = 0; i < cantidad; i++) {
    rutinaBuilder.push({ dia: i + 1, titulo: `Día ${i + 1}`, ejercicios: [] });
  }
}

document.getElementById("selectCantidadDias").addEventListener("change", (e) => {
  const nuevaCantidad = parseInt(e.target.value, 10);
  if (nuevaCantidad < rutinaBuilder.length) {
    if (!confirm("Vas a reducir la cantidad de días. Los días eliminados perderán sus ejercicios. ¿Continuar?")) {
      e.target.value = rutinaBuilder.length;
      return;
    }
    rutinaBuilder = rutinaBuilder.slice(0, nuevaCantidad);
  } else {
    while (rutinaBuilder.length < nuevaCantidad) {
      rutinaBuilder.push({ dia: rutinaBuilder.length + 1, titulo: `Día ${rutinaBuilder.length + 1}`, ejercicios: [] });
    }
  }
  diaSeleccionado = 0;
  renderTabsDias();
  renderEjerciciosDelDia();
});

// ---------- TABS DE DÍAS ----------
function renderTabsDias() {
  const cont = document.getElementById("tabsDiasBuilder");
  cont.innerHTML = "";
  rutinaBuilder.forEach((dia, idx) => {
    const btn = document.createElement("button");
    btn.className = "btn btn-sm btn-outline-light dia-tab" + (idx === diaSeleccionado ? " active" : "");
    btn.textContent = `Día ${dia.dia} (${dia.ejercicios.length})`;
    btn.addEventListener("click", () => {
      diaSeleccionado = idx;
      renderTabsDias();
      renderEjerciciosDelDia();
      limpiarPanelAgregar();
    });
    cont.appendChild(btn);
  });
}

// ---------- LISTA DE EJERCICIOS DEL DÍA ----------
function renderEjerciciosDelDia() {
  const cont = document.getElementById("ejerciciosDelDia");
  const dia = rutinaBuilder[diaSeleccionado];
  cont.innerHTML = `<h5 class="mb-3">Ejercicios del Día ${dia.dia}</h5>`;

  if (dia.ejercicios.length === 0) {
    cont.innerHTML += `<p class="text-secondary">Todavía no agregaste ejercicios a este día.</p>`;
  }

  dia.ejercicios.forEach((ej, idx) => {
    const card = document.createElement("div");
    card.className = "ejercicio-card";
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start flex-wrap">
        <div>
          <h5 class="mb-1">${ej.nombre}</h5>
          <p class="mb-0 small text-secondary">${ej.grupo_muscular} · ${ej.series} series x ${ej.repeticiones} reps (${ej.tipo_entrenamiento || ""})</p>
        </div>
        <button class="btn btn-sm btn-outline-light btnQuitar">Quitar</button>
      </div>
    `;
    card.querySelector(".btnQuitar").addEventListener("click", () => {
      dia.ejercicios.splice(idx, 1);
      renderTabsDias();
      renderEjerciciosDelDia();
      evaluarSobrecarga();
    });
    cont.appendChild(card);
  });

  evaluarSobrecarga();
}

// ---------- SELECT DE GRUPO / EJERCICIO ----------
function cargarGruposEnSelect() {
  document.getElementById("selectGrupo").addEventListener("change", onCambioGrupo);
  document.getElementById("selectEjercicio").addEventListener("change", onCambioEjercicio);
}

function onCambioGrupo(e) {
  const grupo = e.target.value;
  const selectEj = document.getElementById("selectEjercicio");
  limpiarInfoYSugerencias();
  document.getElementById("btnAgregarEjercicio").disabled = true;

  if (!grupo) {
    selectEj.innerHTML = `<option value="">Primero elegí un grupo muscular...</option>`;
    selectEj.disabled = true;
    return;
  }

  const opciones = ejerciciosCatalogo.filter(e => e.grupo_muscular === grupo);
  selectEj.disabled = false;
  selectEj.innerHTML = `<option value="">Selecciona un ejercicio...</option>` +
    opciones.map(o => `<option value="${o.id}">${o.nombre}</option>`).join("");
}

function onCambioEjercicio(e) {
  const id = e.target.value;
  const btnAgregar = document.getElementById("btnAgregarEjercicio");

  if (!id) {
    limpiarInfoYSugerencias();
    btnAgregar.disabled = true;
    return;
  }

  const ejercicio = ejerciciosCatalogo.find(e => e.id === id);
  mostrarInfoGrupo(ejercicio);
  mostrarSugerencias(ejercicio);
  btnAgregar.disabled = false;
}

function limpiarInfoYSugerencias() {
  document.getElementById("infoEjercicioElegido").classList.add("d-none");
  document.getElementById("sugerenciasEjercicio").innerHTML = "";
}

function mostrarInfoGrupo(ejercicio) {
  const info = document.getElementById("infoEjercicioElegido");
  info.classList.remove("d-none");
  info.innerHTML = `💡 <strong>${ejercicio.nombre}</strong> entrena principalmente: <strong>${ejercicio.grupo_muscular}</strong>.`;
}

function mostrarSugerencias(ejercicio) {
  const cont = document.getElementById("sugerenciasEjercicio");
  const dia = rutinaBuilder[diaSeleccionado];
  const gruposYaEnDia = new Set(dia.ejercicios.map(e => e.grupo_muscular));
  gruposYaEnDia.add(ejercicio.grupo_muscular);

  const sinergias = SINERGIA[ejercicio.grupo_muscular] || [];
  const sugerenciasFiltradas = sinergias.filter(s => !gruposYaEnDia.has(s.grupo));

  if (sugerenciasFiltradas.length === 0) {
    cont.innerHTML = "";
    return;
  }

  let html = `<p class="small text-secondary mb-2">Para completar bien este día, también podrías sumar:</p>`;
  sugerenciasFiltradas.forEach(s => {
    const ejemplos = ejerciciosCatalogo.filter(e => e.grupo_muscular === s.grupo).slice(0, 2);
    ejemplos.forEach(ej => {
      html += `
        <div class="ejercicio-card py-2 px-3 mb-2">
          <strong>${ej.nombre}</strong> <span class="text-secondary small">(${s.grupo})</span>
          <p class="small mb-0 text-secondary">📎 ${s.motivo}</p>
        </div>`;
    });
  });
  cont.innerHTML = html;
}

// ---------- PRESETS DE SERIES/REPS ----------
let presetSeleccionado = "hipertrofia";

function renderPresets() {
  const cont = document.getElementById("presetsContainer");
  cont.innerHTML = "";

  PRESETS.forEach(p => {
    const wrapper = document.createElement("div");
    wrapper.className = "form-check";
    wrapper.innerHTML = `
      <input class="form-check-input" type="radio" name="preset" id="preset_${p.id}" value="${p.id}" ${p.id === presetSeleccionado ? "checked" : ""}>
      <label class="form-check-label" for="preset_${p.id}">
        <strong>${p.label}</strong>${p.series ? ` — ${p.series} series x ${p.reps} reps` : ""}
      </label>
    `;
    cont.appendChild(wrapper);

    wrapper.querySelector("input").addEventListener("change", () => {
      presetSeleccionado = p.id;
      mostrarExplicacionPreset(p);
      renderCamposPersonalizados(p.id === "personalizado");
    });
  });

  // Campos custom (ocultos salvo que se elija "Personalizado")
  const customDiv = document.createElement("div");
  customDiv.id = "camposPersonalizados";
  customDiv.className = "d-none mt-2 d-flex gap-2";
  customDiv.innerHTML = `
    <input type="number" min="1" max="10" id="customSeries" class="form-control" placeholder="Series" style="max-width:120px;">
    <input type="number" min="1" max="50" id="customReps" class="form-control" placeholder="Repeticiones" style="max-width:140px;">
  `;
  cont.appendChild(customDiv);

  document.getElementById("camposPersonalizados").querySelectorAll("input").forEach(inp => {
    inp.addEventListener("input", actualizarExplicacionPersonalizada);
  });

  mostrarExplicacionPreset(PRESETS.find(p => p.id === presetSeleccionado));
}

function renderCamposPersonalizados(mostrar) {
  document.getElementById("camposPersonalizados").classList.toggle("d-none", !mostrar);
  if (mostrar) actualizarExplicacionPersonalizada();
}

function mostrarExplicacionPreset(preset) {
  const cont = document.getElementById("explicacionTipo");
  if (preset.id === "personalizado") {
    renderCamposPersonalizados(true);
    return;
  }
  renderCamposPersonalizados(false);
  cont.classList.remove("d-none");
  cont.innerHTML = `🏷️ Tipo de entrenamiento: <strong>${preset.tipo}</strong>. ${preset.explicacion}`;
}

function clasificarPorRepeticiones(reps) {
  if (reps <= 5) return { tipo: "Fuerza", explicacion: "Pocas repeticiones con mucho peso: predomina el desarrollo de fuerza máxima." };
  if (reps <= 12) return { tipo: "Hipertrofia", explicacion: "Rango intermedio: es el más asociado al crecimiento muscular (volumen)." };
  return { tipo: "Resistencia", explicacion: "Muchas repeticiones: predomina la resistencia muscular sobre la fuerza." };
}

function actualizarExplicacionPersonalizada() {
  const reps = parseInt(document.getElementById("customReps").value, 10);
  const cont = document.getElementById("explicacionTipo");
  if (!reps || isNaN(reps)) {
    cont.classList.add("d-none");
    return;
  }
  const clasif = clasificarPorRepeticiones(reps);
  cont.classList.remove("d-none");
  cont.innerHTML = `🏷️ Con ${reps} repeticiones, esto se clasifica como entrenamiento de <strong>${clasif.tipo}</strong>. ${clasif.explicacion}`;
}

// ---------- AGREGAR EJERCICIO AL DÍA ----------
document.getElementById("btnAgregarEjercicio").addEventListener("click", () => {
  const ejercicioId = document.getElementById("selectEjercicio").value;
  const ejercicio = ejerciciosCatalogo.find(e => e.id === ejercicioId);
  if (!ejercicio) return;

  let series, reps, tipo;
  const preset = PRESETS.find(p => p.id === presetSeleccionado);

  if (preset.id === "personalizado") {
    series = parseInt(document.getElementById("customSeries").value, 10);
    reps = parseInt(document.getElementById("customReps").value, 10);
    if (!series || !reps) {
      alert("Completá series y repeticiones para continuar.");
      return;
    }
    tipo = clasificarPorRepeticiones(reps).tipo;
  } else {
    series = preset.series;
    reps = preset.reps;
    tipo = preset.tipo;
  }

  const dia = rutinaBuilder[diaSeleccionado];
  dia.ejercicios.push({
    ejercicio_id: ejercicio.id,
    nombre: ejercicio.nombre,
    grupo_muscular: ejercicio.grupo_muscular,
    descripcion: ejercicio.descripcion,
    video_url: ejercicio.video_url,
    series,
    repeticiones: reps,
    tipo_entrenamiento: tipo,
    peso_actual: null
  });

  limpiarPanelAgregar();
  renderTabsDias();
  renderEjerciciosDelDia();
});

function limpiarPanelAgregar() {
  document.getElementById("selectGrupo").value = "";
  document.getElementById("selectEjercicio").innerHTML = `<option value="">Primero elegí un grupo muscular...</option>`;
  document.getElementById("selectEjercicio").disabled = true;
  document.getElementById("btnAgregarEjercicio").disabled = true;
  limpiarInfoYSugerencias();
}

// ---------- AVISO DE SOBRECARGA ----------
function evaluarSobrecarga() {
  const dia = rutinaBuilder[diaSeleccionado];
  const aviso = document.getElementById("avisoSobrecarga");
  const mensajes = [];

  if (dia.ejercicios.length > 6) {
    mensajes.push(`Tenés ${dia.ejercicios.length} ejercicios este día. Para la mayoría de las personas, lo recomendable es entre 4 y 6 ejercicios por día para no sobrecargarte ni resentir la calidad de la técnica al final de la sesión.`);
  }

  const conteoPorGrupo = {};
  dia.ejercicios.forEach(e => {
    conteoPorGrupo[e.grupo_muscular] = (conteoPorGrupo[e.grupo_muscular] || 0) + 1;
  });
  Object.entries(conteoPorGrupo).forEach(([grupo, cant]) => {
    if (cant >= 3) {
      mensajes.push(`Ya tenés ${cant} ejercicios de ${grupo} el mismo día. Eso puede ser demasiado volumen para un solo grupo muscular en una sesión; considerá repartirlos en otro día.`);
    }
  });

  const seriesTotales = dia.ejercicios.reduce((acc, e) => acc + (e.series || 0), 0);
  if (seriesTotales > 24) {
    mensajes.push(`Llevás ${seriesTotales} series totales en este día, lo cual es un volumen alto. Asegurate de tener tiempo y energía suficiente para completarlo con buena técnica.`);
  }

  if (mensajes.length > 0) {
    aviso.classList.remove("d-none");
    aviso.innerHTML = "⚠️ " + mensajes.join("<br>⚠️ ");
  } else {
    aviso.classList.add("d-none");
  }
}

// ---------- GUARDAR RUTINA ----------
document.getElementById("btnGuardarRutinaPersonalizada").addEventListener("click", async () => {
  const vacios = rutinaBuilder.filter(d => d.ejercicios.length === 0);
  if (vacios.length > 0) {
    const continuar = confirm(`Los días ${vacios.map(d => d.dia).join(", ")} no tienen ejercicios. ¿Guardar igual?`);
    if (!continuar) return;
  }

  rutinaBuilder.forEach((d, i) => {
    d.titulo = `Día ${d.dia}: ` + (d.ejercicios.length > 0
      ? [...new Set(d.ejercicios.map(e => e.grupo_muscular))].join(" + ")
      : "Descanso / sin definir");
  });

  await db.collection("usuarios").doc(usuarioActual.uid).update({
    rutina: rutinaBuilder,
    "perfil.dias": rutinaBuilder.length
  });

  window.location.href = "/dashboard";
});
