import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Everything here is lazy. Importing this module must not touch credentials,
// because in mock mode there may be no .env file at all.
let app = null;
let authInstance = null;
let dbInstance = null;
let providerInstance = null;

const getFirebaseApp = () => {
  if (!app) {
    app = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    });
  }
  return app;
};

export const getAuthInstance = () => {
  if (!authInstance) authInstance = getAuth(getFirebaseApp());
  return authInstance;
};

export const getDb = () => {
  if (!dbInstance) dbInstance = getFirestore(getFirebaseApp());
  return dbInstance;
};

export const getProvider = () => {
  if (!providerInstance) providerInstance = new GoogleAuthProvider();
  return providerInstance;
};
