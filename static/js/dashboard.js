// static/js/dashboard.js

const ADMIN_EMAIL = "ernestoarevalo@gmail.com";

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

  const res = await fetch("/api/ejercicios");
  catalogoCompleto = await res.json();

  if (user.email === ADMIN_EMAIL) {
    document.getElementById("navAdminLink").classList.remove("d-none");
  }

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

  if (!data || !data.disclaimers_aceptados) {
    window.location.href = "/disclaimers";
    return;
  }

  datosUsuario = data;

  const navNombre = document.getElementById("navNombreUsuario");
  if (navNombre) navNombre.textContent = data.username || data.nombre || "Mi perfil";

  if (!data.rutina) {
    window.location.href = "/onboarding";
    return;
  }

  rutinaActual = data.rutina;
  renderCalentamientoYMovilidad();
  renderTabsDias();
  renderDia(0);
  poblarSelectorProgreso();
  verificarCumpleanos(data);

  document.getElementById("btnVolverAnterior").classList.toggle("d-none", !data.rutina_anterior);
}

// ---------- CALENTAMIENTO Y MOVILIDAD (formato inspirado en daBeast) ----------

function renderCalentamientoYMovilidad() {
  document.getElementById("seccionCalentamiento").innerHTML = `
    <h5>🔥 Calentamiento general (5-7 min, antes de cada entrenamiento)</h5>
    <ul class="mb-0">
      <li><strong>0:00–3:00</strong> — Cardio suave (caminata rápida, bicicleta o cuerda): sube la temperatura corporal general.</li>
      <li><strong>3:00–5:00</strong> — Activación dinámica: sentadillas con peso corporal, zancadas caminando, círculos de brazos.</li>
      <li><strong>5:00–7:00</strong> — 1-2 series livianas del primer ejercicio de tu rutina, con poco peso, para preparar el patrón de movimiento específico.</li>
    </ul>
  `;

  document.getElementById("seccionMovilidad").innerHTML = `
    <h5>🧘 Movilidad articular (2-3 min, después del calentamiento)</h5>
    <ul class="mb-0">
      <li><strong>Hombros</strong> — círculos amplios ×10 hacia adelante y ×10 hacia atrás.</li>
      <li><strong>Cadera</strong> — círculos de cadera ×10 por lado, abre la articulación antes de cargar peso.</li>
      <li><strong>Tobillos</strong> — rotaciones y flexiones ×10 por pie, importante antes de sentadillas o zancadas.</li>
      <li><strong>Columna</strong> — gato-camello (flexión/extensión de espalda) ×8 repeticiones lentas.</li>
    </ul>
    <p class="small text-secondary mt-2 mb-0">
      Esta rutina de movilidad es orientativa y general. Si tenés alguna lesión o
      limitación, consultá con tu profesional antes de realizarla (ver disclaimers).
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

function renderDia(idx) {
  diaSeleccionado = idx;
  renderTabsDias();

  const dia = rutinaActual[idx];
  contenidoDia.innerHTML = `<h5 class="mb-3">${dia.titulo}</h5>`;

  dia.ejercicios.forEach((ej, ejIdx) => {
    const idGen = `tecnica_${idx}_${ejIdx}`;
    const card = document.createElement("div");
    card.className = "ejercicio-card";
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start flex-wrap">
        <div>
          <h5>${ICONOS_GRUPO[ej.grupo_muscular] || "🏋️"} ${ej.nombre}</h5>
          <p class="mb-1 small text-secondary">${ej.grupo_muscular} · ${ej.series} series x ${ej.repeticiones} reps ${ej.tipo_entrenamiento ? "(" + ej.tipo_entrenamiento + ")" : ""}</p>
          <p class="mb-1">${ej.descripcion || ""}</p>
          ${ej.tips && ej.tips.length ? `<p class="mb-1 small">💡 ${ej.tips[0]}</p>` : ""}
          ${ej.peso_recomendado ? `<p class="mb-1 small text-secondary">🏋️ Peso orientativo — Principiante: ${ej.peso_recomendado.principiante} · Intermedio: ${ej.peso_recomendado.intermedio} · Avanzado: ${ej.peso_recomendado.avanzado}</p>` : ""}
          <div class="d-flex gap-3 small">
            <a href="${ej.video_url}" target="_blank">▶ YouTube</a>
            ${ej.tiktok_url ? `<a href="${ej.tiktok_url}" target="_blank">🎵 TikTok</a>` : ""}
          </div>
          ${renderTecnica(ej, idGen)}
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

document.getElementById("btnMejorarRutina").addEventListener("click", async () => {
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
  document.getElementById("btnVolverAnterior").classList.remove("d-none");
  renderTabsDias();
  renderDia(0);
  poblarSelectorProgreso();
  alert("¡Tu rutina fue actualizada con más variedad y progresión! 💪");
});

document.getElementById("btnVolverAnterior").addEventListener("click", async () => {
  if (!datosUsuario || !datosUsuario.rutina_anterior) return;
  if (!confirm("¿Volver a tu rutina anterior? Vas a perder la mejora que se generó.")) return;

  const anterior = datosUsuario.rutina_anterior;

  await db.collection("usuarios").doc(usuarioActual.uid).update({
    rutina: anterior,
    rutina_anterior: firebase.firestore.FieldValue.delete()
  });

  rutinaActual = anterior;
  datosUsuario.rutina_anterior = null;
  document.getElementById("btnVolverAnterior").classList.add("d-none");
  renderTabsDias();
  renderDia(0);
  poblarSelectorProgreso();
});
