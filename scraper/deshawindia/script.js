import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'deshawindia'
export const COMPANY = 'D. E. Shaw India'
export const CAREERS_URL = 'https://www.deshawindia.com/careers'
export const COUNTRY = 'India'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const LOCATION_CODE_MAP = new Map([
  ['HYD', 'Hyderabad'],
  ['BLR', 'Bengaluru'],
  ['GGM', 'Gurugram'],
])

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&hellip;/gi, '...')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/section|\/h[1-6]|\/ul)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' '),
)

const unique = (values = []) => [...new Set(values.filter(Boolean))]

const buildAbsoluteUrl = (value) => {
  try {
    return new URL(String(value ?? ''), CAREERS_URL).toString()
  } catch {
    return null
  }
}

const normalizeListedLocationCodes = (value) => {
  const codes = normalizeWhitespace(value)
    ?.split(/[\/,|]/)
    .map((part) => normalizeWhitespace(part)?.toUpperCase())
    .filter(Boolean) || []

  return unique(codes.map((code) => LOCATION_CODE_MAP.get(code) || code))
}

const normalizeLocationNames = (values = []) => unique(
  values
    .map((value) => normalizeWhitespace(typeof value === 'string' ? value : value?.name))
    .filter(Boolean),
)

const formatLocation = (locations = []) => {
  const normalizedLocations = unique(locations)
  if (normalizedLocations.length === 0) return null
  return `${normalizedLocations.join(', ')}, ${COUNTRY}`
}

const extractNextData = (html = '') => {
  const match = String(html ?? '').match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  )
  if (!match?.[1]) return null

  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

const normalizeEmploymentType = (workStatus, title = null) => {
  const normalizedTitle = normalizeWhitespace(title)?.toLowerCase() || ''
  const normalizedStatus = normalizeWhitespace(workStatus)?.toLowerCase() || ''

  if (/intern|internship|apprentice|trainee/.test(normalizedTitle)) return 'Internship'
  if (/contract/.test(normalizedTitle) || /contract/.test(normalizedStatus)) return 'Contract'
  if (/\bpt\b|part/.test(normalizedStatus)) return 'Part-time'
  if (/\bft\b|regular/.test(normalizedStatus)) return 'Full-time'

  return null
}

const extractQualificationSections = (value) => {
  const text = normalizeWhitespace(
    Array.isArray(value)
      ? value.join('\n\n')
      : value,
  )

  if (!text) {
    return {
      minimumQualification: null,
      preferredQualification: null,
    }
  }

  const preferredMatch = text.match(/\bpreferred qualifications:\s*([\s\S]+)$/i)
  const basicMatch = text.match(/\bbasic qualifications:\s*([\s\S]*?)(?=\bpreferred qualifications:|$)/i)

  return {
    minimumQualification: normalizeWhitespace(basicMatch?.[1] || text),
    preferredQualification: normalizeWhitespace(preferredMatch?.[1]),
  }
}

const buildJobDescription = (jobDescription = {}) => {
  const segments = [
    jobDescription.websiteDescription,
    jobDescription.responsibilities,
    ...(Array.isArray(jobDescription.peopleWeAreLookingFor)
      ? jobDescription.peopleWeAreLookingFor
      : [jobDescription.peopleWeAreLookingFor]),
  ]

  const normalized = unique(segments.map((value) => stripHtml(value)).filter(Boolean))
  return normalized.length > 0 ? normalized.join('\n\n') : null
}

const resolvePublicLocations = (jobData, listing = {}) => {
  const detailedLocations = normalizeLocationNames(jobData?.jobMetadata?.jobLocations)
  if (detailedLocations.length > 0) {
    return {
      location: formatLocation(detailedLocations),
      city: detailedLocations[0] || null,
    }
  }

  const fallbackLocations = normalizeLocationNames(
    normalizeWhitespace(listing.location)
      ?.replace(new RegExp(`,\\s*${COUNTRY}$`, 'i'), '')
      .split(',')
      .map((value) => normalizeWhitespace(value)),
  )

  return {
    location: listing.location || formatLocation(fallbackLocations),
    city: listing.city || fallbackLocations[0] || null,
  }
}

export const extractCareerListings = (html = '') => {
  const listings = []
  const pattern = /<div class="job" data-job-id="(\d+)"[\s\S]*?<div class="information">([\s\S]*?)<\/div>[\s\S]*?<a class="parent-arrow-long"[^>]*href="([^"]+)"[\s\S]*?<span class="job-display-name">([\s\S]*?)<\/span>/gi

  let match = pattern.exec(String(html ?? ''))
  while (match) {
    const jobId = normalizeWhitespace(match[1])
    const infoHtml = match[2]
    const href = buildAbsoluteUrl(match[3])
    const title = stripHtml(match[4])
    const department = stripHtml(infoHtml.match(/<p class="category">([\s\S]*?)<\/p>/i)?.[1])
    const locations = normalizeListedLocationCodes(infoHtml.match(/<span class="location">([\s\S]*?)<\/span>/i)?.[1])

    if (jobId && href && title) {
      listings.push({
        title,
        company: COMPANY,
        department,
        location: formatLocation(locations),
        city: null,
        country: COUNTRY,
        jobId,
        requisitionId: jobId,
        sourceUrl: href,
        applyUrl: href,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: 'On-site',
      })
    }

    match = pattern.exec(String(html ?? ''))
  }

  return listings
}

export const extractJobDetail = (html = '', listing = {}) => {
  const pageProps = extractNextData(html)?.props?.pageProps ?? null
  const jobData = pageProps?.jobData ?? null
  const jobDescription = buildJobDescription(jobData?.jobDescription)
  const { minimumQualification, preferredQualification } = extractQualificationSections(
    jobData?.jobDescription?.peopleWeAreLookingFor
      ?? jobData?.jobDescription?.peopleWeAreLookingForStr
      ?? null,
  )
  const { location, city } = resolvePublicLocations(jobData, listing)
  const experienceProfile = extractJobFilterSignals({
    title: listing.title,
    department: listing.department,
    jobDescription,
    minimumQualification,
    preferredQualification,
  }).experienceProfile
  const hasPublicDetailEvidence = Boolean(
    jobData
    && (
      jobDescription
      || minimumQualification
      || preferredQualification
      || Array.isArray(jobData?.jobMetadata?.jobLocations)
      || jobData?.jobMetadata?.isExploratory === true
    )
  )

  return {
    title: listing.title || normalizeWhitespace(jobData?.title) || null,
    department: listing.department || normalizeWhitespace(jobData?.jobHeaders?.[0]) || null,
    location,
    city,
    country: COUNTRY,
    jobId: listing.jobId || null,
    requisitionId: listing.requisitionId || listing.jobId || null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl: listing.applyUrl || listing.sourceUrl || null,
    employmentType: normalizeEmploymentType(jobData?.jobMetadata?.workStatus, listing.title) || listing.employmentType || null,
    experienceRequired: listing.experienceRequired
      || (experienceProfile?.hasExplicitExperience ? experienceProfile.evidence || null : null),
    minimumQualification,
    preferredQualification,
    requiredSkills: [],
    postingDate: listing.postingDate || null,
    closingDate: listing.closingDate || null,
    jobDescription,
    remoteStatus: listing.remoteStatus || (location ? 'On-site' : null),
    publicExperienceChecked: hasPublicDetailEvidence,
  }
}

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

const mergeListingAndDetail = (listing, detail = {}) => ({
  ...listing,
  ...detail,
  company: COMPANY,
  country: COUNTRY,
  source: SOURCE,
  link: detail.applyUrl || detail.sourceUrl || listing.applyUrl || listing.sourceUrl,
  scrapedAt: new Date().toISOString(),
})

export const createDeShawScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    const listings = extractCareerListings(careersHtml)
    const jobs = []

    for (const listing of listings) {
      try {
        const detailHtml = await fetchText(listing.sourceUrl)
        const detail = extractJobDetail(detailHtml, listing)
        jobs.push(mergeListingAndDetail(listing, detail))
      } catch {
        jobs.push(mergeListingAndDetail(listing))
      }
    }

    return jobs
  },
})

export const run = async () => createDeShawScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')

  console.log(`Running D. E. Shaw India scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
