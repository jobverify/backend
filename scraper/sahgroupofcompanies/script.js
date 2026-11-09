import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sahgroupofcompanies'
export const COMPANY = 'SAH Group of Companies'
export const HOMEPAGE_URL = 'https://www.sah.co.in/'
export const CAREERS_PAGE_URL = 'https://www.sah.co.in/careers'
export const JOBS_PAGE_URL = 'https://www.sah.co.in/jobs'
export const OFFICIAL_SURFACE_URLS = [
  HOMEPAGE_URL,
  CAREERS_PAGE_URL,
  JOBS_PAGE_URL,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNAL_PATTERNS = [
  /<title>\s*SAH\s*-\s*Coming Soon\s*<\/title>/i,
  />\s*Coming Soon\s*</i,
  />\s*SAH\s*</i,
]

const MISSING_JOBS_SIGNAL_PATTERNS = [
  /<title>\s*(?:Page not found|404:\s*This page could not be found\.)\s*<\/title>/i,
  />\s*404\s*</i,
  /(?:page could not be found|page not found)/i,
]

const defaultHeaders = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: defaultHeaders,
    redirect: 'manual',
  })

  return {
    url,
    status: response.status,
    text: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) =>
  HOMEPAGE_SIGNAL_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingJobsPage = (page) =>
  Number(page?.status) === 404
  && MISSING_JOBS_SIGNAL_PATTERNS.every((pattern) => pattern.test(String(page?.text ?? '')))

export const getRunnerMetadata = () => ({
  name: SOURCE,
  dryRunFile: 'jobs.json',
  provider: {
    source: SOURCE,
    companyName: COMPANY,
    companyCareerPage: CAREERS_PAGE_URL,
    alternateCareerPages: [HOMEPAGE_URL, JOBS_PAGE_URL],
    adapter: 'script',
    atsPlatform: 'no-public-jobs-surface',
    countryFilter: 'India',
    parser: 'custom-script',
    paginationStrategy: 'none',
    extractionStrategy: 'verified-placeholder-homepage-plus-missing-first-party-careers-return-empty',
    normalizationProfile: 'engineering-default',
    companyDomain: 'sah.co.in',
  },
})

export const createSahGroupOfCompaniesScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (Number(homepage.status) !== 200 || !hasOfficialHomepageSignal(homepage.text)) {
      throw new Error('SAH Group of Companies verified SAH homepage no longer matches the placeholder first-party site')
    }

    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    if (!isVerifiedMissingJobsPage(careersPage)) {
      throw new Error('SAH Group of Companies verified missing careers page changed or now exposes public jobs')
    }

    const jobsPage = await fetchPage(JOBS_PAGE_URL)
    if (!isVerifiedMissingJobsPage(jobsPage)) {
      throw new Error('SAH Group of Companies verified missing jobs page changed or now exposes public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createSahGroupOfCompaniesScraper().run(options)

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
