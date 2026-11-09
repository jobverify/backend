import { timingSafeEqual } from 'node:crypto';

export function hasPublishingCredential(req = {}, env = process.env) {
  const token = env.JOBVERIFY_PUBLISHING_TOKEN;
  if (typeof token !== 'string' || token.length < 32) return false;
  const authorization = req.headers?.authorization;
  if (typeof authorization !== 'string') return false;
  const actual = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isTrustedPublishingRequest(req = {}, env = process.env) {
  if (!['GET', 'HEAD'].includes(String(req.method).toUpperCase())) return false;
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  return /^\/api\/publishing\/jobs\/[a-f0-9]{24}\/?$/i.test(path) && hasPublishingCredential(req, env);
}

export function isTrustedPublicBudgetRequest(req = {}, env = process.env) {
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  return String(req.method).toUpperCase() === 'POST'
    && /^\/api\/publishing\/rate-limit\/?$/i.test(path) && hasPublishingCredential(req, env);
}

export function requirePublishingAccess(req, res, next) {
  res.set('Cache-Control', 'no-store');
  if (!process.env.JOBVERIFY_PUBLISHING_TOKEN || process.env.JOBVERIFY_PUBLISHING_TOKEN.length < 32) {
    return res.status(503).json({ success: false, message: 'Publishing connection is not configured' });
  }
  if (!isTrustedPublishingRequest(req)) return res.status(401).json({ success: false, message: 'Publishing authentication required' });
  next();
}
