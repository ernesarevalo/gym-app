// static/js/onboarding.js
// Motor de generación de rutinas v2 — Sprint 1.
// Aplica: filtro por nivel/equipo, split por días+tiempo, jerarquía de
// fatiga, prevención de solapamiento lumbar, diversidad de patrones, y
// rangos de reps diferenciados por rol del ejercicio en el día.

// =====================================================================
// 1. SPLITS: qué grupos se entrenan cada día según días + tiempo
// =====================================================================
// Sesiones cortas (≤45 min) → Fullbody o splits compactos (menos grupos)
// Sesiones largas (≥90 min)  → PPL / splits más especializados
const SPLITS = {
  // 3 días
  "3_45":  [["Pecho","Piernas"],["Espalda","Hombros"],["Piernas","Brazos","Core"]],
  "3_60":  [["Pecho","Hombros"],["Espalda","Brazos"],["Piernas","Core"]],
  "3_90":  [["Pecho","Espalda","Piernas"],["Hombros","Brazos","Core"],["Piernas","Pecho","Espalda"]],
  "3_120": [["Pecho","Espalda","Piernas"],["Hombros","Brazos","Core"],["Piernas","Pecho","Espalda"]],
  // 4 días
  "4_45":  [["Pecho","Hombros"],["Espalda","Brazos"],["Piernas"],["Core","Brazos"]],
  "4_60":  [["Pecho","Hombros"],["Espalda","Brazos"],["Piernas","Core"],["Pecho","Espalda"]],
  "4_90":  [["Pecho","Hombros"],["Espalda","Brazos"],["Piernas","Core"],["Pecho","Espalda"]],
  "4_120": [["Pecho","Hombros"],["Espalda","Brazos"],["Piernas","Core"],["Pecho","Espalda"]],
  // 5 días
  "5_45":  [["Pecho"],["Espalda"],["Piernas"],["Hombros"],["Brazos","Core"]],
  "5_60":  [["Pecho"],["Espalda"],["Piernas"],["Hombros"],["Brazos","Core"]],
  "5_90":  [["Pecho"],["Espalda"],["Piernas"],["Hombros"],["Brazos","Core"]],
  "5_120": [["Pecho"],["Espalda"],["Piernas"],["Hombros"],["Brazos","Core"]],
  // 6 días (PPL x2)
  "6_45":  [["Pecho"],["Espalda"],["Piernas"],["Hombros"],["Brazos"],["Core"]],
  "6_60":  [["Pecho"],["Espalda"],["Piernas"],["Hombros"],["Brazos"],["Core"]],
  "6_90":  [["Pecho"],["Espalda"],["Piernas"],["Hombros"],["Brazos"],["Core"]],
  "6_120": [["Pecho"],["Espalda"],["Piernas"],["Hombros"],["Brazos"],["Core"]],
};

// Ejercicios por día según el tiempo disponible (sesión más corta = menos)
function ejerciciosPorDia(tiempoSesion) {
  if (tiempoSesion <= 45) return 4;
  if (tiempoSesion <= 60) return 5;
  if (tiempoSesion <= 90) return 6;
  return 7;
}

// =====================================================================
// 2. FILTROS DE NIVEL Y EQUIPAMIENTO
// =====================================================================
const NIVEL_ORDEN = { "Principiante": 0, "Intermedio": 1, "Avanzado": 2 };
const EQUIPO_INCLUYE = {
  "gimnasio": ["casa", "basico", "gimnasio"],
  "basico":   ["casa", "basico"],
  "casa":     ["casa"]
};

function filtrarCatalogo(catalogo, nivel, equipamiento) {
  const nivelNum = NIVEL_ORDEN[nivel] ?? 2;
  const equiposPermitidos = EQUIPO_INCLUYE[equipamiento] || ["casa"];
  return catalogo.filter(ej =>
    NIVEL_ORDEN[ej.nivel_minimo] <= nivelNum &&
    equiposPermitidos.includes(ej.equipamiento)
  );
}

// =====================================================================
// 3. REGLAS DEL MOTOR
// =====================================================================
function esPatronCompuesto(patron) {
  if (!patron) return false;
  const p = patron.toLowerCase();
  return !p.startsWith("aislamiento") && !p.startsWith("estabilización") &&
    !p.startsWith("flexión de tronco") && !p.startsWith("rotación") &&
    !p.startsWith("flexión de cadera");
}

const IDS_LUMBAR_EXIGENTE = new Set(["piernas_1", "piernas_7"]);
const ID_REMO_BARRA = "espalda_2";
const SUSTITUTOS_REMO_BARRA = ["espalda_4", "espalda_8", "espalda_6"];

const REPS_PRINCIPAL_POR_ENFOQUE = {
  "Fuerza": "4-6",
  "Hipertrofia": "6-8",
  "Resistencia": "8-10"
};

function elegirDelGrupo(catalogo, grupo, offset) {
  const f = catalogo.filter(e => e.grupo_muscular === grupo);
  if (!f.length) return null;
  return f[offset % f.length];
}

// =====================================================================
// 4. GENERACIÓN DE RUTINA
// =====================================================================
async function generarRutina(dias, tiempoSesion, enfoque, nivel, equipamiento, offsetGlobal = 0) {
  const catalogoBase = await obtenerCatalogoEjercicios();
  const catalogo = filtrarCatalogo(catalogoBase, nivel, equipamiento);

  const claveTimpo = tiempoSesion <= 45 ? "45" :
                     tiempoSesion <= 60 ? "60" :
                     tiempoSesion <= 90 ? "90" : "120";
  const claveSplit = `${dias}_${claveTimpo}`;
  const split = SPLITS[claveSplit] || SPLITS[`${dias}_60`];
  const maxEjerciciosPorDia = ejerciciosPorDia(tiempoSesion);
  const idsDiaAnterior = new Set();

  const rutina = split.map((grupos, indexDia) => {
    const porGrupo = Math.max(1, Math.ceil(maxEjerciciosPorDia / grupos.length));
    const idsUsados = new Set();
    const ejerciciosDelDia = [];

    grupos.forEach((grupo, gIdx) => {
      const patronesUsadosEnGrupo = new Set();

      for (let k = 0; k < porGrupo; k++) {
        const offset = offsetGlobal + indexDia * 7 + gIdx * 3 + k;
        let candidato = elegirDelGrupo(catalogo, grupo, offset);
        let intentos = 0;

        const esInvalido = (c) => {
          if (!c) return true;
          if (idsUsados.has(c.id)) return true;
          // Diversidad de patrones: no repetir el mismo patrón exacto en el mismo grupo
          if (c.patron_movimiento && patronesUsadosEnGrupo.has(c.patron_movimiento)) return true;
          // Solapamiento lumbar: no agregar Remo con Barra si ya hay lumbar exigente hoy o ayer
          if (c.id === ID_REMO_BARRA) {
            const hayLumbarHoy = [...idsUsados].some(id => IDS_LUMBAR_EXIGENTE.has(id));
            const hayLumbarAyer = [...idsDiaAnterior].some(id => IDS_LUMBAR_EXIGENTE.has(id));
            if (hayLumbarHoy || hayLumbarAyer) return true;
          }
          return false;
        };

        while (esInvalido(candidato) && intentos < 15) {
          intentos++;
          candidato = elegirDelGrupo(catalogo, grupo, offset + intentos);
        }

        // Sustitución explícita si Remo con Barra sigue sin poder usarse
        if (candidato && candidato.id === ID_REMO_BARRA) {
          const subId = SUSTITUTOS_REMO_BARRA.find(id =>
            !idsUsados.has(id) && catalogo.some(e => e.id === id)
          );
          const sub = catalogo.find(e => e.id === subId);
          if (sub) candidato = sub;
        }

        if (candidato && !idsUsados.has(candidato.id)) {
          idsUsados.add(candidato.id);
          if (candidato.patron_movimiento) patronesUsadosEnGrupo.add(candidato.patron_movimiento);
          ejerciciosDelDia.push(candidato);
        }
      }
    });

    // Jerarquía de fatiga: compuestos primero, aislamiento/core al final
    ejerciciosDelDia.sort((a, b) =>
      (esPatronCompuesto(a.patron_movimiento) ? 0 : 1) -
      (esPatronCompuesto(b.patron_movimiento) ? 0 : 1)
    );

    idsDiaAnterior.clear();
    ejerciciosDelDia.forEach(e => idsDiaAnterior.add(e.id));

    const repsPrincipal = REPS_PRINCIPAL_POR_ENFOQUE[enfoque] || "6-8";

    return {
      dia: indexDia + 1,
      titulo: `Día ${indexDia + 1}: ${grupos.join(" + ")}`,
      ejercicios: ejerciciosDelDia.map((ej, idx) => {
        const esPrincipal = idx === 0 && esPatronCompuesto(ej.patron_movimiento);
        return {
          ejercicio_id: ej.id,
          nombre: ej.nombre,
          grupo_muscular: ej.grupo_muscular,
          descripcion: ej.descripcion,
          tecnica: ej.tecnica || null,
          tips: ej.tips || [],
          peso_recomendado: ej.peso_recomendado || null,
          video_url: ej.video_url,
          tiktok_url: ej.tiktok_url || null,
          imagen_url: ej.imagen_url || null,
          patron_movimiento: ej.patron_movimiento || null,
          // Ejercicio principal del día: rango bajo (fuerza)
          // Resto: reps recomendadas de la BD (6-10 compuesto, 10-15 aislamiento)
          series: esPrincipal ? 4 : (ej.series_recomendadas || 3),
          repeticiones: esPrincipal ? repsPrincipal : (ej.repeticiones_recomendadas || "10-15"),
          tipo_entrenamiento: enfoque,
          peso_actual: null
        };
      })
    };
  });

  return rutina;
}

// =====================================================================
// 5. HINTS Y PREVIEW EN EL FORMULARIO
// =====================================================================
const NIVEL_HINTS = {
  "Principiante": "✅ Ejercicios con máquinas y mancuernas, menor demanda de estabilidad y coordinación.",
  "Intermedio": "✅ Se incluyen ejercicios con barra libre y movimientos compuestos más técnicos.",
  "Avanzado": "✅ Acceso a todo el catálogo: peso muerto convencional, sentadilla libre y variantes avanzadas."
};
const EQUIPO_HINTS = {
  "gimnasio": "✅ Acceso a todo el catálogo: barras, jaulas, poleas y máquinas específicas.",
  "basico": "✅ Se filtran los ejercicios que requieren jaula, poleas o máquinas especializadas.",
  "casa": "✅ Solo ejercicios realizables con mancuernas, bandas elásticas y peso corporal."
};
const TIEMPO_HINTS = {
  45: "⚡ Sesión compacta: 4 ejercicios bien elegidos, descansos cortos.",
  60: "🎯 Sesión estándar: 5 ejercicios, equilibrio entre intensidad y volumen.",
  90: "💪 Sesión completa: 6 ejercicios, podés trabajar bien cada grupo.",
  120: "🔥 Sesión larga: hasta 7 ejercicios, ideal para PPL o splits avanzados."
};

document.getElementById("nivel").addEventListener("change", (e) => {
  const hint = document.getElementById("nivelHint");
  hint.textContent = NIVEL_HINTS[e.target.value] || "";
  hint.classList.toggle("d-none", !NIVEL_HINTS[e.target.value]);
  actualizarPreview();
});
document.getElementById("equipamiento").addEventListener("change", (e) => {
  const hint = document.getElementById("equipamientoHint");
  hint.textContent = EQUIPO_HINTS[e.target.value] || "";
  hint.classList.toggle("d-none", !EQUIPO_HINTS[e.target.value]);
  actualizarPreview();
});
document.getElementById("tiempoSesion").addEventListener("change", (e) => {
  const val = parseInt(e.target.value, 10);
  const hint = document.getElementById("tiempoHint");
  hint.textContent = TIEMPO_HINTS[val] || "";
  hint.classList.toggle("d-none", !TIEMPO_HINTS[val]);
  actualizarPreview();
});
document.getElementById("dias").addEventListener("change", actualizarPreview);
document.getElementById("enfoque").addEventListener("change", actualizarPreview);

function actualizarPreview() {
  const dias = document.getElementById("dias").value;
  const tiempo = document.getElementById("tiempoSesion").value;
  const nivel = document.getElementById("nivel").value;
  const equipo = document.getElementById("equipamiento").value;
  const enfoque = document.getElementById("enfoque").value;
  const preview = document.getElementById("splitPreview");

  if (!dias || !tiempo || !nivel || !equipo || !enfoque) {
    preview.classList.add("d-none");
    return;
  }

  const clave = `${dias}_${tiempo <= 45 ? "45" : tiempo <= 60 ? "60" : tiempo <= 90 ? "90" : "120"}`;
  const split = SPLITS[clave] || SPLITS[`${dias}_60`];
  const maxEj = ejerciciosPorDia(parseInt(tiempo, 10));
  const splitStr = split.map((g, i) => `Día ${i+1}: ${g.join(" + ")}`).join("  ·  ");

  preview.classList.remove("d-none");
  preview.innerHTML = `
    <strong>Vista previa de tu split:</strong><br>
    ${splitStr}<br>
    <span class="text-secondary">${maxEj} ejercicios por sesión · ${enfoque} · Solo ejercicios aptos para nivel ${nivel} con equipamiento ${equipo}</span>
  `;
}

// =====================================================================
// 6. ENVÍO DEL FORMULARIO
// =====================================================================
document.getElementById("formOnboarding").addEventListener("submit", async (e) => {
  e.preventDefault();

  const user = auth.currentUser;
  if (!user) { window.location.href = "/"; return; }

  const nivel        = document.getElementById("nivel").value;
  const dias         = parseInt(document.getElementById("dias").value, 10);
  const tiempoSesion = parseInt(document.getElementById("tiempoSesion").value, 10);
  const enfoque      = document.getElementById("enfoque").value;
  const equipamiento = document.getElementById("equipamiento").value;
  const fechaNacimiento = document.getElementById("fechaNacimiento").value;

  const rutina = await generarRutina(dias, tiempoSesion, enfoque, nivel, equipamiento);

  await db.collection("usuarios").doc(user.uid).set(
    {
      perfil: { nivel, dias, tiempoSesion, enfoque, equipamiento },
      fecha_nacimiento: fechaNacimiento,
      rutina
    },
    { merge: true }
  );

  window.location.href = "/dashboard";
});

// Protege la página: si no hay sesión activa o no aceptó disclaimers, redirige.
auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = "/"; return; }
  const snap = await db.collection("usuarios").doc(user.uid).get();
  const data = snap.data();
  if (!data || !data.disclaimers_aceptados) {
    window.location.href = "/disclaimers";
    return;
  }
  // Precargar fecha de nacimiento si ya existe
  if (data.fecha_nacimiento) {
    document.getElementById("fechaNacimiento").value = data.fecha_nacimiento;
  }
  // Precargar preferencias del perfil si ya existen
  const perfil = data.perfil || {};
  if (perfil.nivel)        document.getElementById("nivel").value = perfil.nivel;
  if (perfil.dias)         document.getElementById("dias").value = String(perfil.dias);
  if (perfil.tiempoSesion) document.getElementById("tiempoSesion").value = String(perfil.tiempoSesion);
  if (perfil.enfoque)      document.getElementById("enfoque").value = perfil.enfoque;
  if (perfil.equipamiento) document.getElementById("equipamiento").value = perfil.equipamiento;
});
