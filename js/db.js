/** Capa de persistencia: Firestore (datos) + Firebase Storage (fotos) */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { firestore, storage } from "./firebase.js";
import { getCurrentUser } from "./auth.js";

const CATALOG_STORES = new Set([
  "catalog_plantas",
  "catalog_plagas",
  "catalog_enfermedades",
  "catalog_estados",
]);

const CATALOG_PATHS = {
  catalog_plantas: ["catalogs", "plantas", "items"],
  catalog_plagas: ["catalogs", "plagas", "items"],
  catalog_enfermedades: ["catalogs", "enfermedades", "items"],
  catalog_estados: ["catalogs", "estados", "items"],
};

const USER_STORES = new Set(["plants", "diary", "containers", "treatments", "photos"]);

function requireUser() {
  const user = getCurrentUser();
  if (!user) throw new Error("Debes iniciar sesión para acceder a los datos.");
  return user;
}

function collectionRef(storeName) {
  if (CATALOG_STORES.has(storeName)) {
    return collection(firestore, ...CATALOG_PATHS[storeName]);
  }
  if (USER_STORES.has(storeName)) {
    const user = requireUser();
    return collection(firestore, "users", user.uid, storeName);
  }
  if (storeName === "meta") {
    return collection(firestore, "meta");
  }
  throw new Error(`Store desconocido: ${storeName}`);
}

function docRef(storeName, id) {
  return doc(collectionRef(storeName), id);
}

function normalizePhoto(photo) {
  if (!photo) return photo;
  return {
    ...photo,
    dataUrl: photo.dataUrl || photo.downloadUrl || "",
  };
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);/)?.[1] || "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function storageUploadError(err) {
  const code = err?.code || "";
  if (code === "storage/unauthorized") {
    return "Sin permiso para subir fotos. Revisa storage.rules en Firebase.";
  }
  if (code === "storage/unauthenticated") {
    return "Sesión caducada. Vuelve a iniciar sesión.";
  }
  const msg = String(err?.message || err);
  if (/cors|network|failed|fetch|retry-limit/i.test(msg) || code === "storage/unknown" || code === "storage/retry-limit-exceeded") {
    return "No se pudo subir la foto: falta configurar CORS en el bucket de Storage (ver storage.cors.json y CONTEXT.md).";
  }
  return `Error al subir la foto: ${msg}`;
}

async function uploadPhotoData(item) {
  const user = requireUser();
  const path = `users/${user.uid}/photos/${item.id}`;
  const ref = storageRef(storage, path);
  try {
    const blob = dataUrlToBlob(item.dataUrl);
    await uploadBytes(ref, blob, { contentType: item.mimeType || blob.type || "image/jpeg" });
    const downloadUrl = await getDownloadURL(ref);
    const { dataUrl, ...meta } = item;
    return { ...meta, storagePath: path, downloadUrl };
  } catch (err) {
    throw new Error(storageUploadError(err));
  }
}

async function deleteStorageFile(storagePath) {
  if (!storagePath) return;
  try {
    await deleteObject(storageRef(storage, storagePath));
  } catch (err) {
    console.warn("No se pudo borrar la imagen en Storage:", err);
  }
}

export async function getAll(storeName) {
  const snap = await getDocs(collectionRef(storeName));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (storeName === "photos") return items.map(normalizePhoto);
  return items;
}

export async function getById(storeName, id) {
  const snap = await getDoc(docRef(storeName, id));
  if (!snap.exists()) return null;
  const item = { id: snap.id, ...snap.data() };
  if (storeName === "photos") return normalizePhoto(item);
  return item;
}

export async function put(storeName, item) {
  if (!item?.id) throw new Error("El elemento debe tener id.");

  let toSave = { ...item };

  if (storeName === "photos" && item.dataUrl && !item.storagePath) {
    toSave = await uploadPhotoData(item);
  } else if (storeName === "photos") {
    const { dataUrl, ...meta } = toSave;
    toSave = meta;
  }

  const { id, ...data } = toSave;
  await setDoc(docRef(storeName, id), data, { merge: true });
}

export async function putMany(storeName, items) {
  if (storeName === "photos") {
    for (const item of items) await put(storeName, item);
    return;
  }

  const BATCH_SIZE = 400;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = writeBatch(firestore);
    const chunk = items.slice(i, i + BATCH_SIZE);
    for (const item of chunk) {
      if (!item?.id) continue;
      const { id, ...data } = item;
      batch.set(docRef(storeName, id), data);
    }
    await batch.commit();
  }
}

export async function remove(storeName, id) {
  if (storeName === "photos") {
    const photo = await getById(storeName, id);
    await deleteStorageFile(photo?.storagePath);
  }
  await deleteDoc(docRef(storeName, id));
}

export async function clearStore(storeName) {
  const items = await getAll(storeName);
  if (storeName === "photos") {
    for (const item of items) await deleteStorageFile(item.storagePath);
  }

  const BATCH_SIZE = 400;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = writeBatch(firestore);
    const chunk = items.slice(i, i + BATCH_SIZE);
    for (const item of chunk) {
      batch.delete(docRef(storeName, item.id));
    }
    await batch.commit();
  }
}

export async function getMeta(key) {
  const snap = await getDoc(doc(firestore, "meta", key));
  if (!snap.exists()) return null;
  return snap.data().value ?? null;
}

export async function setMeta(key, value) {
  await setDoc(doc(firestore, "meta", key), { value }, { merge: true });
}

export async function getPhotosByOwner(ownerType, ownerId) {
  const user = requireUser();
  const q = query(
    collection(firestore, "users", user.uid, "photos"),
    where("ownerType", "==", ownerType),
    where("ownerId", "==", ownerId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => normalizePhoto({ id: d.id, ...d.data() }));
}

export async function deletePhotosByOwner(ownerType, ownerId) {
  const photos = await getPhotosByOwner(ownerType, ownerId);
  for (const p of photos) await remove("photos", p.id);
}

export async function countStore(storeName) {
  const items = await getAll(storeName);
  return items.length;
}
