// static/js/dashboard.js

let usuarioActual = null;
let rutinaActual = [];
let diaSeleccionado = 0;
let grupoParaReemplazo = null;
let indexEjercicioParaReemplazo = null;
let chartProgreso = null;

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
  await cargarRutina();
});

document.getElementById("btnLogout").addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "/";
});

// ---------- CARGAR RUTINA ----------

async function cargarRutina() {
  const docSnap = await db.collection("usuarios").doc(usuarioActual.uid).get();
  const data = docSnap.data();

  if (!data || !data.rutina) {
    window.location.href = "/onboarding";
    return;
  }

  rutinaActual = data.rutina;
  renderTabsDias();
  renderDia(0);
  poblarSelectorProgreso();
}

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

function renderDia(idx) {
  diaSeleccionado = idx;
  renderTabsDias();

  const dia = rutinaActual[idx];
  contenidoDia.innerHTML = `<h5 class="mb-3">${dia.titulo}</h5>`;

  dia.ejercicios.forEach((ej, ejIdx) => {
    const card = document.createElement("div");
    card.className = "ejercicio-card";
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start flex-wrap">
        <div>
          <h5>${ej.nombre}</h5>
          <p class="mb-1 small text-secondary">${ej.grupo_muscular} · ${ej.series} series x ${ej.repeticiones} reps</p>
          <p class="mb-2">${ej.descripcion}</p>
          <a href="${ej.video_url}" target="_blank" class="small">▶ Ver demostración</a>
        </div>
        <button class="btn btn-sm btn-outline-light btnCambiar" data-idx="${ejIdx}">Cambiar ejercicio</button>
      </div>
      <div class="d-flex align-items-center gap-2 mt-3" style="max-width:300px;">
        <input type="number" step="0.5" class="form-control form-control-sm inputPeso"
               placeholder="Peso (kg)" value="${ej.peso_actual ?? ''}">
        <button class="btn btn-sm btn-primary btnGuardarPeso">Guardar</button>
      </div>
    `;

    card.querySelector(".btnCambiar").addEventListener("click", () => abrirModalCambio(idx, ejIdx));
    card.querySelector(".btnGuardarPeso").addEventListener("click", () => {
      const peso = card.querySelector(".inputPeso").value;
      guardarPeso(idx, ejIdx, peso);
    });

    contenidoDia.appendChild(card);
  });
}

// ---------- CAMBIAR EJERCICIO ----------

async function abrirModalCambio(diaIdx, ejIdx) {
  indexEjercicioParaReemplazo = { diaIdx, ejIdx };
  const grupo = rutinaActual[diaIdx].ejercicios[ejIdx].grupo_muscular;
  grupoParaReemplazo = grupo;

  const res = await fetch(`/api/ejercicios/${encodeURIComponent(grupo)}`);
  const opciones = await res.json();

  listaReemplazos.innerHTML = "";
  opciones.forEach(op => {
    const item = document.createElement("button");
    item.className = "list-group-item list-group-item-action bg-dark text-white mb-2";
    item.style.borderRadius = "8px";
    item.innerHTML = `<strong>${op.nombre}</strong><br><span class="small text-secondary">${op.descripcion.slice(0, 90)}...</span>`;
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
    video_url: nuevoEjercicio.video_url,
    grupo_muscular: nuevoEjercicio.grupo_muscular,
    peso_actual: null
  };

  await db.collection("usuarios").doc(usuarioActual.uid).update({
    rutina: rutinaActual
  });

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

  // Actualiza el peso "actual" dentro de la rutina
  await db.collection("usuarios").doc(usuarioActual.uid).update({
    rutina: rutinaActual
  });

  // Guarda un registro histórico en la subcolección "progreso"
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
  const snap = await db.collection("usuarios").doc(usuarioActual.uid)
    .collection("progreso")
    .where("ejercicio_id", "==", ejercicioId)
    .orderBy("fecha", "asc")
    .get();

  const labels = [];
  const valores = [];

  snap.forEach(doc => {
    const d = doc.data();
    const fecha = d.fecha ? d.fecha.toDate() : new Date();
    labels.push(fecha.toLocaleDateString());
    valores.push(d.peso);
  });

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
