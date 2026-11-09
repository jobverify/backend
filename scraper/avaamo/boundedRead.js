import { performance } from 'node:perf_hooks'
import { createHash } from 'node:crypto'

const error = message => Object.assign(new Error('Avaamo ' + message), { abortRetries: true })
const integer = (value, fallback, maximum, name) => {
  const result = value ?? fallback
  if (!Number.isSafeInteger(result) || result < 1 || result > maximum) throw error('invalid ' + name + ' limit')
  return result
}
const discard = response => { try { void response?.body?.cancel().catch(() => {}) } catch {} }

// All physical GETs, including admitted redirects, pass through this budget.
// The monotonic checks also cover transports/readers that starve timer callbacks.
export function createAvaamoReader(options = {}) {
  const { signal: caller, fetchImpl = globalThis.fetch } = options
  if (caller?.aborted) throw caller.reason
  const limits = {
    requestTimeoutMs: integer(options.requestTimeoutMs, 15000, 60000, 'request time'),
    collectionBudgetMs: integer(options.collectionBudgetMs, 180000, 300000, 'source time'),
    maxRequests: integer(options.maxRequests, 32, 100, 'request count'),
    maxPages: integer(options.maxPages, 28, 100, 'page count'),
    maxJobs: integer(options.maxJobs, 100, 500, 'job count'),
    maxBodyBytes: integer(options.maxBodyBytes, 2000000, 8000000, 'response bytes'),
    maxTotalBytes: integer(options.maxTotalBytes, 12000000, 32000000, 'source bytes'),
    maxOutputBytes: integer(options.maxOutputBytes, 16000000, 32000000, 'output bytes'),
  }
  const start = performance.now(), source = new AbortController()
  const timer = setTimeout(() => source.abort(error('source deadline exceeded')), limits.collectionBudgetMs)
  let requests = 0, pages = 0, totalBytes = 0, closed = false
  const receipts = []
  const check = () => {
    if (caller?.aborted) throw caller.reason
    if (closed) throw error('reader already closed')
    if (performance.now() - start >= limits.collectionBudgetMs) {
      if (!source.signal.aborted) source.abort(error('source deadline exceeded'))
    }
    source.signal.throwIfAborted()
  }
  const read = async url => {
    check()
    let target = url
    for (let hop = 0; hop < 3; hop++) {
      check()
      const parsed = new URL(target)
      if (parsed.protocol !== 'https:' || parsed.origin !== 'https://avaamo.ai' || parsed.username || parsed.password || parsed.port
        || parsed.search || parsed.hash || !/^\/career(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(parsed.pathname))
        throw error('URL outside declared public careers scope')
      if (requests >= limits.maxRequests) throw error('request count budget exceeded')
      if (pages >= limits.maxPages) throw error('page count budget exceeded')
      requests++
      const requestedAt = new Date().toISOString(), requestStart = performance.now(), timeout = new AbortController()
      const timeoutTimer = setTimeout(() => timeout.abort(error('request deadline exceeded')), limits.requestTimeoutMs)
      const signal = AbortSignal.any([source.signal, timeout.signal, ...(caller ? [caller] : [])])
      let reader, response, finished = false
      const requestCheck = () => {
        check()
        if (performance.now() - requestStart >= limits.requestTimeoutMs && !timeout.signal.aborted)
          timeout.abort(error('request deadline exceeded'))
        signal.throwIfAborted()
      }
      const bounded = async operation => {
        requestCheck()
        let listener
        const promise = Promise.resolve().then(operation)
        try {
          const result = await Promise.race([promise, new Promise((_, reject) => {
            listener = () => reject(caller?.aborted ? caller.reason : signal.reason)
            signal.addEventListener('abort', listener, { once: true })
            if (signal.aborted) listener()
          })])
          requestCheck()
          return result
        } finally { if (listener) signal.removeEventListener('abort', listener) }
      }
      try {
        response = await bounded(async () => {
          const result = await fetchImpl(target, {
            method: 'GET', credentials: 'omit', redirect: 'manual', signal,
            headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)' },
          })
          // Take ownership before bounded() checks elapsed time. A synchronous
          // fetch can starve the timer and be rejected before the await result
          // reaches the outer assignment; finally must still release its body.
          response = result
          if (finished || signal.aborted) discard(result)
          return result
        })
        requestCheck()
        pages++
        const status = response.status, finalUrl = response.url, mime = response.headers?.get?.('content-type') || ''
        const receipt = { method: 'GET', url: target, finalUrl, status, mime, requestedAt }
        if (finalUrl !== target) throw error('unexpected response URL; redirects must be visible physical requests')
        if ([301, 302, 303, 307, 308].includes(status)) {
          const next = new URL(response.headers.get('location'), target).href
          // Only the current canonical landing can redirect to itself. Role
          // identity changes need a fresh publisher contract, not a guessed URL.
          if (target !== 'https://avaamo.ai/career' || next !== target) throw error('unreviewed public redirect')
          receipts.push({ ...receipt, completedAt: new Date().toISOString(), location: next })
          discard(response)
          target = next
          continue
        }
        if (status !== 200) throw Object.assign(error('public GET HTTP ' + status), { status })
        if (!/^(?:text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(mime)) throw error('unexpected HTML MIME')
        const declared = Number(response.headers?.get?.('content-length'))
        if (Number.isFinite(declared) && declared > limits.maxBodyBytes) throw error('response byte budget exceeded')
        if (!response.body || typeof response.body.getReader !== 'function') throw error('non-streaming public body is unsupported')
        reader = response.body.getReader()
        let size = 0
        const chunks = []
        for (;;) {
          const part = await bounded(() => reader.read())
          requestCheck()
          if (part.done) break
          if (!(part.value instanceof Uint8Array)) throw error('unsupported public body chunk')
          size += part.value.byteLength
          totalBytes += part.value.byteLength
          if (size > limits.maxBodyBytes) throw error('response byte budget exceeded')
          if (totalBytes > limits.maxTotalBytes) throw error('source byte budget exceeded')
          chunks.push(Buffer.from(part.value))
        }
        requestCheck()
        const body = Buffer.concat(chunks).toString('utf8')
        requestCheck()
        const bodySHA256 = createHash('sha256').update(body).digest('hex')
        requestCheck()
        receipts.push({ ...receipt, bytes: size, bodySHA256, completedAt: new Date().toISOString() })
        return { url: finalUrl, status, mime, html: body, bytes: size, sha256: bodySHA256 }
      } catch (caught) {
        if (caller?.aborted) throw caller.reason
        check()
        throw caught
      } finally {
        finished = true
        clearTimeout(timeoutTimer)
        try { if (reader) void reader.cancel().catch(() => {}); else discard(response) } catch {}
        try { reader?.releaseLock() } catch {}
      }
    }
    throw error('redirect count budget exceeded')
  }
  return { read, check, limits, receipts,
    stats: () => ({ requests, pages, totalBytes, elapsedMs: performance.now() - start }),
    close: () => { closed = true; clearTimeout(timer); if (!source.signal.aborted) source.abort(error('reader finished')) },
  }
}
