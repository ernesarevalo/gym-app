// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBW-p6OX_HOvplLvE7T74uc5XSlt0D332w",
  authDomain: "gym-app-73834.firebaseapp.com",
  projectId: "gym-app-73834",
  storageBucket: "gym-app-73834.firebasestorage.app",
  messagingSenderId: "941031909123",
  appId: "1:941031909123:web:b43faf33d53281f0fa2b36",
  measurementId: "G-47FFNXPX4Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);