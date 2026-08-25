// ─────────────────────────────────────────────────────────────────────────
// Local file storage for uploaded documents (Resources, Past Papers).
//
// Why IndexedDB and not the zustand/localStorage store: localStorage has a
// ~5-10MB total quota and can only hold strings, so a handful of real PDFs
// would blow the budget and corrupt every other piece of app data sharing
// that quota. IndexedDB has no such practical ceiling for a study app and
// stores Blobs natively — so the actual file bytes live here, keyed by id,
// while lightweight metadata (title, subject, size, uploadedAt) lives in
// the regular store so the rest of the app can list/search it instantly
// without touching IndexedDB.
//
// This keeps every upload control genuinely working — real persistence,
// real download, real reopening after a refresh — rather than a File
// object that's silently thrown away.
// ─────────────────────────────────────────────────────────────────────────

const DB_NAME = "maar-study-hub-files";
const DB_VERSION = 1;
const STORE_NAME = "files";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB isn't available in this browser."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open file storage."));
  });
}

export async function saveFileBlob(id: string, file: File): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to save file."));
  });
}

export async function getFileBlob(id: string): Promise<Blob | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error ?? new Error("Failed to read file."));
  });
}

export async function deleteFileBlob(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to delete file."));
  });
}

/** Opens/downloads a stored file by creating a temporary object URL. */
export async function openStoredFile(id: string, filename: string, mode: "view" | "download") {
  const blob = await getFileBlob(id);
  if (!blob) throw new Error("This file couldn't be found in local storage — it may have been cleared by the browser.");
  const url = URL.createObjectURL(blob);
  if (mode === "download") {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  // Revoke shortly after — long enough for the browser to have opened/
  // started downloading it.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
