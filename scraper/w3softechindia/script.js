import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { W3SOFTECH_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = W3SOFTECH_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  return /<title>\s*Careers \| Job Search \| Job Opportunities \| w3softech\s*<\/title>/i.test(page)
    && /careers@w3softech\.com/i.test(page)
    && /Python Developer/i.test(page)
    && /MuleSoft Developer/i.test(page)
    && /\bApply\b/i.test(page)
}

export const extractJobs = (html = '') => [...String(html ?? '').matchAll(
  /<tr>\s*<td>(W3S\d+)<\/td>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>[\s\S]*?<\/tr>/gi,
)]
  .map((match) => {
    const jobId = normalizeWhitespace(match[1])
    const title = normalizeWhitespace(match[2])
    const experienceRequired = normalizeWhitespace(match[3])
    const city = normalizeWhitespace(match[4])

    return {
      title,
      company: COMPANY,
      location: city ? `${city}, India` : null,
      city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    }
  })

export const createW3SoftechIndiaScraper = ({
  fetchText = defaultFetchText,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText: overrideFetchText } = {}) {
    const html = await (overrideFetchText || fetchText)(CAREERS_URL)

    if (!hasOfficialCareersSignal(html)) {
      throw new Error('The verified W3Softech India careers page no longer matches the pinned public surface')
    }

    return extractJobs(html).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createW3SoftechIndiaScraper().run(options)

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
