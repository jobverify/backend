// Keep long model setup/inference steps visible in streamed workflow logs.
export function createProgressLogger(stage, snapshot, { intervalMs = 30000 } = {}) {
  const started = Date.now()
  let phase = 'configuration'
  const emit = () => console.log(JSON.stringify({
    ...snapshot(), event: 'progress', stage, phase,
    timestamp: new Date().toISOString(), elapsedSeconds: Math.round((Date.now() - started) / 1000),
  }))
  const timer = setInterval(emit, intervalMs)
  timer.unref()
  return {
    phase(value) { phase = value; emit() },
    stop() { clearInterval(timer) },
  }
}
