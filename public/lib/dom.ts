import { Effect, Ref } from 'effect';

export type Child = Node | string | number | boolean | null | undefined | readonly Child[];
export type DomChild = Child;
export type Variant = 'text' | 'contained' | 'outlined';
type EventProperties = { readonly [K in keyof GlobalEventHandlersEventMap as `on${K}`]?: (event: GlobalEventHandlersEventMap[K]) => unknown };
type Properties<K extends keyof HTMLElementTagNameMap> = Partial<Omit<HTMLElementTagNameMap[K], keyof GlobalEventHandlers | 'style' | 'children'>> & EventProperties & {
  readonly class?: string;
  readonly text?: string;
  readonly style?: Readonly<Partial<CSSStyleDeclaration>>;
  readonly attrs?: Readonly<Record<string, string | number | boolean | null | undefined>>;
};

const append = (element: Element, children: readonly Child[]): void => {
  for (const child of children) {
    if (child === null || child === undefined || typeof child === 'boolean') continue;
    if (child instanceof Node) element.append(child);
    else if (typeof child === 'string' || typeof child === 'number') element.append(document.createTextNode(String(child)));
    else append(element, child);
  }
};

export const h = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Properties<K> | null, ...children: readonly Child[]): HTMLElementTagNameMap[K] => Effect.runSync(Effect.sync(() => {
  const element = document.createElement(tag);
  for (const [attribute, value] of Object.entries(props?.attrs ?? {})) {
    if (value !== null && value !== undefined && value !== false) element.setAttribute(attribute, value === true ? '' : String(value));
  }
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === false) continue;
    if (key === 'class' && typeof value === 'string') element.className = value;
    else if (key === 'text' && typeof value === 'string') element.textContent = value;
    else if (key === 'style') Object.assign(element.style, value);
    else if (key === 'attrs') continue;
    else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2), (event) => { Reflect.apply(value, undefined, [event]); });
    } else Object.assign(element, { [key]: value });
  }
  append(element, children);
  return element;
}));

export const render = <T extends Element>(element: T, ...children: readonly Child[]): T => Effect.runSync(Effect.sync(() => {
  element.replaceChildren();
  append(element, children);
  return element;
}));
export const $ = (selector: string, root: ParentNode = document): Element | null => root.querySelector(selector);
export const requireElement = (id: string): HTMLElement => {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Missing element #${id}`);
  return element;
};
export const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);
const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS: Readonly<Record<string, string>> = {
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  attach: 'M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  check_circle: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  computer: 'M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z',
  content_copy: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
  delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  error: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
  file: 'M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z',
  folder: 'M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z',
  image: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
  info: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
  more_vert: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  open_in_new: 'M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z',
  phone: 'M16 1H8C6.34 1 5 2.34 5 4v16c0 1.66 1.34 3 3 3h8c1.66 0 3-1.34 3-3V4c0-1.66-1.34-3-3-3zm-2 20h-4v-1h4v1zm3.25-3H6.75V4h10.5v14z',
  qr: 'M3 11h8V3H3v8zm2-6h4v4H5V5zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM13 3v8h8V3h-8zm6 6h-4V5h4v4zm0 10h2v2h-2zm-6-6h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2zm2 2h2v2h-2zm2-2h2v2h-2zm0-4h2v2h-2zm2 2h2v2h-2z',
  qr_scan: 'M9.5 6.5v3h-3v-3h3M11 5H5v6h6V5zm-1.5 9.5v3h-3v-3h3M11 13H5v6h6v-6zm6.5-6.5v3h-3v-3h3M19 5h-6v6h6V5zm-6 8h1.5v1.5H13V13zm1.5 1.5H16V16h-1.5v-1.5zM16 13h1.5v1.5H16V13zm-3 3h1.5v1.5H13V16zm1.5 1.5H16V19h-1.5v-1.5zM16 16h1.5v1.5H16V16zm1.5-1.5H19V16h-1.5v-1.5zm0 3H19V19h-1.5v-1.5zM22 7h-2V4h-3V2h5v5zm0 15v-5h-2v3h-3v2h5zM2 22h5v-2H4v-3H2v5zM2 2v5h2V4h3V2H2z',
  refresh: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  send: 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z',
  settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  share: 'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z',
  warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  wifi: 'M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z',
  wifi_off: 'M23.64 7c-.45-.34-4.93-4-11.64-4-1.5 0-2.89.19-4.15.48L18.18 13.8 23.64 7zm-6.6 8.22L3.27 1.44 2 2.72l2.05 2.06C1.91 5.76.59 6.82.36 7l11.63 14.49.01.01.01-.01 3.9-4.86 3.32 3.32 1.27-1.27-3.46-3.46z',
};

export const icon = (name: string, cls = ''): SVGSVGElement => Effect.runSync(Effect.sync(() => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `icon ${cls}`.trim());
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[name] ?? 'M6 2h9l5 5v15H4V2z');
  svg.append(path);
  return svg;
}));
export const iconButton = (name: string, label: string, onclick: (event: MouseEvent) => unknown): HTMLButtonElement => h('button', { class: 'icon-btn', attrs: { 'aria-label': label, title: label }, onclick }, icon(name));
export const button = (label: string, onclick: (event: MouseEvent) => unknown, variant: Variant = 'text', iconName?: string): HTMLButtonElement => h('button', { class: `btn btn--${variant}`, onclick }, iconName !== undefined && iconName !== '' && icon(iconName), h('span', { text: label }));
export const progress = (value: number | null): HTMLDivElement => {
  const bar = h('div', { class: 'progress__bar' });
  const element = h('div', { class: `progress${value === null ? ' progress--indeterminate' : ''}`, attrs: { role: 'progressbar' } }, bar);
  if (value !== null) bar.style.transform = `scaleX(${String(Math.max(0, Math.min(1, value)))})`;
  return element;
};
const snackTimer = Effect.runSync(Ref.make<ReturnType<typeof setTimeout> | undefined>(undefined));
export interface SnackbarOptions { readonly action?: string; readonly onAction?: () => void; readonly timeout?: number }
export const snackbar = (message: string, { action, onAction, timeout = 4000 }: SnackbarOptions = {}): void => {
  const element = document.getElementById('snackbar') ?? h('div', { id: 'snackbar', class: 'snackbar', attrs: { role: 'status', 'aria-live': 'polite' } });
  document.body.append(element);
  const hide = (): void => { element.classList.remove('snackbar--open'); };
  render(element, h('span', { class: 'snackbar__text', text: message }), action !== undefined && action !== '' && h('button', { class: 'btn btn--text snackbar__action', text: action, onclick: () => { hide(); onAction?.(); } }));
  element.classList.add('snackbar--open');
  clearTimeout(Effect.runSync(Ref.get(snackTimer)));
  Effect.runSync(Ref.set(snackTimer, setTimeout(hide, timeout)));
};
export interface DialogAction { readonly label: string; readonly value?: unknown; readonly variant?: Variant }
export interface DialogOptions { readonly title?: string; readonly content: Child; readonly actions?: readonly DialogAction[]; readonly dismissible?: boolean }
const dialogClosers = new WeakMap<HTMLDialogElement, (value: unknown) => void>();
export const closeDialog = (element: Element | null, value?: unknown): void => {
  const target = element?.closest('dialog');
  if (target instanceof HTMLDialogElement) dialogClosers.get(target)?.(value);
};
export const dialog = ({ title, content, actions = [{ label: 'OK', value: true }], dismissible = true }: DialogOptions): Promise<unknown> => Effect.runPromise(Effect.callback<unknown>((resume) => {
  const element = h('dialog', { class: 'dialog' });
  const close = (value: unknown): void => { element.close(); element.remove(); dialogClosers.delete(element); resume(Effect.succeed(value)); };
  dialogClosers.set(element, close);
  render(element, title !== undefined && title !== '' && h('h2', { class: 'dialog__title', text: title }), h('div', { class: 'dialog__content' }, content), actions.length > 0 && h('div', { class: 'dialog__actions' }, actions.map((action) => button(action.label, () => { close(typeof action.value === 'function' ? Reflect.apply(action.value, undefined, []) : action.value); }, action.variant ?? 'text'))));
  element.addEventListener('cancel', (event) => { event.preventDefault(); if (dismissible) close(undefined); });
  element.addEventListener('click', (event) => { if (dismissible && event.target === element) close(undefined); });
  document.body.append(element);
  element.showModal();
}));
export const textField = (label: string, { value = '', type = 'text', placeholder = ' ', ...rest }: Properties<'input'> = {}): { readonly el: HTMLLabelElement; readonly input: HTMLInputElement } => {
  const input = h('input', { class: 'text-field__input', type, value, placeholder, ...rest });
  return { el: h('label', { class: 'text-field' }, input, h('span', { class: 'text-field__label', text: label })), input };
};
export const codeBlock = (text: string): HTMLDivElement => h('div', { class: 'code' }, h('code', { text }), iconButton('content_copy', 'Copy', () => Effect.runPromise(Effect.tryPromise(() => navigator.clipboard.writeText(text)).pipe(Effect.match({ onSuccess: () => { snackbar('Copied'); }, onFailure: () => { snackbar('Copy failed – select and copy manually'); } })))));
export interface BuildInformation { readonly version?: string | null; readonly commit?: string; readonly committedAt?: string | null; readonly builtAt?: string | null }
export const buildBadge = (build: BuildInformation = {}): HTMLDivElement => {
  const format = (iso: string | null | undefined): string => {
    const date = iso == null ? undefined : new Date(iso);
    if (date === undefined || Number.isNaN(date.getTime())) return '–';
    const pad = (number: number): string => String(number).padStart(2, '0');
    return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };
  return h('div', { class: 'build-badge', attrs: { title: `Version ${build.version ?? '?'}\nCommit ${build.commit ?? '?'} (${build.committedAt ?? 'unknown'})\nBuilt ${build.builtAt ?? 'unknown'}` } }, h('div', { text: `v${build.version ?? '?'} · ${build.commit ?? 'dev'}` }), h('div', { text: `commit ${format(build.committedAt)} · built ${format(build.builtAt)}` }));
};
export const formatBytes = (number: number): string => {
  if (!Number.isFinite(number)) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  const index = number >= 1024 ** 4 ? 4 : number >= 1024 ** 3 ? 3 : number >= 1024 ** 2 ? 2 : number >= 1024 ? 1 : 0;
  const value = number / 1024 ** index;
  return `${String(value < 10 && index > 0 ? value.toFixed(1) : Math.round(value))} ${units[index]}`;
};
export const timeAgo = (timestamp: number): string => {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${String(Math.round(seconds / 60))} min ago`;
  if (seconds < 86400) return `${String(Math.round(seconds / 3600))} h ago`;
  return new Date(timestamp).toLocaleDateString();
};
export const downloadFile = (file: Blob, name = file instanceof File ? file.name : 'file'): void => {
  const url = URL.createObjectURL(file);
  const link = h('a', { href: url, download: name || 'file', style: { display: 'none' } });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => { URL.revokeObjectURL(url); }, 60000);
};
export interface WakeLockController {
  (busy: boolean): void;
  readonly dispose: () => void;
}
export const wakeLock = (): WakeLockController => {
  interface State { readonly lock: WakeLockSentinel | null; readonly want: boolean; readonly pending: boolean; readonly disposed: boolean }
  const state = Effect.runSync(Ref.make<State>({ lock: null, want: false, pending: false, disposed: false }));
  const read = (): State => Effect.runSync(Ref.get(state));
  const update = (changes: Partial<State>): void => { Effect.runSync(Ref.update(state, (current) => ({ ...current, ...changes }))); };
  const release = (sentinel: WakeLockSentinel): void => { void sentinel.release().catch(() => undefined); };
  const acquire = (): void => {
    const current = read();
    if (!current.want || current.lock !== null || current.pending || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
    update({ pending: true });
    void Effect.runPromise(Effect.tryPromise(() => navigator.wakeLock.request('screen')).pipe(Effect.match({
      onSuccess: (sentinel) => {
        update({ pending: false });
        if (!read().want) { release(sentinel); return; }
        update({ lock: sentinel });
        sentinel.addEventListener('release', () => { if (read().lock === sentinel) update({ lock: null }); }, { once: true });
      },
      onFailure: () => { update({ lock: null, pending: false }); },
    })));
  };
  document.addEventListener('visibilitychange', acquire);
  const setBusy = (busy: boolean): void => {
    if (read().disposed) return;
    update({ want: busy });
    if (busy) acquire();
    else {
      const sentinel = read().lock;
      if (sentinel !== null) { release(sentinel); update({ lock: null }); }
    }
  };
  return Object.assign(setBusy, { dispose: (): void => {
    setBusy(false);
    update({ disposed: true });
    document.removeEventListener('visibilitychange', acquire);
  } });
};
