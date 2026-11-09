/** Failure details cross into downloadable artifacts: allowlist, redact, then bound. */
export const redactRewriteDiagnostic = (value, { limit = 384, sourceTexts = [] } = {}) => {
  if (typeof value !== 'string') return undefined;
  let text = value;
  for (const [key, secret] of Object.entries(process.env)) {
    if (/TOKEN|SECRET|PASSWORD|MONGO_URI|API_KEY|CREDENTIAL|CONNECTION_STRING/i.test(key) && secret?.length >= 6) {
      text = text.split(secret).join('[redacted]');
    }
  }
  for (const source of sourceTexts) if (typeof source === 'string' && source.length >= 8) text = text.split(source).join('[source redacted]');
  return text.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '')
    .replace(/(?:mongodb(?:\+srv)?|https?):\/\/[^\s"'<>]+/gi, '[url redacted]')
    .replace(/(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)/g, '[token redacted]')
    .replace(/\b(?:authorization\s*:\s*)?(?:Bearer|Basic)\s+[^\s,;]+/gi, '[authorization redacted]')
    .replace(/\b(?:password|secret|token|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '[credential redacted]')
    .replace(/"[^"\r\n]*"|'[^'\r\n]*'|`[^`\r\n]*`/g, '[quoted text redacted]')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').slice(0, limit);
};

export const captureRewriteError = (error, context = {}, depth = 0, seen = new Set()) => {
  if (!error || typeof error !== 'object' || seen.has(error) || depth > 2) return undefined;
  seen.add(error);
  const identifier = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(value) ? value : undefined;
  const name = identifier(error.name) || 'Error';
  // V8 JSON errors embed response excerpts whose nested quotes cannot be safely
  // removed by pairing quotes. Keep the type/position, never the parser excerpt.
  const position = typeof error.message === 'string' ? error.message.match(/\bat position (\d{1,10})\b/)?.[1] : undefined;
  const message = name === 'SyntaxError' ? `Syntax error${position ? ' at position ' + position : ''}; response excerpt omitted`
    : redactRewriteDiagnostic(error.message, context);
  const header = `${error.name || 'Error'}${error.message ? ': ' + error.message : ''}`;
  const stack = typeof error.stack === 'string' ? error.stack.startsWith(header) ? error.stack.slice(header.length)
    : error.stack.slice(error.stack.indexOf('\n') + 1) : '';
  // Rebuild the header; never retain multiline error text disguised as a stack.
  const frames = stack.split(/\r?\n/).filter(line => /^\s+at\s+/.test(line)).slice(0, 8)
    .map(line => redactRewriteDiagnostic(line, { ...context, limit: 320 })).join('\n');
  const phase = context.phase ?? error.phase;
  const sourceOffset = context.sourceOffset ?? error.sourceOffset;
  const httpStatus = context.httpStatus ?? error.httpStatus;
  const route = context.route ?? error.route;
  const cause = captureRewriteError(error.cause, { sourceTexts: context.sourceTexts }, depth + 1, seen);
  return { name, ...(message && { message }), ...(identifier(error.code) && { code: error.code }),
    ...(frames && { stack: `${name}${message ? ': ' + message : ''}\n${frames}`.slice(0, 2048) }),
    ...(typeof phase === 'string' && /^[a-z_]{1,48}$/.test(phase) && { phase }),
    ...(Number.isSafeInteger(sourceOffset) && sourceOffset >= 0 && { sourceOffset }),
    ...(Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599 && { httpStatus }),
    ...(['/apply-template', '/tokenize', '/v1/chat/completions'].includes(route) && { route }),
    ...(typeof error.workerSignal === 'string' && /^SIG[A-Z0-9]{1,20}$/.test(error.workerSignal) && { workerSignal: error.workerSignal }),
    ...(Number.isInteger(error.workerExitCode) && { workerExitCode: error.workerExitCode }),
    ...(['process_exit', 'spawn_error', 'connection_refused', 'generation_probe'].includes(error.workerFailure) && { workerFailure: error.workerFailure }),
    ...(cause && { cause }) };
};
