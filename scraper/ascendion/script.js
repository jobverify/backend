import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { collectAscendionNative, inspectNativeWorkplaces } from './nativeInventory.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { assessDescriptionSource } from '../../src/utils/jobDescriptionSourceQuality.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://jobs.ascendion.com/careers'
export const SEARCH_API_BASE_URL = 'https://jobs.ascendion.com/api/pcsx/search'
export const DETAIL_API_BASE_URL = 'https://jobs.ascendion.com/api/pcsx/position_details'
export const DOMAIN = 'ascendion.com'
export const LOCALE = 'en'
export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|hr)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractLines = (value) => String(value ?? '')
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|hr)\b[^>]*>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n')
  .replace(/<p\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split(/\n+/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const unique = (values) => [...new Set(values.filter(Boolean))]

const extractDetailPayload = (detail = {}) => {
  if (detail?.data && typeof detail.data === 'object' && !Array.isArray(detail.data)) {
    return detail.data
  }
  return detail || {}
}

const toIsoDate = (unixSeconds) => {
  const numeric = Number(unixSeconds)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return new Date(numeric * 1000).toISOString()
}

const formatEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

const extractHighlights = (detail = {}) => Array.isArray(detail?.jdHighlight)
  ? detail.jdHighlight.map((highlight) => normalizeWhitespace(highlight)).filter(Boolean)
  : []

const extractMinimumQualification = (detail = {}) => {
  const lines = extractLines(detail?.jobDescription)
  const sectionStart = lines.findIndex((line) => /^(minimum qualifications?|qualifications?)$/i.test(line))

  if (sectionStart !== -1) {
    const sectionLines = lines.slice(sectionStart + 1)
    const candidate = sectionLines.find((line) => (
      !/^(desired|preferred) qualifications?(?: \(optional\))?$/i.test(line)
      && !/\b\d+(?:\.\d+)?\s*(?:-|to|\+)?\s*\d*(?:\.\d+)?\s*(?:years?|yrs?|months?)\b/i.test(line)
    ))
    if (candidate) return candidate
  }

  return extractHighlights(detail).find((line) => (
    !/\b\d+(?:\.\d+)?\s*(?:-|to|\+)?\s*\d*(?:\.\d+)?\s*(?:years?|yrs?|months?)\b/i.test(line)
  )) || null
}

const extractExperienceRequired = (detail = {}) => {
  const candidates = [
    ...extractHighlights(detail),
    stripTags(detail?.jobDescription),
  ].filter(Boolean)

  for (const candidate of candidates) {
    const experienceProfile = extractJobFilterSignals({
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      jobDescription: candidate,
    })?.experienceProfile

    if (experienceProfile?.confidence === 'high' && experienceProfile.evidence) {
      return normalizeWhitespace(
        experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
          ? 'No experience required'
          : experienceProfile.evidence,
      )
    }
  }

  return null
}

export const buildSearchUrl = ({
  start = 0,
  query = '',
  location = '',
  domain = DOMAIN,
  sortBy = '',
  filters = {},
  locale = LOCALE,
} = {}) => {
  const params = new URLSearchParams({
    domain,
    query,
    location,
    start: String(start),
  })

  if (sortBy) {
    params.set('sort_by', sortBy)
  }

  for (const [filterName, values] of Object.entries(filters)) {
    for (const value of Array.isArray(values) ? values : []) {
      params.append(`filter_${String(filterName).replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)}`, value)
    }
  }

  if (locale) {
    params.set('hl', locale)
  }

  return `${SEARCH_API_BASE_URL}?${params.toString()}`
}

export const buildDetailUrl = (positionId, {
  domain = DOMAIN,
  locale = LOCALE,
  queriedLocation = null,
} = {}) => {
  const params = new URLSearchParams({
    position_id: String(positionId),
    domain,
    hl: locale,
  })

  if (queriedLocation) {
    params.set('queried_location', queriedLocation)
  }

  return `${DETAIL_API_BASE_URL}?${params.toString()}`
}

const buildJobUrl = (positionId) => `https://jobs.ascendion.com/careers/job/${positionId}`

const mapPositionToJob = (position, detail = {}) => {
  const detailPayload = extractDetailPayload(detail)
  const geography = inspectNativeWorkplaces(position, detailPayload)
  const cities = unique(geography.india.map(workplace => {
    const label = workplace.location || workplace.standardizedLocation
    const city = normalizeWhitespace(label?.split(',')[0])
    return city && !/^(?:india|in|remote(?: within india)?|anywhere(?: in)? india)$/i.test(city) ? city : null
  }))
  const positionId = normalizeWhitespace(position?.id)
  const displayJobId = normalizeWhitespace(detailPayload?.displayJobId || position?.displayJobId)
  const sourceUrl = buildJobUrl(positionId)
  const descriptionHtml = detailPayload?.jobDescription || null
  const activeDescription = descriptionHtml && assessDescriptionSource(descriptionHtml).ok ? extractActiveDescription(descriptionHtml) : null

  return {
    title: normalizeWhitespace(detailPayload?.name || position?.name),
    company: 'Ascendion',
    department: normalizeWhitespace(detailPayload?.department || position?.department),
    location: geography.india.length ? cities.length > 0 ? `${cities.join(', ')}, India` : 'India' : null,
    city: cities[0] || null,
    country: geography.india.length ? 'India' : null,
    jobId: positionId,
    requisitionId: displayJobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: formatEmploymentType(position?.workLocationOption),
    experienceRequired: extractExperienceRequired(detailPayload),
    minimumQualification: extractMinimumQualification(detailPayload),
    preferredQualification: null,
    requiredSkills: [],
    postingDate: toIsoDate(position?.postedTs),
    closingDate: null,
    jobDescription: activeDescription,
    sourceDescription: activeDescription ? descriptionHtml : null,
  }
}

export const extractSearchResults = (payload, { detailPayloadById = {} } = {}) => {
  const positions = Array.isArray(payload?.data?.positions) ? payload.data.positions : []

  return positions
    .map((position) => mapPositionToJob(position, detailPayloadById[position.id] || {}))
    .filter((job) => job.country === 'India')
}

export const createAscendionScraper = (settings = {}) => ({
  run: (options = {}) => collectAscendionNative({
    mapPositionToJob, buildSearchUrl, buildDetailUrl,
    defaults: { maxJobs: Number.isInteger(config.maxJobs) ? config.maxJobs : null, userAgent: USER_AGENT, ...settings },
  }, options),
})

export const run = async (options = {}) => createAscendionScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Ascendion scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'ascendion')
    console.log('DB result:', result)
    process.exit(0)
  }
}
