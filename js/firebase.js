import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBLdRap8aILz2IFRzvJ2yq6yeVhNgdWyiI",
  authDomain: "lozargarden.firebaseapp.com",
  projectId: "lozargarden",
  storageBucket: "lozargarden.firebasestorage.app",
  messagingSenderId: "402808854253",
  appId: "1:402808854253:web:fc17afcbe29019640a1ee4",
  measurementId: "G-SB01DEBM60",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const storage = getStorage(app);
