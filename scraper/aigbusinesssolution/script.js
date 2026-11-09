import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { AIG_BUSINESS_SOLUTION_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.homepageUrl
export const OPENINGS_URL = PROVIDER_METADATA.companyCareerPage
export const CANDIDATE_EXPERIENCE_URL = PROVIDER_METADATA.oracleCandidateExperienceUrl
export const WORKSPACE_DOMAIN = PROVIDER_METADATA.workspaceDomain
export const LISTING_API_BASE_URL = PROVIDER_METADATA.listingApiBaseUrl
export const PUBLIC_JOBS_BASE_URL = PROVIDER_METADATA.publicJobsBaseUrl
export const SITE_NUMBER = PROVIDER_METADATA.siteNumber
export const DEFAULT_LOCATION = PROVIDER_METADATA.countryFilter
export const DEFAULT_LIMIT = 24

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|section|article|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|hr)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^india$/i.test(normalized)) return DEFAULT_LOCATION
  return normalized
}

const extractCity = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized || /^india$/i.test(normalized)) return null
  return normalized.split(',')[0]?.trim() || null
}

const joinDescriptionParts = (...parts) => normalizeWhitespace(
  parts
    .map((part) => stripTags(part))
    .filter(Boolean)
    .join(' '),
)

const getRequisitionList = (payload = {}) => {
  if (Array.isArray(payload?.items)) {
    return payload.items.flatMap((item) => Array.isArray(item?.requisitionList) ? item.requisitionList : [])
  }

  if (Array.isArray(payload?.requisitionList)) {
    return payload.requisitionList
  }

  return []
}

const getEmploymentType = (record = {}) => normalizeWhitespace(
  record.JobSchedule
    || record.RequisitionType
    || record.JobType
    || record.WorkerType
    || record.ContractType,
)

const getEffectiveLocation = (record = {}) => normalizeLocation(
  record.PrimaryLocation
    || record?.secondaryLocations?.[0]?.Name,
)

const isIndiaJob = (record = {}) => {
  const country = normalizeWhitespace(record.PrimaryLocationCountry)?.toUpperCase()
  const primaryLocation = normalizeWhitespace(record.PrimaryLocation)
  const secondaryLocations = Array.isArray(record?.secondaryLocations)
    ? record.secondaryLocations
      .map((location) => normalizeWhitespace(location?.Name))
      .filter(Boolean)
    : []

  return (
    country === 'IN'
    || /(?:^|,)\s*india\s*$/i.test(primaryLocation || '')
    || secondaryLocations.some((location) => /(?:^|,)\s*india\s*$/i.test(location))
    || false
  )
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  attempts: /aighealthcare\.in/i.test(url) ? 1 : 3,
  timeoutMs: /aighealthcare\.in/i.test(url) ? 5000 : 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const hasOfficialCareersShellSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Careers\s*\|\s*AIG Healthcare\s*<\/title>/i.test(page)
    && normalized.includes('Join Our Dynamic Team')
    && normalized.includes('Current Job Openings')
    && [...page.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)]
      .some((match) => new URL(match[1], CAREERS_URL).toString() === OPENINGS_URL)
}

export const extractOracleCandidateExperienceUrl = (html = '') =>
  String(html ?? '').match(
    /https:\/\/eiyi\.fa\.ap1\.oraclecloud\.com\/hcmUI\/CandidateExperience\/en\/sites\/CX_3001\/?/i,
  )?.[0]?.replace(/\/$/, '') || null

export const hasOfficialOpeningsSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Openings\s*\|\s*AIG Healthcare\s*<\/title>/i.test(page)
    && normalized.includes('Join the rightful revolution, Join AIG Healthcare')
    && normalized.includes('Welcome to IKS Health')
    && extractOracleCandidateExperienceUrl(page) === CANDIDATE_EXPERIENCE_URL
}

export const hasOfficialCandidateExperienceSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*IKS Health - External Career Site\s*<\/title>/i.test(page)
    && /<base[^>]+href=["']\/hcmUI\/CandidateExperience\/en\/sites\/CX_3001\/?["'][^>]+data-apibaseurl=["']https:\/\/eiyi\.fa\.ap1\.oraclecloud\.com:443["'][^>]+data-sitenumber=["']CX_3001["']/i.test(page)
}

export const buildSearchUrl = ({
  page = 0,
  limit = DEFAULT_LIMIT,
  location = DEFAULT_LOCATION,
} = {}) => {
  const normalizedLimit = Number(limit) || DEFAULT_LIMIT
  const offset = Math.max(0, Number(page) || 0) * normalizedLimit

  return `${LISTING_API_BASE_URL}?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${SITE_NUMBER},limit=${normalizedLimit},offset=${offset},location=${location}`
}

export const buildJobDetailUrl = (jobId) =>
  `${PUBLIC_JOBS_BASE_URL}${normalizeWhitespace(jobId) || ''}`

export const extractSearchResults = (payload = {}) => getRequisitionList(payload)
  .filter((record) => isIndiaJob(record))
  .map((record) => {
    const jobId = normalizeWhitespace(record.Id)
    const location = getEffectiveLocation(record)
    const sourceUrl = jobId ? buildJobDetailUrl(jobId) : null

    return {
      title: normalizeWhitespace(record.Title),
      company: COMPANY_NAME,
      department: normalizeWhitespace(record.Organization || record.Department || record.JobFunction || record.JobFamily),
      location,
      city: extractCity(location),
      country: DEFAULT_LOCATION,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: getEmploymentType(record),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeDate(record.ExternalPostedStartDate || record.PostedDate),
      closingDate: normalizeDate(record.ExternalPostedEndDate || record.PostingEndDate),
      jobDescription: joinDescriptionParts(record.ShortDescriptionStr, record.ExternalDescriptionStr),
      remoteStatus: normalizeWhitespace(record.WorkplaceType) || null,
      siteNumber: SITE_NUMBER,
    }
  })
  .filter((job) => job.title && job.jobId && job.sourceUrl)

export const extractPaginationSummary = (payload = {}, { page = 0 } = {}) => {
  const listingSummary = payload?.items?.[0] || {}
  const pageSize = Number(listingSummary.Limit) || DEFAULT_LIMIT
  const totalCount = Number(listingSummary.TotalJobsCount) || 0
  const nextOffset = (Math.max(0, Number(page) || 0) + 1) * pageSize

  return {
    hasNext: nextOffset < totalCount,
    pageSize,
    nextOffset,
    totalCount,
  }
}

const isTimeoutError = (error) =>
  /connect timeout|timed out|timeout/i.test(String(error?.message || ''))
  || error?.code === 'UND_ERR_CONNECT_TIMEOUT'

const isUnavailableLegacyMarketingPageError = (error) =>
  isTimeoutError(error)
  || /certificate's altnames|ERR_TLS_CERT_ALTNAME_INVALID/i.test(String(error?.message || ''))

const validateFirstPartyPage = async ({
  fetchText,
  url,
  validator,
  driftErrorMessage,
}) => {
  try {
    const html = await fetchText(url)
    if (!validator(html)) {
      throw new Error(driftErrorMessage)
    }
    return html
  } catch (error) {
    if (isUnavailableLegacyMarketingPageError(error)) {
      return null
    }
    throw error
  }
}

export const createAigBusinessSolutionScraper = ({
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText: fetchTextOverride = fetchText,
    fetchJson: fetchJsonOverride = fetchJson,
  } = {}) {
    await validateFirstPartyPage({
      fetchText: fetchTextOverride,
      url: CAREERS_URL,
      validator: hasOfficialCareersShellSignal,
      driftErrorMessage: 'AIG Business Solution verified careers shell no longer matches the pinned first-party surface',
    })

    await validateFirstPartyPage({
      fetchText: fetchTextOverride,
      url: OPENINGS_URL,
      validator: hasOfficialOpeningsSignal,
      driftErrorMessage: 'AIG Business Solution verified openings page no longer matches the pinned first-party surface',
    })

    const candidateExperienceHtml = await fetchTextOverride(CANDIDATE_EXPERIENCE_URL)
    if (!hasOfficialCandidateExperienceSignal(candidateExperienceHtml)) {
      throw new Error('AIG Business Solution verified Oracle candidate experience shell changed materially')
    }

    const jobs = []
    const seenJobIds = new Set()

    for (let page = 0; page < maxPages; page += 1) {
      const payload = await fetchJsonOverride(buildSearchUrl({ page }))
      const pageJobs = extractSearchResults(payload)
      const summary = extractPaginationSummary(payload, { page })

      for (const listing of pageJobs) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        jobs.push({
          ...listing,
          source: SOURCE,
          link: listing.applyUrl || listing.sourceUrl,
          scrapedAt: now(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      if (!summary.hasNext) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createAigBusinessSolutionScraper(options).run()

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
