import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { QUBOLE_INDIA_CATALOG as PROVIDER_METADATA } from './catalog.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /darwinbox/i,
  /peoplestrong/i,
  /ashbyhq\.com/i,
  /oraclecloud\.com\/hcmUI\/CandidateExperience/i,
  /oraclecloud\.com\/hcmRestApi\/resources\/latest\/recruitingCEJobRequisitions/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\s+/g, ' ')
  .trim()

const stripTagsToText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeUrlForComparison = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''

    let normalized = url.toString()
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1)
    }

    return normalized
  } catch {
    return null
  }
}

const defaultFetchPage = async (url, { signal, maxResponseBytes, throwIfAborted }) => {
  throwIfAborted()
  const response = await fetch(url, {
    method: 'GET',
    signal,
    credentials: 'omit',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'manual',
  })
  throwIfAborted()
  const discardBody = () => {
    try { Promise.resolve(response.body?.cancel()).catch(() => {}) } catch {}
  }
  if (response.status !== 200) {
    discardBody()
    return { status: response.status, url: response.url, html: '' }
  }
  if (!/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type') || '')) {
    discardBody()
    throw new Error('Qubole India public careers read expected HTML')
  }

  const reader = response.body?.getReader()
  const chunks = []
  let bytes = 0
  let complete = false
  const cancel = () => { if (reader) Promise.resolve(reader.cancel()).catch(() => {}) }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    while (reader) {
      throwIfAborted()
      const { done, value } = await reader.read()
      throwIfAborted()
      if (done) break
      bytes += value.byteLength
      if (bytes > maxResponseBytes) throw new Error('Qubole India public careers body byte limit exceeded')
      chunks.push(value)
    }
    complete = true
  } finally {
    signal.removeEventListener('abort', cancel)
    if (!complete) cancel()
    reader?.releaseLock()
  }

  return {
    status: response.status,
    url: response.url,
    html: Buffer.concat(chunks).toString('utf8'),
    fetchedAt: new Date().toISOString(),
  }
}

const boundedLimit = (value, fallback, maximum, name) => {
  const limit = value ?? fallback
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maximum) {
    throw new Error(`Qubole India invalid ${name} limit`)
  }
  return limit
}

// A single first-party sentinel read has no pagination, job details or retries.
// Race the whole read so an injected transport or stalled body cannot ignore it.
const readWithDeadline = async (options, operation) => {
  const callerSignal = options.signal
  if (callerSignal?.aborted) throw callerSignal.reason
  const requestTimeoutMs = boundedLimit(options.requestTimeoutMs ?? options.timeoutMs, 10000, 20000, 'request deadline')
  const sourceTimeoutMs = boundedLimit(options.sourceTimeoutMs, 20000, 60000, 'source deadline')
  const maxResponseBytes = boundedLimit(options.maxResponseBytes, 2000000, 2000000, 'body byte')
  boundedLimit(options.maxRequests, 1, Number.MAX_SAFE_INTEGER, 'request')
  boundedLimit(options.maxPages, 1, Number.MAX_SAFE_INTEGER, 'page')

  const duration = Math.min(requestTimeoutMs, sourceTimeoutMs)
  const deadline = performance.now() + duration
  const controller = new AbortController()
  const signal = callerSignal ? AbortSignal.any([callerSignal, controller.signal]) : controller.signal
  const timeoutError = new Error(`Qubole India ${sourceTimeoutMs < requestTimeoutMs ? 'source' : 'request'} deadline exceeded`)
  const throwIfAborted = () => {
    if (callerSignal?.aborted) throw callerSignal.reason
    if (performance.now() >= deadline && !controller.signal.aborted) controller.abort(timeoutError)
    signal.throwIfAborted()
  }
  const timer = setTimeout(() => controller.abort(timeoutError), duration)
  let onAbort
  try {
    const aborted = new Promise((_, reject) => {
      onAbort = () => reject(callerSignal?.aborted ? callerSignal.reason : signal.reason)
      signal.addEventListener('abort', onAbort, { once: true })
      if (signal.aborted) onAbort()
    })
    const pending = Promise.resolve().then(() => {
      throwIfAborted()
      return operation({ ...options, signal, maxResponseBytes, requestTimeoutMs, sourceTimeoutMs, throwIfAborted })
    }).then(result => { throwIfAborted(); return result })
    return await Promise.race([pending, aborted])
  } finally {
    clearTimeout(timer)
    if (onAbort) signal.removeEventListener('abort', onAbort)
  }
}

export const extractOpenPositionsUrl = (html = '') => {
  const match = String(html ?? '').match(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*View Open Positions\s*<\/a>/i,
  )

  return match?.[1] ?? null
}

export const pageExposesPublicJobListings = (html = '') => {
  const page = String(html ?? '')
  const doc = readNativeDocument(page)
  if (doc.nodes(node => ['a', 'area'].includes(node.tag) && node.attrs.href).some(node => (
    normalizeUrlForComparison(node.attrs.href) !== normalizeUrlForComparison(CAREERS_URL)
    && PUBLIC_JOB_SIGNAL_PATTERNS.some(pattern => pattern.test(`${node.attrs.href} ${doc.text(node)}`))
  ))) return true

  if (PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(page))) {
    const openPositionsUrl = extractOpenPositionsUrl(page)
    if (!openPositionsUrl) return true

    return normalizeUrlForComparison(openPositionsUrl) !== normalizeUrlForComparison(CAREERS_URL)
  }

  const openPositionsUrl = extractOpenPositionsUrl(page)
  if (!openPositionsUrl) return false

  return normalizeUrlForComparison(openPositionsUrl) !== normalizeUrlForComparison(CAREERS_URL)
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTagsToText(page)
  const openPositionsUrl = extractOpenPositionsUrl(page)

  return /<title>\s*Careers\s*\|\s*Open Job Opportunities at Qubole\s*<\/title>/i.test(page)
    && /Careers:\s*Check out our open career opportunities\./i.test(page)
    && /We are always hiring opportunistically for the best engineers at all of our locations\./i.test(page)
    && text.includes('View Open Positions')
    && normalizeUrlForComparison(openPositionsUrl) === normalizeUrlForComparison(CAREERS_URL)
}

export const createQuboleIndiaScraper = () => ({
  async run(options = {}) {
    const { fetchPage = defaultFetchPage } = options
    return readWithDeadline(options, async readOptions => {
      const careersPage = await fetchPage(CAREERS_URL, readOptions)
      readOptions.throwIfAborted()
      if (Buffer.byteLength(String(careersPage.html ?? ''), 'utf8') > readOptions.maxResponseBytes) {
        throw new Error('Qubole India public careers body byte limit exceeded')
      }

      if (
        careersPage.status !== 200
        || normalizeUrlForComparison(careersPage.url) !== normalizeUrlForComparison(CAREERS_URL)
      ) {
        throw new Error('Qubole India verified official careers page no longer matches the known public surface')
      }

      if (pageExposesPublicJobListings(careersPage.html)) {
        throw new Error('Qubole India careers page now appears to expose public jobs')
      }

      if (!hasOfficialCareersPageSignal(careersPage.html)) {
        throw new Error('Qubole India verified official careers page no longer matches the known public surface')
      }

      return attachInventoryEvidence([], {
        status: 'discovery-only',
        surface: CAREERS_URL,
        firstParty: true,
        listingComplete: false,
        pagesFetched: 1,
        reportedTotal: null,
        indiaFacetCount: null,
        verifiedAt: careersPage.fetchedAt ?? null,
        reason: 'Official Qubole careers page self-loops its open positions link; no enumerable public inventory is published and native counts remain unknown.',
      })
    })
  },
})

export const run = async (options = {}) => createQuboleIndiaScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
