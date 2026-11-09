import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { FOCUS_SOFTNET_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FOCUS_SOFTNET_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const INDIA_CITY_PRIORITY = [
  'Bangalore',
  'Kolkata',
  'Vijayawada',
  'Chennai',
  'Hyderabad',
]

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value).toLowerCase()
  if (normalized === 'full-time' || normalized === 'full time') return 'Full-time'
  return normalizeWhitespace(value) || null
}

const extractExperience = (block) =>
  normalizeWhitespace(block.match(/\b(\d+\s*-\s*\d+\s*years?)\b/i)?.[1])

const extractIndianLocations = (block) => INDIA_CITY_PRIORITY.filter((city) =>
  new RegExp(`\\b${city}\\b`, 'i').test(block))

export const hasVerifiedCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /Careers at Focus Softnet \| Global Job Opportunities/i.test(page)
    && normalized.includes('Join Our Global Team')
    && normalized.includes('Find Your Next Role')
    && normalized.includes('Sales Consultant - CRM/ERP/HCM')
    && normalized.includes('Social Media Specialist')
    && normalized.includes('Apply for Career')
}

export const extractJobListings = (html = '') => {
  const listings = []

  for (const match of String(html ?? '').matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2[^>]*>|$)/gi)) {
    const title = normalizeWhitespace(match[1])
    const block = match[2]

    const indiaLocations = extractIndianLocations(block)
    if (!title || indiaLocations.length === 0 || /^Apply for Career$/i.test(title)) continue

    const jobId = slugify(title)
    listings.push({
      title,
      location: indiaLocations.length === 1
        ? `${indiaLocations[0]}, India`
        : `${indiaLocations.join(' / ')}, India`,
      employmentType: normalizeEmploymentType(block.match(/\b(Full-time|Full Time)\b/i)?.[1]),
      experienceRequired: extractExperience(block),
      applyUrl: `${CAREERS_URL}#${jobId}`,
      sourceUrl: `${CAREERS_URL}#${jobId}`,
    })
  }

  return listings
}

export const createFocusSoftnetScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('The verified Focus Softnet careers page no longer matches the trusted first-party surface')
    }

    return extractJobListings(careersHtml).map((job) => ({
      jobId: slugify(job.title),
      requisitionId: slugify(job.title),
      title: job.title,
      company: COMPANY,
      department: null,
      location: job.location,
      city: job.location.replace(/, India$/i, '').split(' / ')[0] || null,
      country: 'India',
      link: job.applyUrl,
      applyUrl: job.applyUrl,
      sourceUrl: job.sourceUrl,
      employmentType: job.employmentType,
      experienceRequired: job.experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      jobDescription: 'Inline role card captured from the first-party Focus Softnet careers page.',
      postingDate: null,
      closingDate: null,
      remoteStatus: 'On-site',
      source: SOURCE,
      scrapedAt: now(),
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createFocusSoftnetScraper(options).run(options)

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
