// Tiny IndexedDB wrapper shared by the phone PWA and the Linux hub IWA.
// Each app runs on its own origin, so they get separate databases.
//
// Object stores (all out-of-line keys, values are structured-cloned, so
// File/Blob and FileSystemHandle objects can be stored directly):
//   kv       - settings / identity           key: string
//   hubs     - phone: paired computers       key: hubId
//   devices  - hub: paired phones            key: deviceId
//   queue    - pending transfers (+ Files)  key: tid

const DB_NAME = 'i6-share';
const STORES = ['kv', 'hubs', 'devices', 'queue'];
let dbPromise;

function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      for (const name of [...req.result.objectStoreNames]) {
        if (!STORES.includes(name)) req.result.deleteObjectStore(name);
      }
      for (const name of STORES) {
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/** store('hubs').get(id) / .put(id, value) / .delete(id) / .all() */
export function store(name) {
  return {
    get: (key) => run(name, 'readonly', (s) => s.get(key)),
    put: (key, value) => run(name, 'readwrite', (s) => s.put(value, key)),
    delete: (key) => run(name, 'readwrite', (s) => s.delete(key)),
    all: () => run(name, 'readonly', (s) => s.getAll()),
  };
}

export const kv = store('kv');

/** Ask the browser not to evict our data (queued files, pairings). */
export function persist() {
  return navigator.storage?.persist?.().catch(() => false);
}
