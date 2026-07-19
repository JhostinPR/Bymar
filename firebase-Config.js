// ===============================
// CONFIGURACIÓN DE FIREBASE
// ===============================
// Estos datos los sacaste de la consola de Firebase
// (Configuración del proyecto > tus apps > SDK de Firebase).
// No pasa nada si quedan visibles en el código: la apiKey de una
// app web de Firebase no es secreta, la seguridad real se controla
// con las "Reglas" de Firestore (ver nota abajo).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAGCBZbt4pF8PneB4qhNn8wj71K19huGhw",
    authDomain: "bymar-b5ef0.firebaseapp.com",
    projectId: "bymar-b5ef0",
    storageBucket: "bymar-b5ef0.firebasestorage.app",
    messagingSenderId: "1095958697176",
    appId: "1:1095958697176:web:8b29602598df40a389f3ad"
};

const app = initializeApp(firebaseConfig);

// db se usa en script.js para leer y guardar los productos
export const db = getFirestore(app);