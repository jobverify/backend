import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { INNOVISION_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = INNOVISION_CATALOG
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const SOURCE = PROVIDER_METADATA.source
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const APPLICATION_URL = PROVIDER_METADATA.applicationUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeUrl = (value) => String(value ?? '').replace(/\/+$/, '')

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeOptionalValue = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: HOMEPAGE_URL,
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const getFinalUrl = (page, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

const isHeadingNoise = (value) => {
  const normalized = normalizeWhitespace(value)

  return !normalized
    || /^(build your future|careers at innovision|current openings)$/i.test(normalized)
}

const extractTextLines = (html) => {
  const blockSeparated = String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|ul|ol|h[1-6]|span|button)>/gi, '\n')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')

  return decodeHtmlEntities(blockSeparated)
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
}

const normalizeLocation = (value) => {
  const raw = normalizeOptionalValue(value)
  if (!raw) {
    return {
      location: null,
      city: null,
      state: null,
      country: 'India',
    }
  }

  if (/^pan india$/i.test(raw)) {
    return {
      location: 'Pan India',
      city: null,
      state: null,
      country: 'India',
    }
  }

  if (/^multiple locations$/i.test(raw)) {
    return {
      location: 'Multiple Locations, India',
      city: null,
      state: null,
      country: 'India',
    }
  }

  if (/^delhi ncr$/i.test(raw)) {
    return {
      location: 'Delhi NCR, India',
      city: null,
      state: null,
      country: 'India',
    }
  }

  if (/,/.test(raw)) {
    return {
      location: `${raw}, India`,
      city: null,
      state: null,
      country: 'India',
    }
  }

  return {
    location: `${raw}, India`,
    city: raw,
    state: null,
    country: 'India',
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) return null
  if (/full[\s-]?time/i.test(normalized)) return 'Full-time'
  if (/part[\s-]?time/i.test(normalized)) return 'Part-time'
  if (/contract/i.test(normalized)) return 'Contract'
  if (/intern/i.test(normalized)) return 'Internship'
  return normalized
}

const extractOpeningsSection = (html) => {
  const page = String(html ?? '')
  const startMatch = page.match(/current openings/i)
  if (!startMatch?.index && startMatch?.index !== 0) return page

  const startIndex = startMatch.index
  const endMarkers = [
    page.slice(startIndex).search(/don't see a suitable position/i),
    page.slice(startIndex).search(/mailto:careers@innovision\.co\.in/i),
  ].filter((index) => index >= 0)

  if (endMarkers.length === 0) return page.slice(startIndex)

  return page.slice(startIndex, startIndex + Math.min(...endMarkers))
}

export const extractApplyEmail = (html) => {
  const directMatch = String(html ?? '').match(/mailto:careers@innovision\.co\.in/i)
  if (directMatch?.[0]) return directMatch[0]

  const fallbackMatch = String(html ?? '').match(/mailto:[^"'?\s>]+/i)
  return fallbackMatch?.[0] || null
}

export const hasOfficialCareersSignal = (page) => {
  const html = typeof page === 'string' ? page : page?.html
  const status = typeof page === 'string' ? 200 : Number(page?.status)
  const finalUrl = normalizeUrl(getFinalUrl(page, CAREERS_PAGE_URL))
  const rawHtml = String(html ?? '')

  return status === 200
    && finalUrl === normalizeUrl(CAREERS_PAGE_URL)
    && /careers\s*\|\s*innovision security\s*\|\s*innovision limited/i.test(rawHtml)
    && /build your future/i.test(rawHtml)
    && /careers at innovision/i.test(rawHtml)
    && /current openings/i.test(rawHtml)
    && /careers@innovision\.co\.in/i.test(rawHtml)
}

export const extractOpenings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Innovision verified careers page no longer matches the trusted public surface')
  }

  const applyUrl = extractApplyEmail(html)
  if (!applyUrl) {
    throw new Error('Innovision verified careers page no longer exposes the shared application email')
  }

  const sectionHtml = extractOpeningsSection(html)
  const headingMatches = [...sectionHtml.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)]
  const jobs = []

  for (let index = 0; index < headingMatches.length; index += 1) {
    const currentMatch = headingMatches[index]
    const title = stripTags(currentMatch[2])
    if (isHeadingNoise(title)) continue

    const snippetStart = currentMatch.index + currentMatch[0].length
    const snippetEnd = headingMatches[index + 1]?.index ?? sectionHtml.length
    const snippet = sectionHtml.slice(snippetStart, snippetEnd)
    if (!/apply now/i.test(snippet)) continue

    const lines = extractTextLines(snippet)
      .filter((line) =>
        line.toLowerCase() !== 'apply now'
        && line.toLowerCase() !== title.toLowerCase(),
      )

    const [rawLocation, rawEmploymentType, rawDepartment] = lines
    if (!rawLocation || !rawEmploymentType || !rawDepartment) {
      throw new Error('Innovision verified inline openings changed shape')
    }

    const locationBits = normalizeLocation(rawLocation)
    const jobId = slugify(title)
    if (!jobId || !locationBits.location) {
      throw new Error('Innovision verified inline openings changed shape')
    }

    jobs.push({
      title: normalizeWhitespace(title),
      company: COMPANY_NAME,
      department: normalizeOptionalValue(rawDepartment),
      location: locationBits.location,
      city: locationBits.city,
      state: locationBits.state,
      country: locationBits.country,
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_PAGE_URL,
      applyUrl,
      employmentType: normalizeEmploymentType(rawEmploymentType),
      sourceEmploymentType: normalizeOptionalValue(rawEmploymentType),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
      skipPublicExperienceEnrichment: true,
    })
  }

  if (jobs.length === 0) {
    throw new Error('Innovision verified careers page no longer exposes visible inline openings')
  }

  return jobs.sort((left, right) => left.title.localeCompare(right.title))
}

const normalizeScrapedAt = (value) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now() value supplied to Innovision scraper')
  }

  return parsed.toISOString()
}

export const createInnovisionScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date(),
} = {}) => ({
  async run(options = {}) {
    const fetchPage = options.fetchPage || defaultFetchPage

    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    if (!hasOfficialCareersSignal(careersPage)) {
      throw new Error('The verified Innovision careers page no longer matches the trusted public surface')
    }

    const limit = Number.isInteger(options.maxJobs) ? options.maxJobs : maxJobs
    const jobs = extractOpenings(careersPage.html)
    const selectedJobs = limit ? jobs.slice(0, limit) : jobs
    const scrapedAt = normalizeScrapedAt((options.now || now)())

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createInnovisionScraper().run(options)

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
