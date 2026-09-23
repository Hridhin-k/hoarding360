"use client";

import type { PendingIncident, PendingProof } from "@/lib/domain/field";

const DB_NAME = "h360-field";
/** Bump when store schema changes — upgrades recreate missing stores. */
const DB_VERSION = 2;
const PROOFS = "pending_proofs";
const INCIDENTS = "pending_incidents";

function ensureStores(db: IDBDatabase) {
  if (!db.objectStoreNames.contains(PROOFS)) {
    db.createObjectStore(PROOFS, { keyPath: "clientOfflineId" });
  }
  if (!db.objectStoreNames.contains(INCIDENTS)) {
    db.createObjectStore(INCIDENTS, { keyPath: "clientOfflineId" });
  }
}

function storesReady(db: IDBDatabase): boolean {
  return (
    db.objectStoreNames.contains(PROOFS) && db.objectStoreNames.contains(INCIDENTS)
  );
}

function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("IndexedDB delete failed"));
    req.onblocked = () => resolve();
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onupgradeneeded = () => {
      ensureStores(req.result);
    };
    req.onsuccess = () => {
      const db = req.result;
      if (!storesReady(db)) {
        db.close();
        void deleteDb()
          .then(() => openDb())
          .then(resolve, reject);
        return;
      }
      resolve(db);
    };
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | void> {
  const db = await openDb();
  try {
    return await new Promise<T | void>((resolve, reject) => {
      let settled = false;
      try {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const req = run(store);
        if (req) {
          req.onsuccess = () => {
            settled = true;
            resolve(req.result);
          };
          req.onerror = () => {
            settled = true;
            reject(req.error);
          };
        }
        tx.oncomplete = () => {
          if (!settled) resolve(undefined);
        };
        tx.onerror = () => {
          if (!settled) reject(tx.error);
        };
      } catch (e) {
        reject(e);
      }
    });
  } finally {
    db.close();
  }
}

function storeGetAll<T>(storeName: string): Promise<T[]> {
  return withStore<T[]>(storeName, "readonly", (store) => store.getAll()).then(
    (rows) => (rows as T[]) ?? [],
  );
}

function storePut(storeName: string, value: unknown): Promise<void> {
  return withStore(storeName, "readwrite", (store) => {
    store.put(value);
  }).then(() => undefined);
}

function storeDelete(storeName: string, key: string): Promise<void> {
  return withStore(storeName, "readwrite", (store) => {
    store.delete(key);
  }).then(() => undefined);
}

export async function enqueueProof(item: PendingProof): Promise<void> {
  await storePut(PROOFS, item);
}

export async function listPendingProofs(): Promise<PendingProof[]> {
  return storeGetAll<PendingProof>(PROOFS);
}

export async function removePendingProof(id: string): Promise<void> {
  await storeDelete(PROOFS, id);
}

export async function enqueueIncident(item: PendingIncident): Promise<void> {
  await storePut(INCIDENTS, item);
}

export async function listPendingIncidents(): Promise<PendingIncident[]> {
  return storeGetAll<PendingIncident>(INCIDENTS);
}

export async function removePendingIncident(id: string): Promise<void> {
  await storeDelete(INCIDENTS, id);
}

export async function pendingCount(): Promise<number> {
  try {
    const [p, i] = await Promise.all([listPendingProofs(), listPendingIncidents()]);
    return p.length + i.length;
  } catch {
    return 0;
  }
}

export function fileToBase64(file: Blob): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      const base64 = comma >= 0 ? result.slice(comma + 1) : result;
      resolve({ base64, mime: file.type || "image/jpeg" });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function base64ToBlob(base64: string, mime: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
