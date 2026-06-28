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
  const reps = REPS_POR_ENFOQUE[enfoque];

  const rutina = split.map((grupos, indexDia) => {
    // Repartimos al menos MINIMO_EJERCICIOS_POR_DIA ejercicios entre los
    // grupos musculares asignados a este día (varios ejercicios distintos
    // por grupo, no solo uno), usando lo disponible en el catálogo.
    const porGrupo = Math.max(1, Math.ceil(MINIMO_EJERCICIOS_POR_DIA / grupos.length));
    const idsUsados = new Set();
    const ejerciciosDelDia = [];

    grupos.forEach((grupo, gIdx) => {
      for (let k = 0; k < porGrupo; k++) {
        const offset = offsetGlobal + indexDia * 7 + gIdx * 3 + k;
        let candidato = elegirEjercicioPorGrupo(ejercicios, grupo, offset);
        // Evita repetir el mismo ejercicio dos veces en el mismo día
        let intentos = 0;
        while (candidato && idsUsados.has(candidato.id) && intentos < 10) {
          intentos++;
          candidato = elegirEjercicioPorGrupo(ejercicios, grupo, offset + intentos);
        }
        if (candidato && !idsUsados.has(candidato.id)) {
          idsUsados.add(candidato.id);
          ejerciciosDelDia.push(candidato);
        }
      }
    });

    const ejerciciosFormateados = ejerciciosDelDia.map(ej => ({
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
      series: 4,
      repeticiones: reps,
      tipo_entrenamiento: enfoque,
      peso_actual: null
    }));

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
