import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const API_BASE_URL = 'https://public.zwayam.com'
const CAREERS_BASE_URL = 'https://careers.cyient.com/cyient'
const SEARCH_API_URL = `${API_BASE_URL}/jobs/search`
const DETAIL_API_URL = `${API_BASE_URL}/jobs-service/v1/jobs/careersite`
const COMPANY_ID = 'MTU0ODY='
const DOMAIN = 'careers.cyient.com'
const DEFAULT_PAGE_SIZE = 10

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')
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
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+:/g, ':'),
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
  return null
}

const normalizeLocation = (value, jobLocationRecord = []) => {
  const city = toTitleCase(jobLocationRecord[0]?.city)
  if (city) return city

  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return toTitleCase(normalized.split(',')[0])
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

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const isIndiaJob = (record = {}) =>
  normalizeWhitespace(record?.text3)?.toLowerCase() === 'india'
  || (Array.isArray(record?.jobLocationRecord) && record.jobLocationRecord.some(
    (location) => /india/i.test(normalizeWhitespace(location?.country) || ''),
  ))

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

const toJobFromListing = (record = {}) => {
  const location = normalizeLocation(record.location || record.locAgg, record.jobLocationRecord)
  const jobUrl = normalizeWhitespace(record.jobUrl)

  return {
    title: normalizeWhitespace(record.jobTitle),
    company: 'Cyient',
    department: normalizeWhitespace(record.departmentName || record.DepartmentName),
    location,
    city: location,
    jobId: normalizeWhitespace(record.jobCode),
    requisitionId: normalizeWhitespace(record.referenceNumber || record.refNumber),
    sourceUrl: jobUrl ? buildJobDetailUrl(jobUrl) : null,
    applyUrl: jobUrl ? buildJobDetailUrl(jobUrl) : null,
    employmentType: null,
    experienceRequired: normalizeExperience(record.experienceUIField),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: Array.isArray(record.mandatorySkills)
      ? record.mandatorySkills.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
      : [],
    postingDate: normalizeDate(record.createDate),
    closingDate: null,
    jobDescription: stripTags(record.shortDescription),
  }
}

export const extractSearchResults = (payload) => (payload?.data?.data || [])
  .map((item) => item?._source || item)
  .filter((record) => isIndiaJob(record))
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
    payload?.jobConfigurationData?.Location || payload?.location || listing.location,
  )

  return {
    title: normalizeWhitespace(payload?.jobTitle) || listing.title || null,
    department: normalizeWhitespace(
      payload?.department?.departmentName || payload?.departmentName,
    ) || listing.department || null,
    location: location || listing.location || null,
    city: location || listing.city || null,
    jobId: normalizeWhitespace(payload?.jobCode) || listing.jobId || null,
    requisitionId: normalizeWhitespace(payload?.referenceNumber) || listing.requisitionId || null,
    employmentType: null,
    experienceRequired: normalizeExperience(
      payload?.yrsOfExperience,
      payload?.minYrsOfExperience,
      payload?.maxYrsOfExperience,
    ) || listing.experienceRequired || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: splitCsv(
      payload?.jobConfigurationData?.['Skills Required']
        || payload?.skillSet
        || payload?.desiredSkill,
    ),
    postingDate: normalizeDate(payload?.createDate) || listing.postingDate || null,
    closingDate: normalizeDate(payload?.endtDate),
    applyUrl: sourceUrl,
    sourceUrl,
    jobDescription: stripTags(
      payload?.jobConfigurationData?.['Job Description'] || payload?.longDescription,
    ),
  }
}

const buildSearchFormData = (payload) => {
  const form = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    form.append(key, value)
  })
  return form
}

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const run = async () => {
  const jobs = []
  const seenJobIds = new Set()
  const maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY
  const maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null

  for (let page = 1; page <= maxPages; page += 1) {
    const searchPayload = buildSearchPayload({ page })
    const listingPayload = await fetchJson(SEARCH_API_URL, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        Accept: 'application/json,text/plain,*/*',
      },
      body: buildSearchFormData(searchPayload),
    })

    const listings = extractSearchResults(listingPayload)
    const summary = extractPaginationSummary(listingPayload, {
      currentOffset: (page - 1) * DEFAULT_PAGE_SIZE,
    })

    for (const listing of listings) {
      if (seenJobIds.has(listing.jobId)) continue
      seenJobIds.add(listing.jobId)

      const detailPayload = await fetchJson(DETAIL_API_URL, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
          Accept: 'application/json,text/plain,*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobUrl: listing.sourceUrl.split('/').pop(),
          externalSource: 'CareerSite',
          campusUrl: 'empty',
          companyId: '15486',
        }),
      })

      const detail = extractJobDetail(detailPayload, listing)

      jobs.push({
        ...detail,
        company: 'Cyient',
        source: 'cyient',
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
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Cyient scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'cyient')
    console.log('DB result:', result)
    process.exit(0)
  }
}
