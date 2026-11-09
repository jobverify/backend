import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SAPPHIRE_SOFTWARE_SOLUTIONS_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SAPPHIRE_SOFTWARE_SOLUTIONS_INDIA_CATALOG
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

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

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
  return /<title>\s*Career at Sapphire Software Solutions\s*<\/title>/i.test(page)
    && /Current Openings/i.test(page)
    && /Apply Here/i.test(page)
    && /Business Development Executive/i.test(page)
    && /Ahmedabad/i.test(page)
}

export const extractJobs = (html = '') => [...String(html ?? '').matchAll(
  /<section class="opening">\s*<h2>([^<]+)<\/h2>\s*<p>([^<]+)<\/p>[\s\S]*?<\/section>/gi,
)]
  .map((match) => {
    const title = normalizeWhitespace(match[1])
    const city = normalizeWhitespace(match[2])
    const jobId = slugify(title)

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
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    }
  })

export const createSapphireSoftwareSolutionsIndiaScraper = ({
  fetchText = defaultFetchText,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText: overrideFetchText } = {}) {
    const html = await (overrideFetchText || fetchText)(CAREERS_URL)

    if (!hasOfficialCareersSignal(html)) {
      throw new Error('The verified Sapphire Software Solutions careers page no longer matches the pinned current openings surface')
    }

    return extractJobs(html).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createSapphireSoftwareSolutionsIndiaScraper().run(options)

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
