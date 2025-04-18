import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDocs, query, limit } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
let app: any;
let db: any;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (error: any) {
  console.error("Firebase initialization error:", error);
  // Handle the error appropriately, e.g., display an error message to the user
}

// Function to create a collection with an initial document if it doesn't exist
async function createCollectionIfNotExist(collectionName: string, initialData: any) {
  try {
    const collectionRef = collection(db, collectionName);
    const querySnapshot = await getDocs(query(collectionRef, limit(1)));

    if (querySnapshot.empty) {
      // Collection does not exist, create it with initial document
      const docRef = doc(collectionRef);
      await setDoc(docRef, initialData);
      console.log(`Collection "${collectionName}" created successfully.`);
    } else {
      console.log(`Collection "${collectionName}" already exists.`);
    }
  } catch (error) {
    console.error(`Error creating collection "${collectionName}":`, error);
  }
}

let databaseInitialized = false;

// Initialize Clients and Appointments collections
async function initializeDatabase() {
  if (!databaseInitialized) {
    try {
      await createCollectionIfNotExist("Clients", {
        ClientID: "InitialClientID",
        ClientName: "InitialClientName",
        ClientContact: "InitialClientContact",
      });
      await createCollectionIfNotExist("Appointments", {
        AppointmentID: "InitialAppointmentID",
        ClientID: "InitialClientID",
        ServiceProcedure: "InitialService",
        AppointmentDate: "2024-01-01",
        AppointmentTime: "00:00",
      });
      databaseInitialized = true;
    } catch (error) {
      console.error("Database initialization failed:", error);
    }
  }
}

initializeDatabase();

export { firebaseConfig };
