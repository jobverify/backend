import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = 'prisma'
export const COMPANY = 'Prisma'
export const VERIFIED_ON = '2026-07-25'
export const OFFICIAL_SITE_URL = 'https://www.prisma.io/'
export const CAREERS_PAGE_URL = 'https://www.prisma.io/company/careers'
export const RIPPLING_JOBS_URL = 'https://api.rippling.com/platform/api/ats/v1/board/prisma-careers/jobs'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = async (url) => JSON.parse(await defaultFetchText(url))

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title[^>]*>\s*Careers\s*\|\s*Prisma\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.prisma\.io\/company\/careers["']/i.test(page)
    && text.includes('Join Prisma')
    && text.includes('Help us empower developers to build data-driven applications.')
    && text.includes('Open roles')
    && page.includes('OpenRoles')
}

export const hasOfficialRipplingJobsSignal = (records) => Array.isArray(records)
  && records.every((record) => (
    typeof record?.uuid === 'string'
    && typeof record?.name === 'string'
    && /^https:\/\/ats\.rippling\.com\/prisma-careers\/jobs\/[a-f0-9-]+$/i.test(record?.url || '')
    && typeof record?.workLocation?.label === 'string'
  ))

const isIndiaLocation = (value) => /\bindia\b/i.test(normalizeWhitespace(value))

export const extractIndiaJobs = (records = []) => records
  .filter((record) => isIndiaLocation(record?.workLocation?.label))
  .map((record) => {
    const location = normalizeWhitespace(record.workLocation.label)
    const jobId = normalizeWhitespace(record.uuid)

    return {
      title: normalizeWhitespace(record.name),
      company: COMPANY,
      location,
      city: location.replace(/,\s*India\s*$/i, '') || null,
      state: null,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: record.url,
      applyUrl: record.url,
      department: normalizeWhitespace(record?.department?.label) || null,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    }
  })

export const createPrismaScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, now = () => new Date() } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Prisma careers page no longer matches the verified first-party surface')
    }

    const records = await fetchJson(RIPPLING_JOBS_URL)
    if (!hasOfficialRipplingJobsSignal(records)) {
      throw new Error('Prisma Rippling board no longer matches the verified public jobs surface')
    }

    const scrapedAt = now().toISOString()
    return extractIndiaJobs(records).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createPrismaScraper().run(options)

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
