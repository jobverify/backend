import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const origin = 'https://careers.ey.com'
const fail = message => {
  throw Object.assign(new Error(`EY native ${message}`), { abortRetries: true, failureKind: 'source_identity_unverified' })
}
const requestUrl = value => {
  let url
  try { url = new URL(value) } catch { fail('request authority is invalid') }
  if (url.origin !== origin || url.username || url.password || url.hash
    || !(url.pathname === '/ey/search/' || /^\/ey\/job\/[^/]+\/\d+\/?$/.test(url.pathname)
      || url.pathname === '/services/jobs/options/facetValues/'
      || ['/platform/js/j2w/min/options-search.min.js', '/platform/js/search/search.js'].includes(url.pathname))) {
    fail('request authority or path is unbound')
  }
  return url
}
const defaultPath = url => {
  const slash = url.pathname.lastIndexOf('/')
  return slash > 0 ? url.pathname.slice(0, slash) : '/'
}
const pathMatches = (pathname, path) => pathname === path || pathname.startsWith(path)
  && (path.endsWith('/') || pathname[path.length] === '/')

// EY caches the native result set in its anonymous JSESSIONID. A fresh session
// for every offset can read a different result set despite identical queries.
// Keep only that anonymous cookie, in memory for this run and this exact host.
export const createEySessionFetchText = ({ config = {}, fetchImpl = fetch } = {}) => {
  const sessions = new Map()
  return async (value, { signal, headers: additionalHeaders, method = 'GET', body } = {}) => {
    const url = requestUrl(value)
    signal?.throwIfAborted()
    return fetchTextWithRetry(url.href, { signal, method, body,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...additionalHeaders,
      },
      attempts: config.retryAttempts, baseDelayMs: config.retryBaseDelayMs,
      timeoutMs: Math.max(config.jobListingTimeoutMs || 0, 30000), label: 'ey',
      fetchImpl: async (input, options) => {
        const target = requestUrl(input)
        options.signal?.throwIfAborted()
        const headers = new Headers(options.headers)
        headers.delete('cookie')
        const active = [...sessions.values()].filter(cookie => {
          if (cookie.expires <= Date.now()) { sessions.delete(cookie.path); return false }
          return pathMatches(target.pathname, cookie.path)
        }).sort((left, right) => right.path.length - left.path.length)
        if (active.length) headers.set('cookie', active.map(cookie => `JSESSIONID=${cookie.value}`).join('; '))
        const response = await fetchImpl(target.href, { ...options, headers, redirect: 'manual' })
        options.signal?.throwIfAborted()
        if (response.url !== target.href) fail('response authority or path does not match the request')
        const cookies = response.headers?.getSetCookie?.() || [response.headers?.get?.('set-cookie')].filter(Boolean)
        if (response.ok) for (const raw of cookies) {
          const parts = raw.split(';').map(part => part.trim()), equal = parts[0].indexOf('=')
          if (equal < 0 || parts[0].slice(0, equal) !== 'JSESSIONID') continue
          const attributes = new Map(parts.slice(1).map(part => {
            const separator = part.indexOf('=')
            return separator < 0 ? [part.toLowerCase(), '']
              : [part.slice(0, separator).toLowerCase(), part.slice(separator + 1)]
          }))
          const domain = attributes.get('domain')?.toLowerCase().replace(/^\./, '')
          if (domain && !['ey.com', 'careers.ey.com'].includes(domain)) continue
          const path = attributes.get('path')?.startsWith('/') ? attributes.get('path') : defaultPath(target)
          const maxAge = attributes.has('max-age') ? Number(attributes.get('max-age')) : null
          const expiresAt = Date.parse(attributes.get('expires'))
          const expires = maxAge != null && Number.isFinite(maxAge) ? Date.now() + maxAge * 1000
            : Number.isFinite(expiresAt) ? expiresAt : Infinity
          if (expires <= Date.now()) sessions.delete(path)
          else sessions.set(path, { path, expires, value: parts[0].slice(equal + 1) })
        }
        return response
      },
    })
  }
}
