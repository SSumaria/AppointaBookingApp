
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";
import { getAuth, type Auth } from "firebase/auth";

// --- Start of Diagnostic Logging ---
console.log("--- Firebase Config START (firebaseConfig.ts) ---");

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appIdEnv = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
const databaseURL = "https://bookerpro-e5c9f-default-rtdb.firebaseio.com/";

console.log("RAW NEXT_PUBLIC_FIREBASE_API_KEY (firebaseConfig.ts):", process.env.NEXT_PUBLIC_FIREBASE_API_KEY); // Log raw value
console.log("Processed apiKey variable (firebaseConfig.ts):", apiKey ? "EXISTS" : "MISSING_OR_EMPTY");

const firebaseConfig = {
  apiKey: apiKey,
  authDomain: authDomain,
  projectId: projectId,
  storageBucket: storageBucket,
  messagingSenderId: messagingSenderId,
  appId: appIdEnv,
  measurementId: measurementId,
  databaseURL: databaseURL,
};

console.log("Constructed firebaseConfig object (firebaseConfig.ts):", JSON.stringify(firebaseConfig, (key, value) => key === 'apiKey' && value ? 'EXISTS (Hidden)' : value, 2));

if (!firebaseConfig.apiKey) {
  const errorMessage = "CRITICAL FIREBASE CONFIG ERROR (firebaseConfig.ts): NEXT_PUBLIC_FIREBASE_API_KEY is missing, undefined, or empty. Firebase cannot initialize. Application will not function. Please check your .env.local file and ensure the Next.js development server was restarted after any changes.";
  console.error(errorMessage);
  // For public pages like /book/[userId], if the API key is missing, we MUST stop execution.
  // Throwing an error here should halt the script and prevent redirects.
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/book/')) {
    throw new Error(errorMessage);
  }
  // For other pages, the app might attempt to continue, but auth/db will inevitably fail.
}

let app: FirebaseApp;
let db: Database;
let authInstance: Auth;

try {
  if (!getApps().length) {
    console.log("Attempting to initialize Firebase app (firebaseConfig.ts)...");
    app = initializeApp(firebaseConfig);
    console.log("Firebase app INITIALIZED successfully (firebaseConfig.ts).");
  } else {
    app = getApp();
    console.log("Firebase app ALREADY INITIALIZED. Getting existing app (firebaseConfig.ts).");
  }

  console.log("Attempting to get Database and Auth services (firebaseConfig.ts)...");
  db = getDatabase(app);
  authInstance = getAuth(app);
  console.log("Firebase Database and Auth services OBTAINED successfully (firebaseConfig.ts).");

} catch (error: any) {
  console.error("FATAL ERROR during Firebase initialization or service retrieval (firebaseConfig.ts):", error.message, error.stack);
  // If initialization fails, it's critical, especially for public pages.
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/book/')) {
    throw new Error(`Firebase initialization failed: ${error.message}. The public booking page cannot operate. Check API key and other Firebase config values.`);
  }
  // Assign undefined to app, db, authInstance if they fail to initialize to prevent further errors if code attempts to use them
  // This helps in gracefully degrading or showing errors in other parts of the app.
  // @ts-ignore
  app = undefined;
  // @ts-ignore
  db = undefined;
  // @ts-ignore
  authInstance = undefined;
}

console.log("--- Firebase Config END (firebaseConfig.ts) ---");

// Export the potentially undefined services. Consumer modules (like AuthContext) should handle this.
export { app, db, authInstance as auth, firebaseConfig };
