import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { INNOVAPPTIVE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = INNOVAPPTIVE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const BOARD_URL = PROVIDER_METADATA.boardUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_PATTERN =
  /\b(?:india|hyderabad|telangana|bangalore|bengaluru|pune|mumbai|chennai|gurugram|gurgaon|noida|delhi)\b/i

const INDIA_BOARD_OR_REMOTE_PATTERN = /^(?:remote\b|.*\bindia\b.*)$/i

const DETAIL_DESCRIPTION_STARTERS = [
  'The Role',
  'The Opportunity',
  'Job Description',
  'Why This Role Exists',
  'About Us',
  'About Innovapptive',
]

const DETAIL_DESCRIPTION_ENDERS = [
  'How You Will Make',
  'Impact You’ll Make',
  'What You Bring',
  'You Must Have',
  'Nice to Have',
  'Success Metrics',
  'What Success Looks Like',
  'What We Offer',
  'Apply for this position',
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html) => normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const stripToLines = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(div|p|li|section|article|ul|ol|h[1-6])>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const toAbsoluteBoardUrl = (value) => {
  try {
    const url = new URL(value, BOARD_URL)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (url.hostname !== new URL(BOARD_URL).hostname) return null
    return url.href.split('#')[0]
  } catch {
    return null
  }
}

const extractJobId = (url) => {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean)
    const applyIndex = segments.indexOf('apply')
    return applyIndex >= 0 ? segments[applyIndex + 1] || null : null
  } catch {
    return null
  }
}

const normalizeLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) return null
  return location
}

const getCity = (location) => {
  if (!location || /^remote\b/i.test(location)) return null
  return normalizeWhitespace(location.split(',')[0])
}

const isIndiaLocation = (location) => INDIA_LOCATION_PATTERN.test(location || '')

const isBoardCandidateLocation = (location) => INDIA_BOARD_OR_REMOTE_PATTERN.test(location || '')

const getCountry = (location) => (isIndiaLocation(location) ? 'India' : null)

const getRemoteStatus = (location) => {
  if (!location) return null
  return /^remote\b/i.test(location) ? 'Remote' : 'On-site'
}

const extractFieldValue = (lines, prefix) => {
  const line = lines.find((value) => value.toLowerCase().startsWith(prefix.toLowerCase()))
  return normalizeWhitespace(line?.slice(prefix.length).trim() || null)
}

const extractJobDescriptionFromLines = (lines) => {
  const startIndex = lines.findIndex((line) => DETAIL_DESCRIPTION_STARTERS.some((prefix) => line.startsWith(prefix)))
  if (startIndex < 0) return null

  const descriptionLines = []
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line) continue
    if (DETAIL_DESCRIPTION_ENDERS.some((prefix) => line.startsWith(prefix))) break
    descriptionLines.push(line)
  }

  return normalizeWhitespace(descriptionLines.join(' ')) || null
}

export const extractJobDetailFields = (html = '') => {
  const lines = stripToLines(html)

  return {
    location: normalizeLocation(extractFieldValue(lines, 'Location:')),
    employmentType: normalizeWhitespace(extractFieldValue(lines, 'Employment Type:')) || null,
    jobDescription: extractJobDescriptionFromLines(lines),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const title = extractTitle(page)

  return /^career$/i.test(title)
    && normalized.includes('Experience a workplace where Innovation meets Passion!')
    && normalized.includes('Innovapptive is a pioneer in connected worker solutions')
    && normalized.includes('info@innovapptive.com')
    && normalized.includes('All Rights Reserved')
}

export const hasVerifiedBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return extractTitle(page) === 'Innovapptive - Career Page'
    && normalized.includes('Current Openings')
    && normalized.includes('View Our Website')
    && (
      page.includes('https://www.innovapptive.com')
      || /content=["']Explore open job opportunities at Innovapptive\./i.test(page)
    )
}

export const extractBoardJobs = (html = '') => {
  const jobs = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(
    /<h3[^>]*>\s*<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>([\s\S]*?)(?=<h3\b|<\/li>|$)/gi,
  )) {
    const applyUrl = toAbsoluteBoardUrl(match[1])
    const title = normalizeWhitespace(match[2])
    const lines = stripToLines(match[3])
    const location = normalizeLocation(lines[0])
    const department = normalizeWhitespace(lines[1])
    const jobId = applyUrl ? extractJobId(applyUrl) : null

    if (!applyUrl || !title || !location || !jobId || seen.has(applyUrl) || !isBoardCandidateLocation(location)) {
      continue
    }

    seen.add(applyUrl)
    jobs.push({
      title,
      company: COMPANY,
      department: department || null,
      location,
      city: getCity(location),
      country: getCountry(location),
      jobId,
      requisitionId: jobId,
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: getRemoteStatus(location),
    })
  }

  return jobs
}

export const createInnovapptiveScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The official Innovapptive careers page no longer matches the verified first-party surface')
    }

    const boardHtml = await fetchText(BOARD_URL)
    if (!hasVerifiedBoardSignal(boardHtml)) {
      throw new Error('The verified Innovapptive ApplyToJob board no longer matches the trusted public surface')
    }

    const jobs = []
    for (const listing of extractBoardJobs(boardHtml)) {
      let detailFields = { location: null, employmentType: null, jobDescription: null }

      try {
        const detailHtml = await fetchText(listing.sourceUrl)
        detailFields = extractJobDetailFields(detailHtml)
      } catch {
        if (!isIndiaLocation(listing.location)) {
          continue
        }
      }

      const location = normalizeLocation(detailFields.location || listing.location)
      if (!isIndiaLocation(location)) {
        continue
      }

      jobs.push({
        ...listing,
        location,
        city: getCity(location),
        country: 'India',
        employmentType: detailFields.employmentType || listing.employmentType || null,
        jobDescription: detailFields.jobDescription || listing.jobDescription || null,
        remoteStatus: getRemoteStatus(location),
        source: SOURCE,
        link: listing.applyUrl || listing.sourceUrl,
        scrapedAt: new Date().toISOString(),
      })

      if (maxJobs && jobs.length >= maxJobs) {
        return jobs
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createInnovapptiveScraper().run(options)

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
