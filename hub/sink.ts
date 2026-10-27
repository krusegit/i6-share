import { Effect, Ref } from 'effect';
import { downloadFile } from '../public/lib/dom.js';
import { runEffect } from '../public/lib/runtime.js';
import type { Store } from '../public/lib/store.js';

export interface WritableFile {
  readonly write: (bytes: Uint8Array) => Promise<void>;
  readonly close: () => Promise<void>;
  readonly abort: () => Promise<void>;
}
export interface FileHandle {
  readonly createWritable: (options: { readonly keepExistingData: false }) => Promise<WritableFile>;
  readonly getFile: () => Promise<File>;
}
export interface DirectoryHandle {
  readonly name: string;
  readonly queryPermission: (options: { readonly mode: 'readwrite' }) => Promise<PermissionState>;
  readonly requestPermission: (options: { readonly mode: 'readwrite' }) => Promise<PermissionState>;
  readonly getFileHandle: (name: string, options?: { readonly create: true }) => Promise<FileHandle>;
  readonly removeEntry: (name: string) => Promise<void>;
}
export interface DirectoryPickerOptions {
  readonly id: 'i6-share'; readonly mode: 'readwrite'; readonly startIn: 'downloads';
}
export type DirectoryPicker = (options: DirectoryPickerOptions) => Promise<DirectoryHandle>;
declare global { var showDirectoryPicker: DirectoryPicker | undefined; }
export type FolderState = 'none' | PermissionState;
export interface SinkHandle extends WritableFile {
  readonly name: string;
  readonly where: 'folder' | 'download';
}
export interface FolderSink {
  readonly dir: DirectoryHandle | null;
  readonly state: FolderState;
  readonly supported: boolean;
  readonly folderName: string | null;
  readonly usingFolder: boolean;
  readonly init: () => Promise<FolderSink>;
  readonly check: () => Promise<FolderState>;
  readonly pick: () => Promise<boolean>;
  readonly requestPermission: () => Promise<FolderState>;
  readonly useDownloads: () => Promise<void>;
  readonly exists: (name: string) => Promise<boolean>;
  readonly create: (name: string, options?: { readonly type?: string }) => Promise<SinkHandle>;
  readonly openFile: (name: string) => Promise<File>;
  readonly addEventListener: EventTarget['addEventListener'];
  readonly removeEventListener: EventTarget['removeEventListener'];
}
export interface FolderSinkOptions {
  readonly kv: Pick<Store, 'get' | 'put' | 'delete'>;
  readonly pickDirectory?: DirectoryPicker;
  readonly download?: (file: File, name: string) => void;
}
const isDirectory = (value: unknown): value is DirectoryHandle => typeof value === 'object' && value !== null &&
  'name' in value && typeof value.name === 'string' &&
  'queryPermission' in value && typeof value.queryPermission === 'function' &&
  'requestPermission' in value && typeof value.requestPermission === 'function' &&
  'getFileHandle' in value && typeof value.getFileHandle === 'function' &&
  'removeEntry' in value && typeof value.removeEntry === 'function';
const errorName = (error: unknown): unknown => typeof error === 'object' && error !== null && 'name' in error ? error.name : undefined;
const io = <A>(operation: () => Promise<A>): Effect.Effect<A, unknown> => Effect.tryPromise({ try: operation, catch: (error) => error });

/** Resource operations are effects; the facade executes them at browser event boundaries. */
export const createFolderSink = (options: FolderSinkOptions): FolderSink => {
  const events = new EventTarget();
  const state = Ref.makeUnsafe<{ readonly dir: DirectoryHandle | null; readonly permission: FolderState }>({ dir: null, permission: 'none' });
  const snapshot = (): { readonly dir: DirectoryHandle | null; readonly permission: FolderState } => Effect.runSync(Ref.get(state));
  const set = (permission: FolderState): void => {
    Effect.runSync(Ref.update(state, (previous) => ({ ...previous, permission })));
    events.dispatchEvent(new CustomEvent('change', { detail: { state: permission, folderName: snapshot().dir?.name ?? null } }));
  };
  const check = (): Promise<FolderState> => runEffect(Effect.gen(function* () {
    const { dir } = yield* Ref.get(state);
    const permission = dir === null ? 'none' : yield* io(() => dir.queryPermission({ mode: 'readwrite' })).pipe(Effect.catch(() => Effect.succeed('prompt' as const)));
    yield* Effect.sync(() => { set(permission); });
    return permission;
  }));
  const requestPermission = (): Promise<FolderState> => runEffect(Effect.gen(function* () {
    const { dir } = yield* Ref.get(state);
    if (dir === null) return 'none';
    const permission = yield* io(() => dir.requestPermission({ mode: 'readwrite' })).pipe(Effect.catch(() => Effect.succeed('prompt' as const)));
    yield* Effect.sync(() => { set(permission); });
    return permission;
  }));
  const activeDirectory = (): DirectoryHandle | null => snapshot().permission === 'granted' ? snapshot().dir : null;
  const sink: FolderSink = {
    get dir() { return snapshot().dir; },
    get state() { return snapshot().permission; },
    get supported() { return typeof (options.pickDirectory ?? globalThis.showDirectoryPicker) === 'function'; },
    get folderName() { return snapshot().dir?.name ?? null; },
    get usingFolder() { return activeDirectory() !== null; },
    init: () => runEffect(Effect.gen(function* () {
      const saved = yield* io(() => options.kv.get('saveDir')).pipe(Effect.catch(() => Effect.succeed(null)));
      yield* Ref.update(state, (previous) => ({ ...previous, dir: isDirectory(saved) ? saved : null }));
      yield* io(check);
      return sink;
    })),
    check, requestPermission,
    pick: () => runEffect(Effect.gen(function* () {
      const picker = options.pickDirectory ?? globalThis.showDirectoryPicker;
      if (picker === undefined) return yield* Effect.fail(new Error('Folder access is unavailable'));
      const dir = yield* io(() => picker({ id: 'i6-share', mode: 'readwrite', startIn: 'downloads' })).pipe(
        Effect.catch((error) => errorName(error) === 'AbortError' ? Effect.succeed(null) : Effect.fail(error)),
      );
      if (dir === null) return false;
      yield* Ref.update(state, (previous) => ({ ...previous, dir }));
      yield* io(() => options.kv.put('saveDir', dir));
      if ((yield* io(check)) !== 'granted') yield* io(requestPermission);
      return true;
    })),
    useDownloads: () => runEffect(Effect.gen(function* () {
      yield* Ref.update(state, (previous) => ({ ...previous, dir: null }));
      yield* io(() => options.kv.delete('saveDir')).pipe(Effect.catch(() => Effect.void));
      yield* Effect.sync(() => { set('none'); });
    })),
    exists: (name) => runEffect(Effect.gen(function* () {
      const dir = activeDirectory();
      if (dir === null) return false;
      return yield* io(() => dir.getFileHandle(name)).pipe(Effect.as(true), Effect.catch((error) => Effect.succeed(errorName(error) === 'TypeMismatchError')));
    })),
    create: (name, metadata = {}) => runEffect(Effect.gen(function* () {
      const dir = activeDirectory();
      const handle = dir === null ? null : yield* Effect.gen(function* () {
        const file = yield* io(() => dir.getFileHandle(name, { create: true }));
        const writable = yield* io(() => file.createWritable({ keepExistingData: false }));
        return {
          name, where: 'folder' as const,
          write: (bytes: Uint8Array) => runEffect(io(() => writable.write(bytes))),
          close: () => runEffect(io(() => writable.close())),
          abort: () => runEffect(Effect.gen(function* () {
            yield* io(() => writable.abort()).pipe(Effect.catch(() => Effect.void));
            yield* io(() => dir.removeEntry(name)).pipe(Effect.catch(() => Effect.void));
          })),
        };
      }).pipe(Effect.catch((error) => Effect.gen(function* () {
        events.dispatchEvent(new CustomEvent('error', { detail: error }));
        const permission = yield* io(check);
        if (permission === 'granted' && errorName(error) !== 'NotFoundError') return yield* Effect.fail(error);
        return null;
      })));
      if (handle !== null) return handle;
      const chunks = yield* Ref.make<readonly Uint8Array<ArrayBuffer>[]>([]);
      return {
        name, where: 'download' as const,
        write: (bytes: Uint8Array) => runEffect(Ref.update(chunks, (previous) => [...previous, new Uint8Array(bytes)])),
        close: () => runEffect(Effect.gen(function* () {
          const parts = yield* Ref.getAndSet(chunks, []);
          const file = new File([...parts], name, { type: metadata.type ?? '' });
          yield* Effect.sync(() => { (options.download ?? downloadFile)(file, name); });
        })),
        abort: () => runEffect(Ref.set(chunks, [])),
      };
    })),
    openFile: (name) => runEffect(Effect.gen(function* () {
      const dir = activeDirectory();
      if (dir === null) return yield* Effect.fail(new Error('No folder access'));
      const handle = yield* io(() => dir.getFileHandle(name));
      return yield* io(() => handle.getFile());
    })),
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  return sink;
};
