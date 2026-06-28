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
const MINIMO_EJERCICIOS_POR_DIA = 5;

const ICONOS_GRUPO = {
  "Pecho": "🎯", "Espalda": "🦴", "Piernas": "🦵",
  "Hombros": "🤷", "Brazos": "💪", "Core": "🔥"
};

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

  ejerciciosCatalogo = await obtenerCatalogoEjercicios();

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
  const cantidad = dia.ejercicios.length;
  const cumpleMinimo = cantidad >= MINIMO_EJERCICIOS_POR_DIA;
  cont.innerHTML = `
    <h5 class="mb-1">Ejercicios del Día ${dia.dia}</h5>
    <p class="small ${cumpleMinimo ? "text-success" : "text-warning"} mb-3">
      ${cumpleMinimo ? "✅" : "⏳"} ${cantidad}/${MINIMO_EJERCICIOS_POR_DIA} ejercicios mínimos (sin contar calentamiento ni movilidad)
    </p>
  `;

  if (dia.ejercicios.length === 0) {
    cont.innerHTML += `<p class="text-secondary">Todavía no agregaste ejercicios a este día.</p>`;
  }

  dia.ejercicios.forEach((ej, idx) => {
    const card = document.createElement("div");
    card.className = "ejercicio-card";
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start flex-wrap">
        <div>
          <h5 class="mb-1">${ICONOS_GRUPO[ej.grupo_muscular] || "🏋️"} ${ej.nombre}</h5>
          <p class="mb-1 small text-secondary">${ej.grupo_muscular} · ${ej.series} series x ${ej.repeticiones} reps (${ej.tipo_entrenamiento || ""})</p>
          ${ej.tips && ej.tips.length ? `<p class="mb-1 small">💡 ${ej.tips[0]}</p>` : ""}
          <div class="d-flex gap-2 small">
            ${ej.video_url ? `<a href="${ej.video_url}" target="_blank">▶ YouTube</a>` : ""}
            ${ej.tiktok_url ? `<a href="${ej.tiktok_url}" target="_blank">🎵 TikTok</a>` : ""}
            ${ej.imagen_url ? `<a href="${ej.imagen_url}" target="_blank">🖼️ GIF</a>` : ""}
          </div>
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

  let html = `💡 <strong>${ejercicio.nombre}</strong> entrena principalmente: <strong>${ejercicio.grupo_muscular}</strong>.`;

  if (ejercicio.series_recomendadas) {
    html += `<br>📊 Sugerido por defecto: <strong>${ejercicio.series_recomendadas} series x ${ejercicio.repeticiones_recomendadas} reps</strong>.`;
  }
  if (ejercicio.peso_recomendado) {
    html += `<br>🏋️ Peso orientativo — Principiante: ${ejercicio.peso_recomendado.principiante} · Intermedio: ${ejercicio.peso_recomendado.intermedio} · Avanzado: ${ejercicio.peso_recomendado.avanzado}.`;
  }
  if (ejercicio.tips && ejercicio.tips.length) {
    html += `<br>💡 Tip: ${ejercicio.tips[0]}`;
  }
  html += `<br><div class="d-flex gap-3 mt-1">`;
  if (ejercicio.video_url) html += `<a href="${ejercicio.video_url}" target="_blank">▶ Ver en YouTube</a>`;
  if (ejercicio.tiktok_url) html += `<a href="${ejercicio.tiktok_url}" target="_blank">🎵 Ver en TikTok</a>`;
  if (ejercicio.imagen_url) html += `<a href="${ejercicio.imagen_url}" target="_blank">🖼️ Ver GIF/Imagen</a>`;
  html += `</div>`;

  info.innerHTML = html;
}

function mostrarSugerencias(ejercicio) {
  const cont = document.getElementById("sugerenciasEjercicio");
  const dia = rutinaBuilder[diaSeleccionado];
  const idsYaEnDia = new Set(dia.ejercicios.map(e => e.ejercicio_id));
  const gruposYaEnDia = new Set(dia.ejercicios.map(e => e.grupo_muscular));
  gruposYaEnDia.add(ejercicio.grupo_muscular);

  const sinergias = SINERGIA[ejercicio.grupo_muscular] || [];
  const sugerenciasFiltradas = sinergias.filter(s => !gruposYaEnDia.has(s.grupo));

  if (sugerenciasFiltradas.length === 0 && idsYaEnDia.size === 0) {
    cont.innerHTML = "";
    return;
  }

  cont.innerHTML = `<p class="small text-secondary mb-2">✅ Tildá los que quieras agregar (se suman al instante y las recomendaciones se actualizan):</p>`;

  sugerenciasFiltradas.forEach(s => {
    const ejemplos = ejerciciosCatalogo.filter(e => e.grupo_muscular === s.grupo && !idsYaEnDia.has(e.id)).slice(0, 3);
    ejemplos.forEach(ej => {
      const card = document.createElement("label");
      card.className = "ejercicio-card py-2 px-3 mb-2 d-flex align-items-start gap-2 w-100";
      card.style.cursor = "pointer";
      card.innerHTML = `
        <input type="checkbox" class="form-check-input mt-1 chkSugerencia" data-id="${ej.id}">
        <div>
          <strong>${ICONOS_GRUPO[s.grupo] || ""} ${ej.nombre}</strong> <span class="text-secondary small">(${s.grupo})</span>
          <p class="small mb-0 text-secondary">📎 ${s.motivo}</p>
        </div>
      `;
      card.querySelector(".chkSugerencia").addEventListener("change", (e) => {
        if (e.target.checked) {
          agregarAlDia(ej);
        } else {
          const idx = dia.ejercicios.findIndex(x => x.ejercicio_id === ej.id);
          if (idx >= 0) dia.ejercicios.splice(idx, 1);
        }
        renderTabsDias();
        renderEjerciciosDelDia();
        // Recalcula recomendaciones en vivo con el estado actualizado del día
        mostrarSugerencias(ejercicio);
      });
      cont.appendChild(card);
    });
  });
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

function obtenerSeriesRepsTipoActuales(ejercicio) {
  const preset = PRESETS.find(p => p.id === presetSeleccionado);

  if (preset.id === "personalizado") {
    const series = parseInt(document.getElementById("customSeries").value, 10);
    const reps = parseInt(document.getElementById("customReps").value, 10);
    if (!series || !reps) return null;
    return { series, reps, tipo: clasificarPorRepeticiones(reps).tipo };
  }

  // Si el ejercicio tiene sus propias series/reps recomendadas, las usamos
  // como base, salvo que el preset elegido sea explícitamente otro tipo.
  if (preset.id === "hipertrofia" && ejercicio.series_recomendadas && ejercicio.repeticiones_recomendadas) {
    return { series: ejercicio.series_recomendadas, reps: ejercicio.repeticiones_recomendadas, tipo: "Hipertrofia" };
  }

  return { series: preset.series, reps: preset.reps, tipo: preset.tipo };
}

function agregarAlDia(ejercicio) {
  const valores = obtenerSeriesRepsTipoActuales(ejercicio);
  if (!valores) {
    alert("Completá series y repeticiones para continuar.");
    return false;
  }

  const dia = rutinaBuilder[diaSeleccionado];

  if (dia.ejercicios.some(e => e.ejercicio_id === ejercicio.id)) {
    alert("Ese ejercicio ya está agregado a este día.");
    return false;
  }

  dia.ejercicios.push({
    ejercicio_id: ejercicio.id,
    nombre: ejercicio.nombre,
    grupo_muscular: ejercicio.grupo_muscular,
    descripcion: ejercicio.descripcion,
    tecnica: ejercicio.tecnica || null,
    tips: ejercicio.tips || [],
    peso_recomendado: ejercicio.peso_recomendado || null,
    video_url: ejercicio.video_url,
    tiktok_url: ejercicio.tiktok_url || null,
    imagen_url: ejercicio.imagen_url || null,
    series: valores.series,
    repeticiones: valores.reps,
    tipo_entrenamiento: valores.tipo,
    peso_actual: null
  });
  return true;
}

document.getElementById("btnAgregarEjercicio").addEventListener("click", () => {
  const ejercicioId = document.getElementById("selectEjercicio").value;
  const ejercicio = ejerciciosCatalogo.find(e => e.id === ejercicioId);
  if (!ejercicio) return;

  const agregado = agregarAlDia(ejercicio);
  if (!agregado) return;

  // Mantenemos el grupo y el ejercicio elegidos, así las sugerencias y
  // recomendaciones siguen visibles y actualizadas para seguir agregando.
  document.getElementById("btnAgregarEjercicio").disabled = true;
  mostrarInfoGrupo(ejercicio);
  mostrarSugerencias(ejercicio);

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
  const incompletos = rutinaBuilder.filter(d => d.ejercicios.length > 0 && d.ejercicios.length < MINIMO_EJERCICIOS_POR_DIA);
  const vacios = rutinaBuilder.filter(d => d.ejercicios.length === 0);

  if (incompletos.length > 0) {
    alert(
      `Los días ${incompletos.map(d => d.dia).join(", ")} tienen menos de ${MINIMO_EJERCICIOS_POR_DIA} ejercicios ` +
      `(sin contar calentamiento ni movilidad articular, que se agregan aparte). ` +
      `Agregá al menos ${MINIMO_EJERCICIOS_POR_DIA} ejercicios principales por día antes de guardar.`
    );
    return;
  }

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
