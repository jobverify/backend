import { createHash, timingSafeEqual } from 'node:crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { findIndexedPages } from './indexedPages.js';
import { auditPage } from './pageAudit.js';
import { SeoError } from './providerHttp.js';

export function createSeoToolsRouter({ env = process.env, findPages = findIndexedPages, audit = auditPage, requestLimit = 30 } = {}) {
  const router = express.Router();
  let active = 0;
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('X-Robots-Tag', 'noindex'); next(); });
  router.use((req, res, next) => {
    const expected = String(env.SEO_TOOLS_TOKEN || '').trim();
    if (expected.length < 32) return res.status(503).json({ success: false, code: 'tools_not_configured', message: 'Configure SEO_TOOLS_TOKEN with at least 32 random characters on the API server.' });
    const header = String(req.headers.authorization || '');
    const received = /^Bearer [^\s]{1,512}$/i.test(header) ? header.slice(7) : '';
    const digest = value => createHash('sha256').update(value).digest();
    if (!received || !timingSafeEqual(digest(received), digest(expected))) {
      res.set('WWW-Authenticate', 'Bearer');
      return res.status(401).json({ success: false, code: 'unauthorized', message: 'A valid SEO tools token is required.' });
    }
    next();
  });
  // This scoped credential has one shared paid-request budget per process,
  // independent of ENABLE_RATE_LIMITING and of spoofed forwarding headers.
  router.use(rateLimit({ windowMs: 15 * 60_000, limit: requestLimit, keyGenerator: () => 'seo-tools', standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ success: false, code: 'rate_limited', message: 'SEO tools request budget exceeded. Try again after the Retry-After interval.' }),
  }));
  router.use(express.json({ limit: '32kb', strict: true }));
  const run = operation => async (req, res) => {
    if (active >= 2) {
      res.set('Retry-After', '2');
      return res.status(429).json({ success: false, code: 'busy', message: 'Two SEO provider requests are already running. Please retry shortly.' });
    }
    active++;
    try { return res.json({ success: true, data: await operation(req.body, { env }) }); }
    catch (error) {
      return res.status(error instanceof SeoError ? error.status : 500).json({ success: false,
        code: error instanceof SeoError ? error.code : 'tools_failed', message: error instanceof SeoError ? error.message : 'Unable to complete the SEO request.' });
    } finally { active--; }
  };
  router.post('/indexed-pages', run(findPages));
  router.post('/audit', run(audit));
  router.use((_req, res) => res.status(404).json({ success: false, message: 'SEO route not found.' }));
  router.use((error, _req, res, next) => {
    if (error.type === 'entity.too.large') return res.status(413).json({ success: false, message: 'SEO snapshots must fit within 32 KB.' });
    if (error instanceof SyntaxError) return res.status(400).json({ success: false, message: 'A valid JSON object is required.' });
    next(error);
  });
  return router;
}
