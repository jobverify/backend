// Bounded per-process cache for public summaries only. Keep browser/CDN caching
// disabled: settings partitions must never share a response outside this process.
export function createPublicResponseCache({ ttlMs = 30_000, maxEntries = 128, now = Date.now } = {}) {
  const entries = new Map();
  return (key, load) => {
    const existing = entries.get(key);
    if (existing && (existing.pending || existing.expiresAt > now())) return existing.promise;
    if (existing) entries.delete(key);
    if (entries.size >= maxEntries) {
      const victim = [...entries].find(([, entry]) => !entry.pending);
      if (victim) entries.delete(victim[0]);
      else return Promise.resolve().then(load);
    }
    const entry = { pending: true, expiresAt: 0 };
    entry.promise = Promise.resolve().then(load).then(value => {
      entry.pending = false;
      entry.expiresAt = now() + ttlMs;
      if (value == null) entries.delete(key);
      return value;
    }, error => {
      entries.delete(key);
      throw error;
    });
    entries.set(key, entry);
    return entry.promise;
  };
}
