// File sink for the hub: writes received files into a user-chosen folder via the File System
// Access API, or (no folder / no permission) collects them in memory and triggers a download.
//
// Sink interface used by api.js:
//   exists(name) → Promise<boolean>
//   create(name, {type}) → Promise<{name, where: 'folder'|'download', write(u8), close(), abort()}>
//
// Extra for the UI: init(), pick(), requestPermission(), useDownloads(), openFile(name),
// .state ('none' | 'granted' | 'prompt' | 'denied'), .folderName, .supported.
// Events: 'change' (state/folder changed), 'error' (detail = Error).

import { downloadFile } from './lib/dom.js';

const DIR_KEY = 'saveDir';

export class FolderSink extends EventTarget {
  constructor({ kv }) {
    super();
    this.kv = kv;
    this.dir = null;
    this.state = 'none';
  }

  get supported() { return typeof globalThis.showDirectoryPicker === 'function'; }
  get folderName() { return this.dir?.name ?? null; }
  get usingFolder() { return !!this.dir && this.state === 'granted'; }

  async init() {
    try { this.dir = (await this.kv.get(DIR_KEY)) || null; } catch { this.dir = null; }
    await this.check();
    return this;
  }

  async check() {
    let state = 'none';
    if (this.dir) {
      try { state = await this.dir.queryPermission({ mode: 'readwrite' }); } catch { state = 'prompt'; }
    }
    this._set(state);
    return state;
  }

  /** Lets the user choose the save folder (needs a user gesture). Returns false if cancelled. */
  async pick() {
    let dir;
    try {
      dir = await globalThis.showDirectoryPicker({ id: 'i6-share', mode: 'readwrite', startIn: 'downloads' });
    } catch (e) {
      if (e?.name === 'AbortError') return false;
      throw e;
    }
    this.dir = dir;
    await this.kv.put(DIR_KEY, dir);
    if ((await this.check()) !== 'granted') await this.requestPermission();
    return true;
  }

  /** Re-grants access to the saved folder (needs a user gesture). */
  async requestPermission() {
    if (!this.dir) return 'none';
    let state;
    try { state = await this.dir.requestPermission({ mode: 'readwrite' }); } catch { state = 'prompt'; }
    this._set(state);
    return state;
  }

  /** Forget the folder; received files are downloaded instead. */
  async useDownloads() {
    this.dir = null;
    try { await this.kv.delete(DIR_KEY); } catch { /* ignore */ }
    this._set('none');
  }

  async exists(name) {
    if (!this.usingFolder) return false;
    try {
      await this.dir.getFileHandle(name);
      return true;
    } catch (e) {
      return e?.name === 'TypeMismatchError'; // a sub-folder with that name also blocks the name
    }
  }

  async create(name, { type = '' } = {}) {
    if (this.usingFolder) {
      const dir = this.dir;
      try {
        const fh = await dir.getFileHandle(name, { create: true });
        const w = await fh.createWritable({ keepExistingData: false });
        return {
          name,
          where: 'folder',
          write: (bytes) => w.write(bytes),
          close: () => w.close(),
          abort: async () => {
            try { await w.abort(); } catch { /* ignore */ }
            try { await dir.removeEntry(name); } catch { /* ignore */ }
          },
        };
      } catch (e) {
        this.dispatchEvent(new CustomEvent('error', { detail: e }));
        const gone = e?.name === 'NotFoundError'; // the folder itself was deleted / moved
        if ((await this.check()) === 'granted' && !gone) throw e; // a real write error: the phone retries
        // permission lost or folder gone → download fallback so nothing is dropped
      }
    }
    let chunks = [];
    return {
      name,
      where: 'download',
      write: async (bytes) => { chunks.push(bytes); },
      close: async () => {
        const file = new File(chunks, name, { type });
        chunks = [];
        downloadFile(file, name);
      },
      abort: async () => { chunks = []; },
    };
  }

  /** The saved file, for "Open". Throws if it is gone or access was lost. */
  async openFile(name) {
    if (!this.usingFolder) throw new Error('No folder access');
    const fh = await this.dir.getFileHandle(name);
    return fh.getFile();
  }

  _set(state) {
    this.state = state;
    this.dispatchEvent(new CustomEvent('change', { detail: { state, folderName: this.folderName } }));
  }
}
