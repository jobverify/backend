import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { CANONICAL_CITIES } from '../../scraper-support/utils/cities.js'
import { SOPHOS_TECHNOLOGIES_CATALOG } from './catalog.js'
import { runCurrentSophosInventory } from './currentAshby.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = SOPHOS_TECHNOLOGIES_CATALOG.source
export const COMPANY = SOPHOS_TECHNOLOGIES_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SOPHOS_TECHNOLOGIES_CATALOG.officialBrandName
export const CAREERS_URL = SOPHOS_TECHNOLOGIES_CATALOG.companyCareerPage
export const LEVER_BOARD_URL = SOPHOS_TECHNOLOGIES_CATALOG.leverBoardUrl
export const LEVER_POSTINGS_API_URL = SOPHOS_TECHNOLOGIES_CATALOG.leverPostingsApiUrl
export const VERIFIED_ON = SOPHOS_TECHNOLOGIES_CATALOG.verifiedOn
export const PROVIDER_METADATA = SOPHOS_TECHNOLOGIES_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(value)
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const uniqueValues = (values) => [...new Set(values.filter(Boolean))]

const normalizeLocations = (posting) => uniqueValues([
  normalizeWhitespace(posting?.categories?.location),
  ...(Array.isArray(posting?.categories?.allLocations)
    ? posting.categories.allLocations.map((location) => normalizeWhitespace(location))
    : []),
])

const isIndiaCountry = (value) => ['IN', 'IND', 'INDIA'].includes(
  normalizeWhitespace(value)?.toUpperCase(),
)

const INDIA_CITY_ALIASES = new Set(
  Object.keys(CANONICAL_CITIES).filter((value) => !/^(?:remote|none)$/i.test(value)),
)
const INDIA_REGION_PATTERN = /^(?:Andhra Pradesh|Arunachal Pradesh|Assam|Bihar|Chhattisgarh|Goa|Gujarat|Haryana|Himachal Pradesh|Jharkhand|Karnataka|Kerala|Madhya Pradesh|Maharashtra|Manipur|Meghalaya|Mizoram|Nagaland|Odisha|Punjab|Rajasthan|Sikkim|Tamil Nadu|Telangana|Tripura|Uttar Pradesh|Uttarakhand|West Bengal|Delhi|Chandigarh|Puducherry|Ladakh|Jammu and Kashmir)$/i

const isRecognizedIndiaLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) return false
  if (/\bindia\b/i.test(location) || /^IND-/i.test(location)) return true
  if (/^(?:remote|offsite|apac remote)$/i.test(location)) return true
  const parts = location.split(',').map((part) => part.trim()).filter(Boolean)
  const city = parts[0]?.toLowerCase()
  if (!INDIA_CITY_ALIASES.has(city)) return parts.length === 1 && INDIA_REGION_PATTERN.test(parts[0])
  return parts.length === 1 || parts.slice(1).some((part) => INDIA_REGION_PATTERN.test(part))
}

const isIndiaPosting = (posting) => {
  const locations = normalizeLocations(posting)
  if (locations.some((location) => /\bindia\b/i.test(location))) return true
  if (!isIndiaCountry(posting?.country)) return false
  return locations.length === 0 || locations.some(isRecognizedIndiaLocation)
}

const isGenericIndiaLocation = (location) => (
  /^(?:india|remote(?:\s*[-,]\s*india)?|india\s*[-,]\s*remote)$/i.test(location)
)

const chooseIndiaLocation = (locations, country) => {
  const specificIndiaLocation = locations.find((location) => (
    /\bindia\b/i.test(location) && !isGenericIndiaLocation(location)
  ))
  if (specificIndiaLocation) return specificIndiaLocation

  const genericIndiaLocation = locations.find((location) => /\bindia\b/i.test(location))
  if (genericIndiaLocation) return genericIndiaLocation

  if (!isIndiaCountry(country)) return null

  const cityOnlyLocation = locations.find((location) => (
    isRecognizedIndiaLocation(location) && !isGenericIndiaLocation(location)
  ))
  return cityOnlyLocation || 'India'
}

const deriveCity = (location, country) => {
  if (!location || isGenericIndiaLocation(location)) return null
  if (/\bindia\b/i.test(location)) return normalizeWhitespace(location.split(',')[0])
  return isIndiaCountry(country) && isRecognizedIndiaLocation(location)
    ? normalizeWhitespace(location.split(',')[0])
    : null
}

const normalizeLeverHostedUrl = (value, postingId) => {
  const id = normalizeWhitespace(postingId)
  if (!id) return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'jobs.lever.co') return null
    if (url.pathname.replace(/\/+$/, '') !== `/sophos/${id}`) return null
    return `${LEVER_BOARD_URL}/${id}`
  } catch {
    return null
  }
}

const normalizeLeverApplyUrl = (value, postingId, fallback) => {
  const id = normalizeWhitespace(postingId)
  if (!value) return fallback

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'jobs.lever.co') return fallback
    const pathname = url.pathname.replace(/\/+$/, '')
    if (![ `/sophos/${id}`, `/sophos/${id}/apply` ].includes(pathname)) return fallback
    return `${LEVER_BOARD_URL}/${id}${pathname.endsWith('/apply') ? '/apply' : ''}`
  } catch {
    return fallback
  }
}

const toIsoDateTime = (value) => {
  if (value == null || normalizeWhitespace(value) == null) return null
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return null
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const toRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (normalized === 'remote') return 'Remote'
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'onsite' || normalized === 'on-site') return 'On-site'
  return null
}

const buildJobDescription = (posting) => normalizeWhitespace([
  normalizeWhitespace(posting?.descriptionPlain) || stripTags(posting?.description),
  ...(Array.isArray(posting?.lists) ? posting.lists.flatMap((list) => [
    normalizeWhitespace(list?.text),
    stripTags(list?.content),
  ]) : []),
  normalizeWhitespace(posting?.additionalPlain) || stripTags(posting?.additional),
  normalizeWhitespace(posting?.openingPlain) || stripTags(posting?.opening),
].filter(Boolean).join(' '))

export const extractIndiaJobsFromLeverPostings = (
  postings,
  { scrapedAt = new Date().toISOString() } = {},
) => {
  if (!Array.isArray(postings)) {
    throw new Error('Sophos Lever postings payload no longer exposes the expected array')
  }

  const jobsById = new Map()

  for (const posting of postings) {
    if (!isIndiaPosting(posting)) continue

    const jobId = normalizeWhitespace(posting?.id)
    if (jobsById.has(jobId)) continue

    const title = normalizeWhitespace(posting?.text)
    const locations = normalizeLocations(posting)
    const location = chooseIndiaLocation(locations, posting?.country)
    const sourceUrl = normalizeLeverHostedUrl(posting?.hostedUrl, jobId)

    if (!jobId || !title || !location || !sourceUrl) {
      throw new Error('Sophos India posting no longer exposes a verified Sophos Lever URL')
    }

    const applyUrl = normalizeLeverApplyUrl(posting?.applyUrl, jobId, sourceUrl)

    jobsById.set(jobId, {
      title,
      company: COMPANY,
      department: normalizeWhitespace(posting?.categories?.team || posting?.categories?.department),
      location,
      locations,
      city: deriveCity(location, posting?.country),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl,
      link: applyUrl,
      source: SOURCE,
      employmentType: normalizeWhitespace(posting?.categories?.commitment),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: toIsoDateTime(posting?.createdAt),
      closingDate: null,
      jobDescription: buildJobDescription(posting),
      remoteStatus: toRemoteStatus(posting?.workplaceType),
      scrapedAt,
      companyCareerPage: CAREERS_URL,
      companyDomain: SOPHOS_TECHNOLOGIES_CATALOG.companyDomain,
      atsPlatform: SOPHOS_TECHNOLOGIES_CATALOG.atsPlatform,
    })
  }

  return [...jobsById.values()]
}

export const buildLeverPageUrl = ({ skip, limit }) => (
  `${LEVER_POSTINGS_API_URL}?mode=json&limit=${limit}&skip=${skip}`
)

export const fetchAllLeverPostings = async ({
  fetchJson,
  pageSize = 100,
  maxPages = 50,
}) => {
  const postings = []
  const seenIds = new Set()
  const seenPageSignatures = new Set()

  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error('Sophos Lever pageSize must be a positive integer')
  }
  if (!Number.isInteger(maxPages) || maxPages <= 0) {
    throw new Error('Sophos Lever maxPages must be a positive integer')
  }

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const skip = pageIndex * pageSize
    const page = await fetchJson(buildLeverPageUrl({ skip, limit: pageSize }))

    if (!Array.isArray(page)) {
      throw new Error('Sophos Lever postings API expected an array page')
    }
    if (page.length > pageSize) {
      throw new Error('Sophos Lever returned more postings than the requested page size')
    }
    const pageIds = page.map((posting) => normalizeWhitespace(posting?.id))
    if (pageIds.some((id) => !id) || new Set(pageIds).size !== pageIds.length) {
      throw new Error('Sophos Lever page contains missing or duplicate posting identities')
    }
    const signature = pageIds.join('|')
    if (page.length > 0 && seenPageSignatures.has(signature)) {
      throw new Error('Sophos Lever pagination repeated a page without progress')
    }
    if (page.length > 0) seenPageSignatures.add(signature)
    const newPostings = page.filter((posting, index) => !seenIds.has(pageIds[index]))
    if (page.length > 0 && newPostings.length === 0) {
      throw new Error('Sophos Lever pagination made no unique progress')
    }
    pageIds.forEach((id) => seenIds.add(id))

    postings.push(...newPostings)
    if (page.length < pageSize) return postings
  }

  throw new Error(`Sophos Lever pagination limit reached after ${maxPages} pages`)
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    Referer: LEVER_BOARD_URL,
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createSophosTechnologiesScraper = ({
  pageSize = 100,
  maxPages = 50,
  maxJobs = null,
} = {}) => ({
  async run({ fetchJson = defaultFetchJson, now = () => new Date().toISOString() } = {}) {
    const postings = await fetchAllLeverPostings({ fetchJson, pageSize, maxPages })
    const jobs = extractIndiaJobsFromLeverPostings(postings, { scrapedAt: now() })
    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = runCurrentSophosInventory

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
