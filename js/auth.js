import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import { auth } from "./firebase.js";

let currentUser = null;

export function getCurrentUser() {
  return currentUser;
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, (user) => {
    currentUser = user;
    callback(user);
  });
}

export async function register(email, password, displayName) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName?.trim()) {
    await updateProfile(credential.user, { displayName: displayName.trim() });
  }
  return credential.user;
}

export async function login(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function logout() {
  await signOut(auth);
}

export function authErrorMessage(code, rawMessage = "") {
  const messages = {
    "auth/email-already-in-use": "Este correo ya está registrado.",
    "auth/invalid-email": "Correo electrónico no válido.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/user-not-found": "Usuario no encontrado.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Prueba más tarde.",
    "auth/operation-not-allowed": "El inicio de sesión por correo/contraseña no está activado en Firebase. Actívalo en Authentication → Sign-in method.",
    "auth/configuration-not-found": "Firebase Authentication no está configurado. Entra en la consola de Firebase, abre Authentication y pulsa «Comenzar».",
  };

  if (messages[code]) return messages[code];
  if (rawMessage.includes("CONFIGURATION_NOT_FOUND")) {
    return messages["auth/configuration-not-found"];
  }
  return "Error de autenticación. Inténtalo de nuevo.";
}
