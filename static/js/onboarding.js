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
  const res = await fetch("/api/ejercicios");
  return res.json();
}

function elegirEjercicioPorGrupo(ejercicios, grupo) {
  const filtrados = ejercicios.filter(e => e.grupo_muscular === grupo);
  if (filtrados.length === 0) return null;
  // Por simplicidad, elige el primero disponible (el usuario puede cambiarlo luego)
  return filtrados[0];
}

async function generarRutina(dias, enfoque) {
  const ejercicios = await obtenerEjercicios();
  const split = SPLITS[dias];
  const reps = REPS_POR_ENFOQUE[enfoque];

  const rutina = split.map((grupos, index) => {
    const ejerciciosDelDia = grupos
      .map(grupo => elegirEjercicioPorGrupo(ejercicios, grupo))
      .filter(Boolean)
      .map(ej => ({
        ejercicio_id: ej.id,
        nombre: ej.nombre,
        grupo_muscular: ej.grupo_muscular,
        descripcion: ej.descripcion,
        video_url: ej.video_url,
        series: 4,
        repeticiones: reps,
        peso_actual: null
      }));

    return {
      dia: index + 1,
      titulo: `Día ${index + 1}: ${grupos.join(" + ")}`,
      ejercicios: ejerciciosDelDia
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

  const rutina = await generarRutina(dias, enfoque);

  await db.collection("usuarios").doc(user.uid).set(
    {
      perfil: { nivel, dias, enfoque },
      rutina: rutina
    },
    { merge: true }
  );

  window.location.href = "/dashboard";
});

// Protege la página: si no hay sesión, vuelve al login
auth.onAuthStateChanged((user) => {
  if (!user) window.location.href = "/";
});
