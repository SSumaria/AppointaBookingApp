
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";
import { getAuth, type Auth } from "firebase/auth";

// --- Start of Diagnostic Logging ---
console.log("--- Firebase Config: Raw Environment Variables (firebaseConfig.ts) ---");
console.log("process.env.NEXT_PUBLIC_FIREBASE_API_KEY:", process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
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
console.log(JSON.stringify(firebaseConfig, null, 2)); // Pretty print the config object
// --- End of Constructed firebaseConfig object ---

let app: FirebaseApp;

if (!firebaseConfig.apiKey) {
  console.error(
    "CRITICAL ERROR (firebaseConfig.ts): firebaseConfig.apiKey is missing or undefined. " +
    "This strongly suggests NEXT_PUBLIC_FIREBASE_API_KEY is not set correctly in your .env.local file, " +
    "the .env.local file is missing/in the wrong location, or the Next.js server was not restarted after setting it. " +
    "Firebase will NOT be initialized correctly."
  );
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
  }
} else {
  app = getApp();
  console.log("Firebase app already initialized. Getting existing app (firebaseConfig.ts).");
}

// Assign database and auth. These will throw errors if 'app' is not correctly initialized.
// @ts-ignore app might be uninitialized if API key was missing and init failed
const db: Database = getDatabase(app);
// @ts-ignore app might be uninitialized if API key was missing and init failed
const auth: Auth = getAuth(app);

export { app, db, auth, firebaseConfig };
