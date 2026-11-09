import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'talentserve'
export const COMPANY = 'TalentServe'
export const HOMEPAGE_URL = 'https://www.talentserve.org/'
export const CAREERS_URL = 'https://www.talentserve.org/careers.html'
export const OFFICIAL_SURFACE_URLS = [
  HOMEPAGE_URL,
  CAREERS_URL,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNAL_PATTERNS = [
  /<title>\s*Index - Company Bootstrap Template\s*<\/title>/i,
  /<h1[^>]*>\s*TalentServe\s*<\/h1>\s*<span>\s*\.\s*<\/span>/i,
  /Get Placed Upto 25LPA/i,
  /TalentServe's Job Guarantee Program has helped achieve placement upto 25LPA/i,
  /Book Our Free Demo Class/i,
  /href=["']careers\.html["']/i,
  /BootstrapMade/i,
]

const VERIFIED_404_PATTERNS = [
  /<title>\s*404 Not Found\s*<\/title>/i,
  /The resource requested could not be found on this server!/i,
  /Proudly powered by LiteSpeed Web Server/i,
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bview openings\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bjoin our team\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /greenhouse\.io/i,
  /recruitcrm/i,
  /linkedin\.com\/jobs/i,
  /href=["'][^"']*(?:\/jobs\/?|\/careers\/jobs\/?|\/openings\/?)["']/i,
]

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasVerifiedHomepageSignal = (html) => HOMEPAGE_SIGNAL_PATTERNS.every((pattern) => (
  pattern.test(String(html ?? ''))
))

export const hasPublicJobsSignal = (html) => PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => (
  pattern.test(String(html ?? ''))
))

export const isVerifiedMissingCareersRoute = (page = {}) => {
  if (Number(page?.status) !== 404) {
    return false
  }

  if (hasPublicJobsSignal(page?.html)) {
    return false
  }

  return VERIFIED_404_PATTERNS.every((pattern) => pattern.test(String(page?.html ?? '')))
}

export const getRunnerMetadata = () => ({
  name: SOURCE,
  dryRunFile: 'jobs.json',
  provider: {
    source: SOURCE,
    companyName: COMPANY,
    companyCareerPage: HOMEPAGE_URL,
    alternateCareerPages: [CAREERS_URL],
    adapter: 'script',
    atsPlatform: 'official-company-site-no-public-careers',
    countryFilter: 'India',
    parser: 'custom-script',
    paginationStrategy: 'homepage-plus-linked-careers-route-validation',
    extractionStrategy: 'verified-placeholder-homepage-plus-linked-litespeed-404-careers-route-return-empty',
    normalizationProfile: 'engineering-default',
    companyDomain: 'talentserve.org',
  },
})

export const createTalentServeScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasVerifiedHomepageSignal(homepage.html)) {
      throw new Error('TalentServe verified official homepage no longer matches the trusted first-party surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('TalentServe homepage now appears to expose a public jobs surface')
    }

    const careersRoute = await fetchPage(CAREERS_URL)
    if (!isVerifiedMissingCareersRoute(careersRoute)) {
      throw new Error('TalentServe linked careers route changed materially or now exposes public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createTalentServeScraper().run(options)

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
