import path from 'path'
import { fileURLToPath } from 'url'

import { run as runCurrentKpit } from './currentNativeFacts20261121.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const BASE_URL = 'https://www.kpit.com'
const TALENTOJO_BASE_URL = 'https://talentojo.kpit.com'
const LISTING_QUERY = 'country=India&location=&exp=&show_all=1'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&amp;/gi, '&')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toTitleCase = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .toLowerCase()
    .split(' ')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

const splitCsv = (value) => normalizeWhitespace(value)
  ?.split(',')
  .map((part) => normalizeWhitespace(part))
  .filter(Boolean) || []

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const slashDate = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized)
  if (slashDate) {
    const [, year, month, day] = slashDate
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const withoutPrefix = normalized.replace(/^Exp\s*/i, '')
  return /\byears?\b/i.test(withoutPrefix) ? withoutPrefix : `${withoutPrefix} years`
}

const normalizeExperienceRange = (minYears, maxYears) => {
  const min = Number.parseInt(String(minYears ?? ''), 10)
  const max = Number.parseInt(String(maxYears ?? ''), 10)
  if (Number.isFinite(min) && Number.isFinite(max)) {
    return `${min}-${max} years`
  }
  return null
}

const normalizeLocation = (city, country = 'India') => {
  const normalizedCity = toTitleCase(city)
  if (!normalizedCity) return null

  const normalizedCountry = toTitleCase(country) || 'India'
  return `${normalizedCity}, ${normalizedCountry}`
}

const extractCity = (location) => normalizeWhitespace(location)?.split(',')[0] || null

const dedupe = (values) => {
  const seen = new Set()
  const result = []

  for (const value of values) {
    const normalized = normalizeWhitespace(value)
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }

  return result
}

export const buildSearchUrl = () => `${BASE_URL}/job-listing/?${LISTING_QUERY}`

export const buildApplyUrl = (jobId) =>
  `${TALENTOJO_BASE_URL}/tojo/app/job-apply/#/Career%20Portal/${normalizeWhitespace(jobId) || ''}`

export const buildJobDetailApiUrl = (jobId) =>
  `${TALENTOJO_BASE_URL}/service/jobs/${normalizeWhitespace(jobId) || ''}`

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(
  /<h3>([\s\S]*?)<\/h3>[\s\S]*?<div>\s*([^<]+)\s*<\/div>\s*<div>\s*([^<]+)\s*<\/div>\s*<div>\s*Exp\s*([^<]+)\s*<\/div>[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*?<a[^>]+href="([^"]*Career%20Portal\/(\d+))"[^>]*>\s*Apply\s*<\/a>/gi,
)]
  .map((match) => {
    const title = stripTags(match[1])
    const city = toTitleCase(match[2])
    const employmentType = normalizeWhitespace(match[3])
    const experienceRequired = normalizeExperience(match[4])
    const requiredSkills = splitCsv(stripTags(match[5]))
    const applyUrl = normalizeWhitespace(match[6])
    const jobId = normalizeWhitespace(match[7])
    const location = normalizeLocation(city)

    if (!title || !city || !applyUrl || !jobId || !location) return null

    return {
      title,
      company: 'KPIT',
      department: null,
      location,
      city: extractCity(location),
      jobId,
      requisitionId: jobId,
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: employmentType || null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    }
  })
  .filter(Boolean)

export const extractPaginationSummary = (html) => ({
  hasNext: /Load More/i.test(String(html ?? '')),
  totalJobCount: extractSearchResults(html).length,
})

export const extractJobDetail = (payload, listing = {}) => {
  const job = payload?.job || payload || {}
  const city = toTitleCase(Array.isArray(job.location) ? job.location[0] : job.location)
    || listing.city
    || null
  const location = normalizeLocation(city, job.country || 'India') || listing.location || null
  const jobId = normalizeWhitespace(job.id || job.code) || listing.jobId || null
  const applyUrl = listing.applyUrl || buildApplyUrl(jobId)

  return {
    title: normalizeWhitespace(job.title) || listing.title || null,
    department: null,
    location,
    city: city || extractCity(location),
    jobId,
    requisitionId: normalizeWhitespace(job.code) || jobId,
    sourceUrl: listing.sourceUrl || applyUrl,
    applyUrl,
    employmentType: normalizeWhitespace(job.type) || listing.employmentType || null,
    experienceRequired: normalizeExperienceRange(job.min_experience, job.max_experience)
      || listing.experienceRequired
      || null,
    minimumQualification: Array.isArray(job.qualification)
      ? job.qualification.map((value) => normalizeWhitespace(value)).filter(Boolean).join(', ') || null
      : normalizeWhitespace(job.qualification),
    preferredQualification: null,
    requiredSkills: dedupe([
      ...splitCsv(job.required_skills),
      ...splitCsv(job.additional_skills),
    ]),
    postingDate: normalizeDate(job.created_at) || listing.postingDate || null,
    closingDate: null,
    jobDescription: stripTags(job.description),
  }
}

export const run = options => runCurrentKpit(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running KPIT scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'kpit')
    console.log('DB result:', result)
    process.exit(0)
  }
}
