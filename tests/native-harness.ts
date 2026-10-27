import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';

export interface NativeHubOptions {
  readonly root?: string;
  readonly dataDirectory?: string;
  readonly receiveDirectory?: string;
  readonly webRoot?: string;
}
export interface DashboardConnection { readonly close: () => Promise<void> }
export interface NativeHub {
  readonly port: number;
  readonly origin: string;
  readonly adminToken: string;
  readonly dashboard: DashboardConnection;
  readonly openDashboard: () => Promise<DashboardConnection>;
  readonly exited: Promise<void>;
  readonly root: string;
  readonly dataDirectory: string;
  readonly receiveDirectory: string;
  readonly admin: <A>(route: string, decode: (value: unknown) => A, body?: unknown) => Promise<A>;
  readonly request: (route: string, init?: RequestInit) => Promise<Response>;
  readonly stop: () => Promise<void>;
  readonly remove: () => Promise<void>;
}

const project = path.resolve('native/I6Share.Hub/I6Share.Hub.csproj');
const assembly = path.resolve('native/I6Share.Hub/bin/Debug/net10.0/i6-share-hub.dll');
let build: Promise<void> | undefined;
const ensureAssembly = (): Promise<void> => build ??= new Promise<void>((resolve, reject) => {
  const command = spawn('dotnet', ['build', project, '--nologo'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const output: string[] = [];
  command.stdout.setEncoding('utf8'); command.stderr.setEncoding('utf8');
  command.stdout.on('data', (chunk: string) => { output.push(chunk); });
  command.stderr.on('data', (chunk: string) => { output.push(chunk); });
  command.once('error', reject);
  command.once('exit', (code) => { if (code === 0) resolve(); else reject(new Error(`Native hub build failed:\n${output.join('')}`)); });
});

const readyUrl = (line: string): URL | undefined => {
  const prefix = 'I6_SHARE_READY ';
  if (!line.startsWith(prefix)) return undefined;
  const value: unknown = JSON.parse(line.slice(prefix.length));
  if (typeof value !== 'object' || value === null || !('adminUrl' in value) || typeof value.adminUrl !== 'string') throw new Error('Invalid native hub readiness message');
  return new URL(value.adminUrl);
};

/** Start the real backend, or the supplied Native AOT executable, against an isolated filesystem. */
export const startNativeHub = async (options: NativeHubOptions = {}): Promise<NativeHub> => {
  const binary = process.env['I6_NATIVE_BINARY'];
  if (binary === undefined) await ensureAssembly();
  const root = options.root ?? await mkdtemp(path.join(os.tmpdir(), 'i6-native-e2e-'));
  const dataDirectory = options.dataDirectory ?? path.join(root, 'data');
  const receiveDirectory = options.receiveDirectory ?? path.join(root, 'received');
  await mkdir(receiveDirectory, { recursive: true });
  const args = ['--host', '127.0.0.1', '--port', '0', '--data-dir', dataDirectory, '--receive-dir', receiveDirectory];
  if (options.webRoot !== undefined) args.push('--web-root', options.webRoot);
  const child = spawn(binary ?? 'dotnet', binary === undefined ? [assembly, ...args] : args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const logs: string[] = [];
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => { logs.push(chunk); });
  const exited = new Promise<void>((resolve) => { child.once('exit', () => { resolve(); }); });
  const stop = async (): Promise<void> => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill('SIGTERM');
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, 10_000);
    timer.unref();
    await exited;
    clearTimeout(timer);
  };
  const lines = createInterface({ input: child.stdout });
  const ready = new Promise<URL>((resolve, reject) => {
    const timeout = setTimeout(() => { reject(new Error('Native hub did not become ready within 30 seconds')); }, 30_000);
    const finish = (url: URL): void => { clearTimeout(timeout); resolve(url); };
    const fail = (error: Error): void => { clearTimeout(timeout); reject(error); };
    child.once('error', fail);
    child.once('exit', (code) => { fail(new Error(`Native hub exited (${String(code)}): ${logs.join('').replace(/admin=[^"\s]+/g, 'admin=<redacted>')}`)); });
    lines.on('line', (line: string) => {
      logs.push(`${line}\n`);
      try {
        const url = readyUrl(line);
        if (url !== undefined) finish(url);
      } catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
    });
  });
  try {
    const url = await ready;
    const adminToken = new URLSearchParams(url.hash.slice(1)).get('admin');
    if (adminToken === null || adminToken === '') throw new Error('Native hub omitted the administration token');
    const openDashboard = async (): Promise<DashboardConnection> => {
      const socket = new WebSocket(`${url.origin.replace('http:', 'ws:')}/admin/lifetime`, ['i6-share-dashboard', adminToken]);
      const closed = new Promise<void>((resolve) => { socket.addEventListener('close', () => { resolve(); }, { once: true }); });
      await new Promise<void>((resolve, reject) => {
        socket.addEventListener('open', () => { resolve(); }, { once: true });
        socket.addEventListener('error', () => { reject(new Error('Native dashboard lifetime socket failed')); }, { once: true });
      });
      return { close: async () => { socket.close(1000); await closed; } };
    };
    const dashboard = await openDashboard();
    const request = (route: string, init?: RequestInit): Promise<Response> => fetch(`${url.origin}${route}`, init);
    return {
      root, dataDirectory, receiveDirectory, origin: url.origin, port: Number(url.port), adminToken, dashboard, openDashboard, exited,
      request,
      admin: async <A>(route: string, decode: (value: unknown) => A, body?: unknown): Promise<A> => {
        const response = await request(`/admin/${route}`, {
          headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
          ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
        });
        if (!response.ok) throw new Error(`Native admin ${route} returned HTTP ${String(response.status)}: ${await response.text()}`);
        const value: unknown = await response.json();
        return decode(value);
      },
      stop: async () => { await dashboard.close(); await stop(); },
      remove: async () => { await dashboard.close(); await stop(); lines.close(); await rm(root, { recursive: true, force: true }); },
    };
  } catch (error) {
    await stop(); lines.close();
    if (options.root === undefined) await rm(root, { recursive: true, force: true });
    throw error;
  }
};
