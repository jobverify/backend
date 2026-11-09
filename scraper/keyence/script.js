import { readFileSync } from 'node:fs'
import { runReviewedDarwinboxInventory } from './nativeInventory.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'keyence'
export const CAREERS_URL = 'https://www.keyence.co.in/ss/career/'
export const RECRUITMENT_URL = 'https://www.keyence.co.in/ss/career/job.jsp'
export const APPLY_URL = 'https://forms.office.com/r/NvMRr292Pt'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const OFFICIAL_CAREERS_PATTERNS = [
  /KEYENCE India(?:\s*[–-]\s*|&ndash;)\s*Careers/i,
  /added-value for our customers/i,
  />\s*Recruitment\s*</i,
]

const PUBLIC_JOB_SIGNAL_PATTERN =
  /<a[^>]+href=["'][^"']*(?:\/jobs\/|\/job\/|\/opening|\/position)[^"']*["'][^>]*>|job openings|current openings|open positions|apply now/i

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return OFFICIAL_CAREERS_PATTERNS.every((pattern) => pattern.test(page))
}

export const extractRecruitmentUrl = (html) => {
  const match = String(html ?? '').match(/<a[^>]+href=["']([^"']*\/ss\/career\/job\.jsp)["'][^>]*>\s*Recruitment\s*<\/a>/i)
  if (!match) return null

  try {
    return new URL(match[1], CAREERS_URL).toString()
  } catch {
    return null
  }
}

export const hasApplyOnlyZeroJobsSignal = (html) => {
  const page = String(html ?? '')

  return /RECRUITMENT/i.test(page)
    && /Hiring Process/i.test(page)
    && /Registration\s*\/\s*Aptitude Test\s*\/\s*Pre-recorded Video Interview/i.test(page)
    && /FAQ about our recruitment/i.test(page)
    && /We have 5 offices in India:\s*Chennai,\s*Bangalore,\s*Pune,\s*Gurgaon,\s*Ahmedabad\./i.test(page)
    && !PUBLIC_JOB_SIGNAL_PATTERN.test(page)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const nativeSpec = {
  "source": "keyence",
  "company": "Keyence",
  "brand": "Keyence India",
  "tenant": "keyence",
  "tenantId": "373",
  "origin": "https://keyence.darwinbox.in",
  "handoff": "https://keyence.darwinbox.in/ms/candidatev2/main/careers/allJobs"
}
nativeSpec.review = JSON.parse(readFileSync(new URL('./reviewedNativeScope.json', import.meta.url), 'utf8'))

export const createKeyenceScraper = (defaults = {}) => ({
  run: (options = {}) => runReviewedDarwinboxInventory(nativeSpec, { ...defaults, ...options }),
})

export const run = async (options = {}) => createKeyenceScraper().run(options)

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
