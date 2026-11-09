import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  fetchJsonWithRetry,
  fetchTextWithRetry,
} from '../../scraper-support/utils/fetch.js'

import CORNERSTONE_ONDEMAND_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = CORNERSTONE_ONDEMAND_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREER_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const OFFICIAL_JOBS_BOARD_URL = PROVIDER_METADATA.officialJobsBoardUrl
export const DETAIL_API_BASE_URL = 'https://cornerstone.csod.com/services/x/job-requisition/v2/requisitions'
export const CAREER_SITE_ID = 2
export const CULTURE_ID = 1
export const CULTURE_NAME = 'en-US'
export const DEFAULT_POSTINGS_WITHIN_DAYS = 3650

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_CITY_PATTERN =
  /\b(bangalore|bengaluru|chennai|coimbatore|delhi|gurgaon|gurugram|hyderabad|kolkata|mumbai|noida|pune|remote\s*-\s*india)\b/i

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

const unique = (values) => [...new Set(values.filter(Boolean))]

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return /<title>\s*Careers at Cornerstone\s*\|\s*Grow Your Future with Us\s*<\/title>/i.test(page)
    && text.includes('Careers View open job opportunities.')
    && text.includes('Search Open Positions')
    && page.includes(OFFICIAL_JOBS_BOARD_URL)
}

const buildHeaders = (token) => ({
  'User-Agent': USER_AGENT,
  Accept: 'application/json, text/plain, */*',
  Authorization: `Bearer ${token}`,
})

const unwrapDetailPayload = (detail = {}) =>
  detail?.data && typeof detail.data === 'object'
    ? detail.data
    : detail

const isIndiaLocation = (location = {}) => {
  const rawValue = normalizeWhitespace([
    location?.city,
    location?.state,
    location?.country,
    location?.location,
    location?.displayLocation,
  ].filter(Boolean).join(', '))

  return /india/i.test(rawValue || '') || INDIA_CITY_PATTERN.test(rawValue || '')
}

const extractLocationCity = (location = {}) =>
  normalizeWhitespace(
    location?.city
    || location?.location
    || location?.displayLocation
    || location?.placeName,
  )

const extractLocations = (requisition, detail) => {
  const normalizedDetail = unwrapDetailPayload(detail)
  const detailLocations = [
    normalizedDetail?.primaryLocation,
    ...(Array.isArray(normalizedDetail?.additionalLocations) ? normalizedDetail.additionalLocations : []),
  ].filter(Boolean)
  const searchLocations = Array.isArray(requisition?.locations) ? requisition.locations : []
  const selectedLocations = detailLocations.length > 0 ? detailLocations : searchLocations

  return unique(
    selectedLocations
      .filter(isIndiaLocation)
      .map(extractLocationCity)
      .filter(Boolean),
  )
}

const resolveJobDescription = (detail) =>
  normalizeWhitespace(unwrapDetailPayload(detail)?.externalDescription)
  || normalizeWhitespace(unwrapDetailPayload(detail)?.jobAd)
  || null

export const buildSearchRequest = ({
  pageNumber = 1,
  pageSize = 20,
  cultureId = CULTURE_ID,
  cultureName = CULTURE_NAME,
  searchText = '',
  states = '',
  countryCodes = '',
  cities = '',
  placeID = '',
  radius = 0,
  postingsWithinDays = DEFAULT_POSTINGS_WITHIN_DAYS,
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

const buildJobUrl = (requisitionId) =>
  `https://cornerstone.csod.com/ux/ats/careersite/${CAREER_SITE_ID}/home/requisition/${requisitionId}?c=cornerstone`

export const extractContextFromHomePage = (html) => {
  const match = String(html || '').match(/csod\.context=(\{[\s\S]*?\});/)
  if (!match) {
    throw new Error('Unable to find Cornerstone OnDemand CSOD context in career page HTML')
  }

  return JSON.parse(match[1])
}

const buildSearchApiUrl = (context) =>
  new URL('rec-job-search/external/jobs', context?.endpoints?.cloud || 'https://us-galaxy.api.csod.com/').toString()

const mapRequisitionToJob = (requisition, detail = {}) => {
  const normalizedDetail = unwrapDetailPayload(detail)
  const jobId = normalizeWhitespace(requisition?.requisitionId)
  const requisitionId = normalizeWhitespace(normalizedDetail?.ref || requisition?.ref || requisition?.requisitionId)
  const locations = extractLocations(requisition, detail)
  const applyUrl = buildJobUrl(jobId)

  if (locations.length === 0) return null

  return {
    title: normalizeWhitespace(normalizedDetail?.displayTitle || requisition?.displayJobTitle),
    company: COMPANY,
    department: null,
    location: `${locations.join(', ')}, India`,
    city: locations[0] || null,
    country: 'India',
    jobId,
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

export const extractSearchResults = (payload, { detailPayloadById = {} } = {}) => {
  const requisitions = Array.isArray(payload?.data?.requisitions)
    ? payload.data.requisitions
    : []

  return requisitions
    .map((requisition) => mapRequisitionToJob(
      requisition,
      detailPayloadById[requisition.requisitionId] || {},
    ))
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
      headers: {
        ...buildHeaders(token),
        'Content-Type': 'application/json',
      },
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

export const createCornerstoneOnDemandScraper = ({
  maxJobs = null,
  pageSize = 20,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const fetchJson = options.fetchJson || defaultFetchJson
    const now = options.now || (() => new Date().toISOString())

    const homePageHtml = await fetchText(CAREER_PAGE_URL)
    if (!hasOfficialCareersSignal(homePageHtml)) {
      throw new Error('Cornerstone OnDemand careers page no longer matches the verified first-party handoff surface')
    }

    let context
    try {
      context = extractContextFromHomePage(homePageHtml)
    } catch {
      const jobsBoardHtml = await fetchText(OFFICIAL_JOBS_BOARD_URL)
      context = extractContextFromHomePage(jobsBoardHtml)
    }

    const searchApiUrl = buildSearchApiUrl(context)
    const requisitions = await fetchAllRequisitions({
      fetchJson,
      searchApiUrl,
      token: context.token,
      cultureId: context.cultureID || CULTURE_ID,
      cultureName: context.cultureName || CULTURE_NAME,
      pageSize,
    })

    const detailPayloadById = {}
    await Promise.all(requisitions.map(async (requisition) => {
      if (!requisition?.requisitionId) return

      detailPayloadById[requisition.requisitionId] = await fetchJson(
        buildDetailUrl(requisition.requisitionId, context.cultureID || CULTURE_ID),
        {
          headers: buildHeaders(context.token),
        },
      )
    }))

    const jobs = extractSearchResults({
      data: {
        requisitions,
      },
    }, { detailPayloadById })

    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createCornerstoneOnDemandScraper().run(options)

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
