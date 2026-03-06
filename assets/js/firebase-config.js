// assets/js/firebase-config.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyD7_18_n_BC1QIoAYBleWJPpefEKZTz8DY",
    authDomain: "oneq-ph.firebaseapp.com",
    projectId: "oneq-ph",
    storageBucket: "oneq-ph.firebasestorage.app",
    messagingSenderId: "511581658332",
    appId: "1:511581658332:web:23b3e673cc22c11fe36819",
    measurementId: "G-T030GWDV6C"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };