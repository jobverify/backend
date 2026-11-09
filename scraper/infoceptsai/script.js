import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const OFFICIAL_CAREERS_URL = 'https://www.infocepts.ai/careers/'
export const TALENT_PORTAL_URL = 'https://infotalent.infocepts.com/infocepts/'
export const CAREERS_BASE_URL = 'https://infotalent.infocepts.com/infocepts'
export const LISTING_API_URL = 'https://public.zwayam.com/jobs/search'
export const DETAIL_API_URL = 'https://public.zwayam.com/jobs-service/v1/jobs/careersite'
export const TENANT_GROUP_ID = 'G1'

const COMPANY_NAME = 'Infocepts.AI'
const SOURCE = 'infoceptsai'
const DOMAIN = 'infotalent.infocepts.com'
const COMPANY_ID = 'MTUzNDI='
const DETAIL_COMPANY_ID = '15342'
const DEFAULT_PAGE_SIZE = 15
const DEFAULT_MAX_PAGES = 10
const DEFAULT_MAX_JOBS = 150

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
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const splitCsv = (value) => normalizeWhitespace(value)
  ?.split(',')
  .map((part) => normalizeWhitespace(part))
  .filter(Boolean) || []

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/^\d{13}$/.test(normalized)) {
    const parsed = new Date(Number.parseInt(normalized, 10))
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10)
    }
  }

  const dashMonth = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(normalized)
  if (dashMonth) {
    const [, day, monthName, year] = dashMonth
    const monthMap = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      may: '05',
      jun: '06',
      jul: '07',
      aug: '08',
      sep: '09',
      oct: '10',
      nov: '11',
      dec: '12',
    }
    const month = monthMap[monthName.toLowerCase()]
    if (month) return `${year}-${month}-${day.padStart(2, '0')}`
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  return parsed.toISOString().slice(0, 10)
}

const unwrapSearchRecord = (record = {}) => record?._source ?? record

const extractCity = (record = {}) => normalizeWhitespace(
  record?.jobLocationRecord?.[0]?.city
    || record?.city
    || record?.location?.split?.(',')?.[0],
)

export const isIndiaJob = (record = {}) =>
  (Array.isArray(record?.jobLocationRecord) && record.jobLocationRecord.some(
    (location) => /india/i.test(normalizeWhitespace(location?.country) || ''),
  ))
  || /india/i.test(normalizeWhitespace(record?.location) || '')
  || /india/i.test(normalizeWhitespace(record?.locAgg) || '')

export const buildSearchPayload = ({ page = 1, keywords = '' } = {}) => ({
  filterCri: JSON.stringify({
    paginationStartNo: (Math.max(1, Number(page) || 1) - 1) * DEFAULT_PAGE_SIZE,
    selectedCall: 'sort',
    sortCriteria: {
      name: 'modifiedDate',
      isAscending: false,
    },
    anyOfTheseWords: normalizeWhitespace(keywords) || '',
  }),
  domain: DOMAIN,
  companyId: COMPANY_ID,
})

export const buildJobDetailUrl = (jobUrl, jobCode) => {
  const normalizedJobUrl = normalizeWhitespace(jobUrl)
  const normalizedJobCode = normalizeWhitespace(jobCode)
  if (!normalizedJobUrl) return null

  const detailUrl = `${CAREERS_BASE_URL}/jobview/${encodeURIComponent(normalizedJobUrl)}`
  return normalizedJobCode ? `${detailUrl}?id=${encodeURIComponent(normalizedJobCode)}` : detailUrl
}

export const buildDetailRequest = (listing = {}) => ({
  jobUrl: normalizeWhitespace(listing?.jobUrl || listing?.sourceUrl)?.split('/').pop()?.split('?')[0] || null,
  externalSource: 'CareerSite',
  campusUrl: 'empty',
  companyId: DETAIL_COMPANY_ID,
})

export const extractSearchResults = (payload = {}) => (payload?.data?.data || [])
  .map(unwrapSearchRecord)
  .filter((record) => isIndiaJob(record))
  .map((record) => {
    const location = normalizeWhitespace(record.location || record.locAgg)
    const jobCode = normalizeWhitespace(record.jobCode)
    return {
      title: normalizeWhitespace(record.jobTitle),
      company: COMPANY_NAME,
      department: normalizeWhitespace(record.departmentName || record.DepartmentName),
      location,
      city: extractCity(record),
      jobId: jobCode,
      requisitionId: normalizeWhitespace(record.referenceNumber || record.refNumber),
      sourceUrl: buildJobDetailUrl(record.jobUrl, jobCode),
      applyUrl: buildJobDetailUrl(record.jobUrl, jobCode),
      employmentType: null,
      experienceRequired: normalizeWhitespace(record.experienceUIField || record.yrsOfExperience),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: Array.isArray(record.mandatorySkills)
        ? record.mandatorySkills.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
        : splitCsv(record.skillSet || record.skillsToEvaluate),
      postingDate: normalizeDate(record.createDate || record.createdDate),
      closingDate: normalizeDate(record.endtDate || record.endDate),
      jobDescription: stripTags(record.shortDescription),
      _listingRecord: record,
    }
  })
  .filter((job) => job.title && job.jobId && job.sourceUrl)

export const extractPaginationSummary = (payload = {}) => ({
  hasNext: Boolean(payload?.data?.hasMoreData),
  pageSize: Number.parseInt(
    normalizeWhitespace(payload?.data?.facetedSearchConfig?.paginationHowMuch) || '',
    10,
  ) || DEFAULT_PAGE_SIZE,
  totalCount: Number(payload?.data?.totalCount) || 0,
})

export const extractJobDetail = (payload = {}, listing = {}) => {
  const location = normalizeWhitespace(payload?.location || payload?.locationDisplayForManageJobs || listing.location)
  const jobCode = normalizeWhitespace(payload?.jobCode || listing.jobId)

  return {
    title: normalizeWhitespace(payload?.jobTitle) || listing.title || null,
    company: COMPANY_NAME,
    department: normalizeWhitespace(
      payload?.department?.departmentName
        || payload?.departmentName
        || listing.department,
    ),
    location: location || listing.location || null,
    city: extractCity(payload) || listing.city || null,
    jobId: jobCode,
    requisitionId: normalizeWhitespace(payload?.referenceNumber || payload?.refNumber) || listing.requisitionId || null,
    sourceUrl: buildJobDetailUrl(payload?.jobUrl || listing._listingRecord?.jobUrl, jobCode) || listing.sourceUrl || null,
    applyUrl: buildJobDetailUrl(payload?.jobUrl || listing._listingRecord?.jobUrl, jobCode) || listing.applyUrl || null,
    employmentType: normalizeWhitespace(payload?.jobConfigurationData?.['Type of Employment']),
    experienceRequired: normalizeWhitespace(
      payload?.jobConfigurationData?.['Years Of Exp']
        || payload?.yrsOfExperience
        || listing.experienceRequired,
    ),
    minimumQualification: normalizeWhitespace(
      payload?.jobConfigurationData?.['Education/Qualification']
        || payload?.eduqualification,
    ),
    preferredQualification: null,
    requiredSkills: splitCsv(
      payload?.jobConfigurationData?.['Skills Required']
        || payload?.skillSet
        || payload?.desiredSkill,
    ),
    postingDate: normalizeDate(payload?.createDate || payload?.createdDate || listing.postingDate),
    closingDate: normalizeDate(payload?.endtDate || payload?.endDate || listing.closingDate),
    jobDescription: stripTags(
      payload?.jobConfigurationData?.Description
        || payload?.longDescription
        || payload?.shortDescription,
    ),
  }
}

const defaultFetchJson = async (url, options = {}) => {
  const headers = {
    Accept: 'application/json',
    TenantGroupId: TENANT_GROUP_ID,
    ...options.headers,
  }
  const request = {
    method: options.method || 'GET',
    headers,
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

  const response = await fetch(url, request)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const createInfoceptsAiScraper = ({
  maxPages = DEFAULT_MAX_PAGES,
  maxJobs = DEFAULT_MAX_JOBS,
} = {}) => ({
  async run(options = {}) {
    const fetchJson = options.fetchJson || defaultFetchJson
    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages && jobs.length < maxJobs; page += 1) {
      const listingPayload = await fetchJson(LISTING_API_URL, {
        method: 'POST',
        form: buildSearchPayload({ page }),
      })

      const listings = extractSearchResults(listingPayload)
      const summary = extractPaginationSummary(listingPayload)

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailPayload = await fetchJson(DETAIL_API_URL, {
          method: 'POST',
          json: buildDetailRequest(listing._listingRecord),
        })

        const detail = extractJobDetail(detailPayload, listing)
        jobs.push({
          ...detail,
          source: SOURCE,
          link: detail.applyUrl || detail.sourceUrl,
          scrapedAt: new Date().toISOString(),
        })

        if (jobs.length >= maxJobs) break
      }

      if (!summary.hasNext) break
    }

    return jobs
  },
})

export const run = (options) => createInfoceptsAiScraper().run(options)

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
