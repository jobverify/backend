import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PRACTO_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PRACTO_CATALOG.source
export const COMPANY = PRACTO_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = PRACTO_CATALOG.officialBrandName
export const VERIFIED_ON = PRACTO_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PRACTO_CATALOG.verifiedSurfaceSummary
export const OFFICIAL_CAREERS_URL = PRACTO_CATALOG.companyCareerPage
export const SEARCH_API_URL = PRACTO_CATALOG.officialSearchApiUrl
export const DETAIL_API_URL = 'https://public.zwayam.com/jobs-service/v1/jobs/careersite'
export const ZWAYAM_COMPANY_ID = PRACTO_CATALOG.zwayamCompanyId
export const ZWAYAM_DETAIL_COMPANY_ID = PRACTO_CATALOG.zwayamDetailCompanyId

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const CAREERS_HOST = new URL(OFFICIAL_CAREERS_URL).hostname
const DEFAULT_PAGE_SIZE = 9
const DEFAULT_MAX_PAGES = 10
const DEFAULT_MAX_JOBS = 100

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, '-')
  .replace(/&amp;/gi, '&')

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(value)
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const splitCsv = (value) => normalizeWhitespace(value)
  ?.split(',')
  .map((part) => normalizeWhitespace(part))
  .filter(Boolean) || []

const uniqueStrings = (values = []) => [...new Set(values.map((value) => normalizeWhitespace(value)).filter(Boolean))]

const normalizeDate = (value) => {
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

const buildFormData = (form) => {
  const formData = new FormData()
  Object.entries(form).forEach(([key, value]) => {
    formData.append(key, value)
  })
  return formData
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

const defaultFetchJson = async (url, options = {}) => {
  const headers = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    ...(options.headers || {}),
  }

  let body
  if (options.form) {
    body = buildFormData(options.form)
  } else if (options.json) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.json)
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

const unwrapSearchRecord = (record = {}) => record?._source ?? record

const chooseDepartment = (...values) => {
  for (const value of values) {
    const normalized = normalizeWhitespace(value)
    if (!normalized || /^all departments$/i.test(normalized)) continue
    return normalized
  }
  return null
}

const buildExperienceRequired = (...records) => {
  for (const record of records) {
    const explicit = normalizeWhitespace(record?.experienceUIField || record?.yrsOfExperience)
    if (explicit) return explicit

    const min = Number.parseInt(
      String(record?.minYrsOfExperience ?? record?.minYearOfExperience ?? ''),
      10,
    )
    const max = Number.parseInt(
      String(record?.maxYrsOfExperience ?? record?.maxYearOfExperience ?? ''),
      10,
    )

    if (Number.isFinite(min) && Number.isFinite(max) && max > 0) {
      return `${min} - ${max} years`
    }

    if (Number.isFinite(min) && min > 0) {
      return `${min}+ years`
    }
  }

  return null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^[A-Z]$/.test(normalized)) return null
  return normalized
}

const getFormattedLocation = (record = {}) => normalizeWhitespace(
  record?.jobLocationRecord?.[0]?.formattedLocation
    || record?.jobLocationRecord?.[0]?.location
    || record?.location
    || record?.locAgg,
)

const extractCity = (record = {}) => normalizeWhitespace(
  record?.jobLocationRecord?.[0]?.city
    || record?.city
    || getFormattedLocation(record)?.split(',')?.[0],
)

export const buildSearchPayload = ({ paginationStartNo = 0, keywords = '' } = {}) => ({
  filterCri: JSON.stringify({
    paginationStartNo: Math.max(0, Number(paginationStartNo) || 0),
    selectedCall: 'sort',
    sortCriteria: {
      name: 'modifiedDate',
      isAscending: false,
    },
    anyOfTheseWords: normalizeWhitespace(keywords) || '',
  }),
  domain: CAREERS_HOST,
  companyId: ZWAYAM_COMPANY_ID,
})

export const hasVerifiedCareersShellSignals = (html) => {
  const page = String(html ?? '')
  const hasVerifiedTitle = /<title>\s*Practo \| Careers\s*<\/title>/i.test(page)
  const hasVerifiedDescription = /<meta name="description" content="Practo Careers">/i.test(page)
  const hasVerifiedBaseHref = /<base href="\/practo\/">/i.test(page)
  const hasLegacyShell = /current_openings/i.test(page)
    && /Search Jobs/i.test(page)
  const hasCurrentShell = /<app-root>/i.test(page)
    && /current_openings/i.test(page)
    && /<script[^>]+src="runtime\.[^"]+\.js"[^>]*type="module"/i.test(page)
    && /<script[^>]+src="main\.[^"]+\.js"[^>]*type="module"/i.test(page)

  return hasVerifiedTitle
    && hasVerifiedDescription
    && hasVerifiedBaseHref
    && (hasLegacyShell || hasCurrentShell)
}

export const extractSearchRecords = (payload) =>
  Array.isArray(payload?.data?.data)
    ? payload.data.data.map((record) => unwrapSearchRecord(record)).filter(Boolean)
    : []

export const isSuppressedRecord = (record = {}) =>
  normalizeWhitespace(record.otherStatusOne) === 'Hidden'
  && normalizeWhitespace(record.otherStatusTwo) === 'Closed'
  && normalizeWhitespace(record.requisitionStatus) === 'A'
  && String(record.appliesNotBlocked ?? '') === '0'

export const allSearchRecordsAreSuppressed = (payload) => {
  const records = extractSearchRecords(payload)
  return records.length > 0 && records.every((record) => isSuppressedRecord(record))
}

export const extractPaginationSummary = (payload = {}) => ({
  hasNext: Boolean(payload?.data?.hasMoreData),
  pageSize: Number.parseInt(
    normalizeWhitespace(payload?.data?.facetedSearchConfig?.paginationHowMuch) || '',
    10,
  ) || DEFAULT_PAGE_SIZE,
  totalCount: Number(payload?.data?.totalCount) || 0,
})

export const buildJobDetailUrl = (jobUrl) => {
  const normalizedJobUrl = normalizeWhitespace(jobUrl)
  if (!normalizedJobUrl) return null
  return new URL(`jobview/${encodeURIComponent(normalizedJobUrl)}`, OFFICIAL_CAREERS_URL).toString()
}

export const buildDetailRequest = (record = {}) => ({
  jobUrl: normalizeWhitespace(record?.jobUrl || record?.sourceUrl)?.split('/').pop()?.split('?')[0] || null,
  externalSource: 'CareerSite',
  campusUrl: 'empty',
  companyId: ZWAYAM_DETAIL_COMPANY_ID,
})

const buildSearchJob = (record = {}) => ({
  title: normalizeWhitespace(record?.jobTitle),
  company: COMPANY,
  department: chooseDepartment(
    record?.DepartmentName,
    record?.departmentName,
    record?.text1,
    record?.text9,
  ),
  location: getFormattedLocation(record),
  city: extractCity(record),
  country: 'India',
  jobId: normalizeWhitespace(record?.jobCode || record?.newJobCode || record?.referenceNumber),
  requisitionId: normalizeWhitespace(record?.referenceNumber || record?.refNumber),
  sourceUrl: buildJobDetailUrl(record?.jobUrl),
  applyUrl: buildJobDetailUrl(record?.jobUrl),
  employmentType: normalizeEmploymentType(record?.text4 || record?.employmentType || record?.jobType),
  experienceRequired: buildExperienceRequired(record),
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: uniqueStrings([
    ...splitCsv(record?.skillSet),
    ...splitCsv(record?.desiredSkill),
    ...(Array.isArray(record?.desiredSkillList) ? record.desiredSkillList : []),
    ...(Array.isArray(record?.skillsToEvaluateList) ? record.skillsToEvaluateList : []),
  ]),
  postingDate: normalizeDate(record?.createDate || record?.createdDate || record?.modifiedDate),
  closingDate: normalizeDate(record?.endtDate || record?.endDate),
  jobDescription: stripTags(
    record?.shortDescriptionWithoutHtml
      || record?.mediumDescriptionWithoutHtml
      || record?.shortDescription,
  ),
  _listingRecord: record,
})

export const extractSearchResults = (payload = {}) => extractSearchRecords(payload)
  .map((record) => buildSearchJob(record))
  .filter((job) => job.title && job.jobId && job.sourceUrl && /india/i.test(job.location || ''))

export const extractJobDetail = (payload = {}, listing = {}) => {
  const detailRecord = payload ?? {}
  const listingRecord = listing._listingRecord || listing
  const detailDescription = [
    stripTags(detailRecord?.longDescription),
    stripTags(detailRecord?.role),
  ].filter(Boolean).join('\n')

  return {
    title: normalizeWhitespace(detailRecord?.jobTitle) || listing.title || null,
    company: COMPANY,
    department: chooseDepartment(
      detailRecord?.department?.departmentName,
      detailRecord?.departmentName,
      listing.department,
      listingRecord?.DepartmentName,
      listingRecord?.departmentName,
    ),
    location: getFormattedLocation(detailRecord) || listing.location || null,
    city: extractCity(detailRecord) || listing.city || extractCity(listingRecord),
    country: 'India',
    jobId: normalizeWhitespace(detailRecord?.jobCode || listing.jobId || listingRecord?.jobCode),
    requisitionId: normalizeWhitespace(
      detailRecord?.referenceNumber
        || detailRecord?.refNumber
        || listing.requisitionId
        || listingRecord?.referenceNumber,
    ),
    sourceUrl: buildJobDetailUrl(detailRecord?.jobUrl || listingRecord?.jobUrl) || listing.sourceUrl || null,
    applyUrl: buildJobDetailUrl(detailRecord?.jobUrl || listingRecord?.jobUrl) || listing.applyUrl || null,
    employmentType: normalizeEmploymentType(
      detailRecord?.jobConfigurationData?.['Employment Type']
        || detailRecord?.employmentType
        || listing.employmentType,
    ),
    experienceRequired: buildExperienceRequired(detailRecord, listingRecord, listing),
    minimumQualification: normalizeWhitespace(
      detailRecord?.jobConfigurationData?.['Education/Qualification']
        || detailRecord?.eduqualification,
    ),
    preferredQualification: null,
    requiredSkills: uniqueStrings([
      ...splitCsv(detailRecord?.jobConfigurationData?.['Skills Required']),
      ...splitCsv(detailRecord?.skillSet),
      ...splitCsv(detailRecord?.desiredSkill),
      ...(Array.isArray(detailRecord?.desiredSkillList) ? detailRecord.desiredSkillList : []),
      ...(Array.isArray(detailRecord?.skillsToEvaluateList) ? detailRecord.skillsToEvaluateList : []),
    ]),
    postingDate: normalizeDate(
      detailRecord?.createdDate
        || detailRecord?.createDate
        || listing.postingDate
        || listingRecord?.createDate,
    ),
    closingDate: normalizeDate(detailRecord?.endtDate || detailRecord?.endDate || listing.closingDate),
    jobDescription: detailDescription || listing.jobDescription || null,
  }
}

export const createPractoScraper = ({
  maxPages = DEFAULT_MAX_PAGES,
  maxJobs = DEFAULT_MAX_JOBS,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL)
    if (!hasVerifiedCareersShellSignals(careersHtml)) {
      throw new Error('Practo verified careers shell no longer matches the official first-party page')
    }

    const scrapedAt = now()
    const jobs = []
    const seenJobIds = new Set()
    let paginationStartNo = 0

    for (let page = 1; page <= maxPages && jobs.length < maxJobs; page += 1) {
      const searchPayload = await fetchJson(SEARCH_API_URL, {
        method: 'POST',
        form: buildSearchPayload({ paginationStartNo }),
      })

      const listings = extractSearchResults(searchPayload)
      const summary = extractPaginationSummary(searchPayload)
      if (listings.length === 0) break

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        let job = listing
        try {
          const detailPayload = await fetchJson(DETAIL_API_URL, {
            method: 'POST',
            json: buildDetailRequest(listing._listingRecord),
          })
          job = extractJobDetail(detailPayload, listing)
        } catch {
          job = listing
        }

        jobs.push({
          ...job,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt,
        })

        if (jobs.length >= maxJobs) break
      }

      if (!summary.hasNext) break

      const pageSize = summary.pageSize > 0 ? summary.pageSize : listings.length
      paginationStartNo += pageSize

      if (summary.totalCount > 0 && paginationStartNo >= summary.totalCount) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createPractoScraper(options).run(options)

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
