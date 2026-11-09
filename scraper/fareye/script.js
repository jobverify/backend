import path from 'node:path'
import { fileURLToPath } from 'node:url'

import FAREYE_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FAREYE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OFFICIAL_DARWINBOX_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const DARWINBOX_JOBS_URL = PROVIDER_METADATA.darwinboxJobsUrl
export const DARWINBOX_SHELL_ROUTE_URLS = PROVIDER_METADATA.darwinboxShellRouteUrls
export const DARWINBOX_LISTING_API_URL = PROVIDER_METADATA.darwinboxListingApiUrl
export const DARWINBOX_COMPANY_CONFIG_URL = PROVIDER_METADATA.darwinboxCompanyConfigUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob listings?\b/i,
  /\bapply now\b/i,
  /\bjob details?\b/i,
  /\/careers\/jobDetails\//i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/[\u2018\u2019\u201b]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const normalized = normalizeWhitespace(match?.[1])
  return normalized || null
}

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

const sameUrl = (left, right) => normalizeUrl(left) === normalizeUrl(right)

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

const defaultProbeApi = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
      ...(options.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body: options.body,
    redirect: 'follow',
  })

  return {
    status: response.status,
    body: await response.text(),
  }
}

export const extractOfficialDarwinboxUrl = (html = '') => {
  const match = String(html ?? '').match(/https:\/\/fareye\.darwinbox\.in\/ms\/candidate\/careers/i)
  return match ? normalizeUrl(match[0]) : null
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  return extractTitle(page) === 'First choice for last-mile | FarEye'
    && /href=["']https:\/\/fareye\.com\/about\/careers["']/i.test(page)
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return extractTitle(page) === 'Careers | FarEye'
    && /Who is FarEye\?/i.test(normalized)
    && /We're problem-solvers,\s*thinkers,\s*and intrapreneurs\./i.test(normalized)
    && normalized.includes('Explore our open positions.')
    && normalized.includes('Join us')
    && normalized.includes('Explore open positions')
    && extractOfficialDarwinboxUrl(page) === OFFICIAL_DARWINBOX_HANDOFF_URL
}

export const hasDarwinboxLoginRedirectSignal = (page = {}) => (
  Number(page?.status) === 200
  && sameUrl(page?.url, 'https://darwinbox.com/')
  && extractTitle(page?.html) === 'Darwinbox - HR Software | New-Age HR Management Software'
)

export const hasMinimalDarwinboxShellSignal = (html = '') => {
  const page = String(html ?? '')

  return extractTitle(page) === null
    && /runtime\.[a-z0-9]+\.js/i.test(page)
    && /polyfills\.[a-z0-9]+\.js/i.test(page)
    && /scripts\.[a-z0-9]+\.js/i.test(page)
    && /main\.[a-z0-9]+\.js/i.test(page)
    && !PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(page))
}

export const hasBrokenDarwinboxApiSignal = ({ status, body } = {}) => {
  const normalized = normalizeWhitespace(body).toLowerCase()

  return Number(status) === 500
    && normalized.includes('status')
    && normalized.includes('error')
    && normalized.includes('internal server error')
    && normalized.includes('error while getting tenant info')
}

export const createFarEyeScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    probeApi = defaultProbeApi,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      Number(homepage?.status) !== 200
      || !sameUrl(homepage?.url, HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage?.html)
    ) {
      throw new Error('FarEye official homepage no longer matches the verified public surface')
    }

    const careersPage = await fetchPage(OFFICIAL_CAREERS_URL)
    if (
      Number(careersPage?.status) !== 200
      || !sameUrl(careersPage?.url, OFFICIAL_CAREERS_URL)
      || !hasOfficialCareersPageSignal(careersPage?.html)
    ) {
      throw new Error('FarEye official careers page no longer matches the verified public surface')
    }

    const darwinboxJobsPage = await fetchPage(DARWINBOX_JOBS_URL)
    if (!hasDarwinboxLoginRedirectSignal(darwinboxJobsPage)) {
      throw new Error('FarEye Darwinbox jobs redirect no longer matches the verified public surface')
    }

    for (const routeUrl of DARWINBOX_SHELL_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (Number(routePage?.status) !== 200 || !hasMinimalDarwinboxShellSignal(routePage?.html)) {
        throw new Error('FarEye Darwinbox shell route no longer matches the verified public surface')
      }
    }

    const listingApiResult = await probeApi(DARWINBOX_LISTING_API_URL, {
      method: 'POST',
      body: JSON.stringify({
        companyId: 'main',
        sort_option: 'new',
        limit: 10,
        page: 1,
      }),
      headers: {
        Origin: 'https://fareye.darwinbox.in',
        Referer: 'https://fareye.darwinbox.in/ms/candidatev2/main/careers/allJobs',
      },
    })

    if (!hasBrokenDarwinboxApiSignal(listingApiResult)) {
      throw new Error('FarEye Darwinbox listing api no longer matches the verified public surface')
    }

    const companyConfigResult = await probeApi(DARWINBOX_COMPANY_CONFIG_URL, {
      headers: {
        Origin: 'https://fareye.darwinbox.in',
        Referer: 'https://fareye.darwinbox.in/ms/candidatev2/main/careers/allJobs',
      },
    })

    if (!hasBrokenDarwinboxApiSignal(companyConfigResult)) {
      throw new Error('FarEye Darwinbox company config api no longer matches the verified public surface')
    }

    return []
  },
})

export const run = async (options = {}) => createFarEyeScraper().run(options)

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
