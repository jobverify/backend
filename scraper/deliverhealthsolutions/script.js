import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DELIVERHEALTH_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = DELIVERHEALTH_SOLUTIONS_CATALOG.source
export const COMPANY = DELIVERHEALTH_SOLUTIONS_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = DELIVERHEALTH_SOLUTIONS_CATALOG.officialBrandName
export const VERIFIED_ON = DELIVERHEALTH_SOLUTIONS_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = DELIVERHEALTH_SOLUTIONS_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = DELIVERHEALTH_SOLUTIONS_CATALOG
export const CAREERS_PAGE_URL = DELIVERHEALTH_SOLUTIONS_CATALOG.companyCareerPage
export const ADP_BOARD_URL = DELIVERHEALTH_SOLUTIONS_CATALOG.officialJobsBoardUrl

const CID = '4228bffd-fe58-4423-b90e-accba06e7569'
const CC_ID = '19000101_000001'
const LANG = 'en_US'
const LOCALE = 'en_US'
const JOBS_API_BASE_URL =
  'https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions'
const SEARCH_FILTERS_API_BASE_URL = `${JOBS_API_BASE_URL}/getSearchFilters`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HTML_ENTITY_REPLACEMENTS = [
  [/&amp;/gi, '&'],
  [/&nbsp;/gi, ' '],
  [/&#39;|&apos;/gi, '\''],
  [/&#34;|&quot;/gi, '"'],
  [/&lt;/gi, '<'],
  [/&gt;/gi, '>'],
]

const decodeHtmlEntities = (value) => {
  let decoded = String(value ?? '')

  for (const [pattern, replacement] of HTML_ENTITY_REPLACEMENTS) {
    decoded = decoded.replace(pattern, replacement)
  }

  return decoded
}

const stripTags = (value) => decodeHtmlEntities(String(value ?? '').replace(/<[^>]+>/g, ' '))

const normalizeWhitespace = (value) => {
  const normalized = stripTags(value)
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/full.?time/.test(normalized)) return 'Full-time'
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract/.test(normalized)) return 'Contract'
  return normalizeWhitespace(value)
}

const normalizeCountryToken = (value) => {
  const normalized = normalizeWhitespace(value)?.toUpperCase()
  if (!normalized) return null
  if (normalized === 'IN' || normalized === 'IND' || normalized === 'INDIA') return 'India'
  if (normalized === 'US' || normalized === 'USA' || normalized === 'UNITED STATES') {
    return 'United States'
  }
  return normalizeWhitespace(value)
}

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const hasLegacyCareersPageTitle = (page = '') => /AI Healthcare Jobs & Careers \| Join DeliverHealth/i.test(page)

const hasCurrentCareersPageTitle = (page = '') =>
  /<title[^>]*>\s*DeliverHealth\s*-\s*AI-Powered Healthcare Solutions[^<]*Clinical Documentation[^<]*Patient Engagement\s*<\/title>/i
    .test(page)

const buildCommonParams = () => {
  const params = new URLSearchParams()
  params.set('cid', CID)
  params.set('ccId', CC_ID)
  params.set('lang', LANG)
  params.set('locale', LOCALE)
  return params
}

export const buildJobsApiUrl = ({ top = 100 } = {}) => {
  const params = buildCommonParams().toString()
  return `${JOBS_API_BASE_URL}?${params}&$top=${encodeURIComponent(String(top))}`
}

export const buildSearchFiltersApiUrl = () =>
  `${SEARCH_FILTERS_API_BASE_URL}?${buildCommonParams().toString()}`

export const buildDetailApiUrl = (jobId) =>
  `${JOBS_API_BASE_URL}/${encodeURIComponent(jobId)}?${buildCommonParams().toString()}`

export const buildJobDetailUrl = (jobId) => {
  const url = new URL(ADP_BOARD_URL)
  url.searchParams.set('jobId', String(jobId))
  return url.toString()
}

const getStringField = (requisition, codeValue) => {
  const fields = Array.isArray(requisition?.customFieldGroup?.stringFields)
    ? requisition.customFieldGroup.stringFields
    : []

  for (const field of fields) {
    if (field?.nameCode?.codeValue === codeValue) {
      return normalizeWhitespace(field.stringValue)
    }
  }

  return null
}

const extractLocationParts = (requisition = {}) => {
  const locationEntry = Array.isArray(requisition.requisitionLocations)
    ? requisition.requisitionLocations[0]
    : null
  const locationText = normalizeWhitespace(locationEntry?.nameCode?.shortName)
  const address = locationEntry?.address || {}
  const parts = locationText ? locationText.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean) : []
  const city = normalizeWhitespace(address.cityName) || parts[0] || null
  const state = normalizeWhitespace(address?.countrySubdivisionLevel1?.codeValue)
    || (parts.length >= 3 ? parts[1] : null)
  let country = normalizeCountryToken(parts.length > 0 ? parts[parts.length - 1] : null)

  if (!country && /india/i.test(locationText || '')) {
    country = 'India'
  }

  return {
    city,
    state,
    country,
  }
}

const extractExperienceRequired = (description) => {
  const normalized = normalizeWhitespace(description)
  if (!normalized) return null

  const match = normalized.match(/(\d+\+?(?:\s*-\s*\d+\+?)?\s+years?)/i)
  return match ? normalizeWhitespace(match[1]) : null
}

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const directAdpBoardUrl = extractOfficialAdpBoardUrl(page)
  const hasLegacyBundleSignal = hasLegacyCareersPageTitle(page)
    && /<script type="module" crossorigin src="\/assets\/index-[^"]+\.js"/i.test(page)
    && /https:\/\/ai\.deliverhealth\.com\/careers/i.test(page)
  const hasCurrentDirectHandoffSignal =
    (hasLegacyCareersPageTitle(page) || hasCurrentCareersPageTitle(page))
    && normalized.includes('Improve Patient Care. Reduce Burdens.')
    && /great people to join our growing team/i.test(normalized)
    && normalized.includes('Open Positions')
    && normalized.includes('Browse Open Roles')
    && sameUrl(directAdpBoardUrl, ADP_BOARD_URL)

  return hasLegacyBundleSignal || hasCurrentDirectHandoffSignal
}

export const extractClientBundleUrl = (html) => {
  const match = String(html ?? '').match(
    /<script type="module" crossorigin src="((?:[^"]+)?\/assets\/index-[^"]+\.js)"/i,
  )
  if (!match) return null

  try {
    return new URL(match[1], CAREERS_PAGE_URL).toString()
  } catch {
    return null
  }
}

export const extractOfficialAdpBoardUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    try {
      const candidateUrl = new URL(decodeHtmlEntities(match[1]), CAREERS_PAGE_URL).toString()
      if (/workforcenow\.adp\.com\/mascsr\/default\/mdf\/recruitment\/recruitment\.html/i.test(candidateUrl)) {
        return candidateUrl
      }
    } catch {
      continue
    }
  }

  return null
}

export const hasOfficialAdpHandoffSignal = (bundleText) => {
  const text = String(bundleText ?? '')

  return text.includes(ADP_BOARD_URL)
    && text.includes('Browse Open Roles')
    && text.includes('Open Positions')
}

export const hasOfficialAdpBoardSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Recruitment\s*<\/title>/i.test(page)
    && /\bid=["']recruitment_root["']/i.test(page)
    && (
      /applicationName:\s*['"]recruitment['"]/i.test(page)
      || /applicationName\s*=\s*['"]recruitment['"]/i.test(page)
    )
  }

const normalizeJobSummary = (requisition = {}) => {
  const title = normalizeWhitespace(requisition.requisitionTitle)
  const jobId = getStringField(requisition, 'ExternalJobID')
  const requisitionId = normalizeWhitespace(requisition.clientRequisitionID) || jobId
  const { city, state, country } = extractLocationParts(requisition)
  const location = [city, state, country].filter(Boolean).join(', ') || null
  const sourceUrl = jobId ? buildJobDetailUrl(jobId) : null

  if (!title || !jobId || !country || !location || !sourceUrl) return null

  return {
    title,
    company: COMPANY,
    department: getStringField(requisition, 'HomeDepartment'),
    location,
    city,
    state,
    country,
    jobId,
    requisitionId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: normalizeEmploymentType(requisition?.workLevelCode?.shortName),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(requisition.postDate),
    closingDate: null,
    jobDescription: null,
  }
}

export const extractIndiaJobSummaries = (payload = {}) => (Array.isArray(payload?.jobRequisitions)
  ? payload.jobRequisitions
  : [])
  .map(normalizeJobSummary)
  .filter((job) => job?.country === 'India')

const enrichJobWithDetail = (job, detailPayload = {}) => {
  const jobDescription = normalizeWhitespace(detailPayload?.requisitionDescription)

  return {
    ...job,
    experienceRequired: job.experienceRequired || extractExperienceRequired(jobDescription),
    jobDescription: jobDescription || job.jobDescription,
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const isVerifiedDeliverHealthUnavailableSurface = (error) =>
  /fetch failed|timed out|timeout|connect timeout|und_err_connect_timeout|could not connect|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

export const createDeliverHealthSolutionsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    let careersPageHtml = null
    let verifiedAdpBoardUrl = ADP_BOARD_URL

    try {
      careersPageHtml = await fetchText(CAREERS_PAGE_URL)
    } catch (error) {
      if (!isVerifiedDeliverHealthUnavailableSurface(error)) {
        throw error
      }
    }

    if (careersPageHtml) {
      if (!hasOfficialCareersPageSignal(careersPageHtml)) {
        throw new Error('Response is not the verified official DeliverHealth careers page')
      }

      verifiedAdpBoardUrl = extractOfficialAdpBoardUrl(careersPageHtml)
      if (verifiedAdpBoardUrl) {
        if (!sameUrl(verifiedAdpBoardUrl, ADP_BOARD_URL)) {
          throw new Error('DeliverHealth careers page no longer points to the verified public ADP board')
        }
      } else {
        const bundleUrl = extractClientBundleUrl(careersPageHtml)
        if (!bundleUrl) {
          throw new Error('DeliverHealth careers page no longer exposes the verified ADP handoff')
        }

        const bundleText = await fetchText(bundleUrl)
        if (!hasOfficialAdpHandoffSignal(bundleText)) {
          throw new Error('DeliverHealth careers bundle no longer points to the verified public ADP board')
        }

        verifiedAdpBoardUrl = ADP_BOARD_URL
      }
    }

    const adpBoardHtml = await fetchText(verifiedAdpBoardUrl)
    if (!hasOfficialAdpBoardSignal(adpBoardHtml)) {
      throw new Error('Response is not the verified public DeliverHealth ADP board')
    }

    const searchFiltersPayload = await fetchJson(buildSearchFiltersApiUrl())
    if (!Array.isArray(searchFiltersPayload?.data)) {
      throw new Error('DeliverHealth search filters API no longer returns the verified payload shape')
    }

    const requisitionsPayload = await fetchJson(buildJobsApiUrl())
    if (!Array.isArray(requisitionsPayload?.jobRequisitions)) {
      throw new Error('DeliverHealth job requisitions API no longer returns the verified payload shape')
    }

    const summaries = extractIndiaJobSummaries(requisitionsPayload)
    const jobs = []

    for (const summary of summaries) {
      const detailPayload = await fetchJson(buildDetailApiUrl(summary.jobId))
      jobs.push(enrichJobWithDetail(summary, detailPayload))
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createDeliverHealthSolutionsScraper(options).run(options)

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
