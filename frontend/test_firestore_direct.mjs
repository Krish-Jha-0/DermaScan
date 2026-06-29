import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { readFileSync } from 'fs';

// Load env variables manually from .env.local
const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    env[key] = val;
  }
});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

console.log("Initializing Firebase with project:", firebaseConfig.projectId);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  try {
    console.log("Attempting to fetch 'users' collection...");
    const snap = await getDocs(collection(db, "users"));
    console.log(`\n[RESULT] Success! Found ${snap.size} documents in 'users' collection.`);
    snap.forEach(doc => {
      console.log(`- User ID: ${doc.id}, Role: ${doc.data().role}, Email: ${doc.data().email}, Name: ${doc.data().name || doc.data().username}`);
    });
  } catch (err) {
    console.error("\n[RESULT] Error fetching 'users' collection:", err);
  }
}

test();
