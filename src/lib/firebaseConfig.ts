
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";
import { getAuth, type Auth, setPersistence, browserLocalPersistence } from "firebase/auth";

// --- Start of Diagnostic Logging ---
console.log("--- Firebase Config START (firebaseConfig.ts) --- MODULE EXECUTING ---");

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appIdEnv = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
const databaseURL = "https://servicebooker-pro-default-rtdb.europe-west1.firebasedatabase.app/"; // Ensure this is correct

console.log("RAW NEXT_PUBLIC_FIREBASE_API_KEY (firebaseConfig.ts):", process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
console.log("Processed apiKey variable (firebaseConfig.ts):", apiKey ? "EXISTS" : "MISSING_OR_EMPTY");
console.log("typeof window (firebaseConfig.ts):", typeof window);
if (typeof window !== 'undefined') {
  console.log("window.location.pathname (firebaseConfig.ts):", window.location.pathname);
}


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
  
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/book/')) {
    throw new Error(errorMessage + " (This error is thrown for /book/ routes specifically)");
  }
}

let app: FirebaseApp;
let db: Database;
let authInstance: Auth;

try {
  if (!getApps().length) {
    console.log("Attempting to initialize Firebase app (firebaseConfig.ts)...");
    app = initializeApp(firebaseConfig);
    console.log("Firebase app INITIALIZED successfully (firebaseConfig.ts). App Name:", app.name);
  } else {
    app = getApp();
    console.log("Firebase app ALREADY INITIALIZED. Getting existing app (firebaseConfig.ts). App Name:", app.name);
  }

  console.log("Attempting to get Database and Auth services (firebaseConfig.ts)...");
  authInstance = getAuth(app);
  
  // This is the key change: explicitly link auth operations to your custom domain.
  if (authDomain === 'appointa.pro') {
    authInstance.tenantId = projectId as string;
    console.log(`Firebase Auth tenantId explicitly set to '${projectId}' for custom domain '${authDomain}'.`);
  }
  
  // Set persistence to local to maintain login state across browser sessions.
  setPersistence(authInstance, browserLocalPersistence);

  db = getDatabase(app);
  console.log("Firebase Database and Auth services OBTAINED successfully (firebaseConfig.ts).");

} catch (error: any) {
  console.error("FATAL ERROR during Firebase initialization or service retrieval (firebaseConfig.ts):", error.message, error.stack);
  const initErrorMessage = `Firebase initialization failed: ${error.message}. The public booking page cannot operate. Check API key and other Firebase config values.`;
  
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/book/')) {
    throw new Error(initErrorMessage + " (This error is thrown for /book/ routes specifically after init attempt)");
  }
  // @ts-ignore
  app = undefined;
  // @ts-ignore
  db = undefined;
  // @ts-ignore
  authInstance = undefined;
}

console.log("--- Firebase Config END (firebaseConfig.ts) --- Exporting app, db, authInstance:", { appExists: !!app, dbExists: !!db, authInstanceExists: !!authInstance });

export { app, db, authInstance as auth, firebaseConfig };
