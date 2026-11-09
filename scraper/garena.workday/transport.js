import { HOME, PORTAL, BOARD } from './parser.js';
export const MAX_BYTES = 2 * 1024 * 1024;
export const TIMEOUT_MS = 20000;
export function validateURL(value) {
  let url; try { url = new URL(value); } catch { throw Error('Invalid Garena URL'); }
  if (url.href !== value || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw Error('Unapproved Garena URL');
  const native = url.origin === new URL(HOME).origin && url.pathname === '/'
    || url.origin === new URL(PORTAL).origin && /^\/global\/?$/.test(url.pathname)
    || url.origin === new URL(BOARD).origin && /^\/global\/careers(?:\/J\d{8})?\/?$/.test(url.pathname);
  if (!native) throw Error('Unapproved Garena read path');
  return url;
}
export function redirectURL(current, location) {
  if (typeof location !== 'string' || !location.trim() || location !== location.trim() || /[\\\r\n\t]/.test(location)) throw Error('Invalid Garena redirect');
  const from = validateURL(current), target = validateURL(new URL(location, from).href);
  if (from.origin !== target.origin || from.pathname.replace(/\/$/, '') !== target.pathname.replace(/\/$/, '')) throw Error('Garena redirect changes source or role identity');
  return target.href;
}
export function createNativeTransport({ fetchImpl = globalThis.fetch, signal, timeoutMs = TIMEOUT_MS } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > TIMEOUT_MS) throw Error('Invalid Garena timeout');
  return async value => {
    validateURL(value);
    const controller = new AbortController(), abort = () => controller.abort(signal.reason);
    signal?.throwIfAborted(); signal?.addEventListener('abort', abort, { once: true });
    let reader, timer;
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => { const error = Object.assign(Error('Garena GET stream timeout'), { name: 'TimeoutError', code: 'ETIMEDOUT' }); controller.abort(error); reject(error); }, timeoutMs); });
    const task = (async () => {
      const response = await fetchImpl(value, { method: 'GET', credentials: 'omit', redirect: 'manual', headers: { Accept: 'text/html' }, signal: controller.signal });
      controller.signal.throwIfAborted();
      if (response.url !== value || !Number.isInteger(response.status) || typeof response.headers?.entries !== 'function' || response.body !== null && typeof response.body?.getReader !== 'function') throw Error('Invalid Garena manual streaming response');
      const headers = Object.fromEntries(response.headers.entries()), length = headers['content-length'];
      if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) throw Error('Garena advertised body limit');
      if (response.body === null) {
        if (length !== undefined && Number(length) !== 0) throw Error('Incomplete empty Garena response');
        return { url: response.url, status: response.status, headers, body: Buffer.alloc(0), bodyComplete: true };
      }
      reader = response.body.getReader(); const chunks = []; let bytes = 0;
      for (;;) { controller.signal.throwIfAborted(); const part = await reader.read(); controller.signal.throwIfAborted(); if (part.done) break; if (!(part.value instanceof Uint8Array)) throw Error('Invalid response chunk'); bytes += part.value.byteLength; if (bytes > MAX_BYTES) throw Object.assign(Error('Garena 2MiB body limit'), { code: 'GARENA_BODY_LIMIT' }); chunks.push(Buffer.from(part.value)); }
      return { url: response.url, status: response.status, headers, body: Buffer.concat(chunks, bytes), bodyComplete: true };
    })();
    try { return await Promise.race([task, deadline]); }
    catch (error) { controller.abort(error); try { Promise.resolve(reader?.cancel(error)).catch(() => {}); } catch {} throw error; }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  };
}
