import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { OTIPY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = OTIPY_CATALOG.source
export const COMPANY = OTIPY_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = OTIPY_CATALOG.officialBrandName
export const VERIFIED_ON = OTIPY_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = OTIPY_CATALOG.verifiedSurfaceSummary
export const HOMEPAGE_URL = OTIPY_CATALOG.homepageUrl
export const CAREERS_URL = OTIPY_CATALOG.companyCareerPage
export const JOBS_URL = OTIPY_CATALOG.officialJobsPageUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards(?:\.eu)?\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /\bjob id\b/i,
  /\brequisition\b/i,
  /\bapply now\b/i,
]

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

export const defaultFetchPage = async (url, {
  fetchImpl = fetch,
  timeoutMs = 15000,
} = {}) => {
  try {
    const response = await fetchImpl(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: createTimeoutSignal(timeoutMs),
    })

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
      errorCode: null,
      errorMessage: null,
      errorReason: null,
    }
  } catch (error) {
    return {
      status: 0,
      url,
      html: '',
      errorCode: error?.cause?.code || error?.code || null,
      errorMessage: error?.message || String(error),
      errorReason: error?.cause?.reason || null,
    }
  }
}

export const isRestrictedSurface = (page = {}) =>
  (
    page.status === 403
    && /Access is restricted/i.test(String(page.html ?? ''))
  )
  || (
    page.status === 0
    && /ERR_TLS_CERT_ALTNAME_INVALID/i.test(String(page.errorCode ?? ''))
    && /not in the cert's altnames/i.test(
      `${page.errorReason ?? ''} ${page.errorMessage ?? ''}`,
    )
  )

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createOtipyScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Otipy blocked first-party surface now appears to expose public jobs')
    }
    if (!isRestrictedSurface(homepage)) {
      throw new Error('Otipy blocked first-party surface no longer matches the verified homepage contract')
    }

    for (const url of [CAREERS_URL, JOBS_URL]) {
      const response = await fetchPage(url)

      if (hasPublicJobsSignal(response.html)) {
        throw new Error('Otipy blocked first-party surface now appears to expose public jobs')
      }

      if (!isRestrictedSurface(response)) {
        throw new Error('Otipy blocked first-party surface no longer matches the verified careers contract')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createOtipyScraper().run(options)

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
