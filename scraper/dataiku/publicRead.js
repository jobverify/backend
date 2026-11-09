import { createHash } from 'node:crypto'

export const HOME = 'https://www.dataiku.com/company/careers'
export const JOBS = 'https://boards-api.greenhouse.io/v1/boards/dataiku/jobs?content=true'
export const OFFICES = 'https://boards-api.greenhouse.io/v1/boards/dataiku/offices'
export const LIMITS = Object.freeze({ requests: 256, bodyBytes: 3 * 1024 * 1024, totalBytes: 64 * 1024 * 1024,
  requestMs: 20000, sourceMs: 180000 })
const problem = (message, fields = {}) => Object.assign(new Error('[dataiku] ' + message), {
  softFailure: true, abortRetries: true, failureKind: 'surface_drift_or_fail_closed', ...fields,
})
const allowed = url => [HOME, JOBS, OFFICES].includes(url)
  || /^https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/dataiku\/jobs\/[1-9]\d*\?content=true$/.test(url)
const challenge = text => /verify you are human|cf-chl-|Vercel Security Checkpoint|You are opening a CodeSandbox preview/i.test(text)
const observeUntilAborted = (value, signal) => new Promise((resolve, reject) => {
  const abort = () => { signal.removeEventListener('abort', abort); reject(signal.reason) }
  signal.addEventListener('abort', abort, { once: true })
  Promise.resolve(value).then(result => {
    signal.removeEventListener('abort', abort)
    resolve(result)
  }, error => {
    signal.removeEventListener('abort', abort)
    reject(error)
  })
  if (signal.aborted) abort()
})

export function createDataikuPublicRead({ fetchImpl = globalThis.fetch, signal, onNativeResponse } = {}) {
  const deadline = new AbortController(), denied = new Map(), receipts = [], pages = new Map(), pending = new Set()
  const timer = setTimeout(() => deadline.abort(problem('Source time budget exceeded', { failureKind: 'network_or_timeout' })), LIMITS.sourceMs)
  timer.unref?.()
  const sourceSignal = AbortSignal.any([deadline.signal, ...(signal ? [signal] : [])])
  let requests = 0, totalBytes = 0, reservedBytes = 0, budgetError = null
  const check = () => { signal?.throwIfAborted(); if (budgetError) throw budgetError; sourceSignal.throwIfAborted() }
  const exhaust = () => { budgetError ||= problem('Source HTTP budget exceeded'); throw budgetError }
  const perform = async (url, init) => {
    check()
    if (!allowed(url)) throw problem('Unreviewed native HTTP destination')
    const host = new URL(url).hostname
    if (denied.has(host)) throw denied.get(host)
    if (requests >= LIMITS.requests || totalBytes + reservedBytes + LIMITS.bodyBytes > LIMITS.totalBytes) exhaust()
    requests++
    reservedBytes += LIMITS.bodyBytes
    const requestSignal = AbortSignal.any([sourceSignal, ...(init.signal ? [init.signal] : []), AbortSignal.timeout(LIMITS.requestMs)])
    let reader, body, response, receivedBytes = 0
    const requestedAt = new Date().toISOString()
    try {
      response = await fetchImpl(url, { ...init, method: 'GET', redirect: 'manual', credentials: 'omit', signal: requestSignal })
      signal?.throwIfAborted()
      // A known denial must survive every later body, budget, or observer error.
      if ([401, 403, 429].includes(response?.status)) denied.set(host, problem('Native HTTP status ' + response.status + ': public host denied access', {
        failureKind: 'blocked_or_access_denied', status: response.status,
      }))
      if (Number(response.headers?.get?.('content-length')) > LIMITS.bodyBytes) throw problem('Native body exceeds limit')
      if (response.body?.getReader) {
        reader = response.body.getReader()
        const chunks = []
        for (;;) {
          requestSignal.throwIfAborted()
          const part = await reader.read()
          requestSignal.throwIfAborted()
          if (part.done) break
          receivedBytes += part.value.byteLength
          if (receivedBytes > LIMITS.bodyBytes) throw problem('Native body exceeds limit')
          chunks.push(Buffer.from(part.value))
        }
        body = Buffer.concat(chunks)
      } else {
        // Retain the prior explicitly injected HTTP test interface. Actual
        // default HTTP responses always use the bounded stream above.
        if (typeof response.text !== 'function') throw problem('Native response body unavailable')
        body = Buffer.from(await response.text(), 'utf8')
        receivedBytes = body.length
        if (body.length > LIMITS.bodyBytes) throw problem('Native body exceeds limit')
      }
      requestSignal.throwIfAborted()
      const text = new TextDecoder('utf8', { fatal: true }).decode(body)
      if (challenge(text)) denied.set(host, problem('Public host challenge', { failureKind: 'blocked_or_access_denied', status: 403 }))
      const headers = response.headers?.entries ? Object.fromEntries(response.headers.entries()) : {}
      const receipt = { url, finalUrl: response.url, status: response.status, headers, requestedAt,
        completedAt: new Date().toISOString(), bodyBytes: body.length,
        bodySHA256: createHash('sha256').update(body).digest('hex'),
        contentTypeQualified: url === HOME ? /^text\/html(?:;|$)/i.test(headers['content-type'] || '')
          : /^application\/json(?:;|$)/i.test(headers['content-type'] || '') }
      receipts.push(receipt)
      const page = { ...receipt, body, text }
      if (!pages.has(url)) pages.set(url, [])
      pages.get(url).push(page)
      await observeUntilAborted(onNativeResponse?.({ ...receipt, body: Buffer.from(body) }), requestSignal)
      check()
      if (denied.has(host)) throw denied.get(host)
      if (response.status !== 200 || response.url !== url) throw problem('Native response status or final URL changed', { status: response.status })
      return page
    } catch (error) {
      await reader?.cancel(error).catch(() => {})
      if (!reader) await response?.body?.cancel?.(error).catch(() => {})
      signal?.throwIfAborted()
      if (denied.has(host)) throw denied.get(host)
      throw error
    } finally {
      reader?.releaseLock()
      reservedBytes -= LIMITS.bodyBytes
      totalBytes += receivedBytes
    }
  }
  const read = (url, init = {}) => {
    const task = perform(url, init)
    pending.add(task)
    task.then(() => pending.delete(task), () => pending.delete(task))
    return task
  }
  const asResponse = page => ({ status: page.status, url: page.finalUrl,
    headers: { get: key => page.headers[key.toLowerCase()] || null }, text: async () => page.text })
  return { read, asResponse, sourceSignal, receipts, pages,
    async settle() { while (pending.size) await Promise.allSettled([...pending]) },
    dispose() { clearTimeout(timer) },
    get audit() { return { requests, totalBytes, deniedHosts: [...denied.keys()], limits: LIMITS, receipts } },
  }
}
