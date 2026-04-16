/* ============================================================
   FIREBASE INITIALIZATION
   Replace firebaseConfig values with your project credentials.
   ============================================================ */

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

// ─── Firebase Config ──────────────────────────────────────────
// TODO: Replace with your actual Firebase project config from:
// https://console.firebase.google.com/ → Project Settings → Your Apps
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

// ─── Initialize Firebase ───────────────────────────────────────
const app = initializeApp(firebaseConfig);

// ─── Services ─────────────────────────────────────────────────
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Only initialize analytics in browser environments
let analytics = null;
if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
  analytics = getAnalytics(app);
}
export { analytics };

// ─── Emulator support (dev only) ──────────────────────────────
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099');
  console.info('[Firebase] Using emulator suite');
}

export default app;
