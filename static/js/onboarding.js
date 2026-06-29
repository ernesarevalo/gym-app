// static/js/onboarding.js
// Genera una rutina semanal simple en base a las respuestas del cuestionario
// y la guarda en Firestore junto con el perfil del usuario.

const formOnboarding = document.getElementById("formOnboarding");

// Repeticiones sugeridas según el enfoque elegido
const REPS_POR_ENFOQUE = {
  "Fuerza": "1-5",
  "Hipertrofia": "6-12",
  "Resistencia": "15+"
};

// Plantillas de "splits" simples según los días disponibles.
// Cada día tiene una lista de grupos musculares a trabajar.
const SPLITS = {
  3: [
    ["Pecho", "Espalda", "Piernas"],
    ["Hombros", "Brazos", "Core"],
    ["Piernas", "Pecho", "Espalda"]
  ],
  4: [
    ["Pecho", "Hombros"],
    ["Espalda", "Brazos"],
    ["Piernas", "Core"],
    ["Pecho", "Espalda"]
  ],
  5: [
    ["Pecho"],
    ["Espalda"],
    ["Piernas"],
    ["Hombros"],
    ["Brazos", "Core"]
  ],
  6: [
    ["Pecho"],
    ["Espalda"],
    ["Piernas"],
    ["Hombros"],
    ["Brazos"],
    ["Core"]
  ]
};

async function obtenerEjercicios() {
  return obtenerCatalogoEjercicios();
}

const MINIMO_EJERCICIOS_POR_DIA = 5;

// ---------- CLASIFICACIÓN DE PATRONES DE MOVIMIENTO ----------
// Compuestos = van primero en el día (prioridad de Sistema Nervioso Central).
// Aislamiento/Core = van al final.
function esPatronCompuesto(patron) {
  if (!patron) return false;
  const p = patron.toLowerCase();
  return !p.startsWith("aislamiento") && !p.startsWith("estabilización") &&
         !p.startsWith("flexión de tronco") && !p.startsWith("rotación") &&
         !p.startsWith("flexión de cadera / estabilización") &&
         !p.startsWith("flexión de cadera / tronco");
}

// Ejercicios que cargan la zona lumbar de forma exigente. Si están en el
// día, evitamos sumar Remo con Barra (también lumbar-exigente) ese mismo
// día ni en el día inmediatamente siguiente.
const IDS_LUMBAR_EXIGENTE = new Set(["piernas_1", "piernas_7"]); // Sentadilla con Barra, Peso Muerto Convencional
const ID_REMO_BARRA = "espalda_2";
const SUSTITUTOS_REMO_BARRA = ["espalda_4", "espalda_8", "espalda_6"]; // Remo Sentado Polea Baja, Remo Mancuerna, Remo en T (con soporte)

// Rangos de repeticiones por rol dentro del día, según el enfoque elegido.
// El primer ejercicio compuesto del día va a un rango más bajo (fuerza);
// el resto respeta el rango propio de cada ejercicio (ya viene cargado en
// la base de datos: compuestos 6-10, aislamiento/core 10-15+).
const REPS_PRINCIPAL_POR_ENFOQUE = {
  "Fuerza": "4-6",
  "Hipertrofia": "6-8",
  "Resistencia": "8-10"
};

function elegirEjercicioPorGrupo(ejercicios, grupo, offset = 0) {
  const filtrados = ejercicios.filter(e => e.grupo_muscular === grupo);
  if (filtrados.length === 0) return null;
  // Rota entre las opciones disponibles para dar variedad (útil también
  // para "Mejorar mi rutina" más adelante, que pide otro offset).
  return filtrados[offset % filtrados.length];
}

async function generarRutina(dias, enfoque, offsetGlobal = 0) {
  const ejercicios = await obtenerEjercicios();
  const split = SPLITS[dias];
  const idsDiaAnterior = new Set();

  const rutina = split.map((grupos, indexDia) => {
    const porGrupo = Math.max(1, Math.ceil(MINIMO_EJERCICIOS_POR_DIA / grupos.length));
    const idsUsados = new Set();
    const ejerciciosDelDia = [];
    const tieneLumbarExigente = false; // se calcula abajo a medida que agregamos piernas

    grupos.forEach((grupo, gIdx) => {
      const patronesUsadosEnGrupo = new Set();

      for (let k = 0; k < porGrupo; k++) {
        const offset = offsetGlobal + indexDia * 7 + gIdx * 3 + k;
        let candidato = elegirEjercicioPorGrupo(ejercicios, grupo, offset);
        let intentos = 0;

        // Busca un candidato válido: que no esté repetido, que respete la
        // diversidad de patrones dentro del mismo grupo, y que no choque
        // con la regla de solapamiento lumbar.
        const esInvalido = (c) => {
          if (!c) return true;
          if (idsUsados.has(c.id)) return true;
          if (patronesUsadosEnGrupo.has(c.patron_movimiento) && patronesUsadosEnGrupo.size < 5) return true;
          if (c.id === ID_REMO_BARRA) {
            const hayLumbarHoy = [...idsUsados].some(id => IDS_LUMBAR_EXIGENTE.has(id)) ||
              grupos.includes("Piernas") && ejerciciosDelDia.some(e => IDS_LUMBAR_EXIGENTE.has(e.id));
            const hayLumbarAyer = [...idsDiaAnterior].some(id => IDS_LUMBAR_EXIGENTE.has(id));
            if (hayLumbarHoy || hayLumbarAyer) return true;
          }
          return false;
        };

        while (esInvalido(candidato) && intentos < 15) {
          intentos++;
          candidato = elegirEjercicioPorGrupo(ejercicios, grupo, offset + intentos);
        }

        // Si después de varios intentos seguimos chocando con Remo con
        // Barra por la regla lumbar, lo sustituimos directamente.
        if (candidato && candidato.id === ID_REMO_BARRA) {
          const sustitutoId = SUSTITUTOS_REMO_BARRA.find(id => !idsUsados.has(id));
          const sustituto = ejercicios.find(e => e.id === sustitutoId);
          if (sustituto) candidato = sustituto;
        }

        if (candidato && !idsUsados.has(candidato.id)) {
          idsUsados.add(candidato.id);
          patronesUsadosEnGrupo.add(candidato.patron_movimiento);
          ejerciciosDelDia.push(candidato);
        }
      }
    });

    // Jerarquía de fatiga: compuestos primero, aislamiento/core al final.
    ejerciciosDelDia.sort((a, b) => {
      const ca = esPatronCompuesto(a.patron_movimiento) ? 0 : 1;
      const cb = esPatronCompuesto(b.patron_movimiento) ? 0 : 1;
      return ca - cb;
    });

    idsDiaAnterior.clear();
    ejerciciosDelDia.forEach(e => idsDiaAnterior.add(e.id));

    const repsPrincipal = REPS_PRINCIPAL_POR_ENFOQUE[enfoque] || "6-8";

    const ejerciciosFormateados = ejerciciosDelDia.map((ej, idx) => {
      const esElPrincipal = idx === 0 && esPatronCompuesto(ej.patron_movimiento);
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
        // El ejercicio principal del día usa un rango bajo (foco fuerza).
        // El resto respeta el rango propio de cada ejercicio (ya viene
        // diferenciado en la base: compuestos 6-10, aislamiento 10-15+).
        series: esElPrincipal ? 4 : (ej.series_recomendadas || 3),
        repeticiones: esElPrincipal ? repsPrincipal : (ej.repeticiones_recomendadas || "10-15"),
        tipo_entrenamiento: enfoque,
        peso_actual: null
      };
    });

    return {
      dia: indexDia + 1,
      titulo: `Día ${indexDia + 1}: ${grupos.join(" + ")}`,
      ejercicios: ejerciciosFormateados
    };
  });

  return rutina;
}

formOnboarding.addEventListener("submit", async (e) => {
  e.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    alert("Debes iniciar sesión primero.");
    window.location.href = "/";
    return;
  }

  const nivel = document.getElementById("nivel").value;
  const dias = parseInt(document.getElementById("dias").value, 10);
  const enfoque = document.getElementById("enfoque").value;
  const fechaNacimiento = document.getElementById("fechaNacimiento").value;

  const rutina = await generarRutina(dias, enfoque);

  await db.collection("usuarios").doc(user.uid).set(
    {
      perfil: { nivel, dias, enfoque },
      fecha_nacimiento: fechaNacimiento,
      rutina: rutina
    },
    { merge: true }
  );

  window.location.href = "/dashboard";
});

// Protege la página: si no hay sesión, vuelve al login.
// Si no aceptó los disclaimers todavía, lo manda primero ahí.
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "/";
    return;
  }
  const snap = await db.collection("usuarios").doc(user.uid).get();
  const data = snap.data();
  if (!data || !data.disclaimers_aceptados) {
    window.location.href = "/disclaimers";
    return;
  }
  if (data.fecha_nacimiento) {
    document.getElementById("fechaNacimiento").value = data.fecha_nacimiento;
  }
});
