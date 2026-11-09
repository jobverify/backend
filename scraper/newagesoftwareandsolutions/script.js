import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { NEWAGE_SOFTWARE_AND_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = NEWAGE_SOFTWARE_AND_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const APPLICATION_FORM_URL = PROVIDER_METADATA.applicationFormUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeRoleText = (value) => normalizeWhitespace(value)
  .replace(/\s+\?\s+/g, ' - ')
  .trim()

const toAbsoluteUrl = (value, base = HOMEPAGE_URL) => {
  try {
    return new URL(value, base).toString()
  } catch {
    return null
  }
}

const slugFromUrl = (value) => {
  try {
    const segments = new URL(value).pathname.split('/').filter(Boolean)
    return segments.at(-1)?.replace(/-+/g, '-') ?? null
  } catch {
    return null
  }
}

const extractFirstMatch = (value, pattern) => String(value ?? '').match(pattern)?.[1] ?? null

const INDIA_LOCATION_PATTERN = /\b(india|mumbai|chennai|bengaluru|bangalore|pune|hyderabad|noida|gurugram|gurgaon)\b/i
const CITY_PATTERNS = ['Mumbai', 'Chennai', 'Bengaluru', 'Bangalore', 'Pune', 'Hyderabad', 'Noida', 'Gurugram', 'Gurgaon']

const cityFromLocation = (location = '') =>
  CITY_PATTERNS.find((candidate) => new RegExp(`\\b${candidate}\\b`, 'i').test(location)) ?? null

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const title = extractFirstMatch(page, /<title[^>]*>([\s\S]*?)<\/title>/i)

  return /careers/i.test(title || '')
    && /newage/i.test(title || '')
    && normalized.includes('Learn and Grow With Us')
    && normalized.includes('Join Newage and be part of a global team driving innovation')
    && normalized.includes('APPLY NOW')
  }

export const extractRoleCards = (html = '') => {
  const pattern = /<a href="(\/careers\/[^"]+)" class="card group v2 w-inline-block">([\s\S]*?)<\/a>\s*<div class="source-modal-content">([\s\S]*?)<div class="flex"><a href="([^"]+)" class="btn secondary w-inline-block apply-now">/gi

  return [...String(html ?? '').matchAll(pattern)].map((match) => {
    const [, relativeDetailUrl, cardHtml, modalHtml, relativeApplyUrl] = match
    const title = normalizeRoleText(extractFirstMatch(cardHtml, /<h3 class="text-23">([\s\S]*?)<\/h3>/i))
    const location = normalizeRoleText(
      extractFirstMatch(cardHtml, /<div class="font-bold text--graphite">([\s\S]*?)<\/div>/i),
    )
    const detailUrl = toAbsoluteUrl(relativeDetailUrl)
    const applyUrl = toAbsoluteUrl(relativeApplyUrl)
    const jobId = slugFromUrl(detailUrl)
    const description = stripTags(
      extractFirstMatch(modalHtml, /<div class="rt--careers-page w-richtext">([\s\S]*?)<\/div>/i),
    )
    const experienceRequired = normalizeRoleText(
      extractFirstMatch(modalHtml, /<strong>\s*Experience:\s*<\/strong>\s*([^<]+)/i),
    ) || null

    if (!title || !location || !detailUrl || !applyUrl || !jobId || !description) {
      return null
    }

    return {
      jobId,
      title,
      location,
      detailUrl,
      applyUrl,
      description,
      experienceRequired,
    }
  }).filter(Boolean)
}

const isIndiaRole = (role) => INDIA_LOCATION_PATTERN.test(role?.location ?? '')

const normalizeJob = (role, { now = () => new Date().toISOString() } = {}) => ({
  jobId: role.jobId,
  requisitionId: role.jobId,
  title: role.title,
  company: COMPANY,
  department: null,
  location: role.location,
  city: cityFromLocation(role.location),
  country: 'India',
  link: role.detailUrl,
  applyUrl: role.applyUrl,
  sourceUrl: role.detailUrl,
  source: SOURCE,
  employmentType: null,
  experienceRequired: role.experienceRequired,
  jobDescription: role.description,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: null,
  closingDate: null,
  scrapedAt: now(),
})

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createNewAgeSoftwareAndSolutionsScraper = ({
  fetchText = defaultFetchText,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ now: overrideNow } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('NewAge Software & Solutions verified first-party careers page no longer matches the trusted surface')
    }

    const roles = extractRoleCards(careersHtml)
    if (roles.length === 0) {
      throw new Error('NewAge Software & Solutions verified careers page no longer exposes inline role cards')
    }

    const jobs = roles
      .filter((role) => isIndiaRole(role))
      .map((role) => normalizeJob(role, { now: overrideNow || now }))

    if (jobs.length === 0) {
      throw new Error('NewAge Software & Solutions verified first-party careers page no longer yields India-facing jobs')
    }

    return jobs
  },
})

export const run = async (options = {}) => createNewAgeSoftwareAndSolutionsScraper(options).run(options)

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
