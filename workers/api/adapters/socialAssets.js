// The Cloudflare Node HTTP bridge removes Content-Length on streamed bodies.
// A FixedLengthStream restores the protocol length without buffering the movie.
export function restoreSocialAssetLength(response, ctx) {
  const value = response.headers.get('x-jobverify-asset-length');
  if (value === null) return response;
  const headers = new Headers(response.headers); headers.delete('x-jobverify-asset-length');
  const length = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(length) || length <= 0 || length > 16 * 1024 ** 2) throw new Error('Invalid social asset stream length.');
  headers.set('Content-Length', value); headers.delete('Transfer-Encoding');
  if (!response.body) return new Response(null, { status: response.status, statusText: response.statusText, headers });
  const fixed = new globalThis.FixedLengthStream(length);
  const pump = response.body.pipeTo(fixed.writable);
  ctx.waitUntil(pump.catch(() => {}));
  return new Response(fixed.readable, { status: response.status, statusText: response.statusText, headers });
}
