import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'cultfit'
export const COMPANY = 'Cult.fit'
export const OFFICIAL_CAREERS_URL = 'https://careers.cult.fit/cult/'
export const CAREERS_BASE_URL = 'https://careers.cult.fit/cult'
export const LISTING_API_URL = 'https://public.zwayam.com/jobs/search'
export const DETAIL_API_URL = 'https://public.zwayam.com/jobs-service/v1/jobs/careersite'

const DOMAIN = 'careers.cult.fit'
const COMPANY_ID = 'MTU0NzA='
const DETAIL_COMPANY_ID = '15470'
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

export const hasVerifiedCareerPageSignals = (html) => {
  const page = String(html ?? '')
  return /<title[^>]*>\s*(?:cult\.fit careers|Careers\s*\|\s*Cult\.Fit)\s*<\/title>/i.test(page)
    && /<base[^>]+href=["']\/cult\/["']/i.test(page)
    && /<app-root><\/app-root>/i.test(page)
    && /<script[^>]+src=["']main\.[^"']+\.js["']/i.test(page)
}

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
    company: COMPANY,
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

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
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

export const createCultFitScraper = ({
  pageSize = DEFAULT_PAGE_SIZE,
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const fetchJson = options.fetchJson || defaultFetchJson
    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL)

    if (!hasVerifiedCareerPageSignals(careersHtml)) {
      throw new Error('Cult.fit verified careers page shell changed or disappeared')
    }

    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages; page += 1) {
      const listingPayload = await fetchJson(LISTING_API_URL, {
        method: 'POST',
        form: buildSearchPayload({ page }),
      })
      const listings = extractSearchResults(listingPayload)

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
          company: COMPANY,
          source: SOURCE,
          link: detail.applyUrl || detail.sourceUrl,
          scrapedAt: new Date().toISOString(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      if (!listingPayload?.data?.hasMoreData) break
      if ((page - 1) * pageSize >= Number(listingPayload?.data?.totalCount || 0)) break
    }

    return jobs
  },
})

export const run = (options) => createCultFitScraper().run(options)

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
