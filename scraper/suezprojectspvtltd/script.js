import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'suezprojectspvtltd'
export const COMPANY = 'Suez Projects Pvt. Ltd.'
export const VERIFIED_AT = '2026-07-13'
export const INDIA_CAREERS_PAGE_URL = 'https://www.suez.com/en/india/careers'
export const CAREER_PAGE_URL =
  'https://hris-suez.csod.com/ux/ats/careersite/10/home?c=hris-suez&lang=en-GB'
export const SEARCH_API_URL = 'https://uk.api.csod.com/rec-job-search/external/jobs'
export const DETAIL_API_BASE_URL =
  'https://hris-suez.csod.com/services/x/job-requisition/v2/requisitions'
export const CAREER_SITE_ID = 10
export const CULTURE_ID = 2
export const CULTURE_NAME = 'en-GB'
export const DEFAULT_PAGE_SIZE = 20

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtml = (value) => String(value ?? '').replace(/&amp;/gi, '&')

const unique = (values) => [...new Set(values.filter(Boolean))]

const buildHeaders = (token, extraHeaders = {}) => ({
  'User-Agent': USER_AGENT,
  Accept: 'application/json, text/plain, */*',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...extraHeaders,
})

const buildJobUrl = (requisitionId) =>
  `https://hris-suez.csod.com/ux/ats/careersite/${CAREER_SITE_ID}/home/requisition/${requisitionId}?c=hris-suez&lang=en-GB`

const extractCityFromLabel = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .replace(/,\s*India$/i, '')
    .split(',')[0]
    ?.trim() || null
}

const normalizeLocationRecord = (location) => {
  if (!location) return null

  if (typeof location === 'string') {
    const label = normalizeWhitespace(location)
    return label
      ? {
          label,
          city: extractCityFromLabel(label),
          country: /\bindia\b/i.test(label) ? 'India' : null,
        }
      : null
  }

  const city = normalizeWhitespace(location.city)
  const state = normalizeWhitespace(location.state)
  const country = normalizeWhitespace(location.country)
  const label = normalizeWhitespace(
    location.label
      || location.name
      || location.displayLocation
      || [city, state, country].filter(Boolean).join(', '),
  )

  return label
    ? {
        label,
        city: city || extractCityFromLabel(label),
        country,
      }
    : null
}

const isIndiaLocation = (location) => {
  const normalized = normalizeLocationRecord(location)
  if (!normalized) return false

  return /india/i.test(normalized.country || '') || /\bindia\b/i.test(normalized.label)
}

const extractLocations = (requisition, detail) => {
  const detailLocations = [
    detail?.primaryLocation,
    ...(Array.isArray(detail?.additionalLocations) ? detail.additionalLocations : []),
    detail?.location,
  ]
  const searchLocations = [
    ...(Array.isArray(requisition?.locations) ? requisition.locations : []),
    requisition?.primaryLocation,
    requisition?.location,
    requisition?.displayLocation,
  ]

  const candidates = [...detailLocations, ...searchLocations]
    .map((location) => normalizeLocationRecord(location))
    .filter(Boolean)
    .filter((location) => isIndiaLocation(location))

  return unique(candidates.map((location) => location.city || extractCityFromLabel(location.label)))
}

const resolveJobDescription = (detail) =>
  normalizeWhitespace(detail?.externalDescription)
  || normalizeWhitespace(detail?.jobAd)
  || normalizeWhitespace(detail?.description)

const resolveSearchApiUrl = (context = {}) => {
  const cloudEndpoint = normalizeWhitespace(context?.endpoints?.cloud)

  if (!cloudEndpoint) return SEARCH_API_URL

  return new URL('rec-job-search/external/jobs', cloudEndpoint).toString()
}

const mapRequisitionToJob = (requisition, detail = {}) => {
  const locations = extractLocations(requisition, detail)

  if (locations.length === 0) {
    return null
  }

  const rawJobId = normalizeWhitespace(requisition?.requisitionId)
  const requisitionId = normalizeWhitespace(
    detail?.ref || requisition?.ref || requisition?.requisitionId,
  )
  const applyUrl = rawJobId ? buildJobUrl(rawJobId) : null

  if (!rawJobId || !applyUrl) {
    return null
  }

  return {
    title: normalizeWhitespace(detail?.displayTitle || requisition?.displayJobTitle),
    company: COMPANY,
    department: null,
    location: `${locations.join(', ')}, India`,
    city: locations[0] || null,
    country: 'India',
    jobId: rawJobId,
    requisitionId,
    sourceUrl: applyUrl,
    applyUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(requisition?.postingEffectiveDate),
    closingDate: normalizeWhitespace(requisition?.postingExpirationDate),
    jobDescription: resolveJobDescription(detail),
  }
}

export const hasOfficialIndiaCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const decodedHtml = decodeHtml(rawHtml)

  return /<title>\s*Careers\s*\|\s*SUEZ in India\s*<\/title>/i.test(rawHtml)
    && /Discover our all offers/i.test(rawHtml)
    && decodedHtml.includes(CAREER_PAGE_URL)
}

export const hasPublicCsodShell = (html) => {
  const rawHtml = String(html ?? '')

  return /<div id="cs-root"><\/div>/i.test(rawHtml)
    && /career-site/i.test(rawHtml)
    && /player-career-site/i.test(rawHtml)
    && /csod\.context/i.test(rawHtml)
}

const extractAssignedObject = (html, marker) => {
  const rawHtml = String(html ?? '')
  const markerIndex = rawHtml.indexOf(marker)

  if (markerIndex === -1) {
    return null
  }

  const equalsIndex = rawHtml.indexOf('=', markerIndex)
  if (equalsIndex === -1) {
    return null
  }

  const objectStart = rawHtml.indexOf('{', equalsIndex)
  if (objectStart === -1) {
    return null
  }

  let depth = 0
  let inString = false
  let escaping = false

  for (let index = objectStart; index < rawHtml.length; index += 1) {
    const character = rawHtml[index]

    if (inString) {
      if (escaping) {
        escaping = false
        continue
      }

      if (character === '\\') {
        escaping = true
        continue
      }

      if (character === '"') {
        inString = false
      }

      continue
    }

    if (character === '"') {
      inString = true
      continue
    }

    if (character === '{') {
      depth += 1
      continue
    }

    if (character === '}') {
      depth -= 1

      if (depth === 0) {
        return rawHtml.slice(objectStart, index + 1)
      }
    }
  }

  return null
}

const coerceObjectLiteralToJson = (value) => String(value ?? '')
  .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
  .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, content) =>
    `"${content.replace(/"/g, '\\"')}"`)
  .replace(/,\s*([}\]])/g, '$1')

export const extractContextFromHomePage = (html) => {
  const assignedObject = extractAssignedObject(html, 'csod.context')

  if (!assignedObject) {
    throw new Error('Unable to find SUEZ CSOD context in career page HTML')
  }

  try {
    return JSON.parse(assignedObject)
  } catch {
    return JSON.parse(coerceObjectLiteralToJson(assignedObject))
  }
}

export const buildSearchRequest = ({
  pageNumber = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  cultureId = CULTURE_ID,
  cultureName = CULTURE_NAME,
  searchText = '',
  states = '',
  countryCodes = '',
  cities = '',
  placeID = '',
  radius = 0,
  postingsWithinDays = 0,
  customFieldCheckboxKeys = [],
  customFieldDropdowns = [],
  customFieldRadios = [],
} = {}) => ({
  careerSiteId: CAREER_SITE_ID,
  careerSitePageId: CAREER_SITE_ID,
  pageNumber,
  pageSize,
  cultureId,
  cultureName,
  searchText,
  states,
  countryCodes,
  cities,
  placeID,
  radius,
  postingsWithinDays,
  customFieldCheckboxKeys,
  customFieldDropdowns,
  customFieldRadios,
})

export const buildDetailUrl = (requisitionId, cultureId = CULTURE_ID) =>
  `${DETAIL_API_BASE_URL}/${requisitionId}/jobDetails?cultureId=${cultureId}`

export const extractSearchResults = (payload, { detailPayloadById = {} } = {}) => {
  const requisitions = Array.isArray(payload?.data?.requisitions)
    ? payload.data.requisitions
    : []

  return requisitions
    .map((requisition) => {
      const detail = detailPayloadById[requisition?.requisitionId] || {}
      return mapRequisitionToJob(requisition, detail)
    })
    .filter(Boolean)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method || 'GET',
  headers: options.headers,
  body: options.body,
  label: SOURCE,
  timeoutMs: 15000,
})

const fetchAllRequisitions = async ({
  fetchJson,
  searchApiUrl,
  token,
  cultureId,
  cultureName,
  pageSize,
}) => {
  const requisitions = []
  let totalCount = null
  let pageNumber = 1

  while (totalCount == null || requisitions.length < totalCount) {
    const payload = await fetchJson(searchApiUrl, {
      method: 'POST',
      headers: buildHeaders(token, {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(buildSearchRequest({
        pageNumber,
        pageSize,
        cultureId,
        cultureName,
      })),
    })

    const pageResults = Array.isArray(payload?.data?.requisitions)
      ? payload.data.requisitions
      : []

    totalCount = Number(payload?.data?.totalCount || 0)
    requisitions.push(...pageResults)

    if (pageResults.length === 0) break
    pageNumber += 1
  }

  return requisitions
}

export const createSuezProjectsScraper = ({
  pageSize = DEFAULT_PAGE_SIZE,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const indiaCareersHtml = await fetchText(INDIA_CAREERS_PAGE_URL)

    if (!hasOfficialIndiaCareersSignal(indiaCareersHtml)) {
      throw new Error('SUEZ verified official India careers page no longer matches the known public handoff')
    }

    const homePageHtml = await fetchText(CAREER_PAGE_URL)

    if (!hasPublicCsodShell(homePageHtml)) {
      throw new Error('SUEZ verified public CSOD shell no longer matches the known jobs surface')
    }

    const context = extractContextFromHomePage(homePageHtml)
    const cultureId = context.cultureID || CULTURE_ID
    const cultureName = context.cultureName || CULTURE_NAME
    const searchApiUrl = resolveSearchApiUrl(context)

    const requisitions = await fetchAllRequisitions({
      fetchJson,
      searchApiUrl,
      token: context.token,
      cultureId,
      cultureName,
      pageSize,
    })

    const detailPayloadById = {}
    await Promise.all(requisitions.map(async (requisition) => {
      if (!requisition?.requisitionId) return

      const detailPayload = await fetchJson(
        buildDetailUrl(requisition.requisitionId, cultureId),
        {
          headers: buildHeaders(context.token),
        },
      )
      detailPayloadById[requisition.requisitionId] = detailPayload
    }))

    const jobs = extractSearchResults({
      data: {
        requisitions,
      },
    }, { detailPayloadById })

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createSuezProjectsScraper().run(options)

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
