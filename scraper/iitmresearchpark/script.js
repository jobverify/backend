import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { IITM_RESEARCH_PARK_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = IITM_RESEARCH_PARK_CATALOG.source
export const COMPANY_NAME = IITM_RESEARCH_PARK_CATALOG.companyName
export const CAREERS_URL = IITM_RESEARCH_PARK_CATALOG.companyCareerPage
export const VERIFIED_ON = IITM_RESEARCH_PARK_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = IITM_RESEARCH_PARK_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = IITM_RESEARCH_PARK_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const MONTH_INDEX = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
}

const CAREER_CARD_PATTERN =
  /<h4\b[^>]*>([\s\S]*?)<\/h4>[\s\S]{0,2500}?<a\b[^>]+href="([^"]+)"[^>]*>\s*View\s*\/\s*Apply\s*Job\s*<\/a>/gi

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;|&#8217;|&rsquo;/gi, "'")
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;|\u2013|\u2014/gi, '-')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const extractTitle = (html) => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const normalizeMonthDate = (value) => {
  const match = normalizeWhitespace(value).match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/)
  if (!match) return null

  const month = MONTH_INDEX[match[1].toLowerCase()]
  if (!month) return null

  return `${match[3]}-${month}-${match[2].padStart(2, '0')}`
}

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const slugifyTitle = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const extractBadgeTexts = (segment) => [...String(segment ?? '').matchAll(
  /<span[^>]*class=["'][^"']*\bbadge-custom\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi,
)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

export const extractObservedJobCards = (html = '') => [...String(html ?? '').matchAll(CAREER_CARD_PATTERN)]
  .map((match) => {
    const segment = match[0]
    const title = stripTags(match[1])
    const closingDate = normalizeMonthDate(
      extractFirst(
        /Valid\s+till:[\s\S]{0,160}?([A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
        segment,
      ),
    )
    const applyUrl = toAbsoluteUrl(match[2])
    const badgeTexts = extractBadgeTexts(segment)
    const experienceRequired = stripTags(
      extractFirst(/<span[^>]*class=["'][^"']*\bexperience-years\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, segment),
    )
    const jobDescription = stripTags(
      extractFirst(/<p[^>]*class=["'][^"']*\bjob-description\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i, segment),
    )
    const jobId = slugifyTitle(title)

    if (!title || !applyUrl || !closingDate || !jobId) return null

    return {
      title,
      jobId,
      requisitionId: jobId,
      department: badgeTexts.join(' | ') || null,
      badgeTexts,
      experienceRequired: experienceRequired || null,
      jobDescription: jobDescription || null,
      closingDate,
      applyUrl,
      sourceUrl: CAREERS_URL,
    }
  })
  .filter(Boolean)

export const extractObservedJobTitles = (html = '') =>
  extractObservedJobCards(html).map((card) => card.title)

export const extractValidTillDates = (html = '') =>
  extractObservedJobCards(html).map((card) => card.closingDate)

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const cards = extractObservedJobCards(page)

  return extractTitle(page) === 'Careers Page | IIT Madras Research Park'
    && /Launch your future with our open roles/i.test(page)
    && /View\s*\/\s*Apply\s*Job/i.test(page)
    && cards.length >= 1
}

export const hasLivePublicListings = (html = '', today = VERIFIED_ON) =>
  extractObservedJobCards(html).some((card) => card.closingDate >= today)

export const matchesVerifiedExpiredSnapshot = (html = '') => {
  const titles = extractObservedJobTitles(html)
  const dates = extractValidTillDates(html)

  return JSON.stringify(titles) === JSON.stringify(PROVIDER_METADATA.observedJobTitles)
    && JSON.stringify(dates) === JSON.stringify(PROVIDER_METADATA.observedClosingDates)
}

export const extractLiveJobs = (html = '', {
  today = VERIFIED_ON,
  now = () => new Date().toISOString(),
} = {}) => extractObservedJobCards(html)
  .filter((card) => card.closingDate >= today)
  .map((card) => ({
    jobId: card.jobId,
    requisitionId: card.requisitionId,
    title: card.title,
    company: COMPANY_NAME,
    businessUnit: null,
    department: card.department,
    location: null,
    city: null,
    country: PROVIDER_METADATA.countryFilter || 'India',
    link: card.applyUrl,
    applyUrl: card.applyUrl,
    sourceUrl: card.sourceUrl,
    source: SOURCE,
    employmentType: null,
    experienceRequired: card.experienceRequired,
    jobDescription: card.jobDescription,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: card.badgeTexts,
    postingDate: null,
    closingDate: card.closingDate,
    scrapedAt: now(),
  }))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createIITMResearchParkScraper = ({
  today = VERIFIED_ON,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('IITM Research Park official careers page no longer matches the verified public surface')
    }

    return extractLiveJobs(careersHtml, {
      today,
      now,
    })
  },
})

export const run = async (options = {}) => createIITMResearchParkScraper().run(options)

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
