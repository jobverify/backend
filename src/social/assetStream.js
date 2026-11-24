import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { socialError } from './policy.js';

export function socialAssetStore(req) {
  const store = req.app.locals.socialAssets;
  if (!store?.get || !store?.put) throw socialError('Social asset storage is not configured.', 503);
  return store;
}
function byteRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value || '');
  if (!match || (!match[1] && !match[2])) return null;
  let start; let end;
  if (!match[1]) { const suffix = Number(match[2]); if (!Number.isSafeInteger(suffix) || suffix <= 0) return null; start = Math.max(0, size - suffix); end = size - 1; }
  else { start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1; }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return null;
  end = Math.min(end, size - 1); return { offset: start, length: end - start + 1 };
}
export async function streamSocialAsset(req, res, asset, immutable = false) {
  res.set('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'private, no-store');
  if (!asset?.key || !asset.size) return res.status(404).end();
  const etag = `"${asset.hash}"`; const requested = req.get('range');
  const wantsRange = requested && (!req.get('if-range') || req.get('if-range') === etag);
  const range = wantsRange ? byteRange(requested, asset.size) : undefined;
  if (wantsRange && !range) return res.status(416).set('Content-Range', `bytes */${asset.size}`).end();
  const store = socialAssetStore(req);
  const stored = req.method === 'HEAD' && store.head ? await store.head(asset.key) : await store.get(asset.key, range ? { range } : undefined);
  if (!stored) return res.status(404).set('Cache-Control', 'no-store').end();
  res.set({ 'Content-Type': asset.type, 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes', ETag: etag, 'Content-Length': String(range?.length ?? asset.size) });
  if (req.app.locals.socialAssetBridge) res.set('X-Jobverify-Asset-Length', String(range?.length ?? asset.size));
  if (range) res.status(206).set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${asset.size}`);
  if (req.method === 'HEAD') { await stored.body?.cancel?.(); return res.end(); }
  // R2's native stream is consumed incrementally. Never call arrayBuffer on a
  // movie: that would materialize the whole response inside the Worker bridge.
  if (!stored.body) throw socialError('Social asset stream is unavailable.', 503);
  const source = typeof stored.body.getReader === 'function' ? Readable.fromWeb(stored.body) : stored.body;
  try { await pipeline(source, res); }
  catch (error) { if (!res.destroyed) res.destroy(error); }
}
