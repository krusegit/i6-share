import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStorage, kv, persist, store } from '../public/lib/store.js';

const open = (factory: IDBFactory, name: string, version: number, upgrade?: (db: IDBDatabase) => void): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = factory.open(name, version);
  request.onupgradeneeded = () => upgrade?.(request.result);
  request.onsuccess = () => { resolve(request.result); };
  request.onerror = () => { reject(new Error(request.error?.message)); };
});
afterEach(() => { vi.unstubAllGlobals(); });
describe('IndexedDB storage boundary', () => {
  it('persists arbitrary structured values and deletes records', async () => {
    const storage = createStorage({ factory: new IDBFactory(), name: 'round-trip' });
    await storage.close();
    const records = storage.store('queue');
    await records.put('one', { files: ['a'], sent: 0 });
    expect(await records.get('one')).toEqual({ files: ['a'], sent: 0 });
    expect(await records.all()).toEqual([{ files: ['a'], sent: 0 }]);
    await records.delete('one');
    expect(await records.get('one')).toBeUndefined();
    await storage.close();
    expect(await records.all()).toEqual([]);
    await storage.close();
  });
  it('upgrades the old schema, preserves known stores, and releases version locks', async () => {
    const factory = new IDBFactory();
    const previous = await open(factory, 'upgrade', 1, (db) => { db.createObjectStore('legacy'); db.createObjectStore('kv'); });
    previous.close();
    const storage = createStorage({ factory, name: 'upgrade' });
    await storage.store('kv').put('hello', 'world');
    const inspect = await open(factory, 'upgrade', 2);
    expect([...inspect.objectStoreNames]).toEqual(['devices', 'hubs', 'kv', 'queue']);
    inspect.close();
    const upgraded = await open(factory, 'upgrade', 3);
    upgraded.close();
    await expect(storage.store('kv').get('hello')).rejects.toBeDefined();
    await expect(storage.store('kv').get('hello')).rejects.toBeDefined();
    await storage.close();
  });
  it('reports blocked upgrades and continues after the old tab closes', async () => {
    const factory = new IDBFactory();
    const previous = await open(factory, 'blocked', 1);
    const blocked = vi.fn(() => { previous.close(); });
    const storage = createStorage({ factory, name: 'blocked', blocked });
    expect(await storage.store('kv').all()).toEqual([]);
    expect(blocked).toHaveBeenCalledOnce();
    await storage.close();
    const old = await open(factory, 'warn', 1);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => { old.close(); });
    const warning = createStorage({ factory, name: 'warn' });
    await warning.store('kv').all();
    expect(warn).toHaveBeenCalledWith('[i6] IndexedDB upgrade blocked by another tab');
    await warning.close();
  });
  it('rejects a transaction abort without reporting success', async () => {
    const factory = new IDBFactory();
    const opened = vi.spyOn(factory, 'open');
    const storage = createStorage({ factory });
    await storage.store('kv').put('key', 'value');
    const result = opened.mock.results[0];
    if (result?.type !== 'return') throw new Error('Database did not open');
    const db = result.value.result;
    const original = db.transaction.bind(db);
    vi.spyOn(db, 'transaction').mockImplementation((...args: Parameters<IDBDatabase['transaction']>) => {
      const transaction = original(...args);
      queueMicrotask(() => { transaction.abort(); });
      return transaction;
    });
    await expect(storage.store('kv').get('key')).rejects.toBeNull();
    await storage.close();
  });
  it('rejects transaction errors caused by failed writes', async () => {
    const factory = new IDBFactory();
    const opened = vi.spyOn(factory, 'open');
    const storage = createStorage({ factory });
    await storage.store('kv').put('key', 'value');
    const result = opened.mock.results[0];
    if (result?.type !== 'return') throw new Error('Database did not open');
    const db = result.value.result;
    const original = db.transaction.bind(db);
    vi.spyOn(db, 'transaction').mockImplementation((...args: Parameters<IDBDatabase['transaction']>) => {
      const transaction = original(...args);
      transaction.objectStore('kv').add('duplicate', 'key');
      return transaction;
    });
    await expect(storage.store('kv').put('other', 'value')).rejects.toBeDefined();
    await storage.close();
  });
  it('exposes lazy default stores and gracefully handles denied persistence', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    await kv.put('name', 'phone');
    expect(await store('kv').get('name')).toBe('phone');
    vi.stubGlobal('navigator', { storage: { persist: () => Promise.resolve(true) } });
    expect(await persist()).toBe(true);
    vi.stubGlobal('navigator', { storage: { persist: () => Promise.reject(new Error('denied')) } });
    expect(await persist()).toBe(false);
    vi.stubGlobal('navigator', {});
    expect(await persist()).toBe(false);
  });
});
