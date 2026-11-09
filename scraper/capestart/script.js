import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { CAPESTART_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = CAPESTART_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const JOBS_LIST_URL = PROVIDER_METADATA.companyCareerPage
export const TENANT_LOOKUP_URL = PROVIDER_METADATA.zwayamTenantLookupUrl
export const TENANT_GROUP_ID = PROVIDER_METADATA.zwayamTenantGroupId
export const SEARCH_COMPANY_ID = PROVIDER_METADATA.zwayamCompanyId
export const DETAIL_COMPANY_ID = PROVIDER_METADATA.zwayamDetailCompanyId
export const SEARCH_API_URL = PROVIDER_METADATA.zwayamSearchUrl
export const DETAIL_API_URL = PROVIDER_METADATA.zwayamJobDetailUrl
export const PUBLIC_JOB_BASE_URL = PROVIDER_METADATA.publicJobBaseUrl
export const DEFAULT_PAGE_SIZE = 10

const SEARCH_DOMAIN = 'careers.capestart.com'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

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
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|section|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized

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

const splitCsv = (value) => normalizeWhitespace(value)
  ?.split(',')
  .map((part) => normalizeWhitespace(part))
  .filter(Boolean) || []

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const inferCountry = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/\bindia\b/i.test(normalized)) return 'India'
  return null
}

const buildFormData = (payload = {}) => {
  const formData = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    formData.append(key, value)
  })
  return formData
}

const buildPublicJobUrl = (jobUrl) =>
  `${PUBLIC_JOB_BASE_URL}/${normalizeWhitespace(jobUrl) || ''}`

const getSearchRecords = (payload = {}) => payload?.data?.data

const getJobSlugFromListing = (listing = {}) => normalizeWhitespace(
  listing?.sourceUrl?.split('/').pop() || listing?.applyUrl?.split('/').pop(),
)

const joinDescriptionParts = (...parts) => normalizeWhitespace(
  parts
    .map((part) => stripTags(part))
    .filter(Boolean)
    .join(' '),
)

export const hasOfficialJobsListSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Capestart \| Careers\s*<\/title>/i.test(page)
    && /<base href=["']\/capestart\/["']/i.test(page)
    && /main\.[a-z0-9]+\.js/i.test(page)
}

export const hasVerifiedTenantPayload = (payload = {}) =>
  payload?.responseStatus === 'SUCCESS'
  && Number(payload?.responseCode) === 200
  && normalizeWhitespace(payload?.reponseObject?.name) === 'CapeStart Software Private Limited'
  && normalizeWhitespace(payload?.reponseObject?.tenantGroupId) === TENANT_GROUP_ID

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
  domain: SEARCH_DOMAIN,
  companyId: SEARCH_COMPANY_ID,
})

export const buildDetailPayload = (jobUrl) => ({
  jobUrl: normalizeWhitespace(jobUrl),
  externalSource: 'CareerSite',
  campusURL: 'empty',
  companyId: DETAIL_COMPANY_ID,
})

export const extractSearchResults = (payload = {}) => {
  const records = getSearchRecords(payload)
  if (!Array.isArray(records)) {
    throw new Error('CapeStart verified search payload no longer matches the public Zwayam jobs contract')
  }

  return records
    .map((item) => item?._source || item)
    .map((record) => {
      const jobUrl = normalizeWhitespace(record?.jobUrl)
      const sourceUrl = buildPublicJobUrl(jobUrl)

      return {
        title: normalizeWhitespace(record?.jobTitle),
        company: COMPANY,
        department: normalizeWhitespace(record?.departmentName),
        location: normalizeWhitespace(record?.location),
        city: deriveCity(record?.location),
        country: inferCountry(record?.location),
        jobId: normalizeWhitespace(record?.jobCode),
        requisitionId: normalizeWhitespace(record?.referenceNumber),
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeDate(record?.createDate),
        closingDate: null,
        jobDescription: stripTags(record?.shortDescription),
      }
    })
    .filter((job) => job.title && job.jobId && job.sourceUrl)
}

export const extractPaginationSummary = (payload = {}) => ({
  hasNext: Boolean(payload?.data?.hasMoreData),
  pageSize:
    Number.parseInt(normalizeWhitespace(payload?.data?.facetedSearchConfig?.paginationHowMuch) || '', 10)
    || DEFAULT_PAGE_SIZE,
  totalCount: Number(payload?.data?.totalCount) || 0,
})

export const extractJobDetail = (payload = {}, listing = {}) => {
  const title = normalizeWhitespace(payload?.jobTitle)
  if (!title) {
    throw new Error('CapeStart verified CapeStart detail payload no longer exposes public job details')
  }

  const sourceUrl = listing.sourceUrl || buildPublicJobUrl(payload?.jobUrl)
  const location = normalizeWhitespace(payload?.location) || listing.location || null

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(payload?.departmentName) || listing.department || null,
    location,
    city: deriveCity(location) || listing.city || null,
    country: inferCountry(location) || listing.country || null,
    jobId: normalizeWhitespace(payload?.jobCode) || listing.jobId || null,
    requisitionId: normalizeWhitespace(payload?.referenceNumber) || listing.requisitionId || null,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: normalizeWhitespace(payload?.eduqualification) || listing.minimumQualification || null,
    preferredQualification: normalizeWhitespace(payload?.desiredSkill) || listing.preferredQualification || null,
    requiredSkills: splitCsv(payload?.skillSet),
    postingDate: normalizeDate(payload?.createDate) || listing.postingDate || null,
    closingDate: null,
    jobDescription: joinDescriptionParts(payload?.longDescription, payload?.role) || listing.jobDescription || null,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    ...(options.headers || {}),
  },
  body: options.body,
  label: SOURCE,
  timeoutMs: 30000,
})

export const createCapeStartScraper = ({
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const jobsListHtml = await fetchText(JOBS_LIST_URL)
    if (!hasOfficialJobsListSignal(jobsListHtml)) {
      throw new Error('CapeStart verified CapeStart jobs shell no longer matches the known first-party surface')
    }

    const tenantPayload = await fetchJson(TENANT_LOOKUP_URL)
    if (!hasVerifiedTenantPayload(tenantPayload)) {
      throw new Error('CapeStart verified Zwayam tenant payload no longer matches the CapeStart public tenant contract')
    }

    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages; page += 1) {
      const listingPayload = await fetchJson(SEARCH_API_URL, {
        method: 'POST',
        headers: {
          TenantGroupId: TENANT_GROUP_ID,
        },
        body: buildFormData(buildSearchPayload({ page })),
      })

      const listings = extractSearchResults(listingPayload)
      const summary = extractPaginationSummary(listingPayload)

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailPayload = await fetchJson(DETAIL_API_URL, {
          method: 'POST',
          headers: {
            TenantGroupId: TENANT_GROUP_ID,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildDetailPayload(getJobSlugFromListing(listing))),
        })

        const detail = extractJobDetail(detailPayload, listing)

        jobs.push({
          ...detail,
          source: SOURCE,
          link: detail.applyUrl || detail.sourceUrl,
          scrapedAt: now(),
        })

        if (Number.isFinite(maxJobs) && jobs.length >= maxJobs) {
          return jobs
        }
      }

      if (!summary.hasNext) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createCapeStartScraper(options).run(options)

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
