import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { extractAshbyJobs } from '../uipath/script.js'
import { createAshbyApiScraper } from '../../scraper-support/utils/ashbyApi.js'
import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { extractAshbyExperienceRequired } from '../../scraper-support/utils/ashbyExperience.js'

import SISENSE_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = SISENSE_CATALOG.source
export const COMPANY = SISENSE_CATALOG.companyName
export const CAREERS_URL = SISENSE_CATALOG.companyCareerPage
export const ASHBY_PUBLIC_BOARD_URL = 'https://jobs.ashbyhq.com/sisense'
export const ASHBY_JOB_BOARD_URL = 'https://api.ashbyhq.com/posting-api/job-board/sisense'
export const VERIFIED_ON = SISENSE_CATALOG.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const decodeHtml = (value) => normalizeWhitespace(value)

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const extractJobsFromAshbyPayload = (payload = {}) =>
  extractAshbyJobs(payload).map((job) => ({ ...job, company: COMPANY }))

export const createSisenseScraper = () => ({
  async run({ fetchJson = defaultFetchJson, now = () => new Date().toISOString(), signal } = {}) {
    const jobs = await createAshbyApiScraper({ source: SOURCE, companyName: COMPANY,
      ashbyJobBoardUrl: ASHBY_JOB_BOARD_URL, now }).run({ fetchJson, signal })
    return mapJobsWithInventoryEvidence(jobs, job => ({ ...job,
      experienceRequired: extractAshbyExperienceRequired({ title: job.title, jobDescription: job.jobDescription }),
    }))
  },
})

export const run = async (options = {}) => createSisenseScraper().run(options)

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
