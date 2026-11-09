const EXIT_CODES = {
  SIGINT: 130,
  SIGTERM: 143,
}

export const installGracefulShutdownHandlers = ({
  processRef = process,
  log = (message) => console.error(message),
} = {}) => {
  const controller = new AbortController()
  let requested = false
  let signalName = null

  const requestShutdown = (requestedSignal = 'SIGTERM') => {
    const normalizedSignal = requestedSignal === 'SIGINT' ? 'SIGINT' : 'SIGTERM'
    if (requested) {
      log(`[runner] Second ${normalizedSignal} received; forcing immediate exit.`)
      processRef.exit(EXIT_CODES[normalizedSignal])
      return
    }

    requested = true
    signalName = normalizedSignal
    const reason = new Error(`Graceful shutdown requested by ${normalizedSignal}`)
    reason.signalName = normalizedSignal
    controller.abort(reason)
    log(
      `[runner] ${normalizedSignal} received; stopping the queue to finish active sources before exit. `
      + 'Send the signal again to force exit.',
    )
  }

  const onSigint = () => requestShutdown('SIGINT')
  const onSigterm = () => requestShutdown('SIGTERM')
  const onMessage = (message) => {
    if (message?.type !== 'jobverify:shutdown') return
    requestShutdown(message.signal)
  }

  processRef.on('SIGINT', onSigint)
  processRef.on('SIGTERM', onSigterm)
  processRef.on('message', onMessage)

  return {
    get requested() {
      return requested
    },
    get signalName() {
      return signalName
    },
    get exitCode() {
      return signalName ? EXIT_CODES[signalName] : 0
    },
    signal: controller.signal,
    request: requestShutdown,
    dispose() {
      processRef.off('SIGINT', onSigint)
      processRef.off('SIGTERM', onSigterm)
      processRef.off('message', onMessage)
    },
  }
}
