import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runCurrentAccelyaInventory } from './native.js'

import { ACCELYA_SOLUTIONS_INDIA_LIMITED_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const PAGE_SIZE = 20

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeComparableUrl = (value) => String(value ?? '').replace(/\/$/, '')

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Careers at Accelya\b/i.test(page)
    && text.includes('View all jobs')
    && text.includes('Raveena Khatri')
    && text.includes('Mumbai office')
    && page.includes('accelya.wd103.myworkdayjobs.com')
}

export const extractVerifiedWorkdayBoardUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const href = normalizeComparableUrl(match[1])
    if (href === normalizeComparableUrl(WORKDAY_BOARD_URL)) {
      return WORKDAY_BOARD_URL
    }
  }

  return null
}

export const buildJobsRequestBody = ({
  offset = 0,
  limit = PAGE_SIZE,
} = {}) => JSON.stringify({
  appliedFacets: {},
  limit,
  offset,
  searchText: '',
})

export const isVerifiedWorkdayApiFailure = (payload = {}) =>
  ['HTTP_400', 'HTTP_500'].includes(payload?.errorCode)
  || [400, 500].includes(Number(payload?.httpStatus))

export const createAccelyaSolutionsIndiaLimitedScraper = () => ({
  run: options => runCurrentAccelyaInventory(options),
})

export const run = async (options = {}) => createAccelyaSolutionsIndiaLimitedScraper().run(options)

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
