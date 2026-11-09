import { resumeFailure } from './resumeDiagnostics.js';

// Leave time in the 30-minute Actions job for cache saving and cleanup.
export const RESUME_WORKER_BUDGET_MS = 28 * 60000;

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
