import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SMARTQ_BOTTLE_LAB_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SMARTQ_BOTTLE_LAB_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_BOARD_URL = PROVIDER_METADATA.jobsBoardUrl
export const TENANT_LOOKUP_URL = PROVIDER_METADATA.tenantLookupUrl
export const TENANT_GROUP_ID = PROVIDER_METADATA.zwayamTenantGroupId
export const SEARCH_COMPANY_ID = PROVIDER_METADATA.zwayamCompanyId
export const DETAIL_COMPANY_ID = PROVIDER_METADATA.zwayamDetailCompanyId
export const SEARCH_API_URL = PROVIDER_METADATA.searchApiUrl
export const DETAIL_API_URL = PROVIDER_METADATA.detailApiUrl
export const JOBVIEW_BASE_URL = PROVIDER_METADATA.jobViewBaseUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const DEFAULT_PAGE_SIZE = 4

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|h[1-6]|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const joinDescriptionParts = (...parts) => normalizeWhitespace(
  parts
    .map((part) => stripTags(part))
    .filter(Boolean)
    .join(' '),
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

  const dayMonthYear = normalized.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/)
  if (dayMonthYear) {
    const [, day, monthAbbrev, year] = dayMonthYear
    const monthMap = {
      Jan: '01',
      Feb: '02',
      Mar: '03',
      Apr: '04',
      May: '05',
      Jun: '06',
      Jul: '07',
      Aug: '08',
      Sep: '09',
      Oct: '10',
      Nov: '11',
      Dec: '12',
    }
    const month = monthMap[monthAbbrev.slice(0, 1).toUpperCase() + monthAbbrev.slice(1, 3).toLowerCase()]
    if (month) {
      return `${year}-${month}-${day}`
    }
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized
  return parsed.toISOString().slice(0, 10)
}

const buildJobViewUrl = (jobUrl, jobViewId = null) => {
  const normalizedJobUrl = normalizeWhitespace(jobUrl)
  if (!normalizedJobUrl) return null

  const url = new URL(`${JOBVIEW_BASE_URL}/${normalizedJobUrl}`)
  const normalizedJobViewId = normalizeWhitespace(jobViewId)
  if (normalizedJobViewId) {
    url.searchParams.set('id', normalizedJobViewId)
  }
  return url.toString()
}

const extractJobSlugFromSourceUrl = (sourceUrl) => {
  try {
    const url = new URL(sourceUrl)
    return normalizeWhitespace(url.pathname.split('/').filter(Boolean).pop())
  } catch {
    return null
  }
}

const isIndiaJob = (record = {}) =>
  (Array.isArray(record?.jobLocationRecord) && record.jobLocationRecord.some(
    (location) => /india/i.test(normalizeWhitespace(location?.country) || ''),
  ))
  || /india/i.test(normalizeWhitespace(record?.location) || '')
  || /india/i.test(normalizeWhitespace(record?.locAgg) || '')

const toJobFromListing = (record = {}) => {
  const location = normalizeLocation(
    record?.locationDisplayForManageJobs
      || record?.locationSeparatedbySlash
      || record?.locAgg
      || record?.location,
  )
  const jobViewUrl = buildJobViewUrl(record?.jobUrl, record?.id)

  return {
    title: normalizeWhitespace(record?.jobTitle),
    company: COMPANY,
    department: normalizeWhitespace(record?.departmentName || record?.DepartmentName),
    location,
    city: deriveCity(record, location),
    state: deriveState(record, location),
    country: deriveCountry(record, location),
    jobId: normalizeWhitespace(record?.jobCode || record?.newJobCode || record?.id),
    requisitionId: normalizeWhitespace(record?.referenceNumber || record?.refNumber || record?.jobCode),
    sourceUrl: jobViewUrl,
    applyUrl: jobViewUrl,
    employmentType: normalizeWhitespace(
      record?.employeeType
        || record?.jobTypeField
        || record?.jobTypeFieldDisplayName
        || record?.jobType,
    ),
    experienceRequired: normalizeExperience(
      record?.experienceUIField || record?.yrsOfExperience,
      record?.minYrsOfExperience || record?.minYearOfExperience,
      record?.maxYrsOfExperience || record?.maxYearOfExperience,
    ),
    minimumQualification: normalizeWhitespace(record?.eduqualification || record?.degree),
    preferredQualification: normalizeWhitespace(record?.desiredSkill),
    requiredSkills: Array.isArray(record?.mandatorySkills)
      ? record.mandatorySkills.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
      : splitCsv(record?.skillSet || record?.jdSkillsKnown),
    postingDate: normalizeDate(
      record?.createDate
        || record?.createdDate
        || record?.modifiedDate
        || record?.jobCreatedDate,
    ),
    closingDate: normalizeDate(record?.endtDate || record?.endDate),
    jobDescription: joinDescriptionParts(
      record?.shortDescriptionDb,
      record?.shortDescription,
      record?.role,
      record?.responsibility,
    ),
  }
}

const buildFormData = (payload = {}) => {
  const form = new FormData()
  for (const [key, value] of Object.entries(payload)) {
    form.append(key, value)
  }
  return form
}

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
    request.body = buildFormData(options.form)
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

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title\b[^>]*>\s*Careers at SmartQ\s*<\/title>/i.test(page)
    && /Great food experiences start with\s+great people/i.test(normalized || '')
    && (normalized || '').includes('Explore Opportunities')
    && /Bottle Lab Technologies/i.test(page)
    && page.includes('careers.thesmartq.com')
}

export const hasVerifiedCareersShellSignal = hasOfficialCareersSignal

export const hasOfficialJobsBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title\b[^>]*>\s*Smartq\s*\|\s*Careers\s*<\/title>/i.test(page)
    && /<base href=["']\/thesmartq\/["']/i.test(page)
    && /main\.[^"']+\.js/i.test(page)
    && /<app-root>\s*<\/app-root>/i.test(page)
}

export const hasVerifiedTenantPayload = (payload = {}) =>
  payload?.responseStatus === 'SUCCESS'
  && Number(payload?.responseCode) === 200
  && normalizeWhitespace(payload?.reponseObject?.name) === 'SmartQ Bottle Lab Technologies Pvt Ltd'
  && normalizeWhitespace(payload?.reponseObject?.tenantGroupId) === TENANT_GROUP_ID

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
  domain: 'careers.thesmartq.com',
  companyId: SEARCH_COMPANY_ID,
})

export const buildDetailPayload = (listing = {}) => ({
  jobUrl: extractJobSlugFromSourceUrl(listing?.sourceUrl) || normalizeWhitespace(listing?.jobUrl),
  externalSource: 'CAREERSITE',
  campusUrl: 'empty',
  companyId: DETAIL_COMPANY_ID,
})

export const extractSearchResults = (payload = {}) => {
  if (!Array.isArray(payload?.data?.data)) {
    throw new Error('SmartQ verified public zwayam search payload no longer matches the expected array contract')
  }

  return payload.data.data
    .map((item) => item?._source || item)
    .filter((record) => isIndiaJob(record))
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
  const location = normalizeLocation(
    payload?.jobConfigurationData?.Location
      || payload?.locationDisplayForManageJobs
      || payload?.location
      || listing?.location,
  )
  const primaryRecord = Array.isArray(payload?.jobLocationRecord)
    ? { jobLocationRecord: payload.jobLocationRecord }
    : listing
  const sourceUrl = buildJobViewUrl(payload?.jobUrl, payload?.id) || listing?.sourceUrl || null
  const detailSkills = splitCsv(
    payload?.jobConfigurationData?.['Skills Required']
      || payload?.skillSet
      || payload?.tags
      || payload?.desiredSkill,
  )

  return {
    title: normalizeWhitespace(payload?.jobTitle) || listing?.title || null,
    company: COMPANY,
    department: normalizeWhitespace(
      payload?.jobConfigurationData?.Department
        || payload?.department?.departmentName
        || payload?.departmentName
        || payload?.DepartmentName,
    ) || listing?.department || null,
    location: location || listing?.location || null,
    city: deriveCity(primaryRecord, location) || listing?.city || null,
    state: deriveState(primaryRecord, location) || listing?.state || null,
    country: deriveCountry(primaryRecord, location) || listing?.country || null,
    jobId: normalizeWhitespace(payload?.jobCode || payload?.newJobCode || payload?.id) || listing?.jobId || null,
    requisitionId: normalizeWhitespace(payload?.referenceNumber || payload?.refNumber || payload?.jobCode) || listing?.requisitionId || null,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: normalizeWhitespace(
      payload?.employeeType
        || payload?.jobTypeField
        || payload?.jobTypeFieldDisplayName
        || payload?.jobType,
    ) || listing?.employmentType || null,
    experienceRequired: normalizeExperience(
      payload?.jobConfigurationData?.['Years Of Exp']
        || payload?.experienceUIField
        || payload?.yrsOfExperience,
      payload?.minYrsOfExperience || payload?.minYearOfExperience,
      payload?.maxYrsOfExperience || payload?.maxYearOfExperience,
    ) || listing?.experienceRequired || null,
    minimumQualification: normalizeWhitespace(
      payload?.jobConfigurationData?.Qualifications
        || payload?.jobConfigurationData?.['Education/Qualification']
        || payload?.eduqualification
        || payload?.degree,
    ) || listing?.minimumQualification || null,
    preferredQualification: normalizeWhitespace(payload?.desiredSkill) || listing?.preferredQualification || null,
    requiredSkills: detailSkills.length > 0 ? detailSkills : listing?.requiredSkills || [],
    postingDate: normalizeDate(
      payload?.jobConfigurationData?.['Posted On']
        || payload?.createDate
        || payload?.createdDate
        || payload?.modifiedDate,
    ) || listing?.postingDate || null,
    closingDate: normalizeDate(payload?.endtDate || payload?.endDate) || listing?.closingDate || null,
    jobDescription: joinDescriptionParts(
      payload?.jobConfigurationData?.Description,
      payload?.longDescription,
      payload?.role,
      payload?.responsibility,
      payload?.shortDescription,
      listing?.jobDescription,
    ),
  }
}

const sortJobs = (jobs) => [...jobs].sort((left, right) =>
  String(left.title || '').localeCompare(String(right.title || ''), 'en', { sensitivity: 'base' })
  || String(left.jobId || '').localeCompare(String(right.jobId || ''), 'en', { numeric: true }))

export const createSmartQBottleLabTechnologiesScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
    maxPages = Number.POSITIVE_INFINITY,
    maxJobs = null,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('SmartQ - Bottle Lab Technologies first-party careers page no longer matches the verified surface')
    }

    const jobsBoardHtml = await fetchText(JOBS_BOARD_URL)
    if (!hasOfficialJobsBoardSignal(jobsBoardHtml)) {
      throw new Error('SmartQ - Bottle Lab Technologies public jobs shell no longer matches the verified SmartQ board')
    }

    const tenantPayload = await fetchJson(TENANT_LOOKUP_URL)
    if (!hasVerifiedTenantPayload(tenantPayload)) {
      throw new Error('SmartQ - Bottle Lab Technologies verified Zwayam tenant payload no longer matches the SmartQ public tenant contract')
    }

    const jobs = []
    const seenJobIds = new Set()
    let offset = 0

    for (let page = 0; page < maxPages; page += 1) {
      const listingPayload = await fetchJson(SEARCH_API_URL, {
        method: 'POST',
        headers: {
          TenantGroupId: TENANT_GROUP_ID,
        },
        form: buildSearchPayload({ offset }),
      })
      const listings = extractSearchResults(listingPayload)
      const summary = extractPaginationSummary(listingPayload, { currentOffset: offset })

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        let detail = listing
        try {
          const detailPayload = await fetchJson(DETAIL_API_URL, {
            method: 'POST',
            headers: {
              TenantGroupId: TENANT_GROUP_ID,
            },
            json: buildDetailPayload(listing),
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
          scrapedAt: now(),
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

export const run = async (options = {}) => createSmartQBottleLabTechnologiesScraper().run(options)

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
