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
  const nivel = document.getElementById("pNivel").value;
  const dias = parseInt(document.getElementById("pDias").value, 10);
  const enfoque = document.getElementById("pEnfoque").value;

  try {
    await db.collection("usuarios").doc(usuarioActual.uid).set(
      { perfil: { nivel, dias, enfoque } },
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
