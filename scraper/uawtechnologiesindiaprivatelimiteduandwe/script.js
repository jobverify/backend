import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'uawtechnologiesindiaprivatelimiteduandwe'
export const COMPANY = 'UAW Technologies India Private Limited (UANDWE)'
export const COMPANY_DOMAIN = 'uandwe.com'
export const HOMEPAGE_URL = 'https://uandwe.com/'
export const CAREERS_URL = 'https://uandwe.com/careers.html'
export const APPLY_EMAIL = 'recruit@uandwe.com'
export const APPLY_URL = `mailto:${APPLY_EMAIL}`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/\r/g, '')
    .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(?:p|div|li|ul|ol|section|article|main|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const textLines = (html) =>
  decodeHtml(String(html ?? ''))
    .replace(/\r/g, '')
    .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(?:p|div|li|ul|ol|section|article|main|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const titleToSourceUrl = (title) => `${CAREERS_URL}#${SOURCE}-${slugify(title)}`

const extractMinimumQualification = (block) => {
  const text = stripTags(block) || ''

  const qualificationsMatch = text.match(/Qualifications?:\s+(.+?)$/i)
  if (qualificationsMatch) {
    const fragments = qualificationsMatch[1]
      .match(/[^.]+\./g)
      ?.map((entry) => normalizeWhitespace(entry))
      .filter(Boolean)

    return fragments?.[0] || normalizeWhitespace(qualificationsMatch[1])
  }

  return null
}

const extractExperience = (block) => {
  const text = stripTags(block) || ''
  const lineMatch = text.match(/Experience:\s*([^\n]+?)(?:\s+(?:Apply Now|Job Description|Location:)|$)/i)
  if (lineMatch) {
    return normalizeWhitespace(lineMatch[1])
  }

  const bulletMatch = text.match(/\b(\d+\s*-\s*\d+\s+years of experience\.)/i)
  if (bulletMatch) {
    return normalizeWhitespace(bulletMatch[1])
  }

  return null
}

const extractDescription = (block) => {
  const text = stripTags(block) || ''
  const descriptionMatch = text.match(
    /Job Description\s+Location:\s*.*?,\s*India\s+([\s\S]*?)(?:\s+(?:Qualifications?:|Qualification:)\s+|$)/i,
  )
  if (!descriptionMatch) return null

  const description = normalizeWhitespace(descriptionMatch[1])
    ?.replace(/\b(?:Job Responsibilities|Key Skills|Role Overview|Required Qualifications)\s*:?\s*/gi, '')

  return description || null
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  return normalized.split(/[\/,]/)[0]?.trim() || null
}

const getJobBlocks = (html) => {
  const page = String(html ?? '')
  const starts = [...page.matchAll(/<h5\b[^>]*>\s*([\s\S]*?)\s*<\/h5>/gi)]

  return starts.map((match, index) => {
    const rawTitle = match[1]
    const title = stripTags(rawTitle)
    const start = match.index ?? 0
    const end = starts[index + 1]?.index ?? page.length
    const isDecorativeRegionHeading = /^(?:India|USA) Region$/i.test(title || '')
      && /(?:alt=["'][^"']*Flag["']|class=["'][^"']*\bflag\b|emojiterra)/i.test(rawTitle)

    if (isDecorativeRegionHeading) return null

    return {
      title,
      html: page.slice(start, end),
    }
  }).filter((entry) => entry?.title)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = (stripTags(page) || '').toLowerCase()

  return /<title>\s*UANDWE\s*<\/title>/i.test(page)
    && /href=["'](?:https:\/\/uandwe\.com\/careers\.html|\/careers\.html|careers\.html)["']/i.test(page)
    && text.includes('headquartered in bay area ca , with its india subsidiary as uandwe technologies india pvt ltd, bangalore')
    && text.includes('uandwe is a product and service based company. customer centricity and satisfaction is our primary goal')
    && text.includes('contact@uandwe.com')
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /Current Job Openings/i.test(text)
    && /Application Form/i.test(text)
    && /default mail app/i.test(text)
    && new RegExp(escapeRegex(APPLY_EMAIL), 'i').test(text)
    && /Location:\s*[A-Za-z/ ,()-]+,\s*India/i.test(text)
}

export const extractPublicJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('UANDWE careers page no longer matches the verified official public jobs surface')
  }

  const jobs = []

  for (const block of getJobBlocks(html)) {
    const lines = textLines(block.html)
    const title = normalizeWhitespace(block.title)
    const location = normalizeWhitespace(lines[1])
    const employmentType = normalizeWhitespace(lines.find((line) => /^Full Time$/i.test(line)))
    const experienceRequired = extractExperience(block.html)
    const minimumQualification = extractMinimumQualification(block.html)
    const jobDescription = extractDescription(block.html)

    if (location && !/\bindia\b/i.test(location)) {
      continue
    }

    if (!title || !location || !employmentType || !jobDescription) {
      throw new Error(`UANDWE job block drifted for "${title || 'unknown'}"`)
    }

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city: extractCity(location),
      country: 'India',
      jobId: `${SOURCE}-${slugify(title)}`,
      requisitionId: null,
      sourceUrl: titleToSourceUrl(title),
      applyUrl: APPLY_URL,
      employmentType,
      experienceRequired,
      minimumQualification,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription,
      remoteStatus: null,
    })
  }

  if (jobs.length === 0) {
    throw new Error('UANDWE careers page no longer exposes trusted public openings')
  }

  return jobs
}

export const createUawTechnologiesIndiaPrivateLimitedUandweScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('UANDWE homepage no longer matches the verified official first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('UANDWE careers page no longer matches the verified official public jobs surface')
    }

    const scrapedAt = now()
    const jobs = extractPublicJobs(careersHtml)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt,
      companyCareerPage: CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createUawTechnologiesIndiaPrivateLimitedUandweScraper().run(options)

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
