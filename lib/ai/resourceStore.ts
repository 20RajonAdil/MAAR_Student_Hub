"use client";

// ─────────────────────────────────────────────────────────────────────────
// Local resource library storage (IndexedDB).
//
// Uploaded files are read and their text extracted entirely in the
// browser (see pdfExtract.ts), then stored here — never uploaded to any
// server. This replaces the previous resources page, which only kept a
// filename in memory and never actually read the file.
//
// Two object stores:
//  - "resources": one record per uploaded file (metadata + status)
//  - "chunks":    the extracted text, split into retrieval-sized chunks,
//                 each tagged with its resourceId
// ─────────────────────────────────────────────────────────────────────────

export interface ResourceRecord {
  id: string;
  title: string;
  subjectId: string;
  uploadedAt: string;
  status: "processing" | "ready" | "no-readable-text" | "error";
  errorMessage?: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ResourceChunk {
  id: string; // `${resourceId}:${index}`
  resourceId: string;
  index: number;
  text: string;
}

const DB_NAME = "maar-study-hub-resources";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB isn't available in this browser."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("resources")) {
        db.createObjectStore("resources", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("chunks")) {
        const store = db.createObjectStore("chunks", { keyPath: "id" });
        store.createIndex("resourceId", "resourceId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open resource database."));
  });
}

function tx(db: IDBDatabase, stores: string[], mode: IDBTransactionMode) {
  return db.transaction(stores, mode);
}

export async function addResource(meta: Omit<ResourceRecord, "id" | "uploadedAt" | "status"> & { id?: string }): Promise<ResourceRecord> {
  const db = await openDB();
  const record: ResourceRecord = {
    id: meta.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: meta.title,
    subjectId: meta.subjectId,
    uploadedAt: new Date().toISOString(),
    status: "processing",
    mimeType: meta.mimeType,
    sizeBytes: meta.sizeBytes,
  };
  await new Promise<void>((resolve, reject) => {
    const t = tx(db, ["resources"], "readwrite");
    t.objectStore("resources").put(record);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  return record;
}

export async function updateResource(id: string, patch: Partial<ResourceRecord>): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = tx(db, ["resources"], "readwrite");
    const store = t.objectStore("resources");
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing: ResourceRecord | undefined = getReq.result;
      if (existing) store.put({ ...existing, ...patch });
    };
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// Splits extracted text into ~800-character chunks on paragraph/sentence
// boundaries where possible, so retrieval can supply a few focused
// passages to the model rather than an entire document.
function chunkText(text: string, maxChars = 800): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if ((current + "\n\n" + p).length > maxChars && current) {
      chunks.push(current.trim());
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
    while (current.length > maxChars) {
      chunks.push(current.slice(0, maxChars).trim());
      current = current.slice(maxChars);
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export async function saveExtractedText(resourceId: string, text: string): Promise<void> {
  const db = await openDB();
  const chunks = chunkText(text);
  await new Promise<void>((resolve, reject) => {
    const t = tx(db, ["chunks"], "readwrite");
    const store = t.objectStore("chunks");
    chunks.forEach((c, i) => {
      const chunk: ResourceChunk = { id: `${resourceId}:${i}`, resourceId, index: i, text: c };
      store.put(chunk);
    });
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  await updateResource(resourceId, { status: chunks.length ? "ready" : "no-readable-text" });
}

export async function listResources(): Promise<ResourceRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = tx(db, ["resources"], "readonly");
    const req = t.objectStore("resources").getAll();
    req.onsuccess = () => resolve((req.result as ResourceRecord[]).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)));
    req.onerror = () => reject(req.error);
  });
}

export async function deleteResource(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = tx(db, ["resources", "chunks"], "readwrite");
    t.objectStore("resources").delete(id);
    const chunkStore = t.objectStore("chunks");
    const idx = chunkStore.index("resourceId");
    const cursorReq = idx.openCursor(IDBKeyRange.only(id));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function getAllChunksWithTitles(): Promise<{ resourceId: string; title: string; subjectId: string; text: string }[]> {
  const db = await openDB();
  const resources = await listResources();
  const byId = new Map(resources.map((r) => [r.id, r]));
  return new Promise((resolve, reject) => {
    const t = tx(db, ["chunks"], "readonly");
    const req = t.objectStore("chunks").getAll();
    req.onsuccess = () => {
      const chunks = req.result as ResourceChunk[];
      resolve(
        chunks
          .map((c) => {
            const r = byId.get(c.resourceId);
            return r ? { resourceId: c.resourceId, title: r.title, subjectId: r.subjectId, text: c.text } : null;
          })
          .filter((x): x is { resourceId: string; title: string; subjectId: string; text: string } => x !== null)
      );
    };
    req.onerror = () => reject(req.error);
  });
}
