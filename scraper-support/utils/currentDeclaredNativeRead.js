import { createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { boundedDeclaredPublicGet } from '../native-sources/boundedDeclaredPublicGet.js'
import { readLiteralModel } from '../native-sources/literalModel.js'

export const nativeContract = (condition, message) => {
  if (!condition) throw Object.assign(new Error(message), { softFailure: true, upstreamOutage: false,
    abortRetries: true, failureKind: 'coverage_gap' })
}
export const nativeDigest = value => createHash('sha256').update(value).digest('hex')

// These opt-in source readers admit only URLs declared by current employer
// pages or their reviewed static client contract. No site JavaScript is run.
export function createCurrentDeclaredNativeRead(source, allowed, options = {}) {
  const sourceTimeoutMs = options.sourceTimeoutMs ?? 90000
  nativeContract(Number.isSafeInteger(sourceTimeoutMs) && sourceTimeoutMs > 0 && sourceTimeoutMs <= 120000, source + ': invalid source read budget')
  const signal = AbortSignal.any([AbortSignal.timeout(sourceTimeoutMs), ...(options.signal ? [options.signal] : [])])
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const interval = options.requestIntervalMs ?? 250
  nativeContract(Number.isSafeInteger(interval) && interval >= 0 && (interval >= 250 || fetchImpl !== globalThis.fetch), source + ': invalid request interval')
  const pages = [], starts = new Map()
  let aggregateBytes = 0
  const read = async url => {
    signal.throwIfAborted()
    const parsed = new URL(url)
    nativeContract(parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.hash && !parsed.port && allowed(url), source + ': undeclared native read URL')
    nativeContract(pages.length < 100, source + ': native request bound exceeded')
    const wait = interval - (Date.now() - (starts.get(parsed.hostname) || 0))
    if (wait > 0) await delay(wait, undefined, { signal })
    starts.set(parsed.hostname, Date.now())
    const response = await boundedDeclaredPublicGet(url, { signal, overflowError: Error(source + ': native entity too large'),
      fetchImpl: (requested, init) => fetchImpl(requested, { ...init, credentials: 'omit' }) })
    signal.throwIfAborted()
    nativeContract(response.url === url && response.status === 200, source + ': native public response unavailable HTTP ' + response.status)
    const bytes = Buffer.from(response.bodyBase64, 'base64'), body = bytes.toString('utf8')
    aggregateBytes += bytes.length
    nativeContract(Buffer.from(body, 'utf8').equals(bytes) && bytes.length <= 4 * 1024 * 1024 && aggregateBytes <= 64 * 1024 * 1024,
      source + ': native entity encoding or response budget exceeded')
    nativeContract(!/<title[^>]*>\s*(?:Just a moment|Attention Required|Access Denied|Forbidden|Robot Check|Security Verification|Verify you are human)/i.test(body)
      && !/cf-chl-|\/cdn-cgi\/challenge-platform|datadome\.co\/captcha|px-captcha|id=["']challenge-form/i.test(body), source + ': public access challenge')
    const page = { url, status: response.status, headers: response.headers, bodyBase64: response.bodyBase64,
      bodySHA256: nativeDigest(bytes), originalText: body, bytes: bytes.length, usable: true, transportQualified: true }
    pages.push(page)
    if (options.onNativeResponse) await options.onNativeResponse(structuredClone(page))
    return page
  }
  return { read, json: page => readLiteralModel(page.originalText).value, signal, pages }
}
