export class SeoError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export async function requestProviderJson(url, options, { fetchImpl = fetch, maxBytes = 256_000, timeoutMs = 25_000 } = {}) {
  try {
    const response = await fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      await response.body?.cancel();
      throw new SeoError(502, 'provider_unavailable', 'SEO provider request failed. Check server-side credentials and provider quota.');
    }
    if (Number(response.headers.get('content-length')) > maxBytes) {
      await response.body?.cancel();
      throw new SeoError(502, 'provider_response_too_large', 'SEO provider response is too large.');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new SeoError(502, 'invalid_provider_response', 'SEO provider returned an invalid response.');
    const chunks = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          throw new SeoError(502, 'provider_response_too_large', 'SEO provider response is too large.');
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new SeoError(502, 'invalid_provider_response', 'SEO provider returned an invalid JSON response.'); }
  } catch (error) {
    if (error instanceof SeoError) throw error;
    throw new SeoError(error?.name === 'TimeoutError' ? 504 : 502, 'provider_unavailable', 'SEO provider is unavailable or timed out. Please try again.');
  }
}
