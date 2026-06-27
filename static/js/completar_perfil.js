// static/js/completar_perfil.js

let usuarioActual = null;

function normalizarUsername(u) {
  return u.trim().toLowerCase();
}

function mostrarError(msg) {
  const div = document.getElementById("cpError");
  div.textContent = msg;
  div.classList.remove("d-none");
}

document.getElementById("formCompletar").addEventListener("submit", async (e) => {
  e.preventDefault();

  const nombre = document.getElementById("cpNombre").value.trim();
  const username = normalizarUsername(document.getElementById("cpUsername").value);
  const fecha_nacimiento = document.getElementById("cpFechaNacimiento").value;

  try {
    const existente = await db.collection("usernames").doc(username).get();
    if (existente.exists) {
      mostrarError("Ese nombre de usuario ya está en uso. Probá otro.");
      return;
    }

    await db.collection("usuarios").doc(usuarioActual.uid).set({
      nombre,
      username,
      email: usuarioActual.email,
      fecha_nacimiento,
      disclaimers_aceptados: false,
      creado: firebase.firestore.FieldValue.serverTimestamp()
    });

    await db.collection("usernames").doc(username).set({
      uid: usuarioActual.uid,
      email: usuarioActual.email
    });

    window.location.href = "/disclaimers";
  } catch (err) {
    mostrarError("Error al guardar: " + err.message);
  }
});

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "/";
    return;
  }
  usuarioActual = user;

  // Si ya tiene cuenta creada, no debería estar en esta página
  const snap = await db.collection("usuarios").doc(user.uid).get();
  if (snap.exists) {
    window.location.href = "/dashboard";
    return;
  }

  document.getElementById("cpNombre").value = user.displayName || "";
});
