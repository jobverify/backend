import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractAshbyJobs } from '../uipath/script.js'
import {
  fetchJsonWithRetry,
  fetchTextWithRetry,
} from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_PAGE_URL = 'https://atlan.com/careers/'
export const ASHBY_JOB_BOARD_URL = 'https://api.ashbyhq.com/posting-api/job-board/atlan'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = page.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  const hasLegacyAshbyHandoff = /careers?\s+at\s+atlan/i.test(page)
    && /CareersJobListings/i.test(page)
    && page.includes(ASHBY_JOB_BOARD_URL)
    && page.includes('jobs.ashbyhq.com/atlan')

  const hasCurrentClientRenderedJobsShell =
    /<title>\s*Careers\s*\|\s*Atlan\s*<\/title>/i.test(page)
    && /\bOpen positions\b/i.test(normalized)
    && /\bLoading positions\b/i.test(normalized)
    && /\bBrowse open roles\b/i.test(normalized)
    && (/\bRemote-first across\b/i.test(normalized) || /\[Website env:\s*production\]/i.test(normalized))

  return hasLegacyAshbyHandoff || hasCurrentClientRenderedJobsShell
}

export const extractVerifiedAshbyJobBoardUrl = (html) =>
  String(html ?? '').includes(ASHBY_JOB_BOARD_URL) || hasOfficialCareersSignal(html)
    ? ASHBY_JOB_BOARD_URL
    : null

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'atlan',
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  },
  label: 'atlan',
  timeoutMs: 15000,
})

export const createAtlanScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Atlan careers page no longer exposes the verified Ashby job-board handoff')
    }

    const verifiedJobBoardUrl = extractVerifiedAshbyJobBoardUrl(careersHtml)
    if (verifiedJobBoardUrl !== ASHBY_JOB_BOARD_URL) {
      throw new Error('Atlan careers page no longer exposes the verified Ashby job-board handoff')
    }

    const payload = await fetchJson(ASHBY_JOB_BOARD_URL)

    return extractAshbyJobs(payload).map((job) => ({
      ...job,
      company: 'Atlan',
      source: 'atlan',
      link: job.applyUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createAtlanScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'atlan')
}
