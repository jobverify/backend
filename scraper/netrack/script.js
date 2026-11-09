import path from 'node:path'
import { fileURLToPath } from 'node:url'

import NETRACK_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = NETRACK_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CONTACT_URL = PROVIDER_METADATA.contactUrl
export const TEAM_URL = PROVIDER_METADATA.teamUrl
export const BLOCKED_ROUTE_URLS = [...PROVIDER_METADATA.blockedRouteUrls]
export const INFORMATIONAL_ROUTE_URLS = [HOMEPAGE_URL, CONTACT_URL, TEAM_URL]
export const MISSING_ROUTE_URLS = BLOCKED_ROUTE_URLS.filter((url) => !INFORMATIONAL_ROUTE_URLS.includes(url))
export const VERIFIED_ROUTE_TITLES = {
  [HOMEPAGE_URL]: 'Netrack | Server Enclosures | Network Enclosures | Server Racks',
  [CONTACT_URL]: 'Contact | Netrack | quiet server cabinet Manufacturers',
  [TEAM_URL]: 'Netrack Team | Server enclosures manufacturers',
}

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bjoin our team\b/i,
  /\bapply now\b/i,
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
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
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

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasVerifiedInformationalSurface = (page = {}, { expectedUrl, expectedTitle } = {}) => {
  const rawHtml = String(page.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return Number(page.status) === 200
    && String(page.url ?? '') === String(expectedUrl ?? '')
    && extractTitle(rawHtml) === String(expectedTitle ?? '')
    && normalized.includes('Netrack')
    && !hasPublicJobsSignal(rawHtml)
}

export const hasVerifiedMissingJobsRoute = (page = {}, expectedUrl) => {
  const rawHtml = String(page.html ?? '')

  return Number(page.status) === 404
    && String(page.url ?? '') === String(expectedUrl ?? '')
    && extractTitle(rawHtml) === ''
    && normalizeWhitespace(rawHtml) === ''
    && !hasPublicJobsSignal(rawHtml)
}

export const createNetrackScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    for (const url of INFORMATIONAL_ROUTE_URLS) {
      const page = await fetchPage(url)

      if (hasPublicJobsSignal(page.html)) {
        throw new Error(`Netrack blocked first-party route now appears to expose public jobs: ${url}`)
      }

      if (!hasVerifiedInformationalSurface(page, {
        expectedUrl: url,
        expectedTitle: VERIFIED_ROUTE_TITLES[url],
      })) {
        throw new Error(`Netrack first-party informational surface changed: ${url}`)
      }
    }

    for (const url of MISSING_ROUTE_URLS) {
      const page = await fetchPage(url)

      if (hasPublicJobsSignal(page.html)) {
        throw new Error(`Netrack blocked first-party route now appears to expose public jobs: ${url}`)
      }

      if (!hasVerifiedMissingJobsRoute(page, url)) {
        throw new Error(`Netrack missing careers route changed: ${url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createNetrackScraper().run(options)

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
