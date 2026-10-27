import { Effect, Ref } from 'effect';

export type DashboardSocket = Pick<WebSocket, 'addEventListener' | 'removeEventListener' | 'close'>;
export type ConnectDashboard = (url: string, protocols: readonly string[]) => DashboardSocket;
export interface DashboardLifetime { readonly ready: Promise<void>; readonly connected: () => boolean; readonly dispose: () => void }

/** A live document owns the native process through an authenticated WebSocket, not timers. */
export const openDashboardLifetime = (
  token: string,
  url: string,
  disconnected: () => void,
  connect: ConnectDashboard = (address, protocols) => new WebSocket(address, [...protocols]),
): DashboardLifetime => {
  const endpoint = new URL('/admin/lifetime', url);
  endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = connect(endpoint.href, ['i6-share-dashboard', token]);
  const state = Ref.makeUnsafe({ opened: false, disposed: false });
  const ready = Promise.withResolvers<undefined>();
  const close = (notify: boolean, message: string): void => {
    const current = Effect.runSync(Ref.get(state));
    if (current.disposed) return;
    Effect.runSync(Ref.set(state, { ...current, disposed: true }));
    socket.removeEventListener('open', opened);
    socket.removeEventListener('close', ended);
    socket.removeEventListener('error', failed);
    socket.close(1000, 'dashboard closed');
    if (!current.opened) ready.reject(new Error(message));
    else if (notify) disconnected();
  };
  const opened = (): void => {
    Effect.runSync(Ref.update(state, (current) => ({ ...current, opened: true })));
    ready.resolve(undefined);
  };
  const ended = (): void => { close(true, 'The native hub closed the dashboard connection. Relaunch i6-share Hub.'); };
  const failed = (): void => { close(true, 'Cannot connect to the native hub. Open the local dashboard link printed by i6-share Hub.'); };
  socket.addEventListener('open', opened, { once: true });
  socket.addEventListener('close', ended);
  socket.addEventListener('error', failed);
  return { ready: ready.promise, connected: () => { const current = Effect.runSync(Ref.get(state)); return current.opened && !current.disposed; }, dispose: () => { close(false, 'Dashboard closed.'); } };
};
