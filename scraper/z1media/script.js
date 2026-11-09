import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'z1media'
export const COMPANY = 'Z1 Media'
export const LEGACY_HOMEPAGE_URL = 'https://www.z1media.com/'
export const HOMEPAGE_URL = 'https://www.z1tech.com/'
export const CAREERS_URL = 'https://www.z1tech.com/careers'
export const CAREERS_CANONICAL_URL = 'https://app.vdo.ai/careers'
export const LEVER_JOBS_URL = 'https://jobs.lever.co/z1tech/'
export const LEVER_ENDPOINT = 'https://api.lever.co/v0/postings/z1tech?mode=json'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeHtml = (value) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeUrl = (value) => String(value ?? '').replace(/\/+$/, '')

const isExpectedPageUrl = (actualUrl, expectedUrl) => normalizeUrl(actualUrl) === normalizeUrl(expectedUrl)

const toIsoDateTime = (value) => {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return null

  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const toWorkplaceType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (normalized === 'remote') return 'Remote'
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'onsite' || normalized === 'on-site') return 'On-site'
  return null
}

const isIndiaValue = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return false

  return normalized === 'in'
    || normalized === 'india'
    || normalized.endsWith(', india')
    || normalized.includes(' india')
    || normalized === 'gurgaon'
    || normalized === 'gurugram'
    || normalized.includes('gurgaon')
    || normalized.includes('gurugram')
    || normalized === 'mumbai'
    || normalized.includes('mumbai')
}

const isIndiaJob = (job) => {
  const candidates = [
    job?.country,
    job?.categories?.country,
    job?.categories?.location,
    ...(Array.isArray(job?.categories?.allLocations) ? job.categories.allLocations : []),
  ]

  return candidates.some((candidate) => isIndiaValue(candidate))
}

const formatIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return 'India'
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const extractCity = (location) => normalizeWhitespace(location)?.split(/\s+-\s+|,/)[0] || null

const joinDescriptionParts = (...parts) => normalizeWhitespace(parts.filter(Boolean).join(' '))

const findRequirementList = (job, headingPattern) => {
  const lists = Array.isArray(job?.lists) ? job.lists : []

  return lists.find((entry) => headingPattern.test(normalizeWhitespace(entry?.text) || '')) || null
}

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  .map(([, item]) => stripTags(item))
  .filter(Boolean)

const extractExperienceRequired = (job) => {
  const requirements = findRequirementList(job, /requirements?/i)
  if (!requirements) return null

  return extractListItems(requirements.content).find((item) => /\byears?\b.*\bexperience\b|\bexperience\b.*\byears?\b/i.test(item)) || null
}

const extractMinimumQualification = (job) => {
  const requirements = findRequirementList(job, /requirements?/i)
  if (!requirements) return null

  return extractListItems(requirements.content).find((item) =>
    /\bbachelor'?s\b|\bmaster'?s\b|\bdegree\b|\bdiploma\b/i.test(item),
  ) || null
}

const validateRequiredJobField = (value, fieldName) => {
  if (!value) {
    throw new Error(`Z1 Media Lever jobs payload changed: missing ${fieldName}`)
  }

  return value
}

export const hasOfficialHomepageSignal = (html) => {
  const markup = normalizeHtml(html)
  const text = stripTags(html)?.toLowerCase() || ''

  return (/<title>\s*Z1 Tech\s*-\s*Inventing The Future\s*\|\s*Z1 Tech\s*<\/title>/i.test(markup)
      || text.includes('z1 tech - inventing the future | z1 tech'))
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/app\.vdo\.ai\/["']/i.test(markup)
    && /href=["']\/careers["']/i.test(markup)
    && text.includes('inventing the future of digital media and advertising')
    && text.includes('we are a technology-first company aiming to revolutionize digital content consumption experiences')
    && text.includes('discover our future-proof solutions and cutting-edge technology to make an everlasting impression')
}

export const hasOfficialCareersSignal = (html) => {
  const markup = normalizeHtml(html)
  const text = stripTags(html)?.toLowerCase() || ''

  return (/<title>\s*Careers\s*\|\s*Z1 Tech\s*<\/title>/i.test(markup)
      || text.includes('careers | z1 tech'))
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/app\.vdo\.ai\/careers["']/i.test(markup)
    && /href=["']https:\/\/jobs\.lever\.co\/z1tech\/?["']/i.test(markup)
    && text.includes('invent today. shape tomorrow.')
    && text.includes('if working on innovative technologies and creating a global impact excites you')
    && text.includes('life at z1 tech')
    && text.includes('we started our current journey back in 2015')
}

export const extractLeverJobs = (leverJobs = []) => (Array.isArray(leverJobs) ? leverJobs : [])
  .filter(isIndiaJob)
  .map((job) => {
    const id = validateRequiredJobField(normalizeWhitespace(job?.id), 'job id')
    const title = validateRequiredJobField(normalizeWhitespace(job?.text), `title for ${id}`)
    const rawLocation = validateRequiredJobField(
      normalizeWhitespace(job?.categories?.location || job?.categories?.allLocations?.[0] || job?.country),
      `location for ${id}`,
    )
    const sourceUrl = validateRequiredJobField(normalizeWhitespace(job?.hostedUrl), `hosted URL for ${id}`)

    return {
      title,
      company: COMPANY,
      department: normalizeWhitespace(job?.categories?.team || job?.categories?.department),
      location: formatIndiaLocation(rawLocation),
      city: extractCity(rawLocation),
      country: 'India',
      jobId: id,
      requisitionId: id,
      sourceUrl,
      applyUrl: normalizeWhitespace(job?.applyUrl) || sourceUrl,
      employmentType: normalizeWhitespace(job?.categories?.commitment),
      workplaceType: toWorkplaceType(job?.workplaceType),
      experienceRequired: extractExperienceRequired(job),
      minimumQualification: extractMinimumQualification(job),
      preferredQualification: null,
      requiredSkills: [],
      postingDate: toIsoDateTime(job?.createdAt),
      closingDate: null,
      jobDescription: joinDescriptionParts(job?.descriptionPlain, job?.additionalPlain),
    }
  })

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createZ1MediaScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now = defaultNow,
  } = {}) {
    const homepage = await fetchPage(LEGACY_HOMEPAGE_URL)

    if (homepage.status !== 200 || !isExpectedPageUrl(homepage.url, HOMEPAGE_URL) || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Z1 Media verified official homepage no longer matches the known first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)

    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Z1 Media verified official careers page no longer matches the known first-party surface')
    }

    const leverJobs = await fetchJson(LEVER_ENDPOINT)
    const jobs = extractLeverJobs(leverJobs)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
      companyCareerPage: CAREERS_URL,
      companyDomain: 'z1tech.com',
      atsPlatform: 'lever',
    }))
  },
})

export const run = async (options = {}) => createZ1MediaScraper().run(options)

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
