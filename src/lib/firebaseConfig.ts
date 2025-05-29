
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";
import { getAuth, type Auth } from "firebase/auth"; // Added

// --- Start of Diagnostic Logging ---
console.log("--- Firebase Config Environment Variables ---");
console.log("Attempting to use Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY):", process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
console.log("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
console.log("NEXT_PUBLIC_FIREBASE_PROJECT_ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
console.log("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:", process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
console.log("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:", process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID);
console.log("NEXT_PUBLIC_FIREBASE_APP_ID:", process.env.NEXT_PUBLIC_FIREBASE_APP_ID);
console.log("NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:", process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID);
console.log("Database URL is hardcoded in firebaseConfig as: https://bookerpro-e5c9f-default-rtdb.firebaseio.com/");
console.log("--- End of Firebase Config Environment Variables ---");

if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  console.error(
    "CRITICAL ERROR: NEXT_PUBLIC_FIREBASE_API_KEY is undefined. " +
    "Please ensure it is set in your .env.local file and that you have " +
    "restarted the Next.js development server."
  );
}
// --- End of Diagnostic Logging ---

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

let app: FirebaseApp;
if (!getApps().length) {
  try {
    if (!firebaseConfig.apiKey) {
      console.error("Firebase config is missing apiKey. Firebase will not be initialized correctly.");
      // You might choose to throw an error here or handle it differently
      // For now, we let initializeApp attempt and likely fail, which will be caught
    }
    app = initializeApp(firebaseConfig);
  } catch (error) {
    console.error("Firebase initialization error directly from initializeApp:", error);
    // Re-throw the error to prevent the application from continuing with a broken Firebase state.
    // This ensures that subsequent calls like getAuth() or getDatabase() don't mask the original init problem.
    throw new Error(`Firebase initialization failed: ${(error as Error).message}. Please check your Firebase config and .env.local file.`);
  }
} else {
  app = getApp();
}

const db: Database = getDatabase(app);
const auth: Auth = getAuth(app); // Added

export { app, db, auth, firebaseConfig }; // Added auth
