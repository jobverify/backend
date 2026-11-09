import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import CEIPAL_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = CEIPAL_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const CURRENT_OPENINGS_URL = PROVIDER_METADATA.companyCareerPage
export const APPLICATION_URL = 'mailto:apply@ceipal.com'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const INDIA_CITY_PATTERN =
  /\b(ahmedabad|bengaluru|bangalore|chennai|delhi|gurgaon|gurugram|hyderabad|kolkata|mumbai|noida|pune)\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const isIndiaLocation = (value) => /india/i.test(value || '') || INDIA_CITY_PATTERN.test(value || '')

const extractCity = (location) => normalizeWhitespace(location)?.split(',')[0]?.trim() || null

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return normalized.includes("we're hiring")
    && normalized.includes('job title:')
    && normalized.includes('location:')
    && normalized.includes('apply@ceipal.com')
}

const mapOpening = ({ title, location, experience }) => ({
  title,
  company: PROVIDER_METADATA.companyName,
  department: null,
  location,
  city: extractCity(location),
  country: isIndiaLocation(location) ? 'India' : null,
  jobId: slugify(title),
  requisitionId: slugify(title),
  sourceUrl: CURRENT_OPENINGS_URL,
  applyUrl: APPLICATION_URL,
  employmentType: null,
  experienceRequired: experience,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: null,
  closingDate: null,
  jobDescription: 'Resumes should be submitted via email to apply@ceipal.com',
})

export const extractOpenings = (html = '') => {
  const openings = []

  for (const match of String(html).matchAll(
    /Job Title:\s*([^<]+)[\s\S]*?Location:\s*([^<]+)[\s\S]*?Experience:\s*([^<]+)[\s\S]*?(?:mailto:apply@ceipal\.com|apply@ceipal\.com)/gi,
  )) {
    openings.push(mapOpening({
      title: normalizeWhitespace(match[1]),
      location: normalizeWhitespace(match[2]),
      experience: normalizeWhitespace(match[3]),
    }))
  }

  return openings
}

export const createCeipalScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CURRENT_OPENINGS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Ceipal current opening page no longer matches the verified first-party careers surface')
    }

    return extractOpenings(careersHtml)
      .filter((job) => job.country === 'India')
      .map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      }))
  },
})

export const run = async (options = {}) => createCeipalScraper().run(options)

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
