import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://jobs.bosch.com/en/?pages=1&country=in'
export const BOSCH_GLOBAL_SOFTWARE_TECHNOLOGIES_LEGAL_ENTITY_ID = 'Robert Bosch Engineering and Business Solutions Private Ltd.'

const JOBS_API_BASE_URL = 'https://bosch-i3-caas-api.e-spirit.cloud'
const JOBS_API_TENANT = 'bosch-i3-prod'
const JOBS_API_PROJECT = 'bosch-de'
const JOBS_API_COLLECTION = 'jobs'
const JOBS_API_KEY = '2b760fb7-49ef-4e83-b4ba-9c3a8d185e5e'
const JOB_AD_LINK_PREFIX = 'https://jobs.bosch.com/en/job/'
const DEFAULT_PAGE_SIZE = 25
const DEFAULT_DETAIL_CONCURRENCY = 6
const DEFAULT_SEARCH_TERM = ''
const DEFAULT_SORT = { releasedDate: -1 }

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
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
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toTitleCase = (value) => normalizeWhitespace(value)
  ?.split(/\s+/)
  .map((part) => (
    /^[A-Z0-9()./-]+$/.test(part)
      ? part
      : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  ))
  .join(' ') || null

const buildAggregationBaseUrl = () => (
  `${JOBS_API_BASE_URL}/${JOBS_API_TENANT}/${JOBS_API_PROJECT}.${JOBS_API_COLLECTION}.content/_aggrs/get_jobs`
)

const buildContentBaseUrl = () => (
  `${JOBS_API_BASE_URL}/${JOBS_API_TENANT}/${JOBS_API_PROJECT}.${JOBS_API_COLLECTION}.content/`
)

export const buildSearchUrl = ({
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  searchTerm = DEFAULT_SEARCH_TERM,
  legalEntityId = BOSCH_GLOBAL_SOFTWARE_TECHNOLOGIES_LEGAL_ENTITY_ID,
} = {}) => {
  const avars = encodeURIComponent(JSON.stringify({
    country: ['in'],
    legal_entity: [legalEntityId],
    search_term: searchTerm,
    sort: DEFAULT_SORT,
  }))

  return `${buildAggregationBaseUrl()}?pagesize=${pageSize}&page=${page}&avars=${avars}`
}

export const buildDetailUrl = (refNumber) => (
  `${buildContentBaseUrl()}?np&rep=pj&filter=${encodeURIComponent(JSON.stringify({ refNumber }))}`
)

const defaultFetchJson = (url, { signal } = {}) => fetchJsonWithRetry(url, {
  headers: {
    Authorization: `Bearer ${JOBS_API_KEY}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    Accept: 'application/json',
  },
  label: 'boschglobalsoftwaretechnologies',
  signal,
})

export const extractSearchResultSet = (payload) => (
  payload?._embedded?.['rh:result']?.[0] || {
    meta: [],
    data: [],
  }
)

const filterListings = (listings) => listings.filter((listing) => (
  listing?.legal_entity?.valueId === BOSCH_GLOBAL_SOFTWARE_TECHNOLOGIES_LEGAL_ENTITY_ID
  && String(listing?.location?.country || '').toLowerCase() === 'in'
))

const buildJobUrl = (listing) => (
  `${JOB_AD_LINK_PREFIX}${listing?.jobUrl || listing?.refNumber || ''}`
)

const joinUniqueTextParts = (parts) => {
  const seen = new Set()
  const ordered = []

  for (const part of parts) {
    const normalized = normalizeWhitespace(part)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    ordered.push(normalized)
  }

  return normalizeWhitespace(ordered.join(' '))
}

const formatExperienceEvidence = (experienceProfile, evidence) => {
  if (!experienceProfile || !evidence) return null

  if (experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0) {
    return 'No experience required'
  }

  if (Number.isFinite(experienceProfile.minimumYears) && Number.isFinite(experienceProfile.maximumYears)) {
    return experienceProfile.minimumYears === experienceProfile.maximumYears
      ? `${experienceProfile.minimumYears} years`
      : `${experienceProfile.minimumYears}-${experienceProfile.maximumYears} years`
  }

  if (Number.isFinite(experienceProfile.minimumYears) && experienceProfile.isOpenEnded) {
    return `${experienceProfile.minimumYears}+ years`
  }

  return normalizeWhitespace(evidence)
    ?.replace(/\s*-\s*/g, '-')
    .replace(/\s*\+\s*/g, '+')
    .replace(/\byears?\b/i, 'years') || null
}

const inferExperienceFromText = (text) => {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return null

  const experienceProfile = extractJobFilterSignals({
    description: normalized,
  })?.experienceProfile
  const evidence = normalizeWhitespace(experienceProfile?.evidence)

  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return formatExperienceEvidence(experienceProfile, evidence)
}

const buildExperienceSourceText = (detail) => {
  const sections = detail?.jobAd?.sections || {}

  return joinUniqueTextParts([
    stripTags(sections.jobDescription?.text),
    stripTags(sections.qualifications?.text),
    stripTags(sections.additionalInformation?.text),
  ])
}

const normalizeBoschExperienceBand = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const rangeMatch = normalized.match(/^(\d+)\s*(?:-|~|to)\s*(\d+)\+?(?:\s*years?)?$/i)
  if (rangeMatch) {
    return `${rangeMatch[1]}-${rangeMatch[2]} years`
  }

  const plusMatch = normalized.match(/^(\d+)\s*\+(?:\s*years?)?$/i)
  if (plusMatch) {
    return `${plusMatch[1]}+ years`
  }

  const exactMatch = normalized.match(/^(\d+)(?:\s*years?)?$/i)
  if (exactMatch) {
    return `${exactMatch[1]} years`
  }

  return null
}

const extractExperience = (detail) => {
  const additionalInformation = stripTags(
    detail?.jobAd?.sections?.additionalInformation?.text,
  )
  const match = additionalInformation?.match(/Experience\s*:\s*([^|]+)/i)
  const explicitExperience = normalizeWhitespace(match?.[1])

  return (
    normalizeBoschExperienceBand(explicitExperience)
    || normalizeBoschExperienceBand(additionalInformation)
    || explicitExperience
    || inferExperienceFromText(buildExperienceSourceText(detail))
  )
}

const buildDescription = (detail) => {
  const sections = detail?.jobAd?.sections || {}

  return joinUniqueTextParts([
    stripTags(sections.companyDescription?.text),
    stripTags(sections.jobDescription?.text),
    stripTags(sections.qualifications?.text),
    stripTags(sections.additionalInformation?.text),
  ])
}

const mapListingToJob = (listing, detail) => {
  const city = toTitleCase(listing?.location?.city || listing?.working_location?.valueLabel)
  const workLocation = normalizeWhitespace(listing?.location?.workLocation)
  const location = normalizeWhitespace(
    workLocation
      ? `${workLocation}, India`
      : city
        ? `${city}, India`
        : 'India'
  )
  const jobUrl = buildJobUrl(listing)

  return {
    title: normalizeWhitespace(listing?.name),
    company: 'Bosch Global Software Technologies',
    department: normalizeWhitespace(listing?.function?.label) || null,
    location,
    city,
    country: 'India',
    jobId: normalizeWhitespace(listing?.refNumber),
    requisitionId: normalizeWhitespace(listing?.refNumber),
    sourceUrl: jobUrl,
    applyUrl: jobUrl,
    employmentType: normalizeWhitespace(listing?.type_of_contract?.valueLabel) || null,
    experienceRequired: extractExperience(detail),
    minimumQualification: stripTags(detail?.jobAd?.sections?.qualifications?.text),
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(detail?.releasedDate || listing?.releasedDate),
    closingDate: null,
    jobDescription: buildDescription(detail),
    publicExperienceChecked: Boolean(buildExperienceSourceText(detail)),
  }
}

export const extractSearchResults = ({
  listingPayload,
  detailPayloadByRef = {},
}) => {
  const resultSet = extractSearchResultSet(listingPayload)
  const listings = filterListings(resultSet.data || [])

  return listings.map((listing) => {
    const detail = Array.isArray(detailPayloadByRef[listing.refNumber])
      ? detailPayloadByRef[listing.refNumber][0]
      : detailPayloadByRef[listing.refNumber]

    return mapListingToJob(listing, detail || {})
  })
}

const throwIfAborted = (signal) => {
  if (signal?.aborted) throw signal.reason || new Error('Bosch scrape cancelled')
}

const mapWithConcurrency = async (items, concurrency, task, signal) => {
  let nextIndex = 0
  let firstError = null
  const worker = async () => {
    while (!firstError && nextIndex < items.length) {
      try {
        throwIfAborted(signal)
      } catch (error) {
        firstError ||= error
        return
      }
      const item = items[nextIndex]
      nextIndex += 1
      try {
        await task(item)
      } catch (error) {
        firstError ||= error
        return
      }
    }
  }
  const workerCount = Math.min(items.length, concurrency)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  if (firstError) throw firstError
  throwIfAborted(signal)
}

export const createBoschGlobalSoftwareTechnologiesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  pageSize = DEFAULT_PAGE_SIZE,
  detailConcurrency = DEFAULT_DETAIL_CONCURRENCY,
} = {}) => ({
  async run(options = {}) {
    const fetchJson = options.fetchJson || defaultFetchJson
    const signal = options.signal || null
    const concurrency = Number.isInteger(detailConcurrency) && detailConcurrency > 0
      ? detailConcurrency
      : DEFAULT_DETAIL_CONCURRENCY
    const allListings = []

    for (let page = 1; ; page += 1) {
      throwIfAborted(signal)
      const listingPayload = await fetchJson(buildSearchUrl({ page, pageSize }), { signal })
      const resultSet = extractSearchResultSet(listingPayload)
      const listings = filterListings(resultSet.data || [])

      allListings.push(...listings)

      const totalCount = Number(resultSet.meta?.[0]?.count || 0)
      const reachedLimit = maxJobs && allListings.length >= maxJobs
      const reachedLastPage = listings.length < pageSize
        || (totalCount > 0 && allListings.length >= totalCount)

      if (reachedLimit || reachedLastPage) {
        break
      }
    }

    const selectedListings = maxJobs ? allListings.slice(0, maxJobs) : allListings
    const detailPayloadByRef = {}

    await mapWithConcurrency(selectedListings, concurrency, async (listing) => {
      detailPayloadByRef[listing.refNumber] = await fetchJson(
        buildDetailUrl(listing.refNumber),
        { signal },
      )
    }, signal)

    return extractSearchResults({
      listingPayload: {
        _embedded: {
          'rh:result': [
            {
              meta: [{ count: selectedListings.length }],
              data: selectedListings,
            },
          ],
        },
      },
      detailPayloadByRef,
    }).map((job) => ({
      ...job,
      source: 'boschglobalsoftwaretechnologies',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) =>
  createBoschGlobalSoftwareTechnologiesScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Bosch Global Software Technologies scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'boschglobalsoftwaretechnologies')
    console.log('DB result:', result)
    process.exit(0)
  }
}
