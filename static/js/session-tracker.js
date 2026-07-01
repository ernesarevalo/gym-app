// static/js/session-tracker.js
// Pilar 4 — Tracking por Serie (Set-level tracking)
// Modelo de datos y UI para registrar cada serie individualmente:
// peso, repeticiones, is_completed, is_pr, unidad (kg/lbs).
// También maneja: toggle LBS/KG, autocompletado fantasma, bodyweight exception.

// =====================================================================
// MODELO DE DATO DE UNA SERIE (Set)
// Guardado en Firestore bajo progreso/{docId}
// {
//   ejercicio_id, nombre, fecha,
//   sets: [
//     { set_num: 1, peso_kg: 80, repeticiones: 8, is_completed: false, unidad: "kg" },
//     { set_num: 2, peso_kg: 80, repeticiones: 8, is_completed: false, unidad: "kg" },
//   ],
//   is_pr: false,
//   tonelaje_kg: 0,   // sets completados: sum(peso_kg * repeticiones)
//   bodyweight: false,
//   lastre_activado: false
// }
// =====================================================================

const LBS_TO_KG = 1 / 2.2046;
const KG_TO_LBS = 2.2046;

// Lee la preferencia de unidad guardada (por ejercicio_id) en localStorage
function getUnidadPref(ejercicio_id) {
  try {
    const prefs = JSON.parse(localStorage.getItem("gym_unidad_prefs") || "{}");
    return prefs[ejercicio_id] || "kg";
  } catch { return "kg"; }
}

function setUnidadPref(ejercicio_id, unidad) {
  try {
    const prefs = JSON.parse(localStorage.getItem("gym_unidad_prefs") || "{}");
    prefs[ejercicio_id] = unidad;
    localStorage.setItem("gym_unidad_prefs", JSON.stringify(prefs));
  } catch {}
}

// Convierte para mostrar; el backend siempre guarda en KG
function mostrarPeso(peso_kg, unidad) {
  if (unidad === "lbs") return (peso_kg * KG_TO_LBS).toFixed(1);
  return peso_kg % 1 === 0 ? peso_kg : peso_kg.toFixed(1);
}

function parsearPesoAKg(valor, unidad) {
  const n = parseFloat(valor);
  if (isNaN(n)) return 0;
  return unidad === "lbs" ? n * LBS_TO_KG : n;
}

// Recupera el último peso registrado para un ejercicio (autocompletado fantasma)
async function obtenerUltimoPesoKg(uid, ejercicio_id) {
  try {
    const snap = await db.collection("usuarios").doc(uid)
      .collection("progreso")
      .where("ejercicio_id", "==", ejercicio_id)
      .get();

    if (snap.empty) return null;

    // Ordenar en cliente (evita índice compuesto)
    const docs = snap.docs
      .map(d => d.data())
      .filter(d => d.fecha)
      .sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());

    if (!docs.length) return null;
    const ultimo = docs[0];
    // Devuelve el peso promedio de los sets del último registro (o peso_actual legacy)
    if (ultimo.sets && ultimo.sets.length) {
      const pesos = ultimo.sets.filter(s => s.is_completed && s.peso_kg > 0).map(s => s.peso_kg);
      return pesos.length ? Math.max(...pesos) : null;
    }
    return ultimo.peso || null;
  } catch { return null; }
}

// Recupera el PR histórico (máximo peso_kg en cualquier set completado)
async function obtenerPrHistorico(uid, ejercicio_id) {
  try {
    const snap = await db.collection("usuarios").doc(uid)
      .collection("progreso")
      .where("ejercicio_id", "==", ejercicio_id)
      .get();

    let maxPeso = 0;
    snap.docs.forEach(d => {
      const data = d.data();
      if (data.sets) {
        data.sets.filter(s => s.is_completed).forEach(s => {
          if (s.peso_kg > maxPeso) maxPeso = s.peso_kg;
        });
      } else if (data.peso && data.peso > maxPeso) {
        maxPeso = data.peso;
      }
    });
    return maxPeso > 0 ? maxPeso : null;
  } catch { return null; }
}

// =====================================================================
// RENDER DEL TRACKER POR SERIE
// Genera la UI de tracking para un ejercicio con N series individuales.
// =====================================================================
async function renderTrackerSeries(uid, ej, contenedor) {
  const unidad = getUnidadPref(ej.ejercicio_id);
  const ultimoPeso = await obtenerUltimoPesoKg(uid, ej.ejercicio_id);
  const prHistorico = await obtenerPrHistorico(uid, ej.ejercicio_id);
  const esBW = ej.bodyweight === true;
  const numSeries = ej.series || 3;

  let sets = [];
  for (let i = 0; i < numSeries; i++) {
    sets.push({ set_num: i + 1, peso_kg: 0, repeticiones: 0, is_completed: false });
  }

  const ultimoPesoMostrado = ultimoPeso ? mostrarPeso(ultimoPeso, unidad) : null;

  let html = `
    <div class="tracker-bloque" data-ej-id="${ej.ejercicio_id}">
      <div class="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-secondary">${ej.grupo_muscular}</span>
          ${ej.patron_movimiento ? `<span class="badge bg-dark border">${ej.patron_movimiento}</span>` : ""}
        </div>
        <div class="d-flex gap-1">
          ${!esBW ? `
            <button class="btn btn-xs btn-outline-light btnToggleUnidad" data-ej="${ej.ejercicio_id}" data-unidad="${unidad}">
              ${unidad === "kg" ? "→ lbs" : "→ kg"}
            </button>
          ` : ""}
          ${esBW ? `
            <button class="btn btn-xs btn-outline-light btnLastre" data-ej="${ej.ejercicio_id}" title="Activar lastre/peso extra">
              ⚖️ Lastre
            </button>
          ` : ""}
        </div>
      </div>
      ${ultimoPesoMostrado ? `<p class="small text-secondary mb-1">💡 Última sesión: <strong>${ultimoPesoMostrado} ${unidad}</strong> (tocá "Hecho" para usar ese peso)</p>` : ""}
      ${prHistorico ? `<p class="small text-secondary mb-2">🏆 PR: <strong>${mostrarPeso(prHistorico, unidad)} ${unidad}</strong></p>` : ""}
      <div class="sets-container">
        ${Array.from({length: numSeries}, (_, i) => `
          <div class="set-row d-flex align-items-center gap-2 mb-2" data-set="${i+1}">
            <span class="set-label text-secondary" style="min-width:40px;">Serie ${i+1}</span>
            ${esBW ? `
              <input type="number" class="form-control form-control-sm inp-peso" placeholder="0 (solo lastre)"
                     style="max-width:110px;" disabled data-ej="${ej.ejercicio_id}" data-set="${i+1}" value="0">
            ` : `
              <input type="number" step="0.5" class="form-control form-control-sm inp-peso"
                     placeholder="${ultimoPesoMostrado ? ultimoPesoMostrado : "kg"}"
                     style="max-width:110px;" data-ej="${ej.ejercicio_id}" data-set="${i+1}">
            `}
            <input type="number" class="form-control form-control-sm inp-reps"
                   placeholder="${ej.repeticiones || "reps"}" style="max-width:80px;"
                   data-ej="${ej.ejercicio_id}" data-set="${i+1}">
            <button class="btn btn-sm ${ultimoPesoMostrado ? 'btn-outline-light' : 'btn-primary'} btnHecho"
                    data-ej="${ej.ejercicio_id}" data-set="${i+1}"
                    data-ultimo="${ultimoPeso || 0}" data-unidad="${unidad}">
              ✓ Hecho
            </button>
            <span class="pr-badge d-none text-warning fw-bold">🏆 ¡PR!</span>
          </div>
        `).join("")}
      </div>
      <div class="mt-2 d-flex gap-2 flex-wrap">
        <button class="btn btn-sm btn-primary btnGuardarTodosLosSetsDe" data-ej="${ej.ejercicio_id}">
          💾 Guardar todas las series
        </button>
        <span class="tonelaje-badge text-secondary small align-self-center"></span>
      </div>
      <div class="pr-celebracion d-none alert alert-warning mt-2 py-1">🏆 ¡Nuevo Récord Personal!</div>
    </div>
  `;

  contenedor.innerHTML = html;

  // ---- EVENTOS ----

  // Toggle LBS/KG
  contenedor.querySelector(".btnToggleUnidad")?.addEventListener("click", (e) => {
    const nuevaUnidad = e.target.dataset.unidad === "kg" ? "lbs" : "kg";
    setUnidadPref(ej.ejercicio_id, nuevaUnidad);
    renderTrackerSeries(uid, ej, contenedor); // re-render con nueva unidad
  });

  // Activar lastre en bodyweight
  contenedor.querySelector(".btnLastre")?.addEventListener("click", () => {
    const inputs = contenedor.querySelectorAll(".inp-peso");
    inputs.forEach(inp => {
      inp.disabled = false;
      inp.placeholder = "kg lastre";
    });
  });

  // Botón "Hecho" por serie: confirma el peso de la última sesión como fantasma
  contenedor.querySelectorAll(".btnHecho").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const setNum = parseInt(btn.dataset.set, 10);
      const pRow = contenedor.querySelector(`.set-row[data-set="${setNum}"]`);
      const inpPeso = pRow.querySelector(".inp-peso");
      const inpReps = pRow.querySelector(".inp-reps");
      const unidadActual = getUnidadPref(ej.ejercicio_id);

      // Si el peso está vacío, usa el autocompletado fantasma
      if (!inpPeso.value && ultimoPeso) {
        inpPeso.value = mostrarPeso(ultimoPeso, unidadActual);
      }
      if (!inpReps.value && ej.repeticiones) {
        const match = String(ej.repeticiones).match(/\d+/);
        if (match) inpReps.value = match[0];
      }

      const pesoKg = esBW ? 0 : parsearPesoAKg(inpPeso.value, unidadActual);
      const reps = parseInt(inpReps.value, 10) || 0;
      const prBadge = pRow.querySelector(".pr-badge");

      sets[setNum - 1] = { set_num: setNum, peso_kg: pesoKg, repeticiones: reps, is_completed: true, unidad: unidadActual };
      btn.classList.add("btn-success");
      btn.classList.remove("btn-primary", "btn-outline-light");

      // PR check
      if (!esBW && prHistorico && pesoKg > prHistorico) {
        prBadge.classList.remove("d-none");
        contenedor.querySelector(".pr-celebracion").classList.remove("d-none");
      }

      // Tonelaje parcial
      const completados = sets.filter(s => s.is_completed);
      const tonelaje = completados.reduce((acc, s) => acc + s.peso_kg * s.repeticiones, 0);
      contenedor.querySelector(".tonelaje-badge").textContent =
        tonelaje > 0 ? `⚡ Tonelaje parcial: ${tonelaje.toFixed(1)} kg` : "";
    });
  });

  // Guardar TODOS los sets de este ejercicio
  contenedor.querySelector(".btnGuardarTodosLosSetsDe").addEventListener("click", async () => {
    const unidadActual = getUnidadPref(ej.ejercicio_id);
    const setsCompletos = sets.filter(s => s.is_completed);
    if (!setsCompletos.length) { alert("Completá al menos una serie primero."); return; }

    const pesosKg = setsCompletos.map(s => s.peso_kg);
    const maxPesoKg = Math.max(...pesosKg);
    const isPR = !esBW && prHistorico !== null && maxPesoKg > prHistorico;
    const tonelaje = setsCompletos.reduce((acc, s) => acc + s.peso_kg * s.repeticiones, 0);

    await db.collection("usuarios").doc(uid).collection("progreso").add({
      ejercicio_id: ej.ejercicio_id,
      nombre: ej.nombre,
      fecha: firebase.firestore.FieldValue.serverTimestamp(),
      sets: setsCompletos,
      is_pr: isPR,
      tonelaje_kg: tonelaje,
      bodyweight: esBW,
      lastre_activado: false,
      peso: maxPesoKg // campo legacy para el gráfico existente
    });

    if (isPR) {
      contenedor.querySelector(".pr-celebracion").classList.remove("d-none");
    }

    const btn = contenedor.querySelector(".btnGuardarTodosLosSetsDe");
    btn.textContent = "✅ Guardado";
    btn.disabled = true;

    // Actualiza el peso_actual de la rutina con el mejor peso del día
    return maxPesoKg;
  });
}

// Exporta para uso en dashboard.js
window.renderTrackerSeries = renderTrackerSeries;
window.obtenerUltimoPesoKg = obtenerUltimoPesoKg;
