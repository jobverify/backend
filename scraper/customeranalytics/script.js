import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { CUSTOMER_ANALYTICS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = CUSTOMER_ANALYTICS_CATALOG
export const SOURCE = CUSTOMER_ANALYTICS_CATALOG.source
export const COMPANY = CUSTOMER_ANALYTICS_CATALOG.companyName
export const CAREERS_URL = CUSTOMER_ANALYTICS_CATALOG.companyCareerPage

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&#x27;|&apos;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/&/g, ' ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /Company \| Careers/i.test(page)
    && /Craft Your Success Story with Us/i.test(text)
    && /Current Opportunities/i.test(text)
    && /customeranalytics\.com/i.test(text)
}

const extractOfficeLocation = (html = '') => {
  const match = String(html ?? '').match(/Guindy,\s*Chennai\s*[-–]\s*600032/i)
  return match ? 'Chennai, India' : null
}

const extractListItems = (html) =>
  Array.from(String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi))
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

const extractLegacyOpportunities = (html = '') =>
  Array.from(String(html ?? '').matchAll(/<section[^>]*class="opportunity"[^>]*>([\s\S]*?)<\/section>/gi))
    .map((match) => match[1])

const extractCurrentOpportunities = (html = '') => {
  const section = String(html ?? '').match(
    /<section[^>]*class="[^"]*Opportunities_sec[^"]*"[^>]*>[\s\S]*?<\/section>/i,
  )?.[0] ?? ''

  return Array.from(
    section.matchAll(
      /<div[^>]*class="[^"]*relative[^"]*bg-white[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*relative[^"]*bg-white[^"]*"|<\/section>)/gi,
    ),
  ).map((match) => match[1])
}

const buildJob = ({
  title,
  location,
  minimumQualification,
  description,
  now,
}) => ({
  title,
  company: COMPANY,
  department: null,
  location,
  city: location ? 'Chennai' : null,
  state: null,
  country: location ? 'India' : null,
  jobId: slugify(title),
  requisitionId: slugify(title),
  sourceUrl: CAREERS_URL,
  applyUrl: CAREERS_URL,
  employmentType: null,
  experienceRequired: null,
  minimumQualification,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: null,
  closingDate: null,
  jobDescription: description,
  source: SOURCE,
  link: CAREERS_URL,
  scrapedAt: now(),
  companyCareerPage: CAREERS_URL,
  companyDomain: PROVIDER_METADATA.companyDomain,
  atsPlatform: PROVIDER_METADATA.atsPlatform,
})

export const createCustomerAnalyticsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Customer Analytics careers page no longer matches the verified first-party surface')
    }

    const location = extractOfficeLocation(careersHtml)
    const currentSections = extractCurrentOpportunities(careersHtml)
    const sections = currentSections.length > 0
      ? currentSections
      : extractLegacyOpportunities(careersHtml)

    const jobs = sections.map((section) => {
      const title = normalizeWhitespace(section.match(/<h5[^>]*>([\s\S]*?)<\/h5>/i)?.[1])
      const paragraphs = Array.from(section.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
        .map((match) => normalizeWhitespace(match[1]))
        .filter(Boolean)
      const summary = paragraphs[0] ?? ''
      const keyResponsibilities = extractListItems(
        String(section).match(
          /<h6[^>]*>\s*Key Responsibility\s*<\/h6>([\s\S]*?)(?=<h6[^>]*>\s*Requirements\s*<\/h6>|$)/i,
        )?.[1] ?? '',
      )
      const requirements = extractListItems(
        String(section).match(/<h6[^>]*>\s*Requirements\s*<\/h6>([\s\S]*)/i)?.[1] ?? '',
      )
      const description = [summary, ...keyResponsibilities, ...requirements].filter(Boolean).join(' ')
      const minimumQualification = requirements[0] ?? null

      return buildJob({
        title,
        location,
        minimumQualification,
        description,
        now,
      })
    }).filter((job) => job.title && job.jobId && job.jobDescription)

    if (jobs.length === 0) {
      throw new Error('Customer Analytics careers page no longer exposes inline current opportunities')
    }

    return jobs
  },
})

export const run = async (options = {}) => createCustomerAnalyticsScraper().run(options)

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
