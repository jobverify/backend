import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LABVANTAGE_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = LABVANTAGE_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const APPLICATION_EMAIL = PROVIDER_METADATA.applicationEmail
export const APPLICATION_URL = PROVIDER_METADATA.applicationUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
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
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Lab Software Careers')
    && normalized.includes('Join a technology leader serving lab-centered organizations worldwide')
    && normalized.includes('Work on the cutting edge of science and technology')
    && normalized.includes('teamhr@labvantage.com')
  }

export const extractIndiaJobTitles = (html = '') => {
  const page = String(html ?? '')
  const indiaSection = page.match(/(?:<h[1-6][^>]*>|##)\s*India(?:<\/h[1-6]>)?([\s\S]*?)(?:<h[1-6][^>]*>|##\s*North America|$)/i)?.[1] ?? ''

  return Array.from(
    indiaSection.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi),
    (match) => normalizeWhitespace(match[1]),
  ).filter(Boolean)
}

export const createLabvantageSolutionsScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(html)) {
      throw new Error('The official Labvantage Solutions careers page no longer matches the verified public surface')
    }

    const titles = extractIndiaJobTitles(html)
    if (titles.length === 0) {
      throw new Error('The verified Labvantage Solutions India openings no longer appear on the careers page')
    }

    const jobs = titles.map((title) => ({
      title,
      company: COMPANY,
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      link: APPLICATION_URL,
      applyUrl: APPLICATION_URL,
      sourceUrl: CAREERS_URL,
      source: SOURCE,
      jobId: null,
      requisitionId: null,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      preserveExistingSourceContent: true,
      publicExperienceChecked: true,
      remoteStatus: null,
      scrapedAt: new Date().toISOString(),
    }))

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createLabvantageSolutionsScraper(options).run(options)

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
