// static/js/exercises-catalog.js
// Helper compartido para obtener el catálogo de ejercicios.
// Prioriza Firestore (colección "ejercicios", editable desde /admin).
// Si todavía no se migró nada a Firestore, cae de nuevo al catálogo
// local servido por Flask (/api/ejercicios) para que la app nunca se rompa.

async function obtenerCatalogoEjercicios() {
  try {
    const snap = await db.collection("ejercicios").get();
    if (!snap.empty) {
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  } catch (err) {
    console.warn("No se pudo leer el catálogo de ejercicios desde Firestore, usando el local:", err);
  }

  const res = await fetch("/api/ejercicios");
  return res.json();
}

async function obtenerCatalogoEjerciciosPorGrupo(grupo) {
  const catalogo = await obtenerCatalogoEjercicios();
  return catalogo.filter(e => e.grupo_muscular === grupo);
}
