import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, orderBy, limit, getDocs, getDoc, setDoc,
  serverTimestamp, Timestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBaVe16ISpOu_JduU1h6ZcZw2xdiwdc8J0",
  authDomain: "micelula-cfcpn.firebaseapp.com",
  projectId: "micelula-cfcpn",
  storageBucket: "micelula-cfcpn.firebasestorage.app",
  messagingSenderId: "783090082008",
  appId: "1:783090082008:web:634a7d24e02f6db6b477ad"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, orderBy, getDocs, getDoc, setDoc,
  serverTimestamp, Timestamp, onSnapshot, limit,
  ref, uploadBytes, getDownloadURL
};
