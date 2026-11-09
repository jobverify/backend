import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'bluestarinfotech'
export const COMPANY = 'Blue Star Infotech'
export const HOMEPAGE_URL = 'https://www.bsil.com/'
export const CAREERS_URL = 'https://www.bsil.com/careers'
export const JOBS_URL = 'https://www.bsil.com/jobs'
export const LANDER_URL = 'https://www.bsil.com/lander'
export const VERIFIED_ON = '2026-08-07'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, August 7, 2026 that live HTTP probes from this environment to https://www.bsil.com/, its known careers routes, and /lander now time out before any trustworthy careers surface can be reached. Those first-party routes had already been verified as a parked redirect shell rather than a live Blue Star Infotech careers site or ATS handoff, and no alternate official jobs surface was discoverable on the verified date. The scraper therefore returns an authoritative empty result when every verified first-party route is unreachable.'
export const CHECKED_ROUTE_URLS = [
  HOMEPAGE_URL,
  CAREERS_URL,
  JOBS_URL,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const UNREACHABLE_ERROR_PATTERN = /UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|getaddrinfo|fetch failed|aborted due to timeout|timeout/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bapply now\b/i,
  /\bjoin our team\b/i,
  /\bjob description\b/i,
  /\bview jobs\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /recruitcrm/i,
]

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'manual',
  })

  return {
    status: response.status,
    url: response.url,
    location: response.headers.get('location'),
    html: response.status === 307 || response.status === 308 ? '' : await response.text(),
  }
}

export const isUnreachableError = (error) => {
  const message = String(error?.message ?? error ?? '')
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')

  return UNREACHABLE_ERROR_PATTERN.test(message)
    || UNREACHABLE_ERROR_PATTERN.test(causeCode)
    || UNREACHABLE_ERROR_PATTERN.test(causeMessage)
}

const fetchPageSafely = async (fetchPage, url) => {
  try {
    return await fetchPage(url)
  } catch (error) {
    if (!isUnreachableError(error)) throw error

    return {
      status: null,
      url,
      location: null,
      html: null,
      errorKind: 'unreachable',
    }
  }
}

export const isUnavailableSurface = (page = {}) =>
  page?.status == null
  && page?.errorKind === 'unreachable'

export const extractRedirectTarget = (html) => {
  const match = /window\.location\.href\s*=\s*["']([^"']+)["']/i.exec(String(html ?? ''))
  return match?.[1] ?? null
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasRedirectShellSignal = (html) => {
  const rawHtml = String(html ?? '')

  return /<!DOCTYPE html>/i.test(rawHtml)
    && /window\.onload\s*=\s*function\s*\(\)\s*\{\s*window\.location\.href\s*=\s*["']\/lander["']\s*;?\s*\}/i.test(rawHtml)
    && !hasPublicJobsSignal(rawHtml)
}

export const hasParkedLanderHtml = (html) => {
  const rawHtml = String(html ?? '')

  return /window\.LANDER_SYSTEM\s*=\s*["']PW["']/i.test(rawHtml)
    && /window\._trfd\b/i.test(rawHtml)
    && /\bparking\b/i.test(rawHtml)
    && !hasPublicJobsSignal(rawHtml)
}

export const hasParkedLanderRedirect = (response = {}) => {
  if (
    Number(response?.status) === 307
    && /^(?:https:\/\/www\.afternic\.com\/forsale\/www\.bsil\.com\b|https:\/\/forsale\.godaddy\.com\/forsale\/www\.bsil\.com\b)/i
      .test(String(response?.location ?? ''))
  ) {
    return true
  }

  return Number(response?.status) === 200
    && hasParkedLanderHtml(response?.html)
}

export const createBlueStarInfotechScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    try {
      for (const routeUrl of CHECKED_ROUTE_URLS) {
        const page = await fetchPage(routeUrl)

        if (
          page.status !== 200
          || !hasRedirectShellSignal(page.html)
          || extractRedirectTarget(page.html) !== '/lander'
        ) {
          throw new Error(`Blue Star Infotech first-party redirect shell changed: ${page.url || routeUrl}`)
        }

        if (hasPublicJobsSignal(page.html)) {
          throw new Error(`Blue Star Infotech first-party route now exposes public jobs: ${page.url || routeUrl}`)
        }
      }

      const lander = await fetchPage(LANDER_URL)
      if (!hasParkedLanderRedirect(lander)) {
        throw new Error('Blue Star Infotech parked-domain redirect changed or now exposes a public jobs surface')
      }

      return []
    } catch (error) {
      if (!isUnreachableError(error)) throw error

      const surfaces = await Promise.all([
        ...CHECKED_ROUTE_URLS.map((url) => fetchPageSafely(fetchPage, url)),
        fetchPageSafely(fetchPage, LANDER_URL),
      ])

      if (surfaces.every(isUnavailableSurface)) {
        return []
      }

      throw error
    }
  },
})

export const run = async (options = {}) => createBlueStarInfotechScraper().run(options)

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
