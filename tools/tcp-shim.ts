// Node adapters for the browser Direct Sockets contract. Resources are acquired lazily
// by Effect and represented by closure-based capabilities rather than mutable classes.
import * as net from 'node:net';
import * as dgram from 'node:dgram';
import { Effect } from 'effect';
import type { TCPSocket as Socket, TCPListener, TCPListenOptions } from '../hub/http.js';

const quiet = (operation: () => unknown): void => {
  Effect.runSync(Effect.ignore(Effect.try(operation)));
};

/** Wrap a connected Node socket in the Direct Sockets stream interface. */
export const TCPSocket = (socket: net.Socket): Socket => {
  socket.setNoDelay(true);
  const closed = new Promise<void>((resolve) => { socket.once('close', resolve); });
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      socket.on('data', (buffer: Buffer) => {
        controller.enqueue(new Uint8Array(buffer));
        if (Number(controller.desiredSize) <= 0) socket.pause();
      });
      socket.once('end', () => { quiet(() => { controller.close(); }); });
      socket.once('error', (error: Error) => { controller.error(error); });
      socket.once('close', () => { quiet(() => { controller.close(); }); });
    },
    pull() { socket.resume(); },
    cancel() { socket.destroy(); },
  }, { highWaterMark: 4 });
  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      return Effect.runPromise(Effect.callback<undefined, Error>((resume) => {
        if (socket.destroyed) { resume(Effect.fail(new Error('socket closed'))); return; }
        socket.write(chunk, (error) => { resume(error === null || error === undefined ? Effect.succeed(undefined) : Effect.fail(error)); });
      }));
    },
    close() { return new Promise<void>((resolve) => { socket.end(resolve); }); },
    abort() { socket.destroy(); },
  });
  return {
    opened: Promise.resolve({ readable, writable, remoteAddress: socket.remoteAddress,
      remotePort: socket.remotePort, localAddress: socket.localAddress, localPort: socket.localPort }),
    closed,
    close: () => Effect.runPromise(Effect.sync(() => { socket.destroy(); })),
  };
};

/** Factory matching the injected listener capability consumed by startServer. */
export const TCPServerSocket = (localAddress: string, options: TCPListenOptions): TCPListener => {
  const server = net.createServer({ pauseOnConnect: false });
  const controllers = Promise.withResolvers<ReadableStreamDefaultController<Socket>>();
  const readable = new ReadableStream<Socket>({
    start(controller) { controllers.resolve(controller); },
    cancel() { server.close(); },
  });
  const closed = new Promise<void>((resolve) => {
    server.once('close', () => {
      resolve();
      void controllers.promise.then((controller) => { quiet(() => { controller.close(); }); });
    });
  });
  server.on('connection', (socket) => {
    void controllers.promise.then((controller) => {
      Effect.runSync(Effect.try(() => { controller.enqueue(TCPSocket(socket)); }).pipe(
        Effect.catch(() => Effect.sync(() => { socket.destroy(); })),
      ));
    });
  });
  const opened = new Promise<{ readonly readable: ReadableStream<Socket>; readonly localAddress: string; readonly localPort: number }>((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: localAddress, port: options.localPort,
      ...(options.backlog === undefined ? {} : { backlog: options.backlog }), ipv6Only: options.ipv6Only ?? false }, () => {
      server.off('error', reject);
      server.on('error', (error: Error) => { void controllers.promise.then((controller) => { controller.error(error); }); });
      const address = server.address();
      if (address === null || typeof address === 'string') { reject(new Error('TCP listener has no IP address')); return; }
      resolve({ readable, localAddress: address.address, localPort: address.port });
    });
  });
  void opened.catch(() => undefined);
  return { opened, closed, close: () => Effect.runPromise(Effect.sync(() => { server.close(); })) };
};

export interface UdpSocketOptions { readonly remoteAddress: string; readonly remotePort: number }
export interface UdpSocket {
  readonly opened: Promise<{ readonly localAddress: string; readonly localPort: number }>;
  readonly close: () => Promise<void>;
}
/** UDP connect discovers the outbound interface without sending a datagram. */
export const UDPSocket = ({ remoteAddress, remotePort }: UdpSocketOptions): UdpSocket => {
  const socket = dgram.createSocket(remoteAddress.includes(':') ? 'udp6' : 'udp4');
  const opened = new Promise<{ readonly localAddress: string; readonly localPort: number }>((resolve, reject) => {
    socket.on('error', reject);
    socket.connect(remotePort, remoteAddress, () => {
      const address = socket.address();
      resolve({ localAddress: address.address, localPort: address.port });
    });
  });
  void opened.catch(() => undefined);
  return { opened, close: () => Effect.runPromise(Effect.ignore(Effect.try(() => { socket.close(); }))) };
};
