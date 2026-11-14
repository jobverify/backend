// Keep fatal exit status independent of monitoring availability, and bound the
// time allowed for the original exception's queued event to reach transport.
export function createFatalErrorHandler({ capture, flush, exit, timeoutMs = 2000 }) {
  return async error => {
    let timer;
    try {
      try { capture(error); } catch { /* Preserve the original fatal outcome. */ }
      await Promise.race([
        Promise.resolve().then(() => flush(timeoutMs)).catch(() => false),
        new Promise(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); }),
      ]);
    } finally {
      clearTimeout(timer);
      exit(1);
    }
  };
}
