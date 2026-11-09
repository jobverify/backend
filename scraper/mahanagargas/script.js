import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MAHANAGAR_GAS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = MAHANAGAR_GAS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const FIRST_PARTY_ROOT_URLS = [HOMEPAGE_URL]
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  'https://www.mahanagargas.com/careers',
  'https://www.mahanagargas.com/career',
  'https://www.mahanagargas.com/recruitment',
  'https://www.mahanagargas.com/jobs',
  'https://www.mahanagargas.com/work-with-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 10000

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialMahanagarGasSurfaceSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Mahanagar Gas Limited,?\s*\(MGL\)\s*<\/title>/i.test(page)
    && /Mahanagar Gas Limited/i.test(normalized)
    && (
      (
        /PNG Rate/i.test(normalized)
        && /CNG Rate/i.test(normalized)
        && /Emergency No\s*18002669944/i.test(normalized)
      )
      || /Pioneering Natural Gas Solutions in India/i.test(normalized)
      || /Caution Notice/i.test(normalized)
    )
}

export const hasPublicJobsSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  if (/boards-api\.greenhouse|job-boards\.greenhouse|greenhouse\.io|lever\.co|smartrecruiters|workdayjobs|darwinbox|peoplestrong|jobvite|icims/i.test(page)) {
    return true
  }

  return /\b(current openings|open positions|job openings|vacancies|search jobs)\b/i.test(normalized)
    && /\b(apply now|job detail|role|position|location|department)\b/i.test(normalized)
}

export const isExpectedUnreachableSurface = (surface = {}) =>
  surface?.errorKind === 'timeout'
  && !Number.isInteger(surface?.status)
  && surface?.html == null

export const isUnexpectedReachableSurface = (surface = {}) =>
  Number.isInteger(surface?.status) && surface.status > 0

export const isExpectedNoPublicJobsSurface = (surface = {}) =>
  (
    Number(surface?.status) === 200
    && hasOfficialMahanagarGasSurfaceSignal(surface?.html)
    && !hasPublicJobsSignal(surface?.html)
  )
  || (
    Number(surface?.status) === 404
    && /Cannot GET\s+\//i.test(normalizeWhitespace(surface?.html))
    && !hasPublicJobsSignal(surface?.html)
  )

const defaultProbeUrl = async (url) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    return {
      url,
      finalUrl: response.url,
      status: response.status,
      html: await response.text(),
      errorKind: null,
    }
  } catch (error) {
    clearTimeout(timeout)

    if (error?.name === 'AbortError') {
      return {
        url,
        finalUrl: url,
        status: null,
        html: null,
        errorKind: 'timeout',
      }
    }

    const cause = String(error?.cause ?? error?.message ?? error)
    if (/ENOTFOUND|getaddrinfo/i.test(cause)) {
      return {
        url,
        finalUrl: url,
        status: null,
        html: null,
        errorKind: 'dns',
      }
    }

    return {
      url,
      finalUrl: url,
      status: null,
      html: null,
      errorKind: 'network',
      errorMessage: String(error?.message ?? error),
    }
  }
}

const assertVerifiedUnreachableSurface = (surface, label) => {
  if (isExpectedNoPublicJobsSurface(surface) || isExpectedUnreachableSurface(surface)) return

  if (isUnexpectedReachableSurface(surface) && hasPublicJobsSignal(surface?.html)) {
    throw new Error(`Mahanagar Gas ${label} now appears reachable or exposes a public jobs surface: ${surface.finalUrl || surface.url}`)
  }

  if (isUnexpectedReachableSurface(surface)) {
    throw new Error(`Mahanagar Gas ${label} no longer matches the verified no-public-jobs surface: ${surface.finalUrl || surface.url}`)
  }

  throw new Error(`Mahanagar Gas verified no-public-jobs surface changed materially: ${surface.url}`)
}

export const createMahanagarGasScraper = () => ({
  async run({ probeUrl = defaultProbeUrl } = {}) {
    const rootSurfaces = await Promise.all(FIRST_PARTY_ROOT_URLS.map((url) => probeUrl(url)))
    rootSurfaces.forEach((surface) =>
      assertVerifiedUnreachableSurface(surface, 'official first-party root'))

    const routeSurfaces = await Promise.all(NO_PUBLIC_JOB_ROUTE_URLS.map((url) => probeUrl(url)))
    routeSurfaces.forEach((surface) =>
      assertVerifiedUnreachableSurface(surface, 'public jobs surface'))

    return []
  },
})

export const run = async (options = {}) => createMahanagarGasScraper().run(options)

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
