import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ohmiumoperationspltd'
export const COMPANY_NAME = 'Ohmium Operations (P) Ltd'
export const HOMEPAGE_URL = 'https://www.ohmium.com/'
export const WORKDAY_BASE_URL = 'https://ohmium.wd12.myworkdayjobs.com/Ohmium_Careers'
export const INDIA_LOCATION_COUNTRY = 'c4f78be1a8f14da0ab49ce1162348a5e'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_TITLE_PATTERN = /<title>\s*Ohmium\s*\|\s*Home\s*<\/title>/i
const HOMEPAGE_CAREERS_LINK_PATTERN =
  /<a[^>]+href=["'][^"']+["'][^>]*>\s*Careers\s*<\/a>/i
const WORKDAY_CANONICAL_PATTERN =
  /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/ohmium\.wd12\.myworkdayjobs\.com\/Ohmium_Careers["']/i
const WORKDAY_TENANT_PATTERN = /tenant:\s*"ohmium"/i
const WORKDAY_SITE_ID_PATTERN = /siteId:\s*"Ohmium_Careers"/i
const WORKDAY_DESCRIPTION_PATTERN = /Welcome to Ohmium Careers!/i
const WORKDAY_EMAIL_PATTERN = /@ohmium\.com/i

export const buildScraperOptions = () => ({
  company: COMPANY_NAME,
  baseUrl: WORKDAY_BASE_URL,
  locationCountry: INDIA_LOCATION_COUNTRY,
  source: SOURCE,
  scraperDir: currentDir,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return HOMEPAGE_TITLE_PATTERN.test(page) && HOMEPAGE_CAREERS_LINK_PATTERN.test(page)
}

const isVerifiedWorkdayHandoffUrl = (value) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://ohmium.wd12.myworkdayjobs.com'
      && url.pathname === '/Ohmium_Careers'
  } catch {
    return false
  }
}

export const extractVerifiedWorkdayHandoffUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    if (isVerifiedWorkdayHandoffUrl(match[1])) {
      return new URL(match[1]).toString()
    }
  }

  return null
}

export const hasVerifiedWorkdayBoardSignal = (html) => {
  const page = String(html ?? '')
  return WORKDAY_CANONICAL_PATTERN.test(page)
    && WORKDAY_TENANT_PATTERN.test(page)
    && WORKDAY_SITE_ID_PATTERN.test(page)
    && WORKDAY_DESCRIPTION_PATTERN.test(page)
    && WORKDAY_EMAIL_PATTERN.test(page)
}

const WORKDAY_AUTHORITATIVE_EMPTY = Symbol.for('jobverify.workday.authoritative-empty')

export const backfillMissingJobIds = (jobs = []) => {
  const normalizedJobs = mapJobsWithInventoryEvidence(jobs, (job) => {
    if (job?.jobId || !job?.requisitionId) {
      return job
    }

    return {
      ...job,
      jobId: job.requisitionId,
    }
  })

  if (jobs[WORKDAY_AUTHORITATIVE_EMPTY] === true) {
    Object.defineProperty(normalizedJobs, WORKDAY_AUTHORITATIVE_EMPTY, {
      value: true,
    })
  }
  return normalizedJobs
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 3,
  baseDelayMs: 2000,
  timeoutMs: 20000,
  label: SOURCE,
  signal,
})

export const createOhmiumOperationsPltdScraper = ({
  fetchText = defaultFetchText,
  workdayRunner = runWorkdayScraper,
} = {}) => ({
  async run({ signal } = {}) {
    const fetchVerifiedText = (url) => (
      signal === undefined ? fetchText(url) : fetchText(url, { signal })
    )
    const homepageHtml = await fetchVerifiedText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Ohmium official homepage surface changed; refusing to guess the careers handoff')
    }

    const verifiedWorkdayHandoffUrl = extractVerifiedWorkdayHandoffUrl(homepageHtml)
    if (verifiedWorkdayHandoffUrl !== WORKDAY_BASE_URL) {
      throw new Error('Ohmium verified Workday handoff changed; refusing to guess the public jobs source')
    }

    const workdayHtml = await fetchVerifiedText(WORKDAY_BASE_URL)
    assertWorkdayPageAvailable({ status: 200, html: workdayHtml, url: WORKDAY_BASE_URL }, { source: SOURCE, url: WORKDAY_BASE_URL })
    if (!hasVerifiedWorkdayBoardSignal(workdayHtml)) {
      throw new Error('Ohmium verified Workday board changed; refusing to guess the public jobs source')
    }

    return backfillMissingJobIds(await workdayRunner({
      ...buildScraperOptions(),
      ...(signal === undefined ? {} : { signal }),
    }))
  },
})

export const run = async ({
  fetchText = defaultFetchText,
  workdayRunner = runWorkdayScraper,
  signal,
} = {}) => createOhmiumOperationsPltdScraper({ fetchText, workdayRunner }).run({ signal })

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
