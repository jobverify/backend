import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'manatecelectronics'
export const COMPANY = 'Manatec Electronics Private Limited'
export const HOMEPAGE_URL = 'https://manatec.in/'
export const CAREERS_URL = 'https://manatec.in/career/'
export const PAGE_SITEMAP_URL = 'https://manatec.in/wp-sitemap-posts-page-1.xml'
export const MISSING_ROUTE_URL = 'https://manatec.in/join-us'
export const VERIFIED_ON = '2026-09-13'
export const VERIFIED_SURFACE_SUMMARY = "Verified on Sunday, September 13, 2026 that the captured official homepage retained Manatec company identity and its careers link. A fresh default source check timed out after about 15 seconds on the homepage; no complete public vacancy inventory was established. The previously observed careers form is application-only and cannot prove an empty vacancy inventory. Requests now share a 15-second deadline across the homepage, careers page, connection fallback and response bodies; cancellation and any unavailable surface stop the source immediately with a typed error instead of returning an empty snapshot."
export const EXPECTED_DEPARTMENTS = [
  'Commercial and Despatch',
  'CSD',
  'Engineering',
  'Exports Marketing',
  'Domestic Marketing',
  'Finance',
  'HR & Admin',
  'Pricing',
  'Production',
  'Purchase and vendor',
  'Quality',
  'R & D',
  'Stores',
  'Testing and Assembling',
  'Trading',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
export const DEFAULT_FETCH_TIMEOUT_MS = 15000

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8217;|&rsquo;|&#039;/gi, "'")
  .replace(/&quot;|&#8220;|&#8221;/gi, '"')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const stripTags = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<(p|div|section|article|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const normalizeVisibleText = (value) => normalizeWhitespace(stripTags(value)) || ''

const unavailableInventory = (message, cause, { surface = null } = {}) => Object.assign(new Error(message), {
  code: 'MANATEC_INVENTORY_UNAVAILABLE', failureType: 'upstream_unavailable',
  failureKind: 'upstream_unavailable', softFailure: true, upstreamOutage: true, abortRetries: true,
  surface,
  ...(cause ? { cause } : {}),
})

const withRequestDeadline = async (operation, { signal, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS } = {}) => {
  signal?.throwIfAborted()
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Manatec timeoutMs must be positive and finite')
  const controller = new AbortController()
  const requestSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  const timer = setTimeout(() => controller.abort(unavailableInventory('Manatec public inventory request timed out after ' + timeoutMs + 'ms')), timeoutMs)
  let onAbort
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(requestSignal.reason)
    requestSignal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    return await Promise.race([
      Promise.resolve().then(() => { requestSignal.throwIfAborted(); return operation(requestSignal) }),
      aborted,
    ])
  } finally {
    clearTimeout(timer)
    requestSignal.removeEventListener('abort', onAbort)
    requestSignal.throwIfAborted()
  }
}

const isConnectTimeoutFetchError = (error) => {
  const seen = new Set()
  let current = error
  let sawFetchFailed = false
  let sawConnectTimeout = false

  while (current && !seen.has(current)) {
    seen.add(current)

    const message = String(current?.message ?? current)
    const causeCode = String(current?.code ?? '')
    if (/fetch failed/i.test(message)) sawFetchFailed = true
    if (/UND_ERR_CONNECT_TIMEOUT/i.test(causeCode)) sawConnectTimeout = true

    current = current?.cause
  }

  return sawFetchFailed && sawConnectTimeout
}

export const isVerifiedTimeoutBlockedSurface = (error) =>
  isConnectTimeoutFetchError(error)
  || /timed out|timeout|connect timeout|und_err_connect_timeout/i.test(String(error?.message ?? error ?? ''))

const toWwwFallbackUrl = (value) => {
  const url = new URL(value)
  if (url.hostname.startsWith('www.')) {
    return null
  }

  url.hostname = `www.${url.hostname}`
  return url.toString()
}

export const fetchPageWithWwwFallback = async (url, {
  fetchImpl = fetch,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
  signal,
} = {}) => withRequestDeadline(async requestSignal => {
  const fetchOnce = async (targetUrl) => {
    requestSignal.throwIfAborted()
    const response = await fetchImpl(targetUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: requestSignal,
    })
    requestSignal.throwIfAborted()
    const html = await response.text()
    requestSignal.throwIfAborted()
    return { status: response.status, url: response.url, html }
  }
  try {
    return await fetchOnce(url)
  } catch (error) {
    requestSignal.throwIfAborted()
    const fallbackUrl = toWwwFallbackUrl(url)
    if (!fallbackUrl || !isConnectTimeoutFetchError(error)) throw error
    return fetchOnce(fallbackUrl)
  }
}, { signal, timeoutMs })

const defaultFetchPage = (url, options) => fetchPageWithWwwFallback(url, options)

const hasVerifiedCareersLink = (html) =>
  /href=["']https?:\/\/manatec\.in\/career\/["']|href=["']\/career\/["']/i.test(String(html ?? ''))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()

  return /<title>\s*MANATEC\s*(?:&#8211;|&ndash;|–|-)\s*ALIGNED TO EXCELLENCE\s*<\/title>/i.test(page)
    && text.includes('manatec group of companies')
    && text.includes('trusted in 70+ countries')
    && text.includes('garage equipment')
    && text.includes('we work for you since 1987')
    && text.includes('industrial shaft alignment systems')
    && text.includes('automotive aftermarket equipment industry in 1991')
    && hasVerifiedCareersLink(page)
}

export const hasVerifiedPageSitemapSignal = (xml) => {
  const page = String(xml ?? '')
  return /<urlset\b/i.test(page)
    && /<loc>\s*https:\/\/manatec\.in\/\s*<\/loc>/i.test(page)
    && /<loc>\s*https:\/\/manatec\.in\/career\/\s*<\/loc>/i.test(page)
  }

export const extractDepartmentOptions = (html) => [
  ...String(html ?? '').matchAll(/<option[^>]*value="([^"]+)"[^>]*>([\s\S]*?)<\/option>/gi),
].map((match) => normalizeWhitespace(match[2] || match[1])).filter(Boolean)

export const hasApplicationOnlyCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()
  const departments = extractDepartmentOptions(page)

  return /<title>\s*Career\s*(?:&#8211;|&ndash;|–|-)\s*MANATEC\s*<\/title>/i.test(page)
    && text.includes('opportunities')
    && text.includes('at manatec, we believe that our greatest asset is our people.')
    && text.includes('we are always on the lookout for passionate, innovative, and talented individuals')
    && text.includes('whether you are a seasoned professional or just starting your career')
    && text.includes('upload resume / cv')
    && text.includes('message')
    && departments.length === EXPECTED_DEPARTMENTS.length
    && departments.every((department, index) => department === EXPECTED_DEPARTMENTS[index])
    && !/current openings|open positions|job id|requisition|vacancy\s*:|view details|job description|apply now/i.test(text)
}

export const isVerifiedMissingRoute = ({ status, html } = {}) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()

  return status === 404
    && /<title>\s*Page not found\s*(?:&#8211;|&ndash;|–|-)\s*MANATEC\s*<\/title>/i.test(page)
    && text.includes('404')
    && text.includes('opps! the page you requested was not found.')
    && text.includes('back to homepage')
}

const BLOCKED_PUBLIC_JOB_PATTERN =
  /current openings|open positions|job id|requisition|vacancy\s*:|view details|job description|apply now/i

export const isVerifiedBlockedShell = ({ status, html } = {}) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()

  return status === 403
    && /<title>\s*403 Forbidden\s*<\/title>/i.test(page)
    && text.includes('403 forbidden')
    && text.includes("you don't have permission to access")
    && text.includes('a 403 forbidden error was encountered while trying to use an errordocument to handle the request.')
    && !BLOCKED_PUBLIC_JOB_PATTERN.test(text)
}

const buildDiscoveryOnlyEvidence = (now, surface, error) =>
  attachInventoryEvidence([], {
    status: 'discovery-only',
    surface: surface || HOMEPAGE_URL,
    firstParty: true,
    listingComplete: false,
    pagesFetched: 0,
    reportedTotal: null,
    indiaFacetCount: null,
    verifiedAt: now(),
    reason: 'Manatec public inventory is currently unavailable or application-only; enumerable vacancies cannot be verified.',
  })

export const createManatecElectronicsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage, signal, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS } = {}) {
    try {
      return await withRequestDeadline(async requestSignal => {
        const fetchVerifiedPage = async (url) => {
          requestSignal.throwIfAborted()
          try {
            const page = await fetchPage(url, { signal: requestSignal, timeoutMs })
            requestSignal.throwIfAborted()
            if (page?.status !== 200) {
              throw unavailableInventory(
                'Manatec public inventory unavailable: HTTP ' + page?.status + ' for ' + url,
                null,
                { surface: url },
              )
            }
            return page
          } catch (error) {
            requestSignal.throwIfAborted()
            if (error?.code === 'MANATEC_INVENTORY_UNAVAILABLE') throw error
            throw unavailableInventory('Manatec public inventory could not be fetched: ' + url, error, {
              surface: url,
            })
          }
        }
        const homepage = await fetchVerifiedPage(HOMEPAGE_URL)
        if (!hasOfficialHomepageSignal(homepage.html)) throw new Error('Manatec Electronics homepage no longer matches the verified official public site')
        const careersPage = await fetchVerifiedPage(CAREERS_URL)
        if (!hasApplicationOnlyCareersSignal(careersPage.html)) throw new Error('Manatec Electronics careers page no longer matches the verified application-only public surface')
        throw unavailableInventory(
          'Manatec application-only careers form does not establish an enumerable vacancy inventory',
          null,
          { surface: CAREERS_URL },
        )
      }, { signal, timeoutMs })
    } catch (error) {
      if (signal?.aborted) throw signal.reason
      if (error?.code === 'MANATEC_INVENTORY_UNAVAILABLE') {
        return buildDiscoveryOnlyEvidence(now, error.surface, error)
      }
      throw error
    }
  },
})

export const run = async (options = {}) => createManatecElectronicsScraper(options).run(options)

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
