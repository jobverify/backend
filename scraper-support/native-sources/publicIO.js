import { createHash } from 'node:crypto'
import { readLiteralModel } from './literalModel.js'
import { boundedDeclaredPublicGet } from './boundedDeclaredPublicGet.js'

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
export const resourceURL = value => { const url = new URL(value);url.hash = '';return url.href }
export const createPublicIO = ({ fetchPage, fetchText, fetchJson, signal, allowed }) => {
  const rawPages = [], issues = [], cache = new Map()
  const issue = (kind, fields = {}) => issues.push({ kind, ...fields })
  const load = async (declaredURL, { fresh = false, kind = 'text' } = {}) => {
    signal?.throwIfAborted()
    let url
    try {
      url = resourceURL(declaredURL)
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !allowed(parsed)) throw Error('Not an allowed declared public URL')
    } catch (error) { issue('native-url-blocked', { declaredURL, message: error.message });return null }
    if (!fresh && cache.has(url)) return cache.get(url)
    let page
    try {
      let result
      if (fetchPage) result = await fetchPage(url, { signal })
      else if (kind === 'json' && fetchJson) result = { legacyParsedJSON: await fetchJson(url, { signal }) }
      else if (fetchText) result = await fetchText(url, { signal })
      else {
        result = await boundedDeclaredPublicGet(url, {
          fetchImpl: (requested, init) => fetch(requested, { ...init,
            headers: { ...init.headers, Accept: 'text/html,application/json,application/rss+xml,*/*;q=0.5' } }),
          signal: AbortSignal.any([AbortSignal.timeout(15000), ...(signal ? [signal] : [])]),
          overflowError: Error('Native entity exceeds input limit') })
      }
      signal?.throwIfAborted()
      const legacy = typeof result === 'string', bytes = typeof result?.bodyBase64 === 'string' ? Buffer.from(result.bodyBase64, 'base64') : null
      const decoded = bytes?.toString('utf8'), validUTF8 = Boolean(bytes && Buffer.from(decoded, 'utf8').equals(bytes))
      const suppliedText = legacy ? result : typeof result?.html === 'string' ? result.html : null
      const originalText = suppliedText ?? (validUTF8 ? decoded : null)
      const textMatches = !bytes || suppliedText == null || suppliedText === decoded
      const metadataQualified = !legacy && result?.url === url && Number.isInteger(result?.status)
      page = { url, declaredURL, status: result?.status ?? null, finalURL: result?.url ?? null, headers: result?.headers ?? {},
        bodyBase64: bytes?.toString('base64') ?? null, bodySHA256: bytes ? sha256(bytes) : null, bytes: bytes?.length ?? null,
        originalText, legacyParsedJSON: result?.legacyParsedJSON, transportQualified: metadataQualified,
        usable: textMatches && ((metadataQualified && result.status === 200) || legacy || Object.hasOwn(result || {}, 'legacyParsedJSON')) }
      if (!page.usable) issue('native-response-unavailable-or-contradictory', { url, status: page.status, finalURL: page.finalURL })
    } catch (error) {
      signal?.throwIfAborted()
      page = { url, declaredURL, usable: false, transportQualified: false, originalText: null, error: { name: error.name, message: error.message } }
      issue('native-response-failed', { url, message: error.message })
    }
    rawPages.push(page);if (!fresh) cache.set(url, page)
    return page
  }
  const follow = async (url, options = {}) => {
    const seen = new Set()
    for (let hop = 0; hop < 5; hop++) {
      const key = resourceURL(url)
      if (seen.has(key)) { issue('native-redirect-loop', { url });return null }
      seen.add(key)
      const page = await load(url, options)
      if (!page) return null
      if (page.status >= 300 && page.status < 400 && typeof page.headers.location === 'string') { url = new URL(page.headers.location, page.url).href;continue }
      return page
    }
    issue('native-redirect-limit', { url });return null
  }
  const json = page => {
    if (!page?.usable) return null
    if (Object.hasOwn(page, 'legacyParsedJSON') && page.legacyParsedJSON !== undefined) return page.legacyParsedJSON
    try { return readLiteralModel(page.originalText).value }
    catch (error) { issue('native-JSON-unreadable', { url: page.url, message: error.message, duplicateKeys: error.duplicateKeys ?? [] });return null }
  }
  return { load, follow, json, rawPages, issues, issue }
}
