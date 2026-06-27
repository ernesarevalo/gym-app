// static/js/perfil.js

let usuarioActual = null;

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

  const perfil = data.perfil || {};
  document.getElementById("pNivel").value = perfil.nivel || "Principiante";
  document.getElementById("pDias").value = perfil.dias || 3;
  document.getElementById("pEnfoque").value = perfil.enfoque || "Hipertrofia";
}

document.getElementById("btnGuardarDatos").addEventListener("click", async () => {
  const nombre = document.getElementById("pNombre").value.trim();
  try {
    await db.collection("usuarios").doc(usuarioActual.uid).set({ nombre }, { merge: true });
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
});
