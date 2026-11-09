import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BHARAT_FIH_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BHARAT_FIH_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const WWW_HOMEPAGE_URL = PROVIDER_METADATA.wwwHomepageUrl
export const FIRST_PARTY_ROUTE_URLS = [
  HOMEPAGE_URL,
  WWW_HOMEPAGE_URL,
  ...PROVIDER_METADATA.firstPartyCareerRouteUrls,
]
export const DARWINBOX_JOBS_URL = PROVIDER_METADATA.darwinboxJobsUrl
export const DARWINBOX_SHELL_ROUTE_URLS = PROVIDER_METADATA.darwinboxShellRouteUrls
export const DARWINBOX_LISTING_API_URL = PROVIDER_METADATA.darwinboxListingApiUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob listings?\b/i,
  /\bjob postings?\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\/careers\/jobDetails\//i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''

    if (url.pathname !== '/') {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }

    return url.toString()
  } catch {
    return String(value ?? '').trim()
  }
}

const getErrorSignalText = (error) => {
  const seen = new Set()
  const parts = []
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)

    if (current?.name) parts.push(String(current.name))
    if (current?.code) parts.push(String(current.code))
    if (current?.message) parts.push(String(current.message))

    current = current?.cause
  }

  return parts.join(' ').toLowerCase()
}

export const isTlsHostnameMismatchError = (error) => {
  const signals = getErrorSignalText(error)

  return signals.includes('sec_e_wrong_principal')
    || signals.includes('wrong_principal')
    || signals.includes('target principal name is incorrect')
    || signals.includes('err_tls_cert_altname_invalid')
    || signals.includes('altname invalid')
    || (signals.includes('certificate') && signals.includes('hostname'))
}

export const hasBlankDarwinboxShellSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const hasNoPublicJobs = !PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(page))
  const hasAngularCandidateShell = /<!doctype html>/i.test(page)
    && /<title>\s*<\/title>/i.test(page)
    && /<base[^>]+href=["']\/ms\/candidate(?:v2)?\/["']/i.test(page)
    && /<app-root\b/i.test(page)
    && /main\.[a-z0-9]+\.js/i.test(page)

  return hasNoPublicJobs && (
    /<!doctype html>/i.test(page)
    && /<title>\s*<\/title>/i.test(page)
    && /<meta[^>]+property=["']og:title["'][^>]+content=["']\s*["']/i.test(page)
    && normalized === '-'
    || hasAngularCandidateShell
  )
}

export const hasLoginRedirectToDarwinboxHome = (page = {}) => {
  try {
    const url = new URL(normalizeUrl(page?.url))
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()

    return Number(page?.status) === 200
      && hostname === 'darwinbox.com'
      && (url.pathname === '/' || url.pathname === '')
  } catch {
    return false
  }
}

export const hasInvalidDarwinboxSubdomainSignal = ({ status, body } = {}) => {
  const normalized = normalizeWhitespace(body).toLowerCase()

  return Number(status) >= 400
    && normalized.includes('invalid subdomain')
    && normalized.includes('bharatfih')
}

const defaultProbeOfficialRoute = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultProbeListingApi = async (url) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      companyId: 'main',
      sort_option: 'new',
      limit: 10,
      page: 1,
    }),
  })

  return {
    status: response.status,
    body: await response.text(),
  }
}

export const createBharatFihScraper = () => ({
  async run({
    probeOfficialRoute = defaultProbeOfficialRoute,
    fetchPage = defaultFetchPage,
    probeListingApi = defaultProbeListingApi,
  } = {}) {
    for (const routeUrl of FIRST_PARTY_ROUTE_URLS) {
      let sawVerifiedTlsFailure = false

      try {
        await probeOfficialRoute(routeUrl)
      } catch (error) {
        if (isTlsHostnameMismatchError(error)) {
          sawVerifiedTlsFailure = true
        } else {
          throw new Error(
            'Bharat FIH first-party route no longer matches the verified TLS mismatch surface',
            { cause: error },
          )
        }
      }

      if (!sawVerifiedTlsFailure) {
        throw new Error(
          'Bharat FIH first-party route no longer matches the verified TLS mismatch surface',
        )
      }
    }

    const jobsLandingPage = await fetchPage(DARWINBOX_JOBS_URL)
    if (!hasLoginRedirectToDarwinboxHome(jobsLandingPage)) {
      throw new Error(
        'Bharat FIH Darwinbox jobs handoff no longer matches the verified login redirect',
      )
    }

    for (const routeUrl of DARWINBOX_SHELL_ROUTE_URLS) {
      const page = await fetchPage(routeUrl)

      if (Number(page?.status) !== 200 || !hasBlankDarwinboxShellSignal(page?.html)) {
        throw new Error(
          'Bharat FIH Darwinbox shell route no longer matches the verified blank-shell state',
        )
      }
    }

    const listingApiResult = await probeListingApi(DARWINBOX_LISTING_API_URL)
    if (!hasInvalidDarwinboxSubdomainSignal(listingApiResult)) {
      throw new Error(
        'Bharat FIH Darwinbox listing API no longer matches the verified invalid-subdomain state',
      )
    }

    return []
  },
})

export const run = async (options = {}) => createBharatFihScraper().run(options)

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
