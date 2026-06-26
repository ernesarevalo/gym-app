// static/js/firebase-config.js
// -----------------------------------------------------------------
// PEGA AQUÍ las credenciales que te da la consola de Firebase
// (Configuración del proyecto > Tus apps > SDK de Firebase).
// Ver instrucciones en el README para obtener estos valores.
// -----------------------------------------------------------------

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

// Inicializa Firebase (usando los SDKs cargados vía <script> en el HTML)
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
