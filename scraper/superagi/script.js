import { extractLinkedinJobCards } from '../../scraper-support/utils/linkedinJobCards.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'superagi'
export const COMPANY = 'SuperAGI'
export const LINKEDIN_COMPANY_ID = '91427575'
export const LINKEDIN_COMPANY_PAGE_URL = 'https://www.linkedin.com/company/superagi/'
export const LINKEDIN_INDIA_JOBS_URL =
  `https://www.linkedin.com/jobs/search/?f_C=${LINKEDIN_COMPANY_ID}&geoId=102713980`
export const CAREER_PAGE_URL = LINKEDIN_INDIA_JOBS_URL

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtml = (value = '') =>
  String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) =>
  normalizeWhitespace(
    decodeHtml(String(value ?? ''))
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n')
      .replace(/<p\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

const normalizePageText = (value = '') =>
  normalizeWhitespace(
    String(value)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ) || ''

const parseLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  const city = parts[0] || null
  const country = parts.at(-1) === 'India' ? 'India' : parts.at(-1) || null

  return {
    location: normalized,
    city,
    country,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const pageIndicatesSuperagiCompany = (html = '') => {
  const page = String(html)
  const decodedPage = decodeHtml(page)

  return /\bSuperAGI\s*\|\s*LinkedIn\b/i.test(page)
    && page.includes(`urn:li:organization:${LINKEDIN_COMPANY_ID}`)
    && /AI-Native CRM for unified Sales, Marketing & Support\./i.test(decodedPage)
    && /https:\/\/superagi\.com\?utm_source=linkedin&utm_medium=social&utm_campaign=superagi/i.test(decodedPage)
}

export const pageIndicatesSuperagiIndiaJobsSearch = (html = '') => {
  const page = String(html)
  const text = normalizePageText(page)

  return page.includes(`f_C=${LINKEDIN_COMPANY_ID}`)
    && /public_jobs_f_C/i.test(page)
    && /\bSuperAGI\b/i.test(page)
    && (
      /we couldn['’]t find a match/i.test(text)
      || /\b0 jobs?(?:\s+jobs?)?\s+in india\b/i.test(text)
      || /base-card__full-link/i.test(page)
      || /urn:li:jobPosting:/i.test(page)
    )
}

export const extractIndiaJobListings = (html = '') => extractLinkedinJobCards(html)
  .map(({ id: jobId, href: rawHref, title: rawTitle, company: rawCompany, location: rawLocation, datetime: postingDate }) => {
      const title = stripTags(rawTitle)
      const company = stripTags(rawCompany)
      const sourceUrl = normalizeWhitespace(rawHref)
      const locationData = parseLocation(stripTags(rawLocation))

      if (!jobId || !title || !company || !sourceUrl) return null
      if (company.toLowerCase() !== COMPANY.toLowerCase()) return null
      if (locationData.country !== 'India') return null

      return {
        title,
        company: COMPANY,
        department: null,
        location: locationData.location,
        city: locationData.city,
        country: locationData.country,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(postingDate),
        closingDate: null,
        jobDescription: null,
      }
    })
    .filter(Boolean)
    .filter((listing, index, collection) =>
      collection.findIndex((candidate) => candidate.jobId === listing.jobId) === index)

export const createSuperagiScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const companyHtml = await fetchText(LINKEDIN_COMPANY_PAGE_URL)
    if (!pageIndicatesSuperagiCompany(companyHtml)) {
      throw new Error('SuperAGI LinkedIn company page no longer matches the verified public organization surface')
    }

    const jobsHtml = await fetchText(LINKEDIN_INDIA_JOBS_URL)
    if (!pageIndicatesSuperagiIndiaJobsSearch(jobsHtml)) {
      throw new Error('SuperAGI LinkedIn India jobs search no longer matches the verified public search shell')
    }

    return extractIndiaJobListings(jobsHtml).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createSuperagiScraper().run(options)

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
