import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'crtdtechnologies'
export const COMPANY = 'CRTD Technologies'
export const HOMEPAGE_URL = 'https://www.crtd.in/'
export const CAREERS_URL = 'https://www.crtd.in/fresher-jobs'
export const API_JOBS_URL = 'https://www.crtd.in/api/jobs/?page=1&page_size=100'
export const API_STATS_URL = 'https://www.crtd.in/api/jobs/dynamic-job-openings/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_SHELL_PATTERNS = [
  /<title>\s*CRTD Technologies(?:\s*\|\s*IT Solutions (?:&|&amp;) Software Development)?\s*<\/title>/i,
  /<div id="root"[^>]*>/i,
  /<script[^>]+src="\/assets\/index-[^"]+\.js"/i,
]

const VERIFIED_BUNDLE_PATTERNS = [
  /\/fresher-jobs/,
  /\/job-description\/:id/,
  /\/jobs\/dynamic-job-openings\//,
  /\/jobs\/\?page=1&page_size=100/,
  /0 Immediate New Vacancies!/,
  /No jobs found\./,
  /careers@crtd\.in/i,
]

export const hasOfficialShellSignal = (html) => {
  const page = String(html ?? '')
  return OFFICIAL_SHELL_PATTERNS.every((pattern) => pattern.test(page))
}

const hasNoPublicCareersSignals = (html) => !/(careers@crtd\.in|fresher-jobs|job-description|dynamic-job-openings|openings|jobs)/i.test(
  String(html ?? ''),
)

export const extractBundleAssetUrl = (html) => {
  const match = String(html ?? '').match(/<script[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/i)
  if (!match?.[1]) return null

  try {
    return new URL(match[1], HOMEPAGE_URL).toString()
  } catch {
    return null
  }
}

export const hasVerifiedPublicJobsBundleSignal = (bundleJs) => {
  const source = String(bundleJs ?? '')
  return VERIFIED_BUNDLE_PATTERNS.every((pattern) => pattern.test(source))
}

export const isVerifiedBadRequestStatus = (statusCode) => Number(statusCode) === 400

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/javascript,text/javascript;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/javascript,text/javascript;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchStatus = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(15000),
  })

  return response.status
}

export const createCrtdTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchPage = defaultFetchPage, fetchStatus = defaultFetchStatus } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialShellSignal(homepage.html)) {
      throw new Error('The official CRTD Technologies site shell no longer matches the verified first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status === 404) {
      const [jobsStatus, statsStatus] = await Promise.all([
        fetchStatus(API_JOBS_URL),
        fetchStatus(API_STATS_URL),
      ])

      if (Number(jobsStatus) === 404 && Number(statsStatus) === 404 && hasNoPublicCareersSignals(homepage.html)) {
        return []
      }

      throw new Error('The CRTD Technologies public careers surface changed from the verified first-party empty-state contract')
    }

    if (careersPage.status !== 200 || !hasOfficialShellSignal(careersPage.html)) {
      throw new Error('The CRTD Technologies fresher-jobs page no longer matches the verified first-party site shell')
    }

    const bundleUrl = extractBundleAssetUrl(careersPage.html)
    if (!bundleUrl) {
      throw new Error('Unable to locate the CRTD Technologies first-party application bundle')
    }

    const bundleJs = await fetchText(bundleUrl)
    if (!hasVerifiedPublicJobsBundleSignal(bundleJs)) {
      throw new Error('The CRTD Technologies verified public jobs bundle no longer matches the July 13, 2026 empty-state surface')
    }

    const [jobsStatus, statsStatus] = await Promise.all([
      fetchStatus(API_JOBS_URL),
      fetchStatus(API_STATS_URL),
    ])

    if (!isVerifiedBadRequestStatus(jobsStatus) || !isVerifiedBadRequestStatus(statsStatus)) {
      throw new Error('The CRTD Technologies public jobs API state changed from the verified empty/bad-request surface')
    }

    return []
  },
})

export const run = async (options = {}) => createCrtdTechnologiesScraper().run(options)

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
