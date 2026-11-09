import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { IN_TIME_TEC_VISIONSOFT_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = IN_TIME_TEC_VISIONSOFT_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const INDIA_JOBS_URL = PROVIDER_METADATA.indiaJobsUrl
export const SEARCH_API_URL = PROVIDER_METADATA.searchApiUrl
export const DETAIL_API_URL = PROVIDER_METADATA.detailApiUrl
export const SEARCH_COMPANY_ID = PROVIDER_METADATA.companyApiId
export const DETAIL_COMPANY_ID = PROVIDER_METADATA.detailCompanyId
export const JOBVIEW_BASE_URL = 'https://careers.intimetec.in/intimetec/jobview'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const DEFAULT_PAGE_SIZE = 9

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/&#39;|&apos;/gi, "'")

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
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

const splitCsv = (value) => normalizeWhitespace(value)
  ?.split(',')
  .map((part) => normalizeWhitespace(part))
  .filter(Boolean) || []

const normalizeLocation = (value) => normalizeWhitespace(value)
  ?.split(';')
  .map((segment) => normalizeWhitespace(segment))
  .filter(Boolean)
  .join('; ') || null

const derivePrimaryLocation = (value) => normalizeLocation(value)?.split(';')[0]?.trim() || null

const deriveCity = (record = {}, location = null) =>
  normalizeWhitespace(record?.jobLocationRecord?.[0]?.city)
  || normalizeWhitespace(derivePrimaryLocation(location)?.split(',')[0])
  || null

const deriveState = (record = {}, location = null) =>
  normalizeWhitespace(record?.jobLocationRecord?.[0]?.state)
  || normalizeWhitespace(derivePrimaryLocation(location)?.split(',')[1])
  || null

const deriveCountry = (record = {}, location = null) =>
  normalizeWhitespace(record?.jobLocationRecord?.[0]?.country)
  || (/\bindia\b/i.test(derivePrimaryLocation(location) || '') ? 'India' : null)

const normalizeExperience = (value, minYears, maxYears) => {
  const normalized = normalizeWhitespace(value)
  if (normalized) return normalized.replace(/\s+to\s+/i, '-')

  const min = normalizeWhitespace(minYears)
  const max = normalizeWhitespace(maxYears)
  if (min && max) return `${min}-${max} years`
  if (min) return `${min}+ years`
  return null
}

const normalizeDate = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString().slice(0, 10)
  }

  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/^\d{13}$/.test(normalized)) {
    const parsed = new Date(Number.parseInt(normalized, 10))
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10)
    }
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized
  return parsed.toISOString().slice(0, 10)
}

const isIndiaJob = (record = {}) =>
  (Array.isArray(record?.jobLocationRecord) && record.jobLocationRecord.some(
    (location) => /india/i.test(normalizeWhitespace(location?.country) || ''),
  ))
  || /india/i.test(normalizeWhitespace(record?.location) || '')
  || /india/i.test(normalizeWhitespace(record?.locAgg) || '')

const isClosedOrArchived = (record = {}) => [
  record?.otherStatusOne,
  record?.otherStatusTwo,
  record?.otherStatusThree,
  record?.jobStatus,
  record?.status,
].some((value) => /(closed|archiv)/i.test(normalizeWhitespace(value) || ''))

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title\b[^>]*>\s*Careers\s*-\s*Join Our Team\s*-\s*In Time Tec\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Join us in creating')
    && normalized.includes('Careers at In Time Tec offer personal and professional development')
    && /https:\/\/careers\.intimetec\.in\/intimetec(?:\/jobslist)?\/?/i.test(rawHtml)
    && normalized.includes('India Careers')
}

export const hasOfficialIndiaJobsSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title\b[^>]*>\s*In Time Tec\s*-\s*Careers\s*<\/title>/i.test(page)
    && /<base href=["']\/intimetec\/["']/i.test(page)
    && /main\.[^"']+\.js/i.test(page)
    && /styles\.[^"']+\.css/i.test(page)
}

export const buildSearchPayload = ({ offset = 0, keywords = '' } = {}) => ({
  filterCri: JSON.stringify({
    paginationStartNo: Math.max(0, Number(offset) || 0),
    selectedCall: 'sort',
    sortCriteria: {
      name: 'modifiedDate',
      isAscending: false,
    },
    anyOfTheseWords: normalizeWhitespace(keywords) || '',
  }),
  domain: 'careers.intimetec.in',
  companyId: SEARCH_COMPANY_ID,
})

export const buildJobDetailUrl = (jobUrl) =>
  `${JOBVIEW_BASE_URL}/${normalizeWhitespace(jobUrl) || ''}`

const buildDetailRequest = (listing = {}) => ({
  jobUrl: normalizeWhitespace(listing?.sourceUrl)?.split('/').pop() || null,
  externalSource: 'CareerSite',
  campusUrl: 'empty',
  companyId: DETAIL_COMPANY_ID,
})

const toJobFromListing = (record = {}) => {
  const location = normalizeLocation(record.locAgg || record.location)
  const country = deriveCountry(record, location)
  const jobUrl = normalizeWhitespace(record.jobUrl)

  return {
    title: normalizeWhitespace(record.jobTitle),
    company: COMPANY,
    department: normalizeWhitespace(record.departmentName || record.DepartmentName),
    location,
    city: deriveCity(record, location),
    state: deriveState(record, location),
    country,
    jobId: normalizeWhitespace(record.jobCode || record.id),
    requisitionId: normalizeWhitespace(record.referenceNumber || record.refNumber || record.jobCode),
    sourceUrl: jobUrl ? buildJobDetailUrl(jobUrl) : null,
    applyUrl: jobUrl ? buildJobDetailUrl(jobUrl) : null,
    employmentType: null,
    experienceRequired: normalizeExperience(
      record.experienceUIField,
      record.minYrsOfExperience || record.minYearOfExperience,
      record.maxYrsOfExperience || record.maxYearOfExperience,
    ),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: Array.isArray(record.mandatorySkills)
      ? record.mandatorySkills.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
      : splitCsv(record.skillSet || record.jdSkillsKnown),
    postingDate: normalizeDate(
      record.modifiedDate
        || record.createDate
        || record.createdDate
        || record.jobCreatedDate,
    ),
    closingDate: normalizeDate(record.endtDate || record.endDate),
    jobDescription: stripTags(record.shortDescriptionDb || record.shortDescription),
  }
}

export const extractSearchResults = (payload = {}) => {
  if (!Array.isArray(payload?.data?.data)) {
    throw new Error('In Time Tec Visionsoft verified public zwayam search payload no longer matches the expected array contract')
  }

  return payload.data.data
    .map((item) => item?._source || item)
    .filter((record) => isIndiaJob(record))
    .filter((record) => !isClosedOrArchived(record))
    .map((record) => toJobFromListing(record))
    .filter((job) => job.title && job.jobId && job.sourceUrl && job.country === 'India')
}

export const extractPaginationSummary = (payload = {}, { currentOffset = 0 } = {}) => {
  const pageSize = Number.parseInt(
    normalizeWhitespace(payload?.data?.facetedSearchConfig?.paginationHowMuch) || '',
    10,
  )
  const normalizedPageSize = Number.isFinite(pageSize) ? pageSize : DEFAULT_PAGE_SIZE

  return {
    hasNext: Boolean(payload?.data?.hasMoreData),
    pageSize: normalizedPageSize,
    nextOffset: currentOffset + normalizedPageSize,
    totalCount: Number(payload?.data?.totalCount) || 0,
  }
}

export const extractJobDetail = (payload = {}, listing = {}) => {
  const sourceUrl = listing.sourceUrl || buildJobDetailUrl(payload?.jobUrl)
  const location = normalizeLocation(
    payload?.jobConfigurationData?.Location
      || payload?.locationDisplayForManageJobs
      || payload?.location
      || listing.location,
  )
  const primaryRecord = Array.isArray(payload?.jobLocationRecord)
    ? { jobLocationRecord: payload.jobLocationRecord }
    : listing
  const detailSkills = splitCsv(
    payload?.jobConfigurationData?.['Skills Required']
      || payload?.skillSet
      || payload?.desiredSkill,
  )

  return {
    title: normalizeWhitespace(payload?.jobTitle) || listing.title || null,
    department: normalizeWhitespace(
      payload?.jobConfigurationData?.Department
        || payload?.department?.departmentName
        || payload?.departmentName,
    ) || listing.department || null,
    location: location || listing.location || null,
    city: deriveCity(primaryRecord, location) || listing.city || null,
    state: deriveState(primaryRecord, location) || listing.state || null,
    country: deriveCountry(primaryRecord, location) || listing.country || null,
    jobId: normalizeWhitespace(payload?.jobCode) || listing.jobId || null,
    requisitionId: normalizeWhitespace(payload?.referenceNumber) || listing.requisitionId || null,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: normalizeWhitespace(payload?.employeeType || payload?.jobTypeField) || null,
    experienceRequired: normalizeExperience(
      payload?.jobConfigurationData?.['Years Of Exp'] || payload?.yrsOfExperience,
      payload?.minYrsOfExperience,
      payload?.maxYrsOfExperience,
    ) || listing.experienceRequired || null,
    minimumQualification: normalizeWhitespace(
      payload?.jobConfigurationData?.Qualifications
        || payload?.jobConfigurationData?.['Education/Qualification']
        || payload?.eduqualification,
    ),
    preferredQualification: null,
    requiredSkills: detailSkills.length > 0 ? detailSkills : listing.requiredSkills || [],
    postingDate: normalizeDate(
      payload?.jobConfigurationData?.['Posted On']
        || payload?.createDate
        || payload?.createdDate,
    ) || listing.postingDate || null,
    closingDate: normalizeDate(payload?.endtDate || payload?.endDate) || listing.closingDate || null,
    jobDescription: stripTags(
      payload?.jobConfigurationData?.Description
        || payload?.longDescription
        || payload?.shortDescription
        || listing.jobDescription,
    ),
  }
}

const sortJobs = (jobs) => [...jobs].sort((left, right) =>
  String(left.title || '').localeCompare(String(right.title || ''), 'en', { sensitivity: 'base' }))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchJson = (url, options = {}) => {
  const headers = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    ...options.headers,
  }
  const request = {
    method: options.method || 'GET',
    headers,
    label: SOURCE,
    timeoutMs: 30000,
  }

  if (options.form) {
    const form = new FormData()
    for (const [key, value] of Object.entries(options.form)) {
      form.append(key, value)
    }
    request.body = form
  } else if (options.json) {
    request.headers = {
      ...headers,
      'Content-Type': 'application/json',
    }
    request.body = JSON.stringify(options.json)
  } else if (options.body != null) {
    request.body = options.body
  }

  return fetchJsonWithRetry(url, request)
}

export const createInTimeTecVisionsoftScraper = ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now: overrideNow = now,
  } = {}) {
    const careersPageHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersPageHtml)) {
      throw new Error('In Time Tec Visionsoft careers page no longer matches the verified first-party surface')
    }

    const jobsPageHtml = await fetchText(INDIA_JOBS_URL)
    if (!hasOfficialIndiaJobsSignal(jobsPageHtml)) {
      throw new Error('In Time Tec Visionsoft India jobs board no longer matches the verified public surface')
    }

    const jobs = []
    const seenJobIds = new Set()
    let offset = 0

    for (let page = 0; page < maxPages; page += 1) {
      const listingPayload = await fetchJson(SEARCH_API_URL, {
        method: 'POST',
        form: buildSearchPayload({ offset }),
      })
      const listings = extractSearchResults(listingPayload)
      const summary = extractPaginationSummary(listingPayload, {
        currentOffset: offset,
      })

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        let detail = listing
        try {
          const detailPayload = await fetchJson(DETAIL_API_URL, {
            method: 'POST',
            json: buildDetailRequest(listing),
          })
          detail = extractJobDetail(detailPayload, listing)
        } catch {
          detail = listing
        }

        jobs.push({
          ...detail,
          company: COMPANY,
          source: SOURCE,
          link: detail.applyUrl || detail.sourceUrl,
          scrapedAt: overrideNow(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return sortJobs(jobs)
        }
      }

      if (!summary.hasNext) break
      offset = summary.nextOffset
    }

    return sortJobs(jobs)
  },
})

export const run = async (options = {}) => createInTimeTecVisionsoftScraper().run(options)

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
