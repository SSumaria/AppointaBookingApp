
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";
import { getAuth, type Auth } from "firebase/auth";

// --- Start of Diagnostic Logging ---
console.log("--- Firebase Config: Raw Environment Variables (firebaseConfig.ts) ---");
console.log("process.env.NEXT_PUBLIC_FIREBASE_API_KEY:", process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "Exists" : "MISSING or Empty");
console.log("process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
console.log("process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
console.log("process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:", process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
console.log("process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:", process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID);
console.log("process.env.NEXT_PUBLIC_FIREBASE_APP_ID:", process.env.NEXT_PUBLIC_FIREBASE_APP_ID);
console.log("process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:", process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID);
console.log("--- End of Raw Environment Variables (firebaseConfig.ts) ---");

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  databaseURL: "https://bookerpro-e5c9f-default-rtdb.firebaseio.com/",
};

console.log("--- Firebase Config: Constructed firebaseConfig object (firebaseConfig.ts) ---");
console.log(JSON.stringify(firebaseConfig, (key, value) => key === 'apiKey' && value ? 'Exists (Hidden)' : value, 2));
// --- End of Constructed firebaseConfig object ---

let app: FirebaseApp;

if (!firebaseConfig.apiKey) {
  const errorMessage = "CRITICAL FIREBASE CONFIGURATION ERROR (firebaseConfig.ts): NEXT_PUBLIC_FIREBASE_API_KEY is missing, undefined, or empty. " +
    "The application cannot initialize Firebase and will not function correctly. " +
    "Please ensure this environment variable is set in your .env.local file (and that the Next.js server was restarted if changed).";
  console.error(errorMessage);
  // For a public page, throwing here will stop execution and show an error, which is better than a silent redirect.
  // For other pages, this might be too aggressive, but for debugging this redirect, it's useful.
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/book/')) {
    throw new Error(errorMessage);
  }
  // For non-public booking pages, we might just log the error and let AuthContext handle it.
  // However, the app is unlikely to work correctly anyway.
}

if (!getApps().length) {
  try {
    console.log("Attempting to initialize Firebase app (firebaseConfig.ts)...");
    app = initializeApp(firebaseConfig);
    console.log("Firebase app initialization attempt complete (firebaseConfig.ts).");
  } catch (error) {
    console.error("Firebase initialization error during initializeApp (firebaseConfig.ts):", error);
    // If initialization fails, app might be undefined or a broken instance.
    // Subsequent getDatabase or getAuth calls will likely fail.
    // We'll proceed to let those errors manifest to confirm.
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/book/')) {
        throw error; // Re-throw for the public booking page to make it obvious
    }
  }
} else {
  app = getApp();
  console.log("Firebase app already initialized. Getting existing app (firebaseConfig.ts).");
}

let db: Database;
let authInstance: Auth;

try {
  // @ts-ignore app might be uninitialized if API key was missing and init failed
  db = getDatabase(app);
  // @ts-ignore app might be uninitialized if API key was missing and init failed
  authInstance = getAuth(app);
} catch (error) {
    console.error("Error getting Database or Auth instance (firebaseConfig.ts):", error);
    // If we are on the public booking page and Firebase core services fail, throw to make it clear.
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/book/')) {
        throw new Error("Failed to initialize Firebase services (DB or Auth). App cannot continue. Check console for API key or init errors. " + (error as Error).message);
    }
    // For other parts of the app, this might be handled by AuthProvider loading state, but it's critical.
}


export { app, db, authInstance as auth, firebaseConfig };
