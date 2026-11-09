import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'tringapps'
export const COMPANY = 'tringapps'
export const HOMEPAGE_URL = 'https://tringapps.com/'
export const ABOUT_URL = 'https://tringapps.com/about-us/'
export const CAREERS_URL = 'https://tringapps.com/careers/'
export const CONTACT_URL = 'https://tringapps.com/contact-us/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeText = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const slugify = (value) => normalizeText(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const toStructuredText = (html) => decodeHtmlEntities(String(html ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<h[1-6]\b[^>]*>/gi, '\n### ')
  .replace(/<\/h[1-6]>/gi, '\n')
  .replace(/<(?:p|div|section|article|form|ul|ol)\b[^>]*>/gi, '\n')
  .replace(/<\/(?:p|div|section|article|form|ul|ol)>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n')
  .replace(/<\/li>/gi, '\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\r\n?/g, '\n')
  .replace(/[ \t\f\v]+/g, ' ')
  .replace(/ *\n */g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

const linesFromSegment = (segment) => String(segment ?? '')
  .split('\n')
  .map((line) => normalizeText(line))
  .filter(Boolean)

const normalizeEmploymentType = (value) => {
  const normalized = normalizeText(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full time') return 'Full-time'
  if (normalized === 'part time') return 'Part-time'
  if (normalized === 'contract') return 'Contract'
  return normalizeText(value)
}

const normalizeLocation = (locationLine, country) => {
  const normalizedLocation = normalizeText(locationLine)
  const normalizedCountry = normalizeText(country)
  if (!normalizedLocation || !normalizedCountry) return null

  if (normalizedCountry !== 'India') return null

  if (/india/i.test(normalizedLocation)) {
    return {
      location: normalizedLocation,
      city: normalizeText(normalizedLocation.split(',')[0]),
      country: 'India',
    }
  }

  return {
    location: `${normalizedLocation}, India`,
    city: normalizeText(normalizedLocation.split(',')[0]),
    country: 'India',
  }
}

const parseRoleSegments = (html) => {
  const segments = toStructuredText(html)
    .split(/\n###\s+/)
    .slice(1)
    .map((segment) => {
      const lines = linesFromSegment(segment)
      return {
        heading: lines[0] || null,
        lines,
      }
    })

  return segments.filter((segment) => segment.heading)
}

const extractExperience = (lines) =>
  lines.find((line) => /\b\d+\+?\s*Yrs\b/i.test(line)) || null

const extractEmploymentType = (lines) =>
  normalizeEmploymentType(lines.find((line) => /full time|part time|contract/i.test(line)) || null)

const extractDescription = (lines) =>
  lines.find((line) => /^Who We Need\b/i.test(line) && normalizeText(line)?.toLowerCase() !== 'who we need')
  || null

const extractCountryAndLocation = (lines) => {
  const countryIndex = lines.findIndex((line) => line === 'India' || line === 'USA')
  if (countryIndex <= 0) return null

  const country = lines[countryIndex]
  const locationLine = lines[countryIndex - 1]
  return {
    country,
    locationLine,
  }
}

const extractRequiredSkills = (lines) => {
  const requirementsIndex = lines.findIndex((line) => /^Requirements$/i.test(line))
  if (requirementsIndex < 0) return []

  return lines
    .slice(requirementsIndex + 1)
    .filter((line) => !/^Location:/i.test(line))
    .filter((line) => !/^Type:/i.test(line))
    .filter((line) => !/^Experience:/i.test(line))
    .filter((line) => !/^Openings:/i.test(line))
    .filter((line) => !/^Who We Need$/i.test(line))
    .map((line) => normalizeText(line))
    .filter(Boolean)
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeText(html)?.toLowerCase() || ''
  const page = String(html ?? '')

  return /<title>\s*Home - tringapps\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+content=["']Tringapps is a full-stack digital transformation company specializing in AI, FinTech, cloud, mobile, and OTT solutions\. Explore our services!["']/i.test(page)
    && /href=["'](?:https:\/\/tringapps\.com)?\/career\/?["']/i.test(page)
    && /href=["'](?:https:\/\/tringapps\.com)?\/about(?:-us)?\/?["']/i.test(page)
    && /href=["'](?:https:\/\/tringapps\.com)?\/contact-us\/?["']/i.test(page)
}

export const hasOfficialAboutSignal = (html) => {
  const normalized = normalizeText(html)?.toLowerCase() || ''

  return normalized.includes('one vision. infinite possibilities')
    && normalized.includes('global powerhouse in technology, research, and analytics')
    && normalized.includes('2,000 employees')
    && normalized.includes('empowering businesses through cutting-edge technology, research, and analytics solutions')
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeText(toStructuredText(html))?.toLowerCase() || ''

  return normalized.includes('shape your future with us')
    && normalized.includes('discover opportunities')
    && normalized.includes('view details')
    && normalized.includes('apply now')
    && normalized.includes('apply here')
    && normalized.includes('india')
    && normalized.includes('usa')
}

export const hasOfficialContactSignal = (html) => {
  const normalized = normalizeText(html)?.toLowerCase() || ''

  return /let[’']s connect/i.test(normalized)
    && normalized.includes('global locations')
    && normalized.includes('new york city, ny')
    && normalized.includes('chennai, india')
    && normalized.includes('madurai, india')
}

export const extractJobCards = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('tringapps verified first-party careers page no longer matches the trusted public surface')
  }

  const segments = parseRoleSegments(html)
  const summarySegments = segments.filter((segment) =>
    segment.heading !== 'Apply Here' && segment.lines.includes('View Details Apply Now'),
  )

  if (summarySegments.length === 0) {
    throw new Error('tringapps verified first-party careers page no longer exposes public role cards')
  }

  return summarySegments.map((segment) => {
    const title = normalizeText(segment.heading)
    const locationCountry = extractCountryAndLocation(segment.lines)
    const locationData = normalizeLocation(locationCountry?.locationLine, locationCountry?.country)

    if (!title || !locationCountry || !locationData) return null

    const detailSegment = segments.find((candidate, index) =>
      index > segments.indexOf(segment) && candidate.heading === title,
    )
    const requiredSkills = extractRequiredSkills(detailSegment?.lines || [])
    const jobId = `${SOURCE}-${slugify(title)}-${slugify(`${locationData.city}-${locationData.country}`)}`

    return {
      title,
      company: COMPANY,
      department: null,
      location: locationData.location,
      city: locationData.city,
      country: locationData.country,
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: extractEmploymentType(segment.lines),
      experienceRequired: extractExperience(segment.lines),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: extractDescription(segment.lines),
    }
  }).filter(Boolean)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createTringappsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('tringapps verified official homepage no longer matches the trusted first-party surface')
    }

    const aboutHtml = await fetchText(ABOUT_URL)
    if (!hasOfficialAboutSignal(aboutHtml)) {
      throw new Error('tringapps verified about page no longer matches the trusted first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const jobs = extractJobCards(careersHtml)

    const contactHtml = await fetchText(CONTACT_URL)
    if (!hasOfficialContactSignal(contactHtml)) {
      throw new Error('tringapps verified contact page no longer matches the trusted first-party surface')
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createTringappsScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
