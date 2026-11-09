import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

export function requestDiagnostics(req, res, next) {
  const started = performance.now();
  req.requestId = randomUUID();
  res.locals ||= {};
  res.locals.requestId = req.requestId;
  res.set('X-Request-ID', req.requestId);
  res.once('finish', () => {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: 'http_request', requestId: req.requestId,
      method: req.method, route: typeof req.route?.path === 'string' ? req.route.path : 'unmatched',
      statusCode: res.statusCode, durationMs: Math.round((performance.now() - started) * 100) / 100,
    }));
  });
  next();
}
