// static/js/disclaimers.js
// Si el usuario YA aceptó los disclaimers antes, esta página se muestra en
// modo "solo lectura" (sin checkbox, con botón para volver al perfil).
// Si todavía no aceptó (primer ingreso), se muestra el checkbox + botón para
// aceptar, y al aceptar se guarda la fecha en Firestore y se redirige.

const checkAcepto = document.getElementById("checkAcepto");
const btnAceptar = document.getElementById("btnAceptar");
const zonaAceptar = document.getElementById("zonaAceptar");
const zonaVolver = document.getElementById("zonaVolver");
const aceptarError = document.getElementById("aceptarError");

let usuarioActual = null;

checkAcepto.addEventListener("change", () => {
  btnAceptar.disabled = !checkAcepto.checked;
});

btnAceptar.addEventListener("click", async () => {
  try {
    await db.collection("usuarios").doc(usuarioActual.uid).set(
      {
        disclaimers_aceptados: true,
        disclaimers_fecha: firebase.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    const snap = await db.collection("usuarios").doc(usuarioActual.uid).get();
    const data = snap.data();

    if (!data.perfil) {
      window.location.href = "/onboarding";
    } else {
      window.location.href = "/dashboard";
    }
  } catch (err) {
    aceptarError.textContent = "Error al guardar: " + err.message;
    aceptarError.classList.remove("d-none");
  }
});

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "/";
    return;
  }
  usuarioActual = user;

  const snap = await db.collection("usuarios").doc(user.uid).get();
  const data = snap.exists ? snap.data() : null;

  if (data && data.disclaimers_aceptados) {
    // Ya los aceptó antes: modo solo lectura (vista desde el perfil)
    zonaAceptar.classList.add("d-none");
    zonaVolver.classList.remove("d-none");
  }
});
