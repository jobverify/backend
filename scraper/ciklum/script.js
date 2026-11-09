import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { CIKLUM_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = CIKLUM_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const INDIA_CAREERS_URL = PROVIDER_METADATA.officialCareersLandingUrl
export const JOBS_URL = PROVIDER_METADATA.companyCareerPage
export const SITE_NUMBER = PROVIDER_METADATA.siteNumber
export const SELECTED_LOCATIONS_FACET = PROVIDER_METADATA.selectedLocationsFacet
export const LISTING_API_BASE_URL = PROVIDER_METADATA.listingApiBaseUrl
export const DETAIL_API_BASE_URL = PROVIDER_METADATA.detailApiBaseUrl
export const PUBLIC_JOBS_BASE_URL = PROVIDER_METADATA.publicJobsBaseUrl

const DEFAULT_LIMIT = 24

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

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
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|section|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  return parsed.toISOString().slice(0, 10)
}

const normalizeLocation = (value) => normalizeWhitespace(value)

const deriveLocation = (record = {}) =>
  normalizeLocation(
    record?.workLocation?.[0]?.LocationName
    || record?.otherWorkLocations?.[0]?.LocationName
    || record?.secondaryLocations?.[0]?.Name
    || record?.PrimaryLocation,
  )

const deriveCity = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized) return null

  return normalizeWhitespace(
    normalized
      .split(',')[0]
      .split(' - ')[0],
  )
}

const isIndiaJob = (record = {}) => {
  const primaryCountry = normalizeWhitespace(record?.PrimaryLocationCountry)?.toUpperCase()
  if (primaryCountry === 'IN') return true

  const locationCandidates = [
    record?.PrimaryLocation,
    ...(Array.isArray(record?.workLocation) ? record.workLocation.map((item) => item?.LocationName || item?.Country) : []),
    ...(Array.isArray(record?.secondaryLocations) ? record.secondaryLocations.map((item) => item?.Name) : []),
    ...(Array.isArray(record?.otherWorkLocations) ? record.otherWorkLocations.map((item) => item?.LocationName || item?.Country) : []),
  ]

  return locationCandidates.some((value) => /\bindia\b/i.test(normalizeWhitespace(value) || ''))
}

const getRequisitionList = (payload = {}) => {
  const list = Array.isArray(payload?.items)
    ? payload.items.flatMap((item) => Array.isArray(item?.requisitionList) ? item.requisitionList : [])
    : []

  if (!Array.isArray(list)) {
    throw new Error('Ciklum verified search payload no longer matches the public Oracle listing API')
  }

  return list
}

const getDetailRecord = (payload = {}) => {
  const detail = Array.isArray(payload?.items) ? payload.items[0] : null
  return detail || {}
}

const joinDescriptionParts = (...parts) => normalizeWhitespace(
  parts
    .map((part) => stripTags(part))
    .filter(Boolean)
    .join(' '),
)

const normalizeRemoteStatus = (value) => normalizeWhitespace(value)

export const hasOfficialIndiaCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*India - Jobs at Ciklum\s*<\/title>/i.test(page)
    && /Step into your next big opportunity with Ciklum/i.test(page)
    && /https:\/\/explore-jobs\.ciklum\.com\/en\/sites\/ciklum-career\/jobs\?lastSelectedFacet=LOCATIONS&amp;selectedLocationsFacet=300000000468243|https:\/\/explore-jobs\.ciklum\.com\/en\/sites\/ciklum-career\/jobs\?lastSelectedFacet=LOCATIONS&selectedLocationsFacet=300000000468243/i.test(page)
}

export const hasOfficialOracleShellSignal = (html = '') => {
  const page = String(html ?? '')

  return /<meta[^>]+property=["']og:title["'][^>]+content=["']Ciklum Careers["']/i.test(page)
    && /<base[^>]+href=["']\/en\/sites\/ciklum-career["'][^>]+data-apibaseurl=["']https:\/\/ialmme\.fa\.ocs\.oraclecloud\.com:443["'][^>]+data-sitenumber=["']CX_1001["']/i.test(page)
}

export const buildSearchUrl = ({ page = 0, limit = DEFAULT_LIMIT } = {}) => {
  const normalizedLimit = Number(limit) || DEFAULT_LIMIT
  const offset = Math.max(0, Number(page) || 0) * normalizedLimit

  return `${LISTING_API_BASE_URL}?onlyData=true&expand=requisitionList.workLocation,requisitionList.otherWorkLocations,requisitionList.secondaryLocations,flexFieldsFacet.values,requisitionList.requisitionFlexFields&finder=findReqs;siteNumber=${SITE_NUMBER},selectedLocationsFacet=${SELECTED_LOCATIONS_FACET},limit=${normalizedLimit},offset=${offset}`
}

export const buildJobDetailUrl = (jobId) =>
  `${PUBLIC_JOBS_BASE_URL}${normalizeWhitespace(jobId) || ''}`

export const buildJobDetailApiUrl = (jobId) =>
  `${DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;siteNumber=${SITE_NUMBER},Id=%22${normalizeWhitespace(jobId) || ''}%22`

export const extractSearchResults = (payload = {}) => getRequisitionList(payload)
  .filter((record) => isIndiaJob(record))
  .map((record) => {
    const jobId = normalizeWhitespace(record?.Id)
    const location = deriveLocation(record)
    const sourceUrl = buildJobDetailUrl(jobId)

    return {
      title: normalizeWhitespace(record?.Title),
      company: COMPANY,
      department: normalizeWhitespace(record?.Department || record?.JobFunction || record?.Category),
      location,
      city: deriveCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: normalizeWhitespace(record?.JobType || record?.RequisitionType || record?.WorkerType),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeDate(record?.PostedDate),
      closingDate: null,
      jobDescription: stripTags(record?.ShortDescriptionStr),
      remoteStatus: normalizeRemoteStatus(record?.WorkplaceType),
    }
  })
  .filter((job) => job.title && job.jobId && job.sourceUrl)

export const extractPaginationSummary = (payload = {}, { page = 0 } = {}) => {
  const summaryRecord = Array.isArray(payload?.items) ? payload.items[0] || {} : {}
  const pageSize = Number(summaryRecord?.Limit) || DEFAULT_LIMIT
  const totalCount = Number(summaryRecord?.TotalJobsCount) || 0
  const nextOffset = (Math.max(0, Number(page) || 0) + 1) * pageSize

  return {
    hasNext: nextOffset < totalCount,
    pageSize,
    nextOffset,
    totalCount,
  }
}

export const extractJobDetail = (payload = {}, listing = {}) => {
  const detail = getDetailRecord(payload)
  const title = normalizeWhitespace(detail?.Title)

  if (!title) {
    throw new Error('Ciklum verified detail payload no longer exposes the public job detail contract')
  }

  const location = deriveLocation(detail) || listing.location || null
  const jobId = normalizeWhitespace(detail?.Id) || listing.jobId || null
  const sourceUrl = listing.sourceUrl || buildJobDetailUrl(jobId)

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(detail?.Department || detail?.JobFunction || detail?.Category)
      || listing.department
      || null,
    location,
    city: deriveCity(location) || listing.city || null,
    country: 'India',
    jobId,
    requisitionId: jobId || listing.requisitionId || null,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: normalizeWhitespace(detail?.JobType || detail?.RequisitionType || detail?.WorkerType)
      || listing.employmentType
      || null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: Array.isArray(detail?.skills)
      ? detail.skills
        .map((item) => normalizeWhitespace(item?.Skill))
        .filter(Boolean)
      : listing.requiredSkills || [],
    postingDate: normalizeDate(detail?.PostedDate) || listing.postingDate || null,
    closingDate: null,
    jobDescription: joinDescriptionParts(
      detail?.ExternalDescriptionStr,
      detail?.ExternalResponsibilitiesStr,
      detail?.ExternalQualificationsStr,
    ) || listing.jobDescription || null,
    remoteStatus: normalizeRemoteStatus(detail?.WorkplaceType) || listing.remoteStatus || null,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    ...(options.headers || {}),
  },
  body: options.body,
  label: SOURCE,
  timeoutMs: 30000,
})

export const createCiklumScraper = ({
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const indiaCareersHtml = await fetchText(INDIA_CAREERS_URL)
    if (!hasOfficialIndiaCareersSignal(indiaCareersHtml)) {
      throw new Error('Ciklum verified India careers page no longer matches the known first-party handoff')
    }

    const oracleShellHtml = await fetchText(JOBS_URL)
    if (!hasOfficialOracleShellSignal(oracleShellHtml)) {
      throw new Error('Ciklum verified Oracle shell no longer matches the known public candidate experience surface')
    }

    const jobs = []
    const seenJobIds = new Set()

    for (let page = 0; page < maxPages; page += 1) {
      const listingPayload = await fetchJson(buildSearchUrl({ page }))
      const listings = extractSearchResults(listingPayload)
      const summary = extractPaginationSummary(listingPayload, { page })

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailPayload = await fetchJson(buildJobDetailApiUrl(listing.jobId))
        const detail = extractJobDetail(detailPayload, listing)

        jobs.push({
          ...detail,
          source: SOURCE,
          link: detail.applyUrl || detail.sourceUrl,
          scrapedAt: now(),
        })

        if (Number.isFinite(maxJobs) && jobs.length >= maxJobs) {
          return jobs
        }
      }

      if (!summary.hasNext) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createCiklumScraper(options).run(options)

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
