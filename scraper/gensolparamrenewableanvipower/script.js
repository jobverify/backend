import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'gensolparamrenewableanvipower'
export const COMPANY = 'Gensol Param Renewable / Gensol-Anvi Power'
export const HOMEPAGE_URL = 'https://www.gensol.in/'
export const CAREERS_ROUTE_URLS = [
  'https://www.gensol.in/careers',
  'https://www.gensol.in/jobs',
]
export const OFFICIAL_SURFACE_URLS = [
  HOMEPAGE_URL,
  ...CAREERS_ROUTE_URLS,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNAL_PATTERN_SETS = [
  [
    /<title>\s*gensol\.in\s*<\/title>/i,
    /Something amazing will be constructed here/i,
    /upload your website into the public_html directory/i,
    /https:\/\/www\.directadmin\.com/i,
  ],
  [
    /<title>\s*Website Under Development\s*<\/title>/i,
    /Under Development/i,
    /This website is coming soon!/i,
    /HorizonWebinfo Pvt Ltd/i,
    /ERP\s*\|\s*CRM\s*\|\s*Mobile Application\s*\|\s*Website\s*\|\s*HRMS/i,
  ],
]

const MISSING_ROUTE_SIGNAL_PATTERNS = [
  /<title>\s*404 Not Found\s*<\/title>/i,
  /The resource requested could not be found on this server!/i,
  /Proudly powered by LiteSpeed Web Server/i,
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bview jobs\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /greenhouse\.io/i,
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

export const hasVerifiedHomepageSignal = (html) => {
  const page = String(html ?? '')
  return HOMEPAGE_SIGNAL_PATTERN_SETS.some((patterns) => (
    patterns.every((pattern) => pattern.test(page))
  ))
}

export const hasPublicJobsSignal = (html) => PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => (
  pattern.test(String(html ?? ''))
))

export const isVerifiedMissingRoute = (page = {}) => {
  if (Number(page?.status) !== 404) {
    return false
  }

  if (hasPublicJobsSignal(page?.html)) {
    return false
  }

  return MISSING_ROUTE_SIGNAL_PATTERNS.every((pattern) => pattern.test(String(page?.html ?? '')))
}

export const getRunnerMetadata = () => ({
  name: SOURCE,
  dryRunFile: 'jobs.json',
  provider: {
    source: SOURCE,
    companyName: COMPANY,
    companyCareerPage: HOMEPAGE_URL,
    alternateCareerPages: CAREERS_ROUTE_URLS,
    adapter: 'script',
    atsPlatform: 'official-company-site-no-public-careers',
    countryFilter: 'India',
    parser: 'custom-script',
    paginationStrategy: 'homepage-plus-common-careers-route-validation',
    extractionStrategy: 'verified-official-homepage-plus-missing-first-party-careers-routes-return-empty',
    normalizationProfile: 'engineering-default',
    companyDomain: 'gensol.in',
  },
})

export const createGensolParamRenewableAnviPowerScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasVerifiedHomepageSignal(homepage.html)) {
      throw new Error('Gensol Param Renewable / Gensol-Anvi Power verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Gensol Param Renewable / Gensol-Anvi Power homepage now appears to expose a public jobs surface')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)

      if (!isVerifiedMissingRoute(careersRoute)) {
        throw new Error('Gensol Param Renewable / Gensol-Anvi Power careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createGensolParamRenewableAnviPowerScraper().run(options)

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
