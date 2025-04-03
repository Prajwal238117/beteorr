// firebaseConfig.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCxAPjLcvdAA27vbfzv6McEhMOaK_9v7Uk",
  authDomain: "real-db83c.firebaseapp.com",
  projectId: "real-db83c",
  storageBucket: "real-db83c.firebasestorage.app",
  messagingSenderId: "756487873527",
  appId: "1:756487873527:web:50c6456f4d9a93564584f2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app, '(default)');

// Export the initialized services and config
export { auth, db, firebaseConfig };
