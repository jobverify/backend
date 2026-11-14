const ERROR_TYPES = new Set(['Error', 'TypeError', 'SyntaxError', 'RangeError', 'ReferenceError', 'URIError', 'EvalError', 'APIError', 'ValidationError', 'CastError', 'MongoServerError', 'MongoNetworkError', 'MongoServerSelectionError', 'AbortError', 'TimeoutError']);
const LEVELS = new Set(['fatal', 'error', 'warning', 'info', 'debug']);
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9_.$<>[\] /-]{1,160}$/.test(value);
const label = value => typeof value === 'string' && /^[A-Za-z0-9._@/-]{1,128}$/.test(value);

function safeFilename(value) {
  if (typeof value !== 'string') return undefined;
  try {
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      if (url.username || url.password || !/\.[cm]?[jt]sx?$/i.test(url.pathname)) return undefined;
      url.search = '';
      url.hash = '';
      return url.toString();
    }
    const normalized = value.replaceAll('\\', '/').split(/[?#]/, 1)[0];
    const relative = normalized.match(/(?:^|\/)((?:src|node_modules)\/[^:]*\.[cm]?[jt]sx?)$/)?.[1];
    const filename = relative || normalized.split('/').at(-1);
    return /^[A-Za-z0-9_./@-]+\.[cm]?[jt]sx?$/.test(filename || '') ? filename : undefined;
  } catch {
    return undefined;
  }
}

// Rebuild an allowlisted event: never copy messages, request data, source lines,
// locals, breadcrumbs, arbitrary tags, user records, attachments or contexts.
export function sanitizeErrorEvent(event) {
  const result = {
    level: LEVELS.has(event.level) ? event.level : 'error',
    platform: event.platform === 'node' ? 'node' : 'javascript',
  };
  if (/^[a-f0-9]{32}$/i.test(event.event_id || '')) result.event_id = event.event_id;
  if (Number.isFinite(event.timestamp)) result.timestamp = event.timestamp;
  // The SDK attaches these before beforeSend; keep only source-map identifiers.
  if (Array.isArray(event.debug_meta?.images)) {
    const images = [];
    for (const image of event.debug_meta.images.slice(0, 100)) {
      if (!image || image.type !== 'sourcemap'
        || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(image.debug_id || '')) continue;
      const filename = safeFilename(image.code_file);
      if (filename) images.push({ type: 'sourcemap', code_file: filename, debug_id: image.debug_id });
    }
    if (images.length) result.debug_meta = { images };
  }
  for (const key of ['release', 'environment']) if (label(event[key])) result[key] = event[key];
  const values = event.exception?.values;
  if (!Array.isArray(values) || values.length === 0) result.message = 'Application error (details removed for privacy)';
  if (Array.isArray(values)) {
    result.exception = { values: values.slice(0, 5).map(error => ({
      type: ERROR_TYPES.has(error.type) ? error.type : 'Error',
      value: 'Application error (details removed for privacy)',
      stacktrace: { frames: (Array.isArray(error.stacktrace?.frames) ? error.stacktrace.frames : []).slice(-60).map(frame => {
        const safe = {};
        const filename = safeFilename(frame.filename);
        if (filename) safe.filename = filename;
        if (identifier(frame.function)) safe.function = frame.function;
        for (const key of ['lineno', 'colno']) if (Number.isInteger(frame[key]) && frame[key] > 0) safe[key] = frame[key];
        if (typeof frame.in_app === 'boolean') safe.in_app = frame.in_app;
        return safe;
      }) },
    })) };
  }
  if (event.tags?.security_event === 'auth.login_failed') {
    result.message = 'Authentication attempt rejected';
    result.fingerprint = ['auth.login_failed'];
    result.tags = { security_event: 'auth.login_failed',
      auth_method: event.tags.auth_method === 'google' ? 'google' : 'password' };
  }
  return result;
}

export function observeLoginFailures(report) {
  return (req, res, next) => {
    if (req.method === 'POST' && ['/login', '/google'].includes(req.path)) {
      const authMethod = req.path === '/google' ? 'google' : 'password';
      res.once('finish', () => {
        if (![400, 401, 403, 429].includes(res.statusCode)) return;
        try { report(authMethod); } catch { /* Monitoring must not affect sign-in. */ }
      });
    }
    next();
  };
}

