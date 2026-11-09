import { createHash } from 'node:crypto'
const requireNative = (ok, message) => { if (!ok) throw new Error(`Gigamon native: ${message}`) }

/** Validate the complete destination before any anonymous GET, including redirects. */
export const validateURL = (value) => {
  const url = new URL(value)
  requireNative(url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash, 'unapproved origin, credentials, port or fragment')
  const official = url.hostname === 'www.gigamon.com' && ['/', '/company/careers.html'].includes(url.pathname) && !url.search
  const board = url.hostname === 'jobs.jobvite.com' && /^\/gigamon\/?$/.test(url.pathname)
  const detail = url.hostname === 'jobs.jobvite.com' && /^\/gigamon\/job\/[A-Za-z0-9]+\/?$/.test(url.pathname) && !url.search
  requireNative(official || board || detail, 'unapproved public path')
  if (board) {
    for (const key of new Set(url.searchParams.keys())) {
      const values = url.searchParams.getAll(key)
      requireNative(['page', 'p', 'offset', 'start'].includes(key) && values.length === 1 && /^\d{1,5}$/.test(values[0]) && Number(values[0]) <= 10000, 'unapproved pagination query')
    }
    requireNative([...url.searchParams.keys()].length <= 1, 'ambiguous pagination query')
  }
  return url.href
}

/** Retain every hop, body chunk and failure in memory; callers may persist onPacket. */
export const createNativeFetchText = ({
  signal, fetchImpl = globalThis.fetch, fetchText, onPacket,
  packets = [], clock = () => new Date().toISOString(), timeoutMs = 30000,
} = {}) => async (input) => {
  signal?.throwIfAborted()
  const initial = validateURL(input)
  if (fetchText) {
    const html = await fetchText(initial, { signal })
    signal?.throwIfAborted()
    requireNative(typeof html === 'string', 'injected response is not HTML text')
    return html
  }
  let current = initial
  const visited = new Set()
  for (let hop = 0; hop <= 5; hop++) {
    signal?.throwIfAborted()
    requireNative(!visited.has(current), 'redirect loop')
    visited.add(current)
    const activeSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(timeoutMs)])
    const packet = { requestedURL: validateURL(current), method: 'GET', redirect: 'manual', hop, startedAt: clock(), responseAt: null, completedAt: null, status: null, headers: null, bodyBase64: '', failure: null }
    const chunks = []
    let response
    try {
      response = await fetchImpl(validateURL(current), { method: 'GET', redirect: 'manual', signal: activeSignal, headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0' } })
      packet.responseAt = clock()
      packet.status = response.status
      packet.headers = Object.fromEntries(response.headers)
      requireNative(response.redirected !== true && (!response.url || response.url === current), 'fetch followed an unvalidated redirect')
      if (response.body) for await (const chunk of response.body) { chunks.push(Buffer.from(chunk)); activeSignal.throwIfAborted() }
      activeSignal.throwIfAborted()
    } catch (error) {
      packet.failure = { name: error.name, message: error.message, cause: error.cause?.message ?? null }
    }
    const body = Buffer.concat(chunks)
    packet.bodyBase64 = body.toString('base64')
    packet.bodySHA256 = createHash('sha256').update(body).digest('hex')
    packet.bytes = body.length
    packet.completedAt = clock()
    packets.push(packet)
    if (onPacket) await onPacket(packet)
    if (packet.failure) {
      const error = new Error(`Gigamon native transport: ${packet.failure.message}`)
      error.nativePackets = packets
      error.cause = packet.failure
      throw error
    }
    if ([301, 302, 303, 307, 308].includes(packet.status)) {
      requireNative(hop < 5, 'redirect bound exceeded')
      const location = response.headers.get('location')
      requireNative(typeof location === 'string' && location.trim(), 'redirect Location missing')
      const destination = validateURL(new URL(location, current).href)
      requireNative(new URL(destination).origin === new URL(initial).origin, 'redirect changed reviewed origin')
      current = destination
      continue
    }
    requireNative(packet.status === 200, `HTTP ${packet.status}`)
    return body.toString('utf8')
  }
  throw new Error('Gigamon native redirect bound exceeded')
}
