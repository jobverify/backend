import { setTimeout as delay } from 'node:timers/promises'

// Only current, explicitly bound public career endpoints belong in allowedURL.
export const createBoundedPublicCareerTransport = ({ source, allowedURL, fetchImpl = globalThis.fetch,
  fetchText: injectedText, fetchJson: injectedJson, signal: callerSignal,
  timeoutMs = 180000, requestIntervalMs = 1000 } = {}) => {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 180000
    || !Number.isSafeInteger(requestIntervalMs) || requestIntervalMs < 0
    || requestIntervalMs < 1000 && fetchImpl === globalThis.fetch && !injectedText && !injectedJson)
    throw Error(source + ' invalid public transport limits')
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(Error(source + ' source deadline exceeded')), timeoutMs)
  const signal = callerSignal ? AbortSignal.any([callerSignal, controller.signal]) : controller.signal
  const prior = new Map(), denied = new Set()
  let count = 0
  const fail = (message, status) => Object.assign(Error(source + ' public read: ' + message), { publicReadFailure: true, status })
  const read = async (url, options = {}, kind = 'html') => {
    const json = kind === 'json', script = kind === 'js'
    signal.throwIfAborted()
    const target = new URL(url), method = options.method || 'GET'
    if (target.protocol !== 'https:' || target.username || target.password || target.port
      || !allowedURL(url, method, options.body) || ++count > 280) throw Error(source + ' request outside bounded public contract')
    if (denied.has(target.origin)) throw fail('origin already denied')
    const wait = requestIntervalMs - (Date.now() - (prior.get(target.origin) || 0))
    if (wait > 0) await delay(wait, undefined, { signal })
    prior.set(target.origin, Date.now())
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(20000)])
    let listener
    const operation = async () => {
      const injected = json ? injectedJson : injectedText
      if (injected) return injected(url, { ...options, signal: requestSignal })
      const response = await fetchImpl(url, { ...options, method, signal: requestSignal,
        headers: options.headers || { Accept: json ? 'application/json' : script ? 'application/javascript' : 'text/html,application/xhtml+xml' },
        credentials: 'omit', redirect: 'manual' })
      if ([401,403,429,451].includes(response.status)) denied.add(target.origin)
      if (response.status !== 200) throw fail('HTTP ' + response.status, response.status)
      if ((response.url || url) !== url) throw fail('unexpected final URL')
      const mime = response.headers.get('content-type') || ''
      if (!(json ? /(?:application|text)\/(?:[\w.+-]*\+)?json\b/i : script ? /(?:application|text)\/(?:x-)?(?:java|ecma)script/i : /text\/html|application\/xhtml\+xml/i).test(mime))
        throw fail('unexpected response MIME')
      const chunks = []
      let size = 0
      for await (const chunk of response.body) {
        if ((size += chunk.byteLength) > (script ? 16000000 : 4000000)) throw fail('response body limit')
        chunks.push(chunk)
      }
      const text = Buffer.concat(chunks).toString('utf8')
      if (!json) return text
      try { return JSON.parse(text) } catch { throw fail('malformed public JSON') }
    }
    try {
      return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => {
        listener = () => reject(requestSignal.reason)
        requestSignal.addEventListener('abort', listener, { once: true })
        if (requestSignal.aborted) listener()
      })])
    } catch (error) {
      signal.throwIfAborted()
      if (requestSignal.aborted) throw fail('bounded request deadline exceeded')
      if (error.name === 'TimeoutError' || error.message === 'fetch failed') throw fail(error.message)
      throw error
    } finally { if (listener) requestSignal.removeEventListener('abort', listener) }
  }
  return { signal, fetchText: (url, options) => read(url, options, 'html'),
    fetchScript: (url, options) => read(url, options, 'js'),
    fetchJson: (url, options) => read(url, options, 'json'), close: () => { clearTimeout(timer); controller.abort() } }
}
