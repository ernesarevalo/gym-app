// static/js/firebase-config.js
// -----------------------------------------------------------------
// PEGA AQUÍ las credenciales que te da la consola de Firebase
// (Configuración del proyecto > Tus apps > SDK de Firebase).
// Ver instrucciones en el README para obtener estos valores.
// -----------------------------------------------------------------

const firebaseConfig = {
  apiKey: "AIzaSyBW-p6OX_HOvplLvE7T74uc5XSlt0D332w",
  authDomain: "gym-app-73834.firebaseapp.com",
  projectId: "gym-app-73834",
  storageBucket: "gym-app-73834.firebasestorage.app",
  messagingSenderId: "941031909123",
  appId: "1:941031909123:web:b43faf33d53281f0fa2b36"
};

// Inicializa Firebase (usando los SDKs cargados vía <script> en el HTML)
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
