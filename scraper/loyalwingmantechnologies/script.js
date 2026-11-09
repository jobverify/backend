import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'loyalwingmantechnologies'
export const COMPANY = 'Loyal Wingman Technologies'
export const LINKEDIN_COMPANY_ID = '96646029'
export const LINKEDIN_COMPANY_PAGE_URL =
  'https://www.linkedin.com/company/loyal-wingman-technologies-private-limited/'
export const LINKEDIN_INDIA_JOBS_URL =
  `https://www.linkedin.com/jobs/search/?f_C=${LINKEDIN_COMPANY_ID}&geoId=102713980`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const parseLocation = (value) => {
  const location = normalizeWhitespace(value)
  const parts = location.split(',').map(normalizeWhitespace).filter(Boolean)
  const country = parts.at(-1) || null

  return {
    location: location || null,
    city: parts[0] || null,
    country: country === 'India' ? 'India' : country,
  }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const pageIndicatesLoyalWingmanCompany = (html) => {
  const page = String(html ?? '')

  return page.includes(`urn:li:organization:${LINKEDIN_COMPANY_ID}`)
    && /Loyal Wingman Technologies Private Limited/i.test(page)
}

export const pageIndicatesLoyalWingmanIndiaJobsSearch = (html) => {
  const page = String(html ?? '')

  return page.includes(`f_C=${LINKEDIN_COMPANY_ID}`)
    && /Loyal Wingman Technologies Private Limited/i.test(page)
    && /public_jobs_f_C/i.test(page)
}

export const extractIndiaJobListings = (html) => [...String(html ?? '').matchAll(
  /<div class="base-card[\s\S]*?data-entity-urn="urn:li:jobPosting:([0-9]+)"[\s\S]*?<a class="base-card__full-link[^"]*" href="([^"]+)"[\s\S]*?<h3 class="base-search-card__title">\s*([\s\S]*?)\s*<\/h3>[\s\S]*?<h4 class="base-search-card__subtitle">[\s\S]*?<a[^>]*>\s*([\s\S]*?)\s*<\/a>[\s\S]*?<span class="job-search-card__location">\s*([\s\S]*?)\s*<\/span>(?:[\s\S]*?<time[^>]+datetime="([^"]+)")?/gi,
)].map((match) => {
  const [, jobId, rawUrl, rawTitle, rawCompany, rawLocation, postingDate] = match
  const location = parseLocation(rawLocation)
  const title = normalizeWhitespace(rawTitle)
  const company = normalizeWhitespace(rawCompany)
  const sourceUrl = normalizeWhitespace(rawUrl).replace(/&amp;/g, '&')

  if (!jobId || !title || !sourceUrl || company !== `${COMPANY} Private Limited (Loyalwingtech)` || location.country !== 'India') {
    return null
  }

  return {
    title,
    company: COMPANY,
    department: null,
    ...location,
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(postingDate) || null,
    closingDate: null,
    jobDescription: null,
  }
}).filter(Boolean)

export const createLoyalWingmanTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString(), signal } = {}) {
    const read = async url => {
      signal?.throwIfAborted()
      const html = await fetchText(url, { signal })
      signal?.throwIfAborted()
      return html
    }
    const companyHtml = await read(LINKEDIN_COMPANY_PAGE_URL)
    if (!pageIndicatesLoyalWingmanCompany(companyHtml)) {
      throw new Error('Loyal Wingman Technologies LinkedIn company page no longer matches the verified organization')
    }

    const jobsHtml = await read(LINKEDIN_INDIA_JOBS_URL)
    if (!pageIndicatesLoyalWingmanIndiaJobsSearch(jobsHtml)) {
      throw new Error('Loyal Wingman Technologies LinkedIn India jobs search no longer matches the verified public search')
    }

    return extractIndiaJobListings(jobsHtml).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createLoyalWingmanTechnologiesScraper().run(options)

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
