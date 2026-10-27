import { afterEach, expect, it, vi } from 'vitest';
import { openDashboardLifetime } from '../hub/lifetime.js';
import type { ConnectDashboard } from '../hub/lifetime.js';

const fixture = () => {
  const socket = Object.assign(new EventTarget(), { close: vi.fn<(code?: number, reason?: string) => void>() });
  const connect = vi.fn<ConnectDashboard>().mockReturnValue(socket);
  const disconnected = vi.fn<() => void>();
  return { socket, connect, disconnected };
};
afterEach(() => { vi.unstubAllGlobals(); });

it('authenticates the native process lifetime and closes it only when the document disposes', async () => {
  const { socket, connect, disconnected } = fixture();
  const lifetime = openDashboardLifetime('token', 'http://localhost:47616/?view=x#admin=token', disconnected, connect);
  expect(lifetime.connected()).toBe(false);
  expect(connect).toHaveBeenCalledWith('ws://localhost:47616/admin/lifetime', ['i6-share-dashboard', 'token']);
  socket.dispatchEvent(new Event('open')); await lifetime.ready;
  expect(lifetime.connected()).toBe(true);
  lifetime.dispose(); lifetime.dispose();
  expect(lifetime.connected()).toBe(false);
  expect(socket.close).toHaveBeenCalledExactlyOnceWith(1000, 'dashboard closed');
  expect(disconnected).not.toHaveBeenCalled();
  socket.dispatchEvent(new Event('close')); socket.dispatchEvent(new Event('error'));
  expect(disconnected).not.toHaveBeenCalled();
});

it('notifies the UI on unexpected closure after connecting', async () => {
  const { socket, connect, disconnected } = fixture();
  const lifetime = openDashboardLifetime('token', 'https://localhost:47616/', disconnected, connect);
  expect(connect).toHaveBeenCalledWith('wss://localhost:47616/admin/lifetime', ['i6-share-dashboard', 'token']);
  socket.dispatchEvent(new Event('open')); await lifetime.ready;
  socket.dispatchEvent(new Event('close'));
  expect(disconnected).toHaveBeenCalledOnce();
  lifetime.dispose();
});

it('rejects a failed, closed, or disposed handshake without leaving a socket behind', async () => {
  for (const action of ['error', 'close', 'dispose']) {
    const { socket, connect, disconnected } = fixture();
    const lifetime = openDashboardLifetime('token', 'http://localhost/', disconnected, connect);
    const rejected = expect(lifetime.ready).rejects.toBeInstanceOf(Error);
    if (action === 'dispose') lifetime.dispose(); else socket.dispatchEvent(new Event(action));
    await rejected;
    expect(socket.close).toHaveBeenCalledOnce();
    expect(disconnected).not.toHaveBeenCalled();
  }
});

it('uses a platform WebSocket and reports transport errors after an accepted handshake', async () => {
  const { socket, disconnected } = fixture();
  const constructor = vi.fn(function () { return socket; });
  vi.stubGlobal('WebSocket', constructor);
  const lifetime = openDashboardLifetime('token', 'http://localhost/', disconnected);
  expect(constructor).toHaveBeenCalledWith('ws://localhost/admin/lifetime', ['i6-share-dashboard', 'token']);
  socket.dispatchEvent(new Event('open')); await lifetime.ready;
  socket.dispatchEvent(new Event('error')); expect(disconnected).toHaveBeenCalledOnce();
});
