import { hasPublishingCredential } from '../utils/publishingAccess.js';
import { MongoRateLimitStore } from '../utils/mongoRateLimitStore.js';

const policies = new Map([
  ['public-job', { limit: 120, store: new MongoRateLimitStore({ prefix: 'frontend-public-job', windowMs: 60_000 }) }],
  ['sitemap', { limit: 10, store: new MongoRateLimitStore({ prefix: 'frontend-sitemap', windowMs: 60_000 }) }],
]);

// This is a server-to-server operation. Only fixed policies and HMAC client
// identifiers are accepted; browser claims cannot select quotas or authority.
export async function consumePublicBudget(req, res) {
  res.set('Cache-Control', 'no-store');
  if (typeof process.env.JOBVERIFY_PUBLISHING_TOKEN !== 'string' || process.env.JOBVERIFY_PUBLISHING_TOKEN.length < 32) {
    return res.status(503).json({ success: false, message: 'Publishing connection is not configured.' });
  }
  if (!hasPublishingCredential(req)) return res.status(401).json({ success: false, message: 'Publishing authentication required.' });
  const body = req.body;
  if (!body || Array.isArray(body) || Object.keys(body).length !== 2
    || typeof body.policy !== 'string' || !policies.has(body.policy)
    || typeof body.clientKey !== 'string' || !/^[a-f0-9]{64}$/.test(body.clientKey)) {
    return res.status(400).json({ success: false, message: 'Invalid public request budget.' });
  }
  try {
    const policy = policies.get(body.policy);
    const { totalHits, resetTime } = await policy.store.increment(body.clientKey);
    res.set('X-Jobverify-Budget', '1');
    if (totalHits > policy.limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))));
      return res.status(429).json({ success: false, error: 'rate_limited' });
    }
    return res.status(200).json({ success: true, data: { allowed: true } });
  } catch {
    res.set('Retry-After', '60');
    return res.status(503).json({ success: false, message: 'Public request budgets are temporarily unavailable.' });
  }
}
