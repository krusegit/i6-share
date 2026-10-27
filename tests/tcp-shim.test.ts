import * as net from 'node:net';
import * as dgram from 'node:dgram';
import { afterEach, expect, it, vi } from 'vitest';
import { TCPServerSocket, TCPSocket, UDPSocket } from '../tools/tcp-shim.js';

vi.mock('node:net', async (importOriginal) => { const actual = await importOriginal<typeof net>(); return { ...actual, createServer: vi.fn(actual.createServer) }; });
vi.mock('node:dgram', async (importOriginal) => { const actual = await importOriginal<typeof dgram>(); return { ...actual, createSocket: vi.fn(actual.createSocket) }; });

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach((cleanup) => { cleanup(); }); vi.restoreAllMocks(); });

it('bridges a real TCP connection in both directions and closes resources', async () => {
  const listener = TCPServerSocket('127.0.0.1', { localPort: 0, backlog: 2, ipv6Only: false });
  cleanups.push(() => { void listener.close(); });
  const info = await listener.opened;
  const client = net.connect(info.localPort, info.localAddress);
  cleanups.push(() => { client.destroy(); });
  const accepted = await info.readable.getReader().read();
  if (accepted.done) throw new Error('listener ended');
  const connection = await accepted.value.opened;
  const reader = connection.readable.getReader(); const writer = connection.writable.getWriter();
  client.write('from-client'); expect(new TextDecoder().decode((await reader.read()).value)).toBe('from-client');
  const response = new Promise<string>((resolve) => { client.once('data', (data: Buffer) => { resolve(data.toString()); }); });
  await writer.write(new TextEncoder().encode('from-server')); expect(await response).toBe('from-server');
  await writer.close(); await reader.cancel(); await accepted.value.close(); await accepted.value.closed;
});

it('pauses and resumes on readable backpressure', async () => {
  const native = new net.Socket(); const pause = vi.spyOn(native, 'pause'); const resume = vi.spyOn(native, 'resume');
  const socket = TCPSocket(native); const info = await socket.opened;
  for (const value of ['a', 'b', 'c', 'd', 'e']) native.emit('data', Buffer.from(value));
  expect(pause).toHaveBeenCalled(); const reader = info.readable.getReader();
  expect((await reader.read()).value).toEqual(new Uint8Array([97])); await reader.read();
  expect(resume).toHaveBeenCalled(); await reader.cancel(); await socket.close();
});

it('propagates stream errors and rejects writes to destroyed sockets', async () => {
  const native = new net.Socket(); const socket = TCPSocket(native); const info = await socket.opened;
  const reader = info.readable.getReader(); native.emit('error', new Error('connection failed'));
  await expect(reader.read()).rejects.toThrow('connection failed'); native.destroy();
  await expect(info.writable.getWriter().write(new Uint8Array())).rejects.toThrow('socket closed');
});

it('aborts outgoing streams and tolerates end followed by close', async () => {
  const native = new net.Socket(); const socket = TCPSocket(native); const info = await socket.opened;
  native.emit('end'); expect((await info.readable.getReader().read()).done).toBe(true);
  await info.writable.abort(); await socket.closed;
});

it('propagates errors passed by Node write callbacks', async () => {
  const native = new net.Socket();
  vi.spyOn(native, 'write').mockImplementation((...args: readonly unknown[]) => {
    const callback = args[1];
    if (typeof callback === 'function') Reflect.apply(callback, undefined, [new Error('write failed')]);
    return false;
  });
  const socket = TCPSocket(native); const info = await socket.opened;
  await expect(info.writable.getWriter().write(new Uint8Array([1]))).rejects.toThrow('write failed'); await socket.close();
});

it('reports unsuccessful listen and closes safely', async () => {
  const listener = TCPServerSocket('invalid address', { localPort: 0 });
  await expect(listener.opened).rejects.toThrow(); await listener.close();
});

it('reports errors from an already-open listener through its stream', async () => {
  const native = net.createServer();
  vi.spyOn(net, 'createServer').mockReturnValueOnce(native);
  const listener = TCPServerSocket('127.0.0.1', { localPort: 0 });
  const info = await listener.opened; const reader = info.readable.getReader();
  native.emit('error', new Error('accept error'));
  await expect(reader.read()).rejects.toThrow('accept error'); await listener.close();
});

it('rejects impossible listener address results and closes connections arriving after cancellation', async () => {
  const native = net.createServer(); vi.spyOn(net, 'createServer').mockReturnValueOnce(native);
  vi.spyOn(native, 'address').mockReturnValue(null);
  const listener = TCPServerSocket('127.0.0.1', { localPort: 0 });
  await expect(listener.opened).rejects.toThrow('no IP address'); await listener.close();
});

it('cancels listener streams and destroys late arriving sockets', async () => {
  const native = net.createServer(); vi.spyOn(net, 'createServer').mockReturnValueOnce(native);
  const listener = TCPServerSocket('127.0.0.1', { localPort: 0 }); const info = await listener.opened;
  await info.readable.cancel();
  const late = new net.Socket(); native.emit('connection', late);
  await vi.waitFor(() => { expect(late.destroyed).toBe(true); }); await listener.closed;
});

it.each(['127.0.0.1', '::1'])('discovers a local UDP address for %s without sending', async (remoteAddress) => {
  const socket = UDPSocket({ remoteAddress, remotePort: 9 });
  const info = await socket.opened; expect(info.localAddress).toBe(remoteAddress); expect(info.localPort).toBeGreaterThan(0);
  await socket.close(); await socket.close();
});

it('reports UDP connect errors', async () => {
  const native = dgram.createSocket('udp4'); vi.spyOn(dgram, 'createSocket').mockReturnValueOnce(native);
  const socket = UDPSocket({ remoteAddress: 'invalid address', remotePort: 9 });
  native.emit('error', new Error('UDP failed'));
  await expect(socket.opened).rejects.toThrow('UDP failed'); await socket.close();
});
