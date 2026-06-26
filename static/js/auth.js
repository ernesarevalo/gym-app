// static/js/auth.js
// Maneja registro, login con email/password y login con Google.
// Tras autenticar, revisa en Firestore si el usuario ya tiene perfil:
//  - Si NO tiene perfil -> redirige a /onboarding
//  - Si SÍ tiene perfil -> redirige a /dashboard

const formAuth = document.getElementById("formAuth");
const btnRegister = document.getElementById("btnRegister");
const btnGoogle = document.getElementById("btnGoogle");
const authError = document.getElementById("authError");

function mostrarError(msg) {
  authError.textContent = msg;
  authError.classList.remove("d-none");
}

async function redirigirSegunPerfil(uid) {
  const docRef = db.collection("usuarios").doc(uid);
  const snap = await docRef.get();
  if (snap.exists && snap.data().perfil) {
    window.location.href = "/dashboard";
  } else {
    window.location.href = "/onboarding";
  }
}

// LOGIN con email/password
formAuth.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    await redirigirSegunPerfil(cred.user.uid);
  } catch (err) {
    mostrarError("Error al iniciar sesión: " + err.message);
  }
});

// REGISTRO con email/password
btnRegister.addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!email || !password) {
    mostrarError("Completa correo y contraseña para registrarte.");
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    // Crea el documento base del usuario (sin perfil todavía)
    await db.collection("usuarios").doc(cred.user.uid).set({
      email: cred.user.email,
      creado: firebase.firestore.FieldValue.serverTimestamp()
    });
    window.location.href = "/onboarding";
  } catch (err) {
    mostrarError("Error al registrarte: " + err.message);
  }
});

// LOGIN con Google
btnGoogle.addEventListener("click", async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const cred = await auth.signInWithPopup(provider);
    const docRef = db.collection("usuarios").doc(cred.user.uid);
    const snap = await docRef.get();
    if (!snap.exists) {
      await docRef.set({
        email: cred.user.email,
        nombre: cred.user.displayName || "",
        creado: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    await redirigirSegunPerfil(cred.user.uid);
  } catch (err) {
    mostrarError("Error con Google: " + err.message);
  }
});

// Si el usuario ya tiene sesión activa al cargar esta página, redirige.
auth.onAuthStateChanged((user) => {
  if (user) {
    redirigirSegunPerfil(user.uid);
  }
});
