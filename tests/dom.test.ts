// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { $, buildBadge, button, closeDialog, codeBlock, dialog, downloadFile, errorMessage, formatBytes, h, icon, iconButton, progress, render, requireElement, snackbar, textField, timeAgo, wakeLock } from '../public/lib/dom.js';

beforeEach(() => { document.body.replaceChildren(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('constructs typed elements and nested children without HTML sinks', () => {
  const click = vi.fn();
  const element = h('button', { id: 'test', class: 'test', text: 'title', disabled: false, style: { color: 'red' }, attrs: { role: 'button', hidden: true, ignored: false, missing: null, unset: undefined, tabindex: 0 }, onclick: click }, ['body', [null, false, undefined, 4, h('span', null, 'nested')]]);
  document.body.append(element);
  element.click();
  expect(click).toHaveBeenCalledOnce();
  expect(element.textContent).toBe('titlebody4nested');
  expect(element.getAttribute('hidden')).toBe('');
  expect(element.hasAttribute('ignored')).toBe(false);
  expect(element.style.color).toBe('red');
  expect($('#test')).toBe(element);
  expect($('span', element)?.textContent).toBe('nested');
  expect(requireElement('test')).toBe(element);
  expect(() => requireElement('missing')).toThrow('Missing element');
  expect(render(element, 'replacement')).toBe(element);
  expect(element.textContent).toBe('replacement');
  expect(h('div').childNodes).toHaveLength(0);
  expect(errorMessage(new Error('broken'))).toBe('broken');
  expect(errorMessage('value')).toBe('value');
});

it('renders icons, buttons, bounded progress and fields', () => {
  expect(icon('file').querySelector('path')?.getAttribute('d')).toContain('M6 2');
  expect(icon('missing', 'custom').getAttribute('class')).toBe('icon custom');
  expect(button('Send', vi.fn()).textContent).toBe('Send');
  expect(button('Send', vi.fn(), 'contained', 'send').querySelector('svg')).not.toBeNull();
  expect(button('Send', vi.fn(), 'text', '').querySelector('svg')).toBeNull();
  expect(iconButton('close', 'Close', vi.fn()).getAttribute('aria-label')).toBe('Close');
  expect(progress(null).className).toContain('indeterminate');
  expect(progress(-1).firstElementChild?.getAttribute('style')).toContain('scaleX(0)');
  expect(progress(2).firstElementChild?.getAttribute('style')).toContain('scaleX(1)');
  expect(textField('Name').input.value).toBe('');
  expect(textField('Name', { value: 'Alice', type: 'search', placeholder: 'Name', maxLength: 10 }).input.maxLength).toBe(10);
});

it('shows and dismisses snackbars through timers and optional actions', () => {
  snackbar('First');
  const element = requireElement('snackbar');
  expect(element.textContent).toBe('First');
  vi.advanceTimersByTime(4000);
  expect(element.classList.contains('snackbar--open')).toBe(false);
  const onAction = vi.fn();
  snackbar('Second', { action: 'Undo', onAction, timeout: 100 });
  element.querySelector('button')?.click();
  expect(onAction).toHaveBeenCalledOnce();
  snackbar('Third', { action: 'Close' });
  element.querySelector('button')?.click();
  snackbar('Fourth', { action: '' });
  expect(element.querySelector('button')).toBeNull();
});

it('resolves modal actions and direct closure', async () => {
  const defaultDialog = dialog({ content: 'Hello' });
  document.querySelector('dialog button')?.dispatchEvent(new MouseEvent('click'));
  expect(await defaultDialog).toBe(true);
  const functional = dialog({ title: 'Edit', content: h('input'), actions: [{ label: 'Save', value: () => 'name', variant: 'contained' }] });
  document.querySelector('dialog button')?.dispatchEvent(new MouseEvent('click'));
  expect(await functional).toBe('name');
  const programmatic = dialog({ content: 'Working', actions: [], dismissible: false });
  const element = document.querySelector('dialog');
  expect(element).not.toBeNull();
  element?.dispatchEvent(new Event('cancel', { cancelable: true }));
  element?.dispatchEvent(new MouseEvent('click'));
  expect(document.querySelector('dialog')).toBe(element);
  closeDialog(element, 'done');
  expect(await programmatic).toBe('done');
  closeDialog(element);
  closeDialog(null);
  closeDialog(h('div'));
});

it('dismisses modals via backdrop and cancel while retaining content clicks', async () => {
  const cancelled = dialog({ title: '', content: h('p', { id: 'inside' }, 'body') });
  requireElement('inside').click();
  expect(document.querySelector('dialog')).not.toBeNull();
  document.querySelector('dialog')?.dispatchEvent(new Event('cancel', { cancelable: true }));
  expect(await cancelled).toBeUndefined();
  const backdrop = dialog({ content: 'body' });
  document.querySelector('dialog')?.click();
  expect(await backdrop).toBeUndefined();
});

it('copies code with success and failure feedback', async () => {
  const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  const block = codeBlock('hello');
  block.querySelector('button')?.click();
  await vi.waitFor(() => { expect(requireElement('snackbar').textContent).toBe('Copied'); });
  expect(writeText).toHaveBeenCalledWith('hello');
  writeText.mockRejectedValue(new Error('denied'));
  block.querySelector('button')?.click();
  await vi.waitFor(() => { expect(requireElement('snackbar').textContent).toContain('Copy failed'); });
});

it('formats build dates, file sizes and relative timestamps', () => {
  expect(buildBadge().textContent).toContain('v? · dev');
  expect(buildBadge({ version: '1', commit: 'abc', committedAt: 'invalid', builtAt: null }).textContent).toContain('commit – · built –');
  expect(buildBadge({ version: '1', commit: 'abc', committedAt: '2026-10-27T10:03:00Z', builtAt: '2026-10-27T12:04:00Z' }).textContent).toContain('2026-10-27');
  expect(formatBytes(Number.NaN)).toBe('');
  expect(formatBytes(10)).toBe('10 B');
  expect(formatBytes(1024)).toBe('1.0 KB');
  expect(formatBytes(1024 ** 2)).toBe('1.0 MB');
  expect(formatBytes(1024 ** 3)).toBe('1.0 GB');
  expect(formatBytes(1024 * 11)).toBe('11 KB');
  expect(formatBytes(1024 ** 5)).toBe('1024 TB');
  expect(timeAgo(Date.now())).toBe('just now');
  expect(timeAgo(Date.now() - 120_000)).toBe('2 min ago');
  expect(timeAgo(Date.now() - 7_200_000)).toBe('2 h ago');
  const yesterday = Date.now() - 86_400_000;
  expect(timeAgo(yesterday)).toBe(new Date(yesterday).toLocaleDateString());
});

it('downloads named files and anonymous blobs with deferred URL revocation', () => {
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue();
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  downloadFile(new File(['bytes'], 'name.txt'));
  downloadFile(new Blob(['bytes']));
  downloadFile(new Blob(), '');
  expect(create).toHaveBeenCalledTimes(3);
  expect(click).toHaveBeenCalledTimes(3);
  expect(document.querySelector('a')).toBeNull();
  vi.advanceTimersByTime(60000);
  expect(revoke).toHaveBeenCalledTimes(3);
});

describe('screen wake locks', () => {
  it('acquires, reacquires and releases through visibility and browser events', async () => {
    const release = vi.fn(() => Promise.reject(new Error('denied')));
    const sentinel: WakeLockSentinel = Object.assign(new EventTarget(), { released: false, type: 'screen' as const, onrelease: null, release });
    const request = vi.fn(() => Promise.resolve(sentinel));
    vi.stubGlobal('navigator', { wakeLock: { request } });
    const visible = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const setBusy = wakeLock();
    setBusy(false);
    setBusy(true);
    await vi.waitFor(() => { expect(request).toHaveBeenCalledOnce(); });
    setBusy(true);
    expect(request).toHaveBeenCalledOnce();
    sentinel.dispatchEvent(new Event('release'));
    visible.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(request).toHaveBeenCalledOnce();
    visible.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => { expect(request).toHaveBeenCalledTimes(2); });
    setBusy(false);
    expect(release).toHaveBeenCalledOnce();
    request.mockRejectedValue(new Error('denied'));
    setBusy(true);
    await vi.waitFor(() => { expect(request).toHaveBeenCalledTimes(3); });
    setBusy(false);
    vi.stubGlobal('navigator', {});
    setBusy(true);
    setBusy(false);
  });
});
