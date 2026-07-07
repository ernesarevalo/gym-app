// static/js/perfil.js

let usuarioActual = null;
let usernameYaCambiado = false;

const perfilError = document.getElementById("perfilError");
const perfilOk = document.getElementById("perfilOk");

function mostrarOk(msg) {
  perfilOk.textContent = msg;
  perfilOk.classList.remove("d-none");
  perfilError.classList.add("d-none");
  setTimeout(() => perfilOk.classList.add("d-none"), 3000);
}

function mostrarError(msg) {
  perfilError.textContent = msg;
  perfilError.classList.remove("d-none");
  perfilOk.classList.add("d-none");
}

async function cargarPerfil() {
  const snap = await db.collection("usuarios").doc(usuarioActual.uid).get();
  const data = snap.data() || {};

  document.getElementById("pNombre").value = data.nombre || "";
  document.getElementById("pUsername").value = data.username || "";
  document.getElementById("pEmail").value = data.email || usuarioActual.email || "";
  document.getElementById("pFechaNacimiento").value = data.fecha_nacimiento || "";
  document.getElementById("pFotoUrl").value = data.foto_url || "";

  if (data.foto_url) {
    const img = document.getElementById("pFotoPreview");
    img.src = data.foto_url;
    img.classList.remove("d-none");
  }

  const perfil = data.perfil || {};
  document.getElementById("pNivel").value = perfil.nivel || "Principiante";
  document.getElementById("pDias").value = perfil.dias || 3;
  document.getElementById("pTiempoSesion").value = perfil.tiempoSesion || 60;
  document.getElementById("pEquipamiento").value = perfil.equipamiento || "gimnasio";
  document.getElementById("pEnfoque").value = perfil.enfoque || "Hipertrofia";

  usernameYaCambiado = !!data.username_cambiado;
  const aviso = document.getElementById("usernameAviso");
  if (usernameYaCambiado) {
    document.getElementById("btnEditarUsername").disabled = true;
    aviso.textContent = "Ya usaste tu única oportunidad de cambiar el nombre de usuario.";
  } else {
    aviso.textContent = "Podés cambiar tu nombre de usuario una sola vez.";
  }
}

document.getElementById("pFotoUrl").addEventListener("input", (e) => {
  const img = document.getElementById("pFotoPreview");
  if (e.target.value) {
    img.src = e.target.value;
    img.classList.remove("d-none");
  } else {
    img.classList.add("d-none");
  }
});

document.getElementById("btnGuardarDatos").addEventListener("click", async () => {
  const nombre = document.getElementById("pNombre").value.trim();
  const fecha_nacimiento = document.getElementById("pFechaNacimiento").value;
  const foto_url = document.getElementById("pFotoUrl").value.trim();

  try {
    await db.collection("usuarios").doc(usuarioActual.uid).set(
      { nombre, fecha_nacimiento, foto_url },
      { merge: true }
    );
    mostrarOk("Datos personales guardados ✅");
  } catch (err) {
    mostrarError("Error al guardar: " + err.message);
  }
});

document.getElementById("btnGuardarPreferencias").addEventListener("click", async () => {
  const nivel        = document.getElementById("pNivel").value;
  const dias         = parseInt(document.getElementById("pDias").value, 10);
  const tiempoSesion = parseInt(document.getElementById("pTiempoSesion").value, 10);
  const equipamiento = document.getElementById("pEquipamiento").value;
  const enfoque      = document.getElementById("pEnfoque").value;

  try {
    await db.collection("usuarios").doc(usuarioActual.uid).set(
      { perfil: { nivel, dias, tiempoSesion, equipamiento, enfoque } },
      { merge: true }
    );
    mostrarOk("Preferencias guardadas ✅");
  } catch (err) {
    mostrarError("Error al guardar: " + err.message);
  }
});

// ---------- CAMBIO DE USERNAME (UNA SOLA VEZ) ----------
const modalUsername = () => new bootstrap.Modal(document.getElementById("modalUsername"));

document.getElementById("btnEditarUsername").addEventListener("click", () => {
  if (usernameYaCambiado) return;
  document.getElementById("nuevoUsernameInput").value = "";
  document.getElementById("usernameModalError").classList.add("d-none");
  modalUsername().show();
});

document.getElementById("btnConfirmarUsername").addEventListener("click", async () => {
  const nuevoRaw = document.getElementById("nuevoUsernameInput").value.trim();
  const nuevo = nuevoRaw.toLowerCase();
  const errorDiv = document.getElementById("usernameModalError");

  if (nuevo.length < 3 || !/^[a-z0-9_.]+$/.test(nuevo)) {
    errorDiv.textContent = "El nombre de usuario debe tener al menos 3 caracteres (solo letras, números, punto o guión bajo).";
    errorDiv.classList.remove("d-none");
    return;
  }

  try {
    const anterior = document.getElementById("pUsername").value;
    const existente = await db.collection("usernames").doc(nuevo).get();
    if (existente.exists) {
      errorDiv.textContent = "Ese nombre de usuario ya está en uso.";
      errorDiv.classList.remove("d-none");
      return;
    }

    await db.collection("usernames").doc(nuevo).set({ uid: usuarioActual.uid, email: usuarioActual.email });
    if (anterior) {
      await db.collection("usernames").doc(anterior.toLowerCase()).delete();
    }

    await db.collection("usuarios").doc(usuarioActual.uid).set(
      { username: nuevo, username_cambiado: true },
      { merge: true }
    );

    document.getElementById("pUsername").value = nuevo;
    usernameYaCambiado = true;
    document.getElementById("btnEditarUsername").disabled = true;
    document.getElementById("usernameAviso").textContent = "Ya usaste tu única oportunidad de cambiar el nombre de usuario.";
    bootstrap.Modal.getInstance(document.getElementById("modalUsername")).hide();
    mostrarOk("Nombre de usuario actualizado ✅");
  } catch (err) {
    errorDiv.textContent = "Error: " + err.message;
    errorDiv.classList.remove("d-none");
  }
});

document.getElementById("btnLogout").addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "/";
});

// ---- Mejorar rutina desde el perfil ----
document.getElementById("btnMejorarRutinaDesdePerf")?.addEventListener("click", async () => {
  if (!confirm("¿Generar una versión mejorada de tu rutina? Vas a poder volver a la actual si no te convence.")) return;
  try {
    const snap = await db.collection("usuarios").doc(usuarioActual.uid).get();
    const data = snap.data() || {};
    const catalogo = await fetch("/api/ejercicios").then(r => r.json());
    const rutinaActual = data.rutina || [];

    const rutinaMejorada = rutinaActual.map(dia => ({
      ...dia,
      ejercicios: dia.ejercicios.map(ej => {
        const opciones = catalogo.filter(e => e.grupo_muscular === ej.grupo_muscular);
        if (opciones.length <= 1) return { ...ej, series: Math.min((ej.series || 3) + 1, 5) };
        const idxActual = opciones.findIndex(o => o.id === ej.ejercicio_id);
        const siguiente = opciones[(idxActual + 1) % opciones.length];
        return {
          ...ej,
          ejercicio_id: siguiente.id,
          nombre: siguiente.nombre,
          descripcion: siguiente.descripcion,
          tecnica: siguiente.tecnica || null,
          tips: siguiente.tips || [],
          peso_recomendado: siguiente.peso_recomendado || null,
          video_url: siguiente.video_url,
          tiktok_url: siguiente.tiktok_url || null,
          patron_movimiento: siguiente.patron_movimiento || null,
          prioridad_orden: siguiente.prioridad_orden || ej.prioridad_orden,
          series: Math.min((ej.series || 3) + 1, 5),
          peso_actual: null
        };
      })
    }));

    await db.collection("usuarios").doc(usuarioActual.uid).update({
      rutina: rutinaMejorada,
      rutina_anterior: rutinaActual
    });

    document.getElementById("btnVolverAnteriorDesdePerf")?.classList.remove("d-none");
    mostrarOk("¡Rutina mejorada! ✅ Podés verla en el dashboard.");
  } catch (err) {
    mostrarError("Error: " + err.message);
  }
});

document.getElementById("btnVolverAnteriorDesdePerf")?.addEventListener("click", async () => {
  if (!confirm("¿Volver a la rutina anterior?")) return;
  try {
    const snap = await db.collection("usuarios").doc(usuarioActual.uid).get();
    const anterior = (snap.data() || {}).rutina_anterior;
    if (!anterior) { mostrarError("No hay rutina anterior guardada."); return; }

    await db.collection("usuarios").doc(usuarioActual.uid).update({
      rutina: anterior,
      rutina_anterior: firebase.firestore.FieldValue.delete()
    });

    document.getElementById("btnVolverAnteriorDesdePerf")?.classList.add("d-none");
    mostrarOk("Rutina anterior restaurada ✅");
  } catch (err) {
    mostrarError("Error: " + err.message);
  }
});

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "/";
    return;
  }
  usuarioActual = user;
  await cargarPerfil();

  if (user.email === "ernestoarevalo@gmail.com" && typeof RUTINA_GYMROUTINE !== "undefined") {
    document.getElementById("zonaImportarGymroutine").classList.remove("d-none");
  }
  if (user.email === "ernestoarevalo@gmail.com") {
    document.getElementById("zonaAdmin").classList.remove("d-none");
  }
});

document.getElementById("btnImportarGymroutine")?.addEventListener("click", async () => {
  if (!confirm("Esto va a reemplazar tu rutina actual por tu rutina real de gymroutine (5 días). Tu rutina actual se guarda como respaldo y podés volver a ella desde el dashboard. ¿Continuar?")) {
    return;
  }
  try {
    const snap = await db.collection("usuarios").doc(usuarioActual.uid).get();
    const actual = snap.data() || {};

    await db.collection("usuarios").doc(usuarioActual.uid).update({
      rutina: RUTINA_GYMROUTINE,
      rutina_anterior: actual.rutina || firebase.firestore.FieldValue.delete(),
      "perfil.dias": RUTINA_GYMROUTINE.length
    });

    mostrarOk("¡Tu rutina de gymroutine fue importada! Yendo al dashboard...");
    setTimeout(() => window.location.href = "/dashboard", 1200);
  } catch (err) {
    mostrarError("Error al importar: " + err.message);
  }
});
