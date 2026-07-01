// static/js/engine.js
// Motor avanzado — Pilar 1, 2 y 3.
// Pilar 1: Modo Express, Periodización/Descargas, Triage de Molestias
// Pilar 2: Mapa de calor muscular, Superseries/Drop Sets
// Pilar 3: PRs, Racha "Modo Bestia", Tonelaje semanal

// =====================================================================
// PILAR 1-A: MODO EXPRESS (30 minutos)
// Filtra la rutina del día: quita aislamiento, deja solo compuestos.
// Si quedan menos de 2, convierte en circuito (3 rondas x 10 reps).
// =====================================================================
function esPatronCompuesto(patron) {
  if (!patron) return false;
  const p = patron.toLowerCase();
  return !p.startsWith("aislamiento") && !p.startsWith("estabilización") &&
    !p.startsWith("flexión de tronco") && !p.startsWith("rotación") &&
    !p.startsWith("flexión de cadera");
}

function modoExpress(ejerciciosDelDia) {
  const compuestos = ejerciciosDelDia.filter(e => esPatronCompuesto(e.patron_movimiento));

  if (compuestos.length >= 2) {
    // Ajustar series y reps para sesión corta
    return compuestos.map(e => ({
      ...e,
      series: Math.min(e.series || 4, 3),
      repeticiones: e.repeticiones || "8-10",
      nota_express: "⚡ Modo Express: solo ejercicios compuestos, descanso 60s."
    }));
  }

  // Si quedan muy pocos, convertir en circuito con TODOS los ejercicios del día
  return ejerciciosDelDia.map(e => ({
    ...e,
    series: 3,
    repeticiones: "10",
    modo_circuito: true,
    nota_express: "🔄 Circuito: 3 rondas completas, sin descanso entre ejercicios, 90s entre rondas."
  }));
}

// =====================================================================
// PILAR 1-B: PERIODIZACIÓN Y DESCARGAS
// Se llama al cargar el dashboard para verificar si corresponde descarga.
// semanas_entrenadas se guarda en el perfil del usuario en Firestore.
// =====================================================================
async function verificarDescarga(uid) {
  const snap = await db.collection("usuarios").doc(uid).get();
  const data = snap.data() || {};
  const semanas = data.semanas_entrenadas || 0;
  const descargaActiva = data.descarga_activa || false;

  // Cada vez que el usuario completa una semana (lunes detectado o manualmente)
  // el contador sube. Al llegar a semana 5 o 6, se propone descarga.
  if ((semanas % 6 === 4 || semanas % 6 === 5) && !descargaActiva) {
    return {
      proponer: true,
      mensaje: `Llevas ${semanas + 1} semanas de entrenamiento consecutivo. ` +
        `Es momento de una Semana de Descarga para que tu sistema nervioso se recupere. ` +
        `El volumen se reduce un 20% esta semana.`
    };
  }
  return { proponer: false };
}

function aplicarDescarga(ejerciciosDelDia) {
  return ejerciciosDelDia.map(e => ({
    ...e,
    series: Math.max(1, Math.floor((e.series || 3) * 0.8)),
    nota_descarga: "🔵 Semana de Descarga: volumen reducido 20%. Priorizá la técnica."
  }));
}

// =====================================================================
// PILAR 1-C: TRIAGE DE MOLESTIAS FÍSICAS
// Zonas: "lumbar" | "rodilla" | "hombro" | "codo" | "ninguno"
// Reemplaza ejercicios de alto estrés axial/articular por alternativas.
// =====================================================================
const ALTERNATIVAS_POR_ZONA = {
  "lumbar": {
    // ejercicio_riesgo → ejercicio_seguro (ids)
    "piernas_1": "piernas_3",   // Sentadilla → Prensa
    "piernas_7": "piernas_3",   // Peso Muerto Convencional → Prensa
    "espalda_2": "espalda_4",   // Remo con Barra → Remo Sentado Polea
    "espalda_5": "espalda_8",   // Peso Muerto Rumano → Remo Mancuerna
    "espalda_9": "espalda_8",   // Hiperextensiones → Remo Mancuerna
    "hombros_6": "hombros_1",   // Press Militar Barra de pie → Press con Mancuernas sentado
  },
  "rodilla": {
    "piernas_1": "piernas_9",   // Sentadilla → Hip Thrust
    "piernas_2": "piernas_9",   // Zancadas → Hip Thrust
    "piernas_6": "piernas_9",   // Sentadilla Búlgara → Hip Thrust
  },
  "hombro": {
    "pecho_1": "pecho_5",       // Press Banca Barra → Máquina
    "pecho_4": "pecho_5",       // Fondos → Máquina
    "hombros_6": "hombros_9",   // Press Barra → Máquina Hombro
    "hombros_8": "hombros_2",   // Remo Cuello → Elevaciones Laterales
  },
  "codo": {
    "brazos_2": "brazos_5",     // Press Francés → Extensión en Polea (menor stress)
    "brazos_4": "brazos_5",     // Fondos Banco → Extensión en Polea
  }
};

async function aplicarTriage(ejerciciosDelDia, zonaDolor, catalogoEjercicios) {
  if (!zonaDolor || zonaDolor === "ninguno") return { ejercicios: ejerciciosDelDia, reemplazos: [] };

  const mapa = ALTERNATIVAS_POR_ZONA[zonaDolor] || {};
  const reemplazos = [];

  const ejerciciosAjustados = ejerciciosDelDia.map(ej => {
    const idAlternativa = mapa[ej.ejercicio_id];
    if (!idAlternativa) return ej;

    const alternativa = catalogoEjercicios.find(e => e.id === idAlternativa);
    if (!alternativa) return ej;

    reemplazos.push({
      original: ej.nombre,
      reemplazo: alternativa.nombre,
      motivo: `⚠️ Reemplazado por molestia en ${zonaDolor}.`
    });

    return {
      ...alternativa,
      ejercicio_id: alternativa.id,
      series: ej.series,
      repeticiones: ej.repeticiones,
      tipo_entrenamiento: ej.tipo_entrenamiento,
      peso_actual: null,
      nota_triage: `⚠️ Reemplazo por molestia en ${zonaDolor}: se sustituyó "${ej.nombre}" por este ejercicio más seguro.`
    };
  });

  return { ejercicios: ejerciciosAjustados, reemplazos };
}

// =====================================================================
// PILAR 2-A: MAPA DE CALOR MUSCULAR
// Lee los últimos 2 días del historial y calcula el nivel de fatiga
// por grupo muscular: 0 (fresco) | 1 (48h de descanso, OK) | 2 (reciente, cuidado)
// =====================================================================
async function calcularMapaCalor(uid) {
  const hoy = new Date();
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  const anteayer = new Date(hoy); anteayer.setDate(hoy.getDate() - 2);

  const snap = await db.collection("usuarios").doc(uid)
    .collection("historial_sesiones")
    .get();

  const mapaCalor = {};

  snap.docs.forEach(doc => {
    const s = doc.data();
    if (!s.fecha) return;
    const fecha = s.fecha.toDate();
    const diffDias = Math.floor((hoy - fecha) / 86400000);

    (s.grupos_trabajados || []).forEach(grupo => {
      if (diffDias === 0) mapaCalor[grupo] = Math.max(mapaCalor[grupo] || 0, 2); // hoy
      else if (diffDias === 1) mapaCalor[grupo] = Math.max(mapaCalor[grupo] || 0, 2); // ayer = fatigado
      else if (diffDias === 2) mapaCalor[grupo] = Math.max(mapaCalor[grupo] || 0, 1); // anteayer = recuperando
    });
  });

  return mapaCalor; // { "Pecho": 2, "Espalda": 1, ... }
}

function colorCalor(nivel) {
  if (nivel === 2) return { color: "#ef4444", label: "🔴 Entrenado ayer — necesita más descanso" };
  if (nivel === 1) return { color: "#f59e0b", label: "🟡 Entrenado hace 2 días — recuperando" };
  return { color: "#22c55e", label: "🟢 Listo para entrenar" };
}

// =====================================================================
// PILAR 2-B: SUPERSERIES Y DROP SETS
// Modelo de datos: un bloque puede contener 2 ejercicios vinculados.
// El tipo define cómo se registra y ejecuta.
// {
//   tipo: "superserie" | "dropset",
//   ejercicios: [ejercicio_a, ejercicio_b],
//   descanso_entre_ejercicios_seg: 0,
//   descanso_entre_series_seg: 90,
//   nota: "Ejecutar A inmediatamente seguido de B sin descanso"
// }
// =====================================================================
function crearSuperSerie(ejercicioA, ejercicioB) {
  return {
    tipo: "superserie",
    ejercicios: [ejercicioA, ejercicioB],
    descanso_entre_ejercicios_seg: 0,
    descanso_entre_series_seg: 90,
    nota: `Superserie: ${ejercicioA.nombre} → ${ejercicioB.nombre} sin descanso entre ellos.`
  };
}

function crearDropSet(ejercicio, porcentaje_reduccion = 20) {
  return {
    tipo: "dropset",
    ejercicios: [ejercicio],
    porcentaje_reduccion,
    nota: `Drop Set: al fallar, reducir el peso un ${porcentaje_reduccion}% y continuar sin descanso.`
  };
}

// =====================================================================
// PILAR 3-A: RÉCORDS PERSONALES (PRs)
// Ya implementado en session-tracker.js. Este wrapper guarda el PR
// en el perfil del usuario para notificación y estadísticas.
// =====================================================================
async function registrarPR(uid, ejercicio_id, nombre, nuevo_peso_kg) {
  const ref = db.collection("usuarios").doc(uid)
    .collection("prs").doc(ejercicio_id);

  const snap = await ref.get();
  const actual = snap.exists ? snap.data().peso_kg : 0;

  if (nuevo_peso_kg > actual) {
    await ref.set({
      ejercicio_id,
      nombre,
      peso_kg: nuevo_peso_kg,
      fecha: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true; // nuevo PR
  }
  return false;
}

// =====================================================================
// PILAR 3-B: RACHA Y DESBLOQUEO MODO BESTIA
// Se llama al guardar una sesión completada.
// Al llegar a 21 días consecutivos, activa bestia_desbloqueado = true.
// =====================================================================
async function actualizarRacha(uid) {
  const snap = await db.collection("usuarios").doc(uid).get();
  const data = snap.data() || {};

  const hoy = new Date().toDateString();
  const ultimaFecha = data.ultima_sesion_fecha || null;
  let racha = data.racha_dias || 0;

  if (ultimaFecha === hoy) return racha; // Ya entrenó hoy, sin cambios

  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const ayerStr = ayer.toDateString();

  if (ultimaFecha === ayerStr) {
    racha += 1; // día consecutivo
  } else {
    racha = 1; // racha rota, empieza de 1
  }

  const bestiaDesbloqueada = racha >= 21;
  const update = {
    racha_dias: racha,
    ultima_sesion_fecha: hoy,
    semanas_entrenadas: Math.floor(racha / 7)
  };

  if (bestiaDesbloqueada && !data.bestia_desbloqueado) {
    update.bestia_desbloqueado = true;
    // Activa el modo bestia en el tema visual
    localStorage.setItem("gymapp_theme", "beast-light");
  }

  await db.collection("usuarios").doc(uid).set(update, { merge: true });
  return { racha, bestiaDesbloqueada };
}

// =====================================================================
// PILAR 3-C: MÉTRICA DE TONELAJE SEMANAL
// Suma (series * repeticiones * peso_kg) de todos los registros de la semana.
// =====================================================================
async function calcularTonelajeSemanal(uid) {
  const hoy = new Date();
  const inicioSemana = new Date(hoy);
  inicioSemana.setDate(hoy.getDate() - hoy.getDay()); // Domingo de esta semana
  inicioSemana.setHours(0, 0, 0, 0);

  const snap = await db.collection("usuarios").doc(uid)
    .collection("progreso")
    .get();

  let tonelajeTotal = 0;
  const porGrupo = {};

  snap.docs.forEach(doc => {
    const d = doc.data();
    if (!d.fecha) return;
    const fecha = d.fecha.toDate ? d.fecha.toDate() : new Date(d.fecha);
    if (fecha < inicioSemana) return;

    if (d.sets) {
      d.sets.filter(s => s.is_completed).forEach(s => {
        const ton = (s.peso_kg || 0) * (s.repeticiones || 0);
        tonelajeTotal += ton;
        if (d.grupo_muscular) {
          porGrupo[d.grupo_muscular] = (porGrupo[d.grupo_muscular] || 0) + ton;
        }
      });
    } else if (d.peso && d.peso > 0) {
      // Fallback para registros legacy (sin tracking por serie)
      tonelajeTotal += d.peso;
    }
  });

  return { total_kg: Math.round(tonelajeTotal), por_grupo: porGrupo };
}

// =====================================================================
// GUARDAR SESIÓN COMPLETADA (wrapper que dispara racha, tonelaje, etc.)
// =====================================================================
async function guardarSesionCompletada(uid, diaRutina) {
  const grupos = [...new Set(diaRutina.ejercicios.map(e => e.grupo_muscular))];

  // Guardar en historial de sesiones (para mapa de calor)
  await db.collection("usuarios").doc(uid).collection("historial_sesiones").add({
    fecha: firebase.firestore.FieldValue.serverTimestamp(),
    dia_rutina: diaRutina.dia,
    titulo: diaRutina.titulo,
    grupos_trabajados: grupos
  });

  // Actualizar racha
  const resultadoRacha = await actualizarRacha(uid);
  return resultadoRacha;
}

// Exporta para dashboard.js
window.GymEngine = {
  modoExpress, verificarDescarga, aplicarDescarga,
  aplicarTriage, calcularMapaCalor, colorCalor,
  crearSuperSerie, crearDropSet,
  registrarPR, actualizarRacha, calcularTonelajeSemanal,
  guardarSesionCompletada
};
