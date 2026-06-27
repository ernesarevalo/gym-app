// static/js/auth.js
// Login con correo+contraseña O nombre de usuario+contraseña, registro con
// nombre/usuario/correo, y login con Google. Tras autenticar, decide a dónde
// redirigir según el estado del usuario: disclaimers -> onboarding -> dashboard.

const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const formLogin = document.getElementById("formLogin");
const formRegister = document.getElementById("formRegister");
const btnGoogle = document.getElementById("btnGoogle");
const authError = document.getElementById("authError");
const authInfo = document.getElementById("authInfo");

tabLogin.addEventListener("click", () => {
  tabLogin.classList.replace("btn-outline-light", "btn-primary");
  tabRegister.classList.replace("btn-primary", "btn-outline-light");
  formLogin.classList.remove("d-none");
  formRegister.classList.add("d-none");
});

tabRegister.addEventListener("click", () => {
  tabRegister.classList.replace("btn-outline-light", "btn-primary");
  tabLogin.classList.replace("btn-primary", "btn-outline-light");
  formRegister.classList.remove("d-none");
  formLogin.classList.add("d-none");
});

function mostrarError(msg) {
  authError.textContent = msg;
  authError.classList.remove("d-none");
  authInfo.classList.add("d-none");
}

function mostrarInfo(msg) {
  authInfo.textContent = msg;
  authInfo.classList.remove("d-none");
  authError.classList.add("d-none");
}

// ---------- REDIRECCIÓN SEGÚN ESTADO ----------
async function redirigirSegunEstado(uid) {
  const snap = await db.collection("usuarios").doc(uid).get();
  const data = snap.exists ? snap.data() : null;

  if (!data || !data.disclaimers_aceptados) {
    window.location.href = "/disclaimers";
  } else if (!data.perfil) {
    window.location.href = "/onboarding";
  } else {
    window.location.href = "/dashboard";
  }
}

// ---------- HELPERS DE USERNAME ----------
function normalizarUsername(u) {
  return u.trim().toLowerCase();
}

async function usernameDisponible(username) {
  const doc = await db.collection("usernames").doc(username).get();
  return !doc.exists;
}

async function generarUsernameDesdeEmail(email) {
  let base = normalizarUsername(email.split("@")[0]).replace(/[^a-z0-9_.]/g, "");
  if (base.length < 3) base = "user" + base;
  let candidato = base;
  let intento = 0;
  while (!(await usernameDisponible(candidato))) {
    intento++;
    candidato = `${base}${Math.floor(Math.random() * 9000) + 100}`;
    if (intento > 8) break; // failsafe
  }
  return candidato;
}

// ---------- LOGIN ----------
formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  const identifier = document.getElementById("loginIdentifier").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    let email = identifier;

    if (!identifier.includes("@")) {
      // Es un nombre de usuario: buscamos su correo asociado
      const username = normalizarUsername(identifier);
      const doc = await db.collection("usernames").doc(username).get();
      if (!doc.exists) {
        mostrarError("No encontramos ese nombre de usuario.");
        return;
      }
      email = doc.data().email;
    }

    const cred = await auth.signInWithEmailAndPassword(email, password);
    await redirigirSegunEstado(cred.user.uid);
  } catch (err) {
    mostrarError("Error al iniciar sesión: " + err.message);
  }
});

// ---------- REGISTRO ----------
formRegister.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nombre = document.getElementById("regNombre").value.trim();
  const usernameRaw = document.getElementById("regUsername").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const username = normalizarUsername(usernameRaw);

  try {
    if (!(await usernameDisponible(username))) {
      mostrarError("Ese nombre de usuario ya está en uso. Probá otro.");
      return;
    }

    const cred = await auth.createUserWithEmailAndPassword(email, password);

    await db.collection("usuarios").doc(cred.user.uid).set({
      nombre,
      username,
      email: cred.user.email,
      disclaimers_aceptados: false,
      creado: firebase.firestore.FieldValue.serverTimestamp()
    });

    await db.collection("usernames").doc(username).set({
      uid: cred.user.uid,
      email: cred.user.email
    });

    window.location.href = "/disclaimers";
  } catch (err) {
    mostrarError("Error al registrarte: " + err.message);
  }
});

// ---------- LOGIN CON GOOGLE ----------
btnGoogle.addEventListener("click", async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const cred = await auth.signInWithPopup(provider);
    const docRef = db.collection("usuarios").doc(cred.user.uid);
    const snap = await docRef.get();

    if (!snap.exists) {
      const username = await generarUsernameDesdeEmail(cred.user.email);
      await docRef.set({
        nombre: cred.user.displayName || "",
        username,
        email: cred.user.email,
        disclaimers_aceptados: false,
        creado: firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection("usernames").doc(username).set({
        uid: cred.user.uid,
        email: cred.user.email
      });
    }

    await redirigirSegunEstado(cred.user.uid);
  } catch (err) {
    mostrarError("Error con Google: " + err.message);
  }
});

// Si el usuario ya tiene sesión activa al cargar esta página, redirige.
auth.onAuthStateChanged((user) => {
  if (user) {
    redirigirSegunEstado(user.uid);
  }
});
