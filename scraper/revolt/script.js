import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'revolt'
export const COMPANY = 'Revolt'
export const HOMEPAGE_URL = 'https://www.revoltmotors.com/'
export const CAREERS_URL = 'https://www.revoltmotors.com/career-with-us'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')

const stripTags = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = stripTags(value)
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/['"]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const toTitleCase = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/\b[a-z]/g, (match) => match.toUpperCase()) || null

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /^full\s*time$/i.test(normalized) ? 'Full-time' : normalized
}

const normalizeLocation = (value) => {
  const normalized = toTitleCase(value)
  if (!normalized) return null
  return normalized.replace(/\s*\/\s*/g, '/ ').replace(/\s*,\s*/g, ', ')
}

const toCity = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized) return null
  if (/[,/]/.test(normalized)) return null
  return normalized
}

const formatLocation = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized) return null
  return /india$/i.test(normalized) ? normalized : `${normalized}, India`
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const hasLegacyTrustSignals =
    /href="\/career-with-us"/i.test(page)
    && normalized.includes('contact@revoltmotors.com')
    && normalized.includes('Revolt Intellicorp Private Limited')
  const hasCurrentTrustSignals =
    /<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.revoltmotors\.com\/?"/i.test(page)
    && /<meta[^>]+property="og:title"[^>]+content="Revolt Electric Bikes- EV Bike Price India and Latest Models"/i.test(page)
    && /rattanindia/i.test(page)

  return /<title>\s*Revolt Electric Bikes- EV Bike Price India and Latest Models\s*<\/title>/i.test(page)
    && /<meta[^>]+name="description"[^>]+Find the best electric bikes in India/i.test(page)
    && /<meta[^>]+property="og:site_name"[^>]+content="Revolt Motors"/i.test(page)
    && (hasLegacyTrustSignals || hasCurrentTrustSignals)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Revolt Motors Careers \| Jobs and Hiring Opportunities\s*<\/title>/i.test(page)
    && /<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.revoltmotors\.com\/career-with-us"/i.test(page)
    && normalized.includes('Build your career at Revolt')
    && normalized.includes('Check all our job openings')
    && normalized.includes('Select Department')
    && normalized.includes('Select Location')
    && normalized.includes('Apply Filter')
}

const normalizeExperienceRequired = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^0(?:\s*years?)?$/i.test(normalized)) return 'No experience required'

  const rangeMatch = normalized.match(/^(\d+)\s*(?:-|to|–|—)\s*(\d+)\s*(?:years?|yrs?)?$/i)
  if (rangeMatch) {
    return `${rangeMatch[1]}-${rangeMatch[2]} years`
  }

  const openEndedMatch = normalized.match(/^(\d+)\s*\+\s*(?:years?|yrs?)?$/i)
  if (openEndedMatch) {
    return `${openEndedMatch[1]}+ years`
  }

  const singleYearMatch = normalized.match(/^(\d+)\s*(?:years?|yrs?)?$/i)
  if (singleYearMatch) {
    return `${singleYearMatch[1]} years`
  }

  const experienceProfile = extractJobFilterSignals({
    description: `Experience: ${normalized}`,
  })?.experienceProfile
  const evidence = normalizeWhitespace(experienceProfile?.evidence)

  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return (
    experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
      ? 'No experience required'
      : evidence
  )
}

const extractJsonArrayBlock = (value, startIndex) => {
  const page = String(value ?? '')
  const arrayStart = page.indexOf('[', startIndex)
  if (arrayStart < 0) return null

  let depth = 0
  for (let index = arrayStart; index < page.length; index += 1) {
    if (page[index] === '[') depth += 1
    if (page[index] === ']') depth -= 1
    if (depth === 0) return page.slice(arrayStart, index + 1)
  }

  return null
}

const parseStructuredJobsArray = (payload, { escaped }) => {
  if (!payload) return []

  const normalizedPayload = escaped
    ? payload.replace(/\\"/g, '"').replace(/\\\//g, '/')
    : payload

  try {
    const parsed = JSON.parse(normalizedPayload)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const extractStructuredInitialJobs = (html) => {
  const page = String(html ?? '')
  const markerMatch = page.match(/\\?"initialJobs\\?"\s*:\s*\[/)
  if (!markerMatch || typeof markerMatch.index !== 'number') {
    return []
  }

  const payload = extractJsonArrayBlock(page, markerMatch.index)
  const parsedJobs = parseStructuredJobsArray(payload, {
    escaped: markerMatch[0].includes('\\"'),
  })

  return parsedJobs.map((record = {}) => ({
    requisition_date: normalizeWhitespace(record.requisition_date),
    department: normalizeWhitespace(record.department),
    designation: normalizeWhitespace(record.designation),
    location: normalizeWhitespace(record.location),
    exp: normalizeWhitespace(record.exp),
    qualifications: normalizeWhitespace(record.qualifications),
    short_text: normalizeWhitespace(record.short_text),
    type: normalizeWhitespace(record.type),
  }))
}

const buildStructuredJob = (record = {}) => {
  const title = normalizeWhitespace(record.designation)
  const department = normalizeWhitespace(record.department)
  const location = normalizeWhitespace(record.location)
  const description = normalizeWhitespace(record.short_text)
  const normalizedLocation = formatLocation(location)
  const jobSlug = slugify(`${SOURCE}-${title}-${department}-${location}`)
  const experienceRequired = normalizeExperienceRequired(record.exp)

  if (!title || !department || !location || !normalizedLocation || !jobSlug) {
    return null
  }

  return {
    title,
    company: COMPANY,
    location: normalizedLocation,
    city: toCity(location),
    country: 'India',
    department,
    jobId: jobSlug,
    requisitionId: jobSlug,
    sourceUrl: CAREERS_URL,
    applyUrl: CAREERS_URL,
    employmentType: normalizeEmploymentType(record.type),
    experienceRequired,
    minimumQualification: normalizeWhitespace(record.qualifications),
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(record.requisition_date),
    closingDate: null,
    jobDescription: description,
    publicExperienceChecked: Boolean(description) && !experienceRequired,
  }
}

const mergeStructuredJobs = (cardJobs, structuredJobs) => {
  const mergedJobsById = new Map(
    (Array.isArray(cardJobs) ? cardJobs : [])
      .map((job) => [job.jobId, job]),
  )

  for (const structuredJob of Array.isArray(structuredJobs) ? structuredJobs : []) {
    if (!structuredJob) continue
    const existingJob = mergedJobsById.get(structuredJob.jobId)

    mergedJobsById.set(structuredJob.jobId, {
      ...(existingJob || {}),
      ...structuredJob,
      employmentType: structuredJob.employmentType || existingJob?.employmentType || null,
      minimumQualification: structuredJob.minimumQualification || existingJob?.minimumQualification || null,
      jobDescription: structuredJob.jobDescription || existingJob?.jobDescription || null,
      publicExperienceChecked:
        structuredJob.publicExperienceChecked === true
        || existingJob?.publicExperienceChecked === true,
    })
  }

  return [...mergedJobsById.values()]
}

const extractVisibleCardJobs = (html) => {
  const blocks = String(html ?? '').split(/<div data-slot="card" class="/i).slice(1)
  const jobs = []

  for (const block of blocks) {
    const title = normalizeWhitespace(
      block.match(/<div data-slot="card-title"[^>]*>([\s\S]*?)<\/div>/i)?.[1],
    )
    const spans = [...block.matchAll(/<span(?:\s[^>]*)?>([\s\S]*?)<\/span>/gi)]
      .map((match) => normalizeWhitespace(match[1]))
      .filter(Boolean)
    const description = normalizeWhitespace(
      block.match(/<div data-slot="card-content"[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/i)?.[1],
    )

    const location = spans[0]
    const department = spans[1]

    if (!title || !location || !department || !description) {
      continue
    }

    const normalizedLocation = formatLocation(location)
    const city = toCity(location)
    const jobSlug = slugify(`${SOURCE}-${title}-${department}-${location}`)

    if (!jobSlug || !normalizedLocation) {
      throw new Error(`Revolt verified card for ${title} no longer exposes a stable identifier`)
    }

    jobs.push({
      title,
      company: COMPANY,
      location: normalizedLocation,
      city,
      country: 'India',
      department,
      jobId: jobSlug,
      requisitionId: jobSlug,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: description,
    })
  }

  return jobs
}

export const extractJobOpenings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Revolt verified first-party careers page no longer matches the trusted public surface')
  }

  const cardJobs = extractVisibleCardJobs(html)
  const structuredJobs = extractStructuredInitialJobs(html).map(buildStructuredJob).filter(Boolean)
  const jobs = structuredJobs.length > 0
    ? mergeStructuredJobs(cardJobs, structuredJobs)
    : cardJobs

  if (jobs.length === 0) {
    throw new Error('Revolt verified first-party careers page no longer exposes inline public role cards')
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

export const createRevoltScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Revolt verified official homepage no longer matches the trusted public surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const jobs = extractJobOpenings(careersHtml)
    const scrapedAt = now()

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createRevoltScraper().run(options)

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
