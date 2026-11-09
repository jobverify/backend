import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SOURCE = 'sbdautomotive'
export const COMPANY = 'SBD Automotive'
export const HOMEPAGE_URL = 'https://www.sbdautomotive.com/'
export const INDIA_URL = 'https://www.sbdautomotive.com/india'
export const CAREERS_URL = 'https://www.sbdautomotive.com/careers-vacancies'
export const WORKING_AT_SBD_URL = 'https://www.sbdautomotive.com/working-at-sbd'
export const BAMBOOHR_CV_URL = 'https://sbdautomotive.bamboohr.com/careers/91'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bview jobs\b/i,
  /\bread more\b/i,
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
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+,/g, ',')
  .replace(/\s+/g, ' ')
  .trim()

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

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('sbd automotive')
    && normalized.includes('safe, secure, sustainable')
    && normalized.includes('seamless mobility')
}

export const hasOfficialIndiaSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('sbd automotive bengaluru, india')
    && normalized.includes('founded by abhishek visveswaran in 2015')
    && normalized.includes('sbd automotive india team')
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('careers | sbd automotive')
    && normalized.includes('sbd automotive careers')
    && normalized.includes('help us shape the future of the automotive industry')
    && normalized.includes('unlock your potential with a career at sbd automotive')
    && normalized.includes("we're hiring")
}

export const hasOfficialWorkingAtSbdSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('working at sbd | sbd automotive')
    && normalized.includes('take a look at our current vacancies')
    && normalized.includes('browse our up-to-date careers page')
    && normalized.includes("don't see the role you're looking for")
    && normalized.includes('submit your cv')
}

export const extractBambooHrCareerLinks = (html) =>
  [...new Set(
    [...String(html ?? '').matchAll(/https:\/\/sbdautomotive\.bamboohr\.com\/careers\/\d+/gi)]
      .map((match) => match[0]),
  )]

export const hasOnlyVerifiedCvHandoff = (html) => {
  const links = extractBambooHrCareerLinks(html)
  return links.length === 1 && links[0] === BAMBOOHR_CV_URL
}

export const hasPublicJobsSignal = (html) => {
  const bambooHrLinks = extractBambooHrCareerLinks(html)
  if (bambooHrLinks.some((link) => link !== BAMBOOHR_CV_URL)) {
    return true
  }

  return PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))
}

export const createSbdAutomotiveScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('SBD Automotive official homepage no longer matches the known public surface')
    }

    const indiaPage = await fetchPage(INDIA_URL)
    if (indiaPage.status !== 200 || !hasOfficialIndiaSignal(indiaPage.html)) {
      throw new Error('SBD Automotive India page no longer matches the known public surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('SBD Automotive careers page changed materially or no longer matches the known public surface')
    }

    if (extractBambooHrCareerLinks(careersPage.html).length > 0 || hasPublicJobsSignal(careersPage.html)) {
      throw new Error('SBD Automotive careers page now appears to expose rendered public jobs')
    }

    const workingPage = await fetchPage(WORKING_AT_SBD_URL)
    if (workingPage.status !== 200 || !hasOfficialWorkingAtSbdSignal(workingPage.html)) {
      throw new Error('SBD Automotive working-at-sbd page changed materially or no longer matches the known public surface')
    }

    if (!hasOnlyVerifiedCvHandoff(workingPage.html)) {
      throw new Error('SBD Automotive working-at-sbd page no longer exposes the verified BambooHR CV handoff')
    }

    if (hasPublicJobsSignal(workingPage.html)) {
      throw new Error('SBD Automotive working-at-sbd page now appears to expose rendered public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createSbdAutomotiveScraper().run(options)

export const runStandalone = async ({
  argv = process.argv,
  runScraper = run,
  saveToFileImpl,
  saveToDbImpl,
} = {}) => {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = argv.includes('--dry-run')
  const jobs = await runScraper()

  if (isDryRun) {
    ;(saveToFileImpl || saveToFile)(jobs, path.join(currentDir, 'jobs.json'))
    return jobs
  }

  await (saveToDbImpl || saveToDB)(jobs, SOURCE)
  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runStandalone()
}
