import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { runCurrentApollo } from './currentNative.js'
import {
  fetchJsonWithRetry,
  fetchTextWithRetry,
} from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://apollotyres.csod.com/ux/ats/careersite/1/home?c=apollotyres'
export const SEARCH_API_URL = 'https://uk.api.csod.com/rec-job-search/external/jobs'
export const DETAIL_API_BASE_URL = 'https://apollotyres.csod.com/services/x/job-requisition/v2/requisitions'
export const CAREER_SITE_ID = 1
export const CULTURE_ID = 1
export const CULTURE_NAME = 'en-US'
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

const unique = (values) => [...new Set(values.filter(Boolean))]

const buildHeaders = (token) => ({
  'User-Agent': USER_AGENT,
  Accept: 'application/json, text/plain, */*',
  Authorization: `Bearer ${token}`,
})

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

const buildJobUrl = (requisitionId) =>
  `https://apollotyres.csod.com/ux/ats/careersite/${CAREER_SITE_ID}/home/requisition/${requisitionId}?c=apollotyres`

export const extractContextFromHomePage = (html) => {
  const match = String(html || '').match(/csod\.context=(\{[\s\S]*?\});/)
  if (!match) {
    throw new Error('Unable to find Apollo Tyres CSOD context in career page HTML')
  }

  return JSON.parse(match[1])
}

const extractLocations = (requisition, detail) => {
  const detailLocations = [
    detail?.primaryLocation,
    ...(Array.isArray(detail?.additionalLocations) ? detail.additionalLocations : []),
  ]
  const searchLocations = Array.isArray(requisition?.locations) ? requisition.locations : []

  const selectedLocations = detailLocations.some((location) => location?.country)
    ? detailLocations
    : searchLocations

  return unique(
    selectedLocations
      .filter((location) => /india/i.test(String(location?.country || '')))
      .map((location) => normalizeWhitespace(location?.city))
      .filter(Boolean),
  )
}

const resolveJobDescription = (detail) =>
  normalizeWhitespace(detail?.externalDescription) || normalizeWhitespace(detail?.jobAd)

const mapRequisitionToJob = (requisition, detail = {}) => {
  const requisitionId = normalizeWhitespace(
    detail?.ref || requisition?.ref || requisition?.requisitionId,
  )
  const rawJobId = normalizeWhitespace(requisition?.requisitionId)
  const locations = extractLocations(requisition, detail)
  const applyUrl = buildJobUrl(rawJobId)

  return {
    title: normalizeWhitespace(detail?.displayTitle || requisition?.displayJobTitle),
    company: 'Apollo Tyres',
    department: null,
    location: locations.length > 0 ? `${locations.join(', ')}, India` : 'India',
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

export const extractSearchResults = (payload, { detailPayloadById = {} } = {}) => {
  const requisitions = Array.isArray(payload?.data?.requisitions)
    ? payload.data.requisitions
    : []

  return requisitions.map((requisition) => {
    const detail = detailPayloadById[requisition.requisitionId] || {}
    return mapRequisitionToJob(requisition, detail)
  })
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'apollo-home',
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method || 'GET',
  headers: options.headers,
  body: options.body,
  label: 'apollo-json',
})

const fetchAllRequisitions = async ({
  fetchJson,
  token,
  cultureId,
  cultureName,
  pageSize,
}) => {
  const requisitions = []
  let totalCount = null
  let pageNumber = 1

  while (totalCount == null || requisitions.length < totalCount) {
    const payload = await fetchJson(SEARCH_API_URL, {
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

export const createApolloTyresScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  pageSize = 20,
} = {}) => ({
  async run(options = {}) {
    return runCurrentApollo({ maxJobs, pageSize, ...options })
  },
})

export const run = async (options = {}) => createApolloTyresScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Apollo Tyres scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'apollo')
    console.log('DB result:', result)
    process.exit(0)
  }
}
