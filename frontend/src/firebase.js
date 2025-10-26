// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// Your web app's Firebase configuration
// For Firebase JS SDK v9-compat and v9-modular
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyARbjTKoJUPlrDicCXN0xohdPQ-tpKip5I",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "freshcart-2eb8e.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "freshcart-2eb8e",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "freshcart-2eb8e.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "439045841343",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:439045841343:web:1e8d8ac6f287c5a72bc10a",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-TF467PEE0V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Firestore database
export const db = getFirestore(app);

// Initialize Analytics (only in browser where supported and measurementId is available)
try {
  if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
    getAnalytics(app);
  }
} catch (e) {
  // Analytics may fail in non-browser environments or with invalid config; ignore safely
  console.warn('Firebase Analytics initialization failed:', e.message);
}

export default app;
