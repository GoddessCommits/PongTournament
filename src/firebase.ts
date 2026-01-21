import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
    projectId: "pong-tournament-godin-8be68",
    appId: "1:511779064270:web:f89654bbddc1efcc5e039f",
    databaseURL: "https://pong-tournament-godin-8be68-default-rtdb.europe-west1.firebasedatabase.app",
    storageBucket: "pong-tournament-godin-8be68.firebasestorage.app",
    apiKey: "AIzaSyCX1CKzBPxhDxw0MEtQ32ajR3V5dmcwd88",
    authDomain: "pong-tournament-godin-8be68.firebaseapp.com",
    messagingSenderId: "511779064270",
    measurementId: "G-WN5LN48QPT"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
