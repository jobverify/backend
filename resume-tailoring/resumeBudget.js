import { resumeFailure } from './resumeDiagnostics.js';

// Leave time in the 30-minute Actions job for cache saving and cleanup.
export const RESUME_WORKER_BUDGET_MS = 28 * 60000;

// Estimate CPU retry cost from this request's measured prefill/decode rates.
// Conservative defaults also cover failures before the runtime returns usage.
export function estimateResumeRepairMs({ inputCharacters, outputTokens, usage = {} }) {
  const rate = (tokens, milliseconds, fallback) => Number.isFinite(tokens) && tokens > 0
    && Number.isFinite(milliseconds) && milliseconds > 0 ? Math.min(fallback, tokens * 1000 / milliseconds) : fallback;
  const prefillRate = rate(usage.inputTokens, usage.promptMilliseconds, 15);
  const decodeRate = rate(usage.outputTokens, usage.outputMilliseconds, 3);
  return Math.ceil(1.2 * (Math.ceil(inputCharacters / 3) / prefillRate + outputTokens / decodeRate) * 1000 + 15000);
}

export function resumeWorkerDeadline(startedAt, now = Date.now()) {
  const started = Date.parse(startedAt || '');
  return Math.min(Number.isFinite(started) ? started : now, now) + RESUME_WORKER_BUDGET_MS;
}

export function remainingBudget(deadline, maximum) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw resumeFailure('time_limit', { statusCode: 504 });
  return Math.max(1, Math.floor(Math.min(remaining, maximum)));
}

export async function withinResumeBudget(deadline, operation) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(resumeFailure('time_limit', { statusCode: 504 })),
    remainingBudget(deadline, 2147483647));
  let abort;
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      new Promise((_, reject) => {
        abort = () => reject(controller.signal.reason);
        controller.signal.addEventListener('abort', abort, { once: true });
      }),
    ]);
  } finally {
    clearTimeout(timeout);
    controller.signal.removeEventListener('abort', abort);
  }
}
