/**
 * Run maintenance serially. The next delay starts after work settles, so slow
 * database calls cannot create an ever-growing queue of overlapping sweeps.
 */
export function createPeriodicTask(task, {
  intervalMs,
  runImmediately = false,
  onError = console.error,
}) {
  let stopped = false;
  let timer;
  let running = Promise.resolve();

  const schedule = () => {
    if (!stopped) {
      timer = setTimeout(run, intervalMs);
      timer.unref?.();
    }
  };
  const run = () => {
    if (stopped) return;
    running = Promise.resolve().then(task).catch(onError).finally(schedule);
  };

  if (runImmediately) run();
  else schedule();

  return async () => {
    stopped = true;
    clearTimeout(timer);
    await running;
  };
}

/**
 * Drain HTTP requests and maintenance before closing the database. Callers own
 * the process exit policy; rejecting at the deadline lets the entry point exit
 * unsuccessfully instead of hanging indefinitely during deployment.
 */
export function createShutdown({
  server,
  stopTasks = [],
  disconnect,
  timeoutMs = 10_000,
  onStart = () => {},
}) {
  let shutdownPromise;
  return () => {
    if (shutdownPromise) return shutdownPromise;

    shutdownPromise = Promise.resolve().then(async () => {
      onStart();
      let timer;
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
          server.closeAllConnections();
          reject(new Error(`Shutdown exceeded ${timeoutMs}ms.`));
        }, timeoutMs);
      });
      const drain = new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
      try {
        await Promise.race([
          Promise.all([drain, ...stopTasks.map((stop) => Promise.resolve().then(stop))])
            .then(disconnect),
          deadline,
        ]);
      } finally {
        clearTimeout(timer);
      }
    });
    return shutdownPromise;
  };
}
