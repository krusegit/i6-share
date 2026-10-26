// Node shim of Chrome's Direct Sockets TCPServerSocket / TCPSocket (and a connected
// UDPSocket for address probing), so hub/http.js + hub/api.js can run under Node for tests:
//
//   import { TCPServerSocket } from './tools/tcp-shim.mjs';
//   startServer({ port, handler, TCPServerSocket });
//
// Mirrors the browser API surface used by the hub:
//   new TCPServerSocket(localAddress, {localPort, backlog?, ipv6Only?})
//     .opened → {readable: ReadableStream<TCPSocket>, localAddress, localPort}
//     .closed, .close()
//   TCPSocket.opened → {readable: ReadableStream<Uint8Array>, writable: WritableStream<Uint8Array>,
//                       remoteAddress, remotePort, localAddress, localPort}
//     .closed, .close()

import net from 'node:net';
import dgram from 'node:dgram';

const noop = () => {};

export class TCPSocket {
  /** Wraps an accepted node:net socket. */
  constructor(sock) {
    this._sock = sock;
    sock.setNoDelay(true);
    let closedResolve;
    this.closed = new Promise((r) => { closedResolve = r; });
    sock.once('close', () => closedResolve());
    sock.on('error', noop); // surfaced through the streams

    const readable = new ReadableStream({
      start(controller) {
        sock.on('data', (buf) => {
          controller.enqueue(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
          if (controller.desiredSize <= 0) sock.pause();
        });
        sock.once('end', () => { try { controller.close(); } catch { /* already closed */ } });
        sock.once('error', (e) => { try { controller.error(e); } catch { /* ignore */ } });
        sock.once('close', () => { try { controller.close(); } catch { /* ignore */ } });
      },
      pull() { sock.resume(); },
      cancel() { sock.destroy(); },
    }, { highWaterMark: 4 });

    const writable = new WritableStream({
      write(chunk) {
        return new Promise((resolve, reject) => {
          if (sock.destroyed) return reject(new Error('socket closed'));
          sock.write(chunk, (err) => (err ? reject(err) : resolve()));
        });
      },
      close() { return new Promise((resolve) => sock.end(resolve)); },
      abort() { sock.destroy(); },
    });

    this.opened = Promise.resolve({
      readable,
      writable,
      remoteAddress: sock.remoteAddress,
      remotePort: sock.remotePort,
      localAddress: sock.localAddress,
      localPort: sock.localPort,
    });
  }

  close() {
    this._sock.destroy();
    return Promise.resolve();
  }
}

export class TCPServerSocket {
  constructor(localAddress, { localPort = 0, backlog, ipv6Only = false } = {}) {
    const server = net.createServer({ pauseOnConnect: false });
    this._server = server;
    let controller;
    const readable = new ReadableStream({
      start(c) { controller = c; },
      cancel() { server.close(); },
    });
    let closedResolve;
    this.closed = new Promise((r) => { closedResolve = r; });
    server.once('close', () => { closedResolve(); try { controller.close(); } catch { /* ignore */ } });
    server.on('connection', (sock) => {
      try { controller.enqueue(new TCPSocket(sock)); } catch { sock.destroy(); }
    });
    this.opened = new Promise((resolve, reject) => {
      const onError = (e) => reject(e);
      server.once('error', onError);
      server.listen({ host: localAddress, port: localPort, backlog, ipv6Only }, () => {
        server.off('error', onError);
        server.on('error', (e) => { try { controller.error(e); } catch { /* ignore */ } });
        const a = server.address();
        resolve({ readable, localAddress: a.address, localPort: a.port });
      });
    });
    this.opened.catch(noop);
  }

  close() {
    this._server.close();
    return Promise.resolve();
  }
}

/** Connected UDP socket (only what hub/net.js needs: opened.localAddress, close()). */
export class UDPSocket {
  constructor({ remoteAddress, remotePort }) {
    const sock = dgram.createSocket(remoteAddress.includes(':') ? 'udp6' : 'udp4');
    this._sock = sock;
    sock.on('error', noop);
    this.opened = new Promise((resolve, reject) => {
      sock.once('error', reject);
      sock.connect(remotePort, remoteAddress, () => {
        const a = sock.address();
        resolve({ readable: new ReadableStream(), writable: new WritableStream(), remoteAddress, remotePort, localAddress: a.address, localPort: a.port });
      });
    });
    this.opened.catch(noop);
  }

  close() {
    try { this._sock.close(); } catch { /* ignore */ }
    return Promise.resolve();
  }
}
