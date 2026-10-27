import { Effect, Ref } from 'effect';
import { runEffect } from './runtime.js';

export type StoreName = 'kv' | 'hubs' | 'devices' | 'queue';
export interface Store {
  readonly get: (key: string) => Promise<unknown>;
  readonly put: (key: string, value: unknown) => Promise<void>;
  readonly delete: (key: string) => Promise<void>;
  readonly all: () => Promise<readonly unknown[]>;
}
export interface StorageOptions {
  readonly factory?: IDBFactory;
  readonly name?: string;
  readonly blocked?: () => void;
}
const STORES: readonly StoreName[] = ['kv', 'hubs', 'devices', 'queue'];

/** IndexedDB is the untrusted serialization boundary; consumers decode values. */
export const createStorage = (options: StorageOptions = {}): {
  readonly store: (name: StoreName) => Store;
  readonly close: () => Promise<void>;
} => {
  const cached = Ref.makeUnsafe<Promise<IDBDatabase> | undefined>(undefined);
  const reset = (): void => { Effect.runSync(Ref.set(cached, undefined)); };
  const database = (): Promise<IDBDatabase> => {
    const existing = Effect.runSync(Ref.get(cached));
    if (existing !== undefined) return existing;
    const pending = runEffect(Effect.callback<IDBDatabase, DOMException | null>((resume) => {
      const request = (options.factory ?? globalThis.indexedDB).open(options.name ?? 'i6-share', 2);
      request.onupgradeneeded = (): void => {
        const db = request.result;
        Array.from(db.objectStoreNames).filter((name) => !STORES.some((storeName) => storeName === name))
          .forEach((name) => { db.deleteObjectStore(name); });
        STORES.filter((name) => !db.objectStoreNames.contains(name)).forEach((name) => db.createObjectStore(name));
      };
      request.onsuccess = (): void => {
        const db = request.result;
        db.onversionchange = (): void => { db.close(); reset(); };
        resume(Effect.succeed(db));
      };
      request.onerror = (): void => { reset(); resume(Effect.fail(request.error)); };
      request.onblocked = (): void => {
        if (options.blocked !== undefined) options.blocked();
        else console.warn('[i6] IndexedDB upgrade blocked by another tab');
      };
    }));
    Effect.runSync(Ref.set(cached, pending));
    return pending;
  };
  const transaction = <A>(name: StoreName, mode: IDBTransactionMode, request: (store: IDBObjectStore) => IDBRequest<A>): Promise<A> =>
    runEffect(Effect.flatMap(Effect.tryPromise(database), (db) => Effect.callback<A, DOMException | null>((resume) => {
      const tx = db.transaction(name, mode);
      const result = request(tx.objectStore(name));
      tx.oncomplete = (): void => { resume(Effect.succeed(result.result)); };
      tx.onerror = (): void => { resume(Effect.fail(tx.error)); };
      tx.onabort = (): void => { resume(Effect.fail(tx.error)); };
    })));
  const store = (name: StoreName): Store => ({
    get: (key) => transaction<unknown>(name, 'readonly', (objectStore) => objectStore.get(key)),
    put: (key, value) => transaction(name, 'readwrite', (objectStore) => objectStore.put(value, key)).then(() => undefined),
    delete: (key) => transaction(name, 'readwrite', (objectStore) => objectStore.delete(key)),
    all: () => transaction<unknown[]>(name, 'readonly', (objectStore) => objectStore.getAll()),
  });
  return {
    store,
    close: async (): Promise<void> => {
      const pending = Effect.runSync(Ref.get(cached));
      reset();
      if (pending !== undefined) (await pending).close();
    },
  };
};
const storage = createStorage();
export const store = storage.store;
export const kv = store('kv');

/** Browsers may decline persistence; that is an ordinary negative result. */
export const persist = (): Promise<boolean> => runEffect(
  Effect.tryPromise(async () => {
    const storageManager = globalThis.navigator.storage;
    return storageManager.persist();
  }).pipe(Effect.catch(() => Effect.succeed(false))),
);
