import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const OFFICIAL_CAREERS_URL = 'https://mathco.com/careers/'
export const EXPLORE_ROLES_URL = 'https://mathco.com/explore-roles/'
export const CAREERS_BASE_URL = 'https://careers.mathco.com/mathco'
export const LISTING_API_URL = 'https://public.zwayam.com/jobs/search'
export const DETAIL_API_URL = 'https://public.zwayam.com/jobs-service/v1/jobs/careersite'

const COMPANY_NAME = 'TheMathCompany'
const SOURCE = 'themathcompany'
const DOMAIN = 'careers.mathco.com'
const COMPANY_ID = 'MTUyMTU='
const DETAIL_COMPANY_ID = '15215'
const DEFAULT_PAGE_SIZE = 10

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

const toTitleCase = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .toLowerCase()
    .split(' ')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

const splitCsv = (value) => normalizeWhitespace(value)
  ?.split(',')
  .map((part) => normalizeWhitespace(part))
  .filter(Boolean) || []

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

const normalizeLocation = (value, jobLocationRecord = []) => {
  const city = toTitleCase(jobLocationRecord[0]?.city || jobLocationRecord[0]?.location)
  if (city) return city

  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return toTitleCase(normalized.split(',')[0])
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

export const buildJobDetailUrl = (jobUrl) =>
  `${CAREERS_BASE_URL}/jobview/${normalizeWhitespace(jobUrl) || ''}`

const buildDetailRequest = (listing = {}) => ({
  jobUrl: normalizeWhitespace(listing?.sourceUrl)?.split('/').pop() || null,
  externalSource: 'CareerSite',
  campusUrl: 'empty',
  companyId: DETAIL_COMPANY_ID,
})

const toJobFromListing = (record = {}) => {
  const location = normalizeLocation(record.location || record.locAgg, record.jobLocationRecord)
  const jobUrl = normalizeWhitespace(record.jobUrl)

  return {
    title: normalizeWhitespace(record.jobTitle),
    company: COMPANY_NAME,
    department: normalizeWhitespace(record.departmentName || record.DepartmentName),
    location,
    city: location,
    jobId: normalizeWhitespace(record.jobCode),
    requisitionId: normalizeWhitespace(record.referenceNumber || record.refNumber),
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
      : splitCsv(record.skillSet || record.skillsToEvaluate),
    postingDate: normalizeDate(record.createDate || record.createdDate),
    closingDate: null,
    jobDescription: stripTags(record.shortDescription),
  }
}

export const extractSearchResults = (payload) => (payload?.data?.data || [])
  .map((item) => item?._source || item)
  .filter((record) => isIndiaJob(record))
  .filter((record) => !isClosedOrArchived(record))
  .map((record) => toJobFromListing(record))
  .filter((job) => job.title && job.jobId && job.sourceUrl)

export const extractPaginationSummary = (payload, { currentOffset = 0 } = {}) => {
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

export const extractJobDetail = (payload, listing = {}) => {
  const sourceUrl = listing.sourceUrl || buildJobDetailUrl(payload?.jobUrl)
  const location = normalizeLocation(
    payload?.jobConfigurationData?.Location
      || payload?.locationDisplayForManageJobs
      || payload?.location
      || listing.location,
  )

  return {
    title: normalizeWhitespace(payload?.jobTitle) || listing.title || null,
    department: normalizeWhitespace(
      payload?.jobConfigurationData?.Department
        || payload?.department?.departmentName
        || payload?.departmentName,
    ) || listing.department || null,
    location: location || listing.location || null,
    city: location || listing.city || null,
    jobId: normalizeWhitespace(payload?.jobCode) || listing.jobId || null,
    requisitionId: normalizeWhitespace(payload?.referenceNumber) || listing.requisitionId || null,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: normalizeWhitespace(payload?.designation || payload?.role),
    experienceRequired: normalizeExperience(
      payload?.jobConfigurationData?.['Years Of Exp'] || payload?.yrsOfExperience,
      payload?.minYrsOfExperience,
      payload?.maxYrsOfExperience,
    ) || listing.experienceRequired || null,
    minimumQualification: normalizeWhitespace(
      payload?.jobConfigurationData?.['Education/Qualification'] || payload?.eduqualification,
    ),
    preferredQualification: null,
    requiredSkills: splitCsv(
      payload?.jobConfigurationData?.['Skills Required']
        || payload?.skillSet
        || payload?.desiredSkill,
    ),
    postingDate: normalizeDate(
      payload?.jobConfigurationData?.['Posted On'] || payload?.createDate || payload?.createdDate,
    ) || listing.postingDate || null,
    closingDate: normalizeDate(payload?.endtDate || payload?.endDate),
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

export const createTheMathCompanyScraper = ({
  pageSize = DEFAULT_PAGE_SIZE,
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchJson = options.fetchJson || defaultFetchJson
    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages; page += 1) {
      const listingPayload = await fetchJson(LISTING_API_URL, {
        method: 'POST',
        form: buildSearchPayload({ page }),
      })
      const listings = extractSearchResults(listingPayload)
      const summary = extractPaginationSummary(listingPayload, {
        currentOffset: (page - 1) * pageSize,
      })

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailPayload = await fetchJson(DETAIL_API_URL, {
          method: 'POST',
          json: buildDetailRequest(listing),
        })
        const detail = extractJobDetail(detailPayload, listing)

        jobs.push({
          ...detail,
          company: COMPANY_NAME,
          source: SOURCE,
          link: detail.applyUrl || detail.sourceUrl,
          scrapedAt: new Date().toISOString(),
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

export const run = (options) => createTheMathCompanyScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running TheMathCompany scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
