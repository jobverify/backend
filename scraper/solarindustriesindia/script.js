import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { SOLAR_INDUSTRIES_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SOLAR_INDUSTRIES_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.officialHomepageUrl
export const HOMEPAGE_CAREERS_ENTRY_URL = PROVIDER_METADATA.homepageCareersEntryUrl
export const CAREERS_BOARD_URL = PROVIDER_METADATA.companyCareerPage
export const SAMPLE_JOB_VIEW_URL = PROVIDER_METADATA.sampleJobViewUrl
export const SEARCH_API_URL = PROVIDER_METADATA.officialSearchApiUrl
export const DETAIL_API_URL = PROVIDER_METADATA.officialDetailApiUrl
export const ZWAYAM_DOMAIN = PROVIDER_METADATA.zwayamDomain
export const SEARCH_COMPANY_ID = PROVIDER_METADATA.zwayamCompanyId
export const DETAIL_COMPANY_ID = PROVIDER_METADATA.zwayamDetailCompanyId
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const DEFAULT_PAGE_SIZE = 9
export const DEFAULT_MAX_PAGES = 25
export const DEFAULT_MAX_JOBS = 250

export const hasVerifiedCareersBoardTlsFailure = (error) =>
  /tlsv1 alert internal error/i.test(
    `${String(error?.message ?? error ?? '')} ${String(error?.cause?.message ?? '')}`,
  )

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15000

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
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
    const parsedFromEpoch = new Date(Number.parseInt(normalized, 10))
    if (!Number.isNaN(parsedFromEpoch.getTime())) {
      return parsedFromEpoch.toISOString().slice(0, 10)
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

const normalizeExperience = (value, minYears, maxYears) => {
  const normalized = normalizeWhitespace(value)
  if (normalized) return normalized.replace(/\s+to\s+/i, '-').replace(/\s+Years?$/i, ' years')

  const min = normalizeWhitespace(minYears)
  const max = normalizeWhitespace(maxYears)
  if (min && max) return `${min}-${max} years`
  if (min) return `${min}+ years`
  return null
}

const buildDisplayTitle = (jobTitle, designation) => {
  const primary = normalizeWhitespace(jobTitle)
  const secondary = normalizeWhitespace(designation)

  if (!primary) return secondary
  if (!secondary) return primary
  if (primary.toLowerCase() === secondary.toLowerCase()) return primary

  return `${primary} - ${secondary}`
}

const canonicalizeHomepageCareersEntryUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    const url = new URL(normalized, HOMEPAGE_URL)
    if (url.hostname !== 'careers.solargroup.com') return null
    if (!url.hash || url.hash === '#') {
      url.hash = '!/'
    }
    return url.toString()
  } catch {
    return null
  }
}

const chooseDepartment = (record = {}, fallback = null) =>
  normalizeWhitespace(
    record?.department?.departmentName
      || record?.departmentName
      || record?.DepartmentName
      || fallback,
  )

const chooseLocation = (record = {}, fallback = PROVIDER_METADATA.countryFilter) => {
  const explicitLocation = normalizeWhitespace(
    record?.jobLocationRecord?.[0]?.formattedLocation
      || record?.jobLocationRecord?.[0]?.location
      || record?.locationDisplayForManageJobs
      || record?.officeLocation
      || record?.location,
  )

  if (explicitLocation && (/,/.test(explicitLocation) || /\bindia\b/i.test(explicitLocation))) {
    return explicitLocation
  }

  return fallback || null
}

const chooseCity = (record = {}) => {
  const city = normalizeWhitespace(record?.jobLocationRecord?.[0]?.city)
  if (city) return city

  const formattedLocation = normalizeWhitespace(
    record?.jobLocationRecord?.[0]?.formattedLocation
      || record?.locationDisplayForManageJobs
      || record?.location,
  )
  if (formattedLocation && /,/.test(formattedLocation)) {
    return normalizeWhitespace(formattedLocation.split(',')[0])
  }

  return null
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = stripTags(rawHtml) || ''

  return /<title>\s*Solar Group\s*<\/title>/i.test(rawHtml)
    && /\bDefence\b/i.test(normalized)
    && /\bMining\b/i.test(normalized)
}

export const extractHomepageCareersEntryUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const candidateUrl = canonicalizeHomepageCareersEntryUrl(match[1])
    if (candidateUrl) {
      return candidateUrl
    }
  }

  return null
}

export const hasCareersBoardShellSignal = (html) => {
  const rawHtml = String(html ?? '')

  return /<title>\s*Careers\s*-\s*Solar Industries India Limited"?\s*<\/title>/i.test(rawHtml)
    && /<base[^>]+href=["']\/solargroup\/["']/i.test(rawHtml)
    && /<app-root\b/i.test(rawHtml)
    && /<script[^>]+src=["'][^"']*main\.[^"']+\.js["']/i.test(rawHtml)
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
  domain: ZWAYAM_DOMAIN,
  companyId: SEARCH_COMPANY_ID,
})

export const buildJobDetailUrl = (jobUrl) => {
  const normalizedJobUrl = normalizeWhitespace(jobUrl)
  if (!normalizedJobUrl) return null

  return `${CAREERS_BOARD_URL.replace(/\/$/, '')}/jobview/${encodeURIComponent(normalizedJobUrl)}`
}

export const buildDetailRequest = (record = {}) => ({
  jobUrl: normalizeWhitespace(record?.jobUrl || record?.sourceUrl)?.split('/').pop()?.split('?')[0] || null,
  externalSource: 'CAREERSITE',
  campusUrl: 'empty',
  companyId: DETAIL_COMPANY_ID,
})

const unwrapSearchRecord = (record = {}) => record?._source ?? record

const extractSearchRecords = (payload = {}) => {
  const records = payload?.data?.data
  if (!Array.isArray(records)) {
    throw new Error('Solar Industries India public Zwayam search response no longer matches the expected payload')
  }

  return records.map(unwrapSearchRecord).filter(Boolean)
}

const toListingJob = (record = {}) => ({
  title: buildDisplayTitle(record?.jobTitle, record?.designation),
  company: COMPANY,
  department: chooseDepartment(record, record?.location || record?.locAgg),
  location: chooseLocation(record),
  city: chooseCity(record),
  jobId: normalizeWhitespace(record?.jobCode || record?.newJobCode),
  requisitionId: normalizeWhitespace(record?.referenceNumber || record?.refNumber),
  sourceUrl: buildJobDetailUrl(record?.jobUrl),
  applyUrl: buildJobDetailUrl(record?.jobUrl),
  employmentType: null,
  experienceRequired: normalizeExperience(
    record?.yrsOfExperience || record?.experienceUIField,
    record?.minYrsOfExperience,
    record?.maxYrsOfExperience,
  ),
  minimumQualification: normalizeWhitespace(record?.eduqualification),
  preferredQualification: null,
  requiredSkills: splitCsv(record?.skillSet || record?.desiredSkill),
  postingDate: normalizeDate(record?.createdDate || record?.createDate),
  closingDate: normalizeDate(record?.endtDate || record?.endDate),
  jobDescription: stripTags(
    record?.shortDescription
      || record?.mediumDescriptionWithoutHtml
      || record?.longDescription,
  ),
  _listingRecord: record,
})

export const extractSearchResults = (payload = {}) => extractSearchRecords(payload)
  .map((record) => toListingJob(record))
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
  const listingRecord = listing._listingRecord || listing
  const detailJobUrl = normalizeWhitespace(payload?.jobUrl || listingRecord?.jobUrl)

  return {
    title: buildDisplayTitle(payload?.jobTitle, payload?.designation) || listing.title || null,
    company: COMPANY,
    department: chooseDepartment(
      payload,
      chooseDepartment(listingRecord, listing.department || listingRecord?.location || listingRecord?.locAgg),
    ),
    location: chooseLocation(payload, listing.location || PROVIDER_METADATA.countryFilter),
    city: chooseCity(payload) || listing.city || null,
    jobId: normalizeWhitespace(payload?.jobCode || listing.jobId || listingRecord?.jobCode),
    requisitionId: normalizeWhitespace(
      payload?.referenceNumber
        || listing.requisitionId
        || listingRecord?.referenceNumber,
    ),
    sourceUrl: buildJobDetailUrl(detailJobUrl) || listing.sourceUrl || null,
    applyUrl: buildJobDetailUrl(detailJobUrl) || listing.applyUrl || null,
    employmentType: null,
    experienceRequired: normalizeExperience(
      payload?.yrsOfExperience,
      payload?.minYrsOfExperience,
      payload?.maxYrsOfExperience,
    ) || listing.experienceRequired || null,
    minimumQualification: normalizeWhitespace(payload?.eduqualification) || listing.minimumQualification || null,
    preferredQualification: null,
    requiredSkills: splitCsv(payload?.skillSet || payload?.desiredSkill)
      || listing.requiredSkills
      || [],
    postingDate: normalizeDate(payload?.createdDate || payload?.createDate) || listing.postingDate || null,
    closingDate: normalizeDate(payload?.endtDate || payload?.endDate) || listing.closingDate || null,
    jobDescription: stripTags(
      payload?.jobConfigurationData?.['Job Description']
        || payload?.longDescription
        || payload?.mediumDescriptionWithoutHtml
        || payload?.shortDescription
        || payload?.shortDescriptionWithoutHtml,
    ) || listing.jobDescription || null,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  redirect: 'follow',
  timeoutMs: REQUEST_TIMEOUT_MS,
  label: `Solar Industries India page ${url}`,
})

const defaultFetchJson = (url, options = {}) => {
  const headers = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    ...(options.headers || {}),
  }

  const request = {
    method: options.method || 'GET',
    headers,
    redirect: 'follow',
    timeoutMs: REQUEST_TIMEOUT_MS,
    label: `Solar Industries India API ${url}`,
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

export const createSolarIndustriesIndiaScraper = ({
  maxPages = DEFAULT_MAX_PAGES,
  maxJobs = DEFAULT_MAX_JOBS,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Solar Industries India verified homepage no longer matches the trusted public surface')
    }

    const homepageCareersEntryUrl = extractHomepageCareersEntryUrl(homepageHtml)
    if (homepageCareersEntryUrl !== HOMEPAGE_CAREERS_ENTRY_URL) {
      throw new Error('Solar Industries India verified homepage careers entry no longer matches the trusted public surface')
    }

    try {
      const boardShellHtml = await fetchText(CAREERS_BOARD_URL)
      if (!hasCareersBoardShellSignal(boardShellHtml)) {
        throw new Error('Solar Industries India verified careers board shell no longer matches the trusted public surface')
      }

      const sampleJobViewHtml = await fetchText(SAMPLE_JOB_VIEW_URL)
      if (!hasCareersBoardShellSignal(sampleJobViewHtml)) {
        throw new Error('Solar Industries India verified sample jobview route no longer matches the trusted public surface')
      }
    } catch (error) {
      if (!hasVerifiedCareersBoardTlsFailure(error)) throw error
    }

    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages && jobs.length < maxJobs; page += 1) {
      const listingPayload = await fetchJson(SEARCH_API_URL, {
        method: 'POST',
        form: buildSearchPayload({ page }),
      })
      const listings = extractSearchResults(listingPayload)
      const summary = extractPaginationSummary(listingPayload)

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
          company: COMPANY,
          country: PROVIDER_METADATA.countryFilter,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          companyCareerPage: CAREERS_BOARD_URL,
          companyDomain: PROVIDER_METADATA.companyDomain,
          atsPlatform: PROVIDER_METADATA.atsPlatform,
          scrapedAt: now(),
        })

        if (jobs.length >= maxJobs) break
      }

      if (!summary.hasNext) break
      if (summary.totalCount > 0 && page * summary.pageSize >= summary.totalCount) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createSolarIndustriesIndiaScraper(options).run(options)

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
