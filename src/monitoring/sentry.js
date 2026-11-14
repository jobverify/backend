import * as Sentry from '@sentry/node';
import { sanitizeErrorEvent } from './errorEvents.js';

const enabled = Boolean(process.env.SENTRY_DSN);
if (enabled) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE,
    defaultIntegrations: false,
    integrations: [
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration({ mode: 'strict' }),
      Sentry.captureConsoleIntegration({ levels: ['error'] }),
    ],
    attachStacktrace: true,
    sendClientReports: false,
    tracesSampleRate: 0,
    maxBreadcrumbs: 0,
    dataCollection: {
      userInfo: false, cookies: false, httpHeaders: false, httpBodies: [],
      urlQueryParams: false, genAI: { inputs: false, outputs: false },
      databaseQueryData: false, stackFrameVariables: false, frameContextLines: 0,
      graphQL: { document: false, variables: false },
    },
    beforeSend: sanitizeErrorEvent,
  });
}

export function captureServerError(error) {
  if (!enabled) return;
  try { Sentry.captureException(error); } catch { /* Keep normal error handling available. */ }
}

export function captureLoginFailure(method) {
  if (!enabled) return;
  try {
    Sentry.captureMessage('Authentication attempt rejected', {
      level: 'warning', tags: { security_event: 'auth.login_failed', auth_method: method },
    });
  } catch { /* Never turn a rejected login into a server error. */ }
}

export async function flushMonitoring(timeoutMs = 2000) {
  if (!enabled) return true;
  try { return await Sentry.flush(timeoutMs); } catch { return false; }
}

