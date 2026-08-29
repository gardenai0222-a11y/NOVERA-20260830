// js/firebase-config.js
// Firebase SDK Version 10 or 9 (Modular syntax)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

// TODO: 將下方的 firebaseConfig 替換為您從 Firebase 控制台取得的專屬設定
const firebaseConfig = {
    apiKey: "AIzaSyAlbBBdy6mZdcHHxleueKyYCuKjvshcPFU",
    authDomain: "novera-e7162.firebaseapp.com",
    projectId: "novera-e7162",
    storageBucket: "novera-e7162.firebasestorage.app",
    messagingSenderId: "335167531566",
    appId: "1:335167531566:web:92eaf0df0be916ac4f4dbf",
    measurementId: "G-23T6YFGK13",
    databaseURL: "https://novera-e7162-default-rtdb.firebaseio.com"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
