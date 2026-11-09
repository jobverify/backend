import path from 'node:path'
import { fileURLToPath } from 'node:url'

import GREAVES_ELECTRIC_MOBILITY_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /jobdetails\/\d+/i,
  /applyjob\/\d+/i,
]

export const PROVIDER_METADATA = GREAVES_ELECTRIC_MOBILITY_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const OFFICIAL_CAREERS_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#039;|&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const matchesExpectedUrl = (value, expected) => {
  try {
    const actualUrl = new URL(value)
    const expectedUrl = new URL(expected)

    const normalizePath = (pathname) => pathname === '/' ? '/' : pathname.replace(/\/+$/, '')

    return actualUrl.hostname.replace(/^www\./i, '').toLowerCase() === expectedUrl.hostname.replace(/^www\./i, '').toLowerCase()
      && normalizePath(actualUrl.pathname) === normalizePath(expectedUrl.pathname)
      && actualUrl.search === expectedUrl.search
  } catch {
    return false
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(15000) : undefined,
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractOfficialKekaHandoffUrl = (html = '') => {
  const match = String(html ?? '').match(/https:\/\/peopleatgems\.kekahire\.com\/?/i)
  if (!match?.[0]) return null
  return match[0].endsWith('/') ? match[0] : `${match[0]}/`
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Careers - Greaves Electric Mobility\s*<\/title>/i.test(page)
    && normalized.includes("We take charge of an electric future for all. If you're one of us, join our squad.")
    && normalized.includes('Hello Technovators, explore opportunities in Design, Technology, Sales, and many more interesting functions.')
    && normalized.includes('customersupport@greaveselectricmobility.com')
    && normalized.includes('Greaves Electric Mobility Limited')
    && extractOfficialKekaHandoffUrl(page) === OFFICIAL_CAREERS_HANDOFF_URL
}

export const isExpectedVerificationFailure = (error) => {
  const message = String(error?.message ?? '')
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const combined = `${message} ${causeCode} ${causeMessage}`

  return /UND_ERR_CONNECT_TIMEOUT/i.test(combined)
    || /Connect Timeout Error/i.test(combined)
    || /Could not establish trust relationship for the SSL\/TLS secure channel/i.test(combined)
    || /DEPTH_ZERO_SELF_SIGNED_CERT/i.test(combined)
    || /self-signed certificate/i.test(combined)
    || /certificate has expired/i.test(combined)
}

const fetchVerifiedPage = async (url, fetchPage) => {
  try {
    return await fetchPage(url)
  } catch (error) {
    if (isExpectedVerificationFailure(error)) {
      return null
    }

    throw error
  }
}

export const createGreavesElectricMobilityScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_PAGE_URL)

    if (
      Number(careersPage?.status) !== 200
      || !matchesExpectedUrl(careersPage?.url, CAREERS_PAGE_URL)
      || !hasOfficialCareersSignal(careersPage?.html)
    ) {
      throw new Error('The verified Greaves Electric Mobility careers page changed materially')
    }

    if (extractOfficialKekaHandoffUrl(careersPage?.html) !== OFFICIAL_CAREERS_HANDOFF_URL) {
      throw new Error('The verified Greaves Electric Mobility Keka handoff changed materially')
    }

    const handoffPage = await fetchVerifiedPage(OFFICIAL_CAREERS_HANDOFF_URL, fetchPage)
    if (handoffPage == null) return []

    if (pageExposesPublicJobListings(handoffPage?.html)) {
      throw new Error(
        'The verified Greaves Electric Mobility Keka handoff now appears to expose public jobs',
      )
    }

    throw new Error('The verified Greaves Electric Mobility Keka handoff requires re-verification')
  },
})

export const run = async (options = {}) => createGreavesElectricMobilityScraper(options).run(options)

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
