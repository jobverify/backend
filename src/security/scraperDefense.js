// A user-agent policy is a deterrent, not authentication. Public content can
// still be copied by clients that change their user-agent.
const TRAINING_CRAWLER = /(?:^|[\s/;(])(?:GPTBot|ClaudeBot|anthropic-ai|CCBot|Bytespider|Google-Extended|cohere-ai|Diffbot|meta-externalagent)(?:$|[\s/;)])/i;

export function createCrawlerPolicyGuard() {
  return (req, res, next) => {
    res.set('Link', '</api/_canary/0>; rel="jv-canary"');
    if (TRAINING_CRAWLER.test(String(req.headers?.['user-agent'] || ''))) {
      res.set('Cache-Control', 'no-store');
      return res.status(403).json({ success: false, message: 'Automated collection is restricted.' });
    }
    next();
  };
}

export function createCanaryHandler({ now = Date.now, limit = 20, windowMs = 60_000 } = {}) {
  // A separate, process-wide budget is deliberate: no spoofable IP headers,
  // unbounded key maps, timers, downstream requests or database work.
  let resetAt = 0;
  let requests = 0;
  return (req, res) => {
    const time = now();
    if (time >= resetAt) { resetAt = time + windowMs; requests = 0; }
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    if (++requests > limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((resetAt - time) / 1000))));
      return res.status(429).json({ success: false, message: 'Request budget exceeded.' });
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.set('Allow', 'GET, HEAD');
      return res.status(405).json({ success: false, message: 'Method not allowed.' });
    }
    const path = req.path === '/' ? '/0' : req.path;
    if (!/^\/[0-3]\/?$/.test(path)) {
      return res.status(400).json({ success: false, message: 'Invalid catalog page.' });
    }
    const step = Number(path.split('/')[1]);
    res.status(step === 3 ? 410 : 200);
    if (req.method === 'HEAD') return res.end();
    return res.json({ synthetic: true, catalog: `archive-${step}`, entries: [], next: step === 3 ? null : `/api/_canary/${step + 1}` });
  };
}
