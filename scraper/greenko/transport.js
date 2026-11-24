// A run-local boundary keeps legacy session/listing retries from issuing another
// request after denial, cancellation or a failed native response read.
export const createGreenkoTransport = ({ fetchImpl = globalThis.fetch, signal, headers = {} } = {}) => {
  const terminal = new AbortController()
  const runSignal = signal ? AbortSignal.any([signal, terminal.signal]) : terminal.signal
  const stop = error => {
    if (!terminal.signal.aborted) terminal.abort(error)
    throw error
  }
  const request = async (url, init = {}) => {
    const requestSignal = init.signal ? AbortSignal.any([runSignal, init.signal]) : runSignal
    try {
      requestSignal.throwIfAborted()
      const response = await fetchImpl(url, { ...init, redirect: 'manual', signal: requestSignal })
      requestSignal.throwIfAborted()
      if (!(response instanceof Response) || !Number.isInteger(response.status) || response.status < 200
        || response.status > 599 || response.bodyUsed || response.body?.locked) {
        throw new Error(`Invalid completed HTTP response for ${url}`)
      }
      if (!response.ok || response.status === 202) {
        throw Object.assign(new Error(`HTTP ${response.status} for ${url}`), {
          status: response.status, httpStatus: response.status, requestedUrl: String(url), abortRetries: true,
        })
      }
      return new Proxy(response, {
        get(target, key) {
          if (key === 'text' || key === 'json') return async (...args) => {
            try {
              requestSignal.throwIfAborted()
              const value = await Reflect.apply(target[key], target, args)
              requestSignal.throwIfAborted()
              if (key === 'text' && (typeof value !== 'string' || !value.trim())) {
                throw new Error(`Empty or invalid completed HTTP body for ${url}`)
              }
              return value
            } catch (error) { return stop(error) }
          }
          const value = Reflect.get(target, key, target)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
    } catch (error) { return stop(error) }
  }
  const fetchText = async (url, { timeoutMs = 15000, ...init } = {}) => {
    const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : null
    const requestSignal = timeout ? AbortSignal.any([runSignal, ...(init.signal ? [init.signal] : []), timeout]) : init.signal
    const response = await request(url, { ...init, headers: init.headers || headers, signal: requestSignal })
    return response.text()
  }
  return { fetch: request, fetchText, signal: runSignal }
}
