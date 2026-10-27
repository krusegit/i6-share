import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFolderSink } from '../hub/sink.js';
import type { DirectoryHandle, WritableFile } from '../hub/sink.js';
import { downloadFile } from '../public/lib/dom.js';

vi.mock('../public/lib/dom.js', () => ({ downloadFile: vi.fn() }));
const storage = (saved?: unknown) => ({
  get: vi.fn<(key: string) => Promise<unknown>>().mockResolvedValue(saved),
  put: vi.fn<(key: string, value: unknown) => Promise<void>>().mockResolvedValue(undefined),
  delete: vi.fn<(key: string) => Promise<void>>().mockResolvedValue(undefined),
});
const directory = () => {
  const writable = {
    write: vi.fn<WritableFile['write']>().mockResolvedValue(undefined),
    close: vi.fn<WritableFile['close']>().mockResolvedValue(undefined),
    abort: vi.fn<WritableFile['abort']>().mockResolvedValue(undefined),
  };
  const file = new File(['saved'], 'saved.txt');
  const handle = { createWritable: vi.fn().mockResolvedValue(writable), getFile: vi.fn().mockResolvedValue(file) };
  const dir = {
    name: 'Inbox',
    queryPermission: vi.fn<DirectoryHandle['queryPermission']>().mockResolvedValue('granted'),
    requestPermission: vi.fn<DirectoryHandle['requestPermission']>().mockResolvedValue('granted'),
    getFileHandle: vi.fn<DirectoryHandle['getFileHandle']>().mockResolvedValue(handle),
    removeEntry: vi.fn<DirectoryHandle['removeEntry']>().mockResolvedValue(undefined),
  };
  return { dir, writable, handle, file };
};
afterEach(() => { vi.unstubAllGlobals(); });
describe('folder file sink', () => {
  it('starts without a folder and downloads immutable chunks', async () => {
    const download = vi.fn<(file: File, name: string) => void>();
    const sink = createFolderSink({ kv: storage(), download });
    const changed = vi.fn();
    sink.addEventListener('change', changed);
    expect(await sink.init()).toBe(sink);
    expect(sink.dir).toBeNull();
    expect(sink.folderName).toBeNull();
    expect(sink.state).toBe('none');
    expect(sink.usingFolder).toBe(false);
    expect(sink.supported).toBe(false);
    expect(await sink.requestPermission()).toBe('none');
    expect(await sink.exists('x')).toBe(false);
    await expect(sink.openFile('x')).rejects.toThrow('No folder access');
    const file = await sink.create('hello.txt', { type: 'text/plain' });
    expect(file.where).toBe('download');
    const bytes = new Uint8Array([65, 66]);
    await file.write(bytes);
    bytes[0] = 90;
    await file.close();
    const saved = download.mock.calls[0]?.[0];
    expect(saved?.type).toBe('text/plain');
    expect(await saved?.text()).toBe('AB');
    await file.write(new Uint8Array([67]));
    await file.abort();
    await file.close();
    expect(await download.mock.calls[1]?.[0].text()).toBe('');
    sink.removeEventListener('change', changed);
    await sink.useDownloads();
    expect(changed).toHaveBeenCalledOnce();
  });
  it('uses the standard download adapter and default MIME type', async () => {
    const sink = createFolderSink({ kv: storage() });
    const file = await sink.create('empty');
    await file.close();
    expect(downloadFile).toHaveBeenCalledWith(expect.objectContaining({ name: 'empty', type: '' }), 'empty');
  });
  it('rejects malformed persisted directory handles at the boundary', async () => {
    const { dir } = directory();
    const malformed: readonly unknown[] = [null, 1, {}, { name: 1 }, { name: 'x' },
      { ...dir, queryPermission: 1 }, { ...dir, requestPermission: undefined },
      { ...dir, getFileHandle: null }, { ...dir, removeEntry: false },
      { name: 'x', queryPermission: dir.queryPermission },
      { name: 'x', queryPermission: dir.queryPermission, requestPermission: dir.requestPermission },
      { name: 'x', queryPermission: dir.queryPermission, requestPermission: dir.requestPermission, getFileHandle: dir.getFileHandle },
    ];
    for (const value of malformed) {
      const sink = createFolderSink({ kv: storage(value) });
      await sink.init();
      expect(sink.dir).toBeNull();
    }
    const kv = storage();
    kv.get.mockRejectedValue(new Error('unavailable'));
    expect((await createFolderSink({ kv }).init()).state).toBe('none');
  });
  it('restores permissions and writes, opens, and aborts real folder handles', async () => {
    const { dir, writable, file } = directory();
    const sink = await createFolderSink({ kv: storage(dir) }).init();
    expect(sink.dir).toBe(dir);
    expect(sink.folderName).toBe('Inbox');
    expect(sink.usingFolder).toBe(true);
    expect(await sink.exists('saved.txt')).toBe(true);
    expect(await sink.openFile('saved.txt')).toBe(file);
    const handle = await sink.create('received');
    expect(handle).toMatchObject({ name: 'received', where: 'folder' });
    const bytes = new Uint8Array([1, 2]);
    await handle.write(bytes);
    await handle.close();
    await handle.abort();
    expect(writable.write).toHaveBeenCalledWith(bytes);
    expect(writable.close).toHaveBeenCalledOnce();
    expect(dir.removeEntry).toHaveBeenCalledWith('received');
    writable.abort.mockRejectedValue(new Error('closed'));
    dir.removeEntry.mockRejectedValue(new Error('gone'));
    await expect(handle.abort()).resolves.toBeUndefined();
  });
  it('distinguishes occupied subfolders from missing files and other lookup errors', async () => {
    const { dir } = directory();
    const sink = await createFolderSink({ kv: storage(dir) }).init();
    dir.getFileHandle.mockRejectedValue(new DOMException('', 'TypeMismatchError'));
    expect(await sink.exists('subfolder')).toBe(true);
    for (const error of [new DOMException('', 'NotFoundError'), null, 'failure', {}]) {
      dir.getFileHandle.mockRejectedValue(error);
      expect(await sink.exists('missing')).toBe(false);
    }
  });
  it('treats permission API failures as a prompt and clears saved folders safely', async () => {
    const { dir } = directory();
    dir.queryPermission.mockRejectedValue(new Error('requires gesture'));
    dir.requestPermission.mockRejectedValue(new Error('requires gesture'));
    const kv = storage(dir);
    kv.delete.mockRejectedValue(new Error('storage unavailable'));
    const sink = await createFolderSink({ kv }).init();
    expect(sink.state).toBe('prompt');
    expect(await sink.requestPermission()).toBe('prompt');
    dir.requestPermission.mockResolvedValue('denied');
    expect(await sink.requestPermission()).toBe('denied');
    await sink.useDownloads();
    expect(sink.state).toBe('none');
    expect(sink.dir).toBeNull();
  });
  it('picks and persists folders and requests permission when needed', async () => {
    const { dir } = directory();
    const kv = storage();
    const pickDirectory = vi.fn().mockResolvedValue(dir);
    const sink = createFolderSink({ kv, pickDirectory });
    expect(sink.supported).toBe(true);
    expect(await sink.pick()).toBe(true);
    expect(kv.put).toHaveBeenCalledWith('saveDir', dir);
    expect(pickDirectory).toHaveBeenCalledWith({ id: 'i6-share', mode: 'readwrite', startIn: 'downloads' });
    dir.queryPermission.mockResolvedValue('prompt');
    expect(await sink.pick()).toBe(true);
    expect(dir.requestPermission).toHaveBeenCalledOnce();
  });
  it('supports the browser picker and treats cancellation as a negative result', async () => {
    const { dir } = directory();
    const picker = vi.fn().mockResolvedValue(dir);
    vi.stubGlobal('showDirectoryPicker', picker);
    const sink = createFolderSink({ kv: storage() });
    expect(sink.supported).toBe(true);
    expect(await sink.pick()).toBe(true);
    picker.mockRejectedValue(new DOMException('', 'AbortError'));
    expect(await sink.pick()).toBe(false);
    const error = new Error('blocked');
    picker.mockRejectedValue(error);
    await expect(sink.pick()).rejects.toBe(error);
    vi.stubGlobal('showDirectoryPicker', undefined);
    await expect(sink.pick()).rejects.toThrow('Folder access is unavailable');
  });
  it('retains write errors while access remains granted so the sender can retry', async () => {
    const { dir, handle } = directory();
    const sink = await createFolderSink({ kv: storage(dir) }).init();
    const listener = vi.fn();
    sink.addEventListener('error', listener);
    const error = new Error('disk full');
    handle.createWritable.mockRejectedValue(error);
    await expect(sink.create('file')).rejects.toBe(error);
    expect(listener).toHaveBeenCalledOnce();
  });
  it('falls back to download when the directory vanished or permission was lost', async () => {
    const { dir } = directory();
    const sink = await createFolderSink({ kv: storage(dir) }).init();
    dir.getFileHandle.mockRejectedValue(new DOMException('', 'NotFoundError'));
    expect((await sink.create('missing-folder')).where).toBe('download');
    dir.getFileHandle.mockRejectedValue(new Error('revoked'));
    dir.queryPermission.mockResolvedValue('denied');
    expect((await sink.create('permission-lost')).where).toBe('download');
    expect(sink.state).toBe('denied');
  });
});
