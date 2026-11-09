import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { INFOWORKS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const BROWSER_TIMEOUT_MS = 60000
const PUBLIC_JOBS_SIGNAL_PATTERN =
  /\b(careers?|jobs?|open positions|apply now|search jobs|current openings)\b/i
const DEFAULT_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent': USER_AGENT,
}

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const ACQUISITION_URL = PROVIDER_METADATA.officialAcquisitionUrl
export const PARENT_CAREERS_URL = PROVIDER_METADATA.parentCareersUrl
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const FIRST_PARTY_REDIRECT_ROUTES = [...PROVIDER_METADATA.firstPartyRedirectRoutes]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

export const extractParentCareersUrl = (html = '') => {
  const match = String(html ?? '').match(/https:\/\/www\.uniphore\.com\/careers\/?/i)
  if (!match) return null

  return match[0].endsWith('/') ? match[0] : `${match[0]}/`
}

export const hasOfficialAcquisitionSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return extractTitle(page) === 'InfoWorks | Uniphore'
    && text.includes('Uniphore Acquired InfoWorks')
    && text.includes('Uniphore has acquired Infoworks')
    && extractParentCareersUrl(page) === PARENT_CAREERS_URL
}

export const isExpectedInfoworksRedirectSurface = (surface = {}) =>
  Number(surface?.status) === 200
  && surface?.finalUrl === ACQUISITION_URL
  && hasOfficialAcquisitionSignal(surface?.html)

const isUnexpectedReachableSurface = (surface = {}) =>
  Number.isInteger(surface?.status)
  && surface.status > 0
  && surface.finalUrl !== ACQUISITION_URL
  && PUBLIC_JOBS_SIGNAL_PATTERN.test(normalizeWhitespace(surface?.html))

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined
  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultProbeUrl = async (url) => {
  const response = await fetch(url, {
    headers: DEFAULT_HEADERS,
    redirect: 'follow',
    signal: createTimeoutSignal(BROWSER_TIMEOUT_MS),
  })

  return {
    url,
    finalUrl: response.url || url,
    status: response.status,
    html: await response.text(),
    errorKind: null,
  }
}

export const createInfoworksScraper = () => ({
  async run({ probeUrl } = {}) {
    const probe = probeUrl || defaultProbeUrl

    const acquisitionSurface = await probe(ACQUISITION_URL)
    if (!isExpectedInfoworksRedirectSurface(acquisitionSurface)) {
      throw new Error(
        'Infoworks verified acquisition page no longer matches the trusted first-party surface',
      )
    }

    for (const url of FIRST_PARTY_REDIRECT_ROUTES) {
      const surface = await probe(url)

      if (isExpectedInfoworksRedirectSurface(surface)) continue

      if (isUnexpectedReachableSurface(surface)) {
        throw new Error(
          `${COMPANY} public jobs surface now appears reachable: ${surface.finalUrl || surface.url}`,
        )
      }

      throw new Error(
        `${COMPANY} verified redirect route changed materially: ${surface.finalUrl || surface.url}`,
      )
    }

    return []
  },
})

export const run = async (options = {}) => createInfoworksScraper().run(options)

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
