import { Effect } from 'effect';
import { store } from './lib/store.js';

export const CACHE = 'i6-share-1.1.0';
export const SHELL = [
  './', './index.html', './app.js', './app.css', './client.js', './style.css',
  './lib/proto.js', './lib/dom.js', './lib/store.js', './manifest.webmanifest', './build-info.js',
] as const;
export const OPTIONAL = [
  './icons/icon.svg', './icons/favicon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './icons/maskable-512.png', './icons/apple-touch-icon.png',
] as const;

export interface LifetimeEvent { readonly waitUntil: (promise: Promise<unknown>) => void }
export interface WorkerFetchEvent extends LifetimeEvent {
  readonly request: Request;
  readonly respondWith: (response: Promise<Response>) => void;
}
export interface WorkerCache {
  readonly addAll: (requests: Request[]) => Promise<void>;
  readonly add: (request: Request) => Promise<void>;
  readonly put: (request: RequestInfo | URL, response: Response) => Promise<void>;
  readonly match: (request: RequestInfo | URL, options?: CacheQueryOptions) => Promise<Response | undefined>;
}
export interface WorkerCaches {
  readonly open: (name: string) => Promise<WorkerCache>;
  readonly keys: () => Promise<string[]>;
  readonly delete: (name: string) => Promise<boolean>;
}
export interface WorkerScope {
  readonly registration: { readonly scope: string };
  readonly location: { readonly origin: string };
  readonly clients: { readonly claim: () => Promise<void> };
  readonly skipWaiting: () => Promise<void>;
  readonly caches: WorkerCaches;
  readonly fetch: typeof fetch;
  addEventListener(type: 'install' | 'activate', handler: (event: LifetimeEvent) => void): void;
  addEventListener(type: 'fetch', handler: (event: WorkerFetchEvent) => void): void;
}
export interface WorkerDependencies {
  readonly scope: WorkerScope;
  readonly stage: (files: readonly File[]) => Promise<unknown>;
  readonly now: () => Date;
  readonly report: (error: unknown) => void;
}
const attempt = <A>(run: () => Promise<A>): Effect.Effect<A, unknown> => Effect.tryPromise({ try: run, catch: (error) => error });
export const scoped = (scope: WorkerScope, path: string): string => new URL(path, scope.registration.scope).href;

export const install = ({ scope }: WorkerDependencies): Effect.Effect<void, unknown> => Effect.gen(function* () {
  const cache = yield* attempt(() => scope.caches.open(CACHE));
  yield* attempt(() => cache.addAll(SHELL.map((path) => new Request(scoped(scope, path), { cache: 'reload' }))));
  yield* Effect.forEach(OPTIONAL, (path) => attempt(() => cache.add(new Request(scoped(scope, path), { cache: 'reload' }))).pipe(Effect.ignore), { concurrency: 'unbounded', discard: true });
  yield* attempt(() => scope.skipWaiting());
});

export const activate = ({ scope }: WorkerDependencies): Effect.Effect<void, unknown> => Effect.gen(function* () {
  const keys = yield* attempt(() => scope.caches.keys());
  yield* Effect.forEach(keys.filter((key) => key.startsWith('i6-share-') && key !== CACHE), (key) => attempt(() => scope.caches.delete(key)), { discard: true });
  yield* attempt(() => scope.clients.claim());
});

export const networkFirst = ({ scope }: WorkerDependencies, request: Request): Effect.Effect<Response, unknown> => Effect.gen(function* () {
  const cache = yield* attempt(() => scope.caches.open(CACHE));
  return yield* Effect.gen(function* () {
    const response = yield* attempt(() => scope.fetch(request, { cache: 'no-cache' }));
    if (response.ok) yield* attempt(() => cache.put(request, response.clone()));
    return response;
  }).pipe(Effect.catch((error) => attempt(() => cache.match(request)).pipe(Effect.flatMap((cached) => cached === undefined ? Effect.fail(error) : Effect.succeed(cached)))));
});

export const navigationKey = (request: Request): string | Request => {
  if (request.mode !== 'navigate') return request;
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  return url.href;
};

export const staleWhileRevalidate = ({ scope }: WorkerDependencies, event: LifetimeEvent, request: Request): Effect.Effect<Response, unknown> => Effect.gen(function* () {
  const cache = yield* attempt(() => scope.caches.open(CACHE));
  const navigation = request.mode === 'navigate';
  const key = navigationKey(request);
  const cached = yield* attempt(() => cache.match(key, { ignoreSearch: navigation }));
  const network = attempt(() => scope.fetch(request, { cache: 'no-cache' })).pipe(Effect.tap((response) => response.ok && response.type === 'basic' ? attempt(() => cache.put(key, response.clone())) : Effect.void));
  if (cached !== undefined) {
    event.waitUntil(Effect.runPromise(network.pipe(Effect.ignore)));
    return cached;
  }
  return yield* network.pipe(Effect.catch((error) => {
    if (!navigation || (key !== scoped(scope, './') && key !== scoped(scope, './index.html'))) return Effect.fail(error);
    return attempt(() => cache.match(scoped(scope, './'))).pipe(
      Effect.flatMap((shell) => shell === undefined ? attempt(() => cache.match(scoped(scope, './index.html'))) : Effect.succeed(shell)),
      Effect.flatMap((shell) => shell === undefined ? Effect.fail(error) : Effect.succeed(shell)),
    );
  }));
});

export const sharedFiles = (form: FormData, now: Date): readonly File[] => {
  const files = form.getAll('files').filter((value): value is File => typeof value !== 'string' && (value.size > 0 || value.name.length > 0));
  if (files.length > 0) return files;
  const text = ['title', 'text', 'url'].map((key) => form.get(key)).filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  if (text.length === 0) return [];
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return [new File([`${[...new Set(text)].join('\n')}\n`], `shared-${stamp}.txt`, { type: 'text/plain' })];
};

export const receiveShare = (dependencies: WorkerDependencies, request: Request): Effect.Effect<Response> => attempt(() => request.formData()).pipe(
  Effect.map((form) => sharedFiles(form, dependencies.now())),
  Effect.flatMap((files) => files.length > 0 ? attempt(() => dependencies.stage(files)) : Effect.void),
  Effect.catch((error) => Effect.sync(() => { dependencies.report(error); })),
  Effect.map(() => Response.redirect(scoped(dependencies.scope, './?share=1'), 303)),
);

export const handleFetch = (dependencies: WorkerDependencies, event: WorkerFetchEvent): void => {
  const { scope } = dependencies;
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== scope.location.origin) return;
  const target = new URL(url);
  target.search = '';
  target.hash = '';
  if (request.method === 'POST' && target.href === scoped(scope, './share-target')) {
    event.respondWith(Effect.runPromise(receiveShare(dependencies, request)));
    return;
  }
  if (request.method !== 'GET' || request.headers.has('range') || !url.href.startsWith(scope.registration.scope) || url.href.startsWith(scoped(scope, './downloads/'))) return;
  event.respondWith(Effect.runPromise(url.pathname.endsWith('/build-info.js') ? networkFirst(dependencies, request) : staleWhileRevalidate(dependencies, event, request)));
};

export const registerServiceWorker = (dependencies: WorkerDependencies): void => {
  dependencies.scope.addEventListener('install', (event) => { event.waitUntil(Effect.runPromise(install(dependencies))); });
  dependencies.scope.addEventListener('activate', (event) => { event.waitUntil(Effect.runPromise(activate(dependencies))); });
  dependencies.scope.addEventListener('fetch', (event) => { handleFetch(dependencies, event); });
};

declare const self: WorkerScope;
export const initializeServiceWorker = (): void => { registerServiceWorker({ scope: self, stage: (files) => store('kv').put('staged', files), now: () => new Date(), report: (error) => { console.error('share target failed', error); } }); };
