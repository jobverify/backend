import https from 'node:https';

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

// Certificate authentication, origin restrictions and resource bounds apply to
// every hop. HTML branding cannot substitute for authenticated transport.
export const fetchVerifiedHttpsPage = async (url, {
  allowedOrigins, request = https.request, signal, headers = {},
  timeoutMs = 15000, maxBytes = 8 * 1024 * 1024, maxRedirects = 5,
} = {}) => {
  const origins = new Set(allowedOrigins);
  const deadline = Date.now() + timeoutMs;
  let target = new URL(url);
  for (let hop = 0; ; hop++) {
    if (target.protocol !== 'https:' || target.username || target.password || !origins.has(target.origin)) {
      throw new Error('Refusing HTTPS request outside the verified origins');
    }
    signal?.throwIfAborted();
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('HTTPS request deadline exceeded');
    const page = await new Promise((resolve, reject) => {
      let handle;
      let incoming;
      let settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        if (error) reject(error); else resolve(value);
      };
      const stop = error => {
        finish(error);
        handle?.destroy?.(error);
        incoming?.destroy?.();
      };
      const abort = () => stop(signal.reason || new Error('HTTPS request aborted'));
      const timer = setTimeout(() => stop(new Error('HTTPS request deadline exceeded')), remaining);
      signal?.addEventListener('abort', abort, { once: true });
      try {
        handle = request(target.toString(), { method: 'GET', headers, rejectUnauthorized: true }, response => {
          incoming = response;
          response.on('error', error => stop(error));
          response.on('aborted', () => stop(new Error('HTTPS response aborted')));
          const status = Number(response.statusCode ?? 0);
          const location = response.headers?.location;
          if (REDIRECTS.has(status) && location) {
            finish(null, { redirect: location });
            // Do not drain a potentially unbounded redirect body.
            response.destroy?.();
            return;
          }
          if (Number(response.headers?.['content-length']) > maxBytes) {
            stop(new Error('HTTPS response exceeds the byte limit'));
            return;
          }
          const chunks = [];
          let bytes = 0;
          response.on('data', chunk => {
            if (settled) return;
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            bytes += buffer.length;
            if (bytes > maxBytes) { stop(new Error('HTTPS response exceeds the byte limit')); return; }
            chunks.push(buffer);
          });
          response.on('end', () => finish(null, { status, url: target.toString(), headers: response.headers,
            html: Buffer.concat(chunks).toString('utf8') }));
          response.on('close', () => { if (!settled) stop(new Error('HTTPS response closed before completion')); });
        });
        handle.on('error', error => finish(error));
        handle.end();
      } catch (error) { stop(error); }
    });
    if (!page.redirect) return page;
    if (hop >= maxRedirects) throw new Error('HTTPS redirect limit exceeded');
    target = new URL(page.redirect, target);
  }
};
