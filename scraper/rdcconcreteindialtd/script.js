import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'rdcconcreteindialtd'
export const COMPANY = 'RDC Concrete (India) Ltd'
export const HOMEPAGE_URL = 'https://www.rdc.in/'
export const CAREERS_URL = 'https://www.rdc.in/careers'

const COMPANY_DOMAIN = 'rdc.in'
const ATS_PLATFORM = 'official-company-careers'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;|&#8211;|&#8212;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/table|\/tbody|\/h[1-6]|\/section)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|tr|table|tbody|h[1-6]|section)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/['"]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const buildJobId = ({ title, location }) => `${SOURCE}-${slugify(`${title} ${location}`)}`

const REGIONAL_LOCATIONS = new Set(['pan india', 'north', 'south', 'east', 'west'])

const inferCity = (location) => {
  const normalizedLocation = normalizeWhitespace(location)
  if (!normalizedLocation) return null
  if (REGIONAL_LOCATIONS.has(normalizedLocation.toLowerCase())) return null

  const firstSegment = normalizedLocation.split(',')[0]?.trim()
  if (!firstSegment) return null

  return normalizeCity(firstSegment) || firstSegment
}

const parsePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (!match) return null

  const [, day, month, year] = match
  const parsed = new Date(`${month} ${day}, ${year} UTC`)
  if (Number.isNaN(parsed.getTime())) return null

  return parsed.toISOString().slice(0, 10)
}

const parseVacancyCount = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/\d+/)
  return match ? Number.parseInt(match[0], 10) : null
}

const extractTableFields = (tableHtml) => {
  const fields = new Map()

  for (const match of String(tableHtml ?? '').matchAll(
    /<tr>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi,
  )) {
    const label = stripTags(match[1])
    const value = stripTags(match[2])
    if (label && value) fields.set(label.toLowerCase(), value)
  }

  return fields
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*RDC Concrete \(India\) Limited - Readymix Concrete company, India\s*<\/title>/i.test(page)
    && /href=["']https:\/\/www\.rdc\.in\/careers["']/i.test(page)
    && text.includes('RDC Concrete (India) Limited stands as a pioneering and leading force')
    && text.includes("India's first commercial RMX plant")
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Career at RDC Concrete \(India\) Limited\s*<\/title>/i.test(page)
    && text.includes('Current Vacancies')
    && /mailto:careers@rdc\.in/i.test(page)
    && /career-apply\.php\?id=\d+/i.test(page)
    && text.includes('Job Position')
    && text.includes('Qualification')
    && text.includes('Experience')
}

export const extractPublicJobs = (html) => {
  const page = String(html ?? '')
  const jobs = []

  for (const match of page.matchAll(
    /<div class="col-md-12">\s*<table\b[^>]*>([\s\S]*?)<\/table>\s*<div class="readmore"><a href="([^"]+)">Apply Now<\/a><\/div>/gi,
  )) {
    const fields = extractTableFields(match[1])
    const title = normalizeWhitespace(fields.get('job position'))
    const location = normalizeWhitespace(fields.get('location'))
    const qualification = normalizeWhitespace(fields.get('qualification'))
    const experienceRequired = normalizeWhitespace(fields.get('experience'))
    const postingDate = parsePostingDate(fields.get('posted on'))
    const vacancyCount = parseVacancyCount(fields.get('no. of vacancy'))
    const applyUrl = toAbsoluteUrl(match[2], CAREERS_URL)

    if (!title || !location || !qualification || !experienceRequired || !postingDate || !applyUrl) {
      throw new Error('RDC verified public careers surface no longer exposes the required vacancy fields')
    }

    const jobId = buildJobId({ title, location })
    if (!jobId) {
      throw new Error('RDC verified public careers surface no longer yields stable vacancy identifiers')
    }

    jobs.push({
      title,
      company: COMPANY,
      location,
      city: inferCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl,
      employmentType: 'Full-time',
      experienceRequired,
      minimumQualification: qualification,
      preferredQualification: null,
      requiredSkills: [],
      postingDate,
      closingDate: null,
      jobDescription: [
        vacancyCount != null ? `Vacancies: ${vacancyCount}` : null,
        `Qualification: ${qualification}`,
        `Experience: ${experienceRequired}`,
      ].filter(Boolean).join('\n'),
      vacancyCount,
    })
  }

  if (jobs.length === 0) {
    throw new Error('RDC verified public careers surface returned no public jobs')
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const buildNormalizedJob = (job, now) => {
  const normalized = normalizeScrapedJob({
    ...job,
    source: SOURCE,
    companyCareerPage: CAREERS_URL,
    companyDomain: COMPANY_DOMAIN,
    atsPlatform: ATS_PLATFORM,
    scrapedAt: now(),
  }, {
    companyName: COMPANY,
    companyCareerPage: CAREERS_URL,
    companyDomain: COMPANY_DOMAIN,
    atsPlatform: ATS_PLATFORM,
    countryFilter: 'India',
  })

  return {
    ...normalized,
    link: normalized.applyUrl || normalized.sourceUrl,
  }
}

export const createRdcConcreteIndiaLtdScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now: overrideNow,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('RDC verified official homepage no longer matches the known first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('RDC verified public careers surface no longer matches the known first-party jobs page')
    }

    const timestampFactory = overrideNow || now
    return extractPublicJobs(careersHtml).map((job) => buildNormalizedJob(job, timestampFactory))
  },
})

export const run = async (options = {}) => createRdcConcreteIndiaLtdScraper().run(options)

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
