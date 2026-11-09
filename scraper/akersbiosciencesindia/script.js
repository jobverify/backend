import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AKERS_BIOSCIENCES_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AKERS_BIOSCIENCES_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const PARKED_EXACT_NAME_URL = PROVIDER_METADATA.parkedExactNameUrl
export const OFFICIAL_HOST_URL = PROVIDER_METADATA.companyCareerPage
export const PARKED_ROUTE_URLS = [
  PARKED_EXACT_NAME_URL,
  'https://akersbiosciences.com/careers',
  'https://akersbiosciences.com/jobs',
]
export const OFFICIAL_SURFACE_URLS = [
  'https://akersbio.com/',
  'https://akersbio.com/sitemap.xml',
  'https://akersbio.com/contact-us',
]
export const MISSING_JOB_ROUTE_URLS = [
  'https://akersbio.com/careers',
  'https://akersbio.com/jobs',
  'https://akersbio.com/openings',
]
const PARKED_DOMAIN_DESTINATION_URL =
  'https://www.hugedomains.com/domain_profile.cfm?d=akersbiosciences.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bview openings\b/i,
  /\bopen roles\b/i,
  /\bjoin our team\b/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&ndash;|&mdash;|&#8211;|&#8212;/gi, '-')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const isConnectTimeoutError = (error) => {
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const message = String(error?.message ?? error ?? '')

  return /UND_ERR_CONNECT_TIMEOUT/i.test(causeCode)
    || /\bconnect timeout(?: error)?\b/i.test(causeMessage)
    || /\bconnect timeout(?: error)?\b/i.test(message)
}

export const createFetchPage = ({ fetchImpl = fetch } = {}) => async (url) => {
  const fetchResponse = (targetUrl, redirect = 'follow') => fetchImpl(targetUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect,
  })

  let response

  try {
    response = await fetchResponse(url)
  } catch (error) {
    if (!isConnectTimeoutError(error) || !PARKED_ROUTE_URLS.includes(url)) throw error

    const fallbackUrl = new URL(url)
    fallbackUrl.protocol = 'http:'
    const redirectResponse = await fetchResponse(fallbackUrl.href, 'manual')
    const redirectUrl = new URL(redirectResponse.headers.get('location') ?? '', fallbackUrl).href

    if (
      [301, 302, 303, 307, 308].includes(redirectResponse.status)
      && redirectUrl === PARKED_DOMAIN_DESTINATION_URL
    ) {
      response = await fetchResponse(redirectUrl)
    } else {
      response = redirectResponse
    }
  }

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchPage = createFetchPage()

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasVerifiedParkedSurface = (html = '') => {
  const page = String(html ?? '')
  const title = extractTitle(page)
  const text = normalizeWhitespace(page)

  return title === 'AkersBiosciences.com is for sale | HugeDomains'
    && text.includes('AkersBiosciences.com is for sale')
    && text.includes('HugeDomains')
}

const getPathname = (value = '') => {
  try {
    return new URL(value).pathname.replace(/\/$/, '') || '/'
  } catch {
    return ''
  }
}

export const hasVerifiedOfficialSurface = (page = {}) => {
  const html = String(page.html ?? '')
  const title = extractTitle(html)
  const text = normalizeWhitespace(html)
  const pathname = getPathname(page.url)

  if (Number(page.status) !== 200 || hasPublicJobsSignal(html)) return false

  if (pathname === '/sitemap.xml') {
    return /<loc>http:\/\/www\.akersbio\.com<\/loc>/i.test(html)
      && /<loc>http:\/\/www\.akersbio\.com\/products<\/loc>/i.test(html)
      && /<loc>http:\/\/www\.akersbio\.com\/contact-us<\/loc>/i.test(html)
      && !/\/(?:career|careers|jobs?|openings)(?:\/|<)/i.test(html)
  }

  return (
    (
      title === 'Akers Bio | Biotechnology Research, Life Sciences & Innovation'
      || title === 'Contact Us - Akers Biosciences, Inc.'
    )
    && text.includes('Akers Biosciences')
    && text.includes('Products')
    && text.includes('Investor Center')
  )
}

export const isMissingJobRoute = (page = {}) => {
  const html = String(page.html ?? '')
  const text = normalizeWhitespace(html)

  return Number(page.status) === 404
    && extractTitle(html) === '404 Not Found'
    && text.includes('The requested URL was not found on this server.')
    && !hasPublicJobsSignal(html)
}

export const createAkersBiosciencesIndiaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    for (const url of PARKED_ROUTE_URLS) {
      const page = await fetchPage(url)

      if (hasPublicJobsSignal(page.html)) {
        throw new Error(`Akers Biosciences India parked exact-name domain route now appears to expose public jobs: ${url}`)
      }

      if (!hasVerifiedParkedSurface(page.html)) {
        throw new Error(`Akers Biosciences India verified parked exact-name domain surface changed: ${url}`)
      }
    }

    for (const url of OFFICIAL_SURFACE_URLS) {
      const page = await fetchPage(url)

      if (hasPublicJobsSignal(page.html)) {
        throw new Error(`Akers Biosciences India official canonical host route now appears to expose public jobs: ${url}`)
      }

      if (!hasVerifiedOfficialSurface(page)) {
        throw new Error(`Akers Biosciences India official canonical host surface changed: ${url}`)
      }
    }

    for (const url of MISSING_JOB_ROUTE_URLS) {
      const page = await fetchPage(url)

      if (hasPublicJobsSignal(page.html)) {
        throw new Error(`Akers Biosciences India missing canonical jobs route now appears to expose public jobs: ${url}`)
      }

      if (!isMissingJobRoute(page)) {
        throw new Error(`Akers Biosciences India verified missing canonical jobs route changed: ${url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createAkersBiosciencesIndiaScraper().run(options)

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
