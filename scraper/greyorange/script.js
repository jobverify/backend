import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import GREYORANGE_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = GREYORANGE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const COMPANY_CONFIG_URL = PROVIDER_METADATA.zwayamCompanyConfigUrl
export const SEARCH_API_URL = PROVIDER_METADATA.zwayamSearchUrl
export const DETAIL_API_URL = PROVIDER_METADATA.zwayamJobDetailUrl
export const PUBLIC_JOB_BASE_URL = PROVIDER_METADATA.publicJobBaseUrl
export const COMPANY_ID = 'MTYwOTA='
export const DETAIL_COMPANY_ID = '16090'
export const SEARCH_DOMAIN = 'careers.greyorange.com'
export const DEFAULT_PAGE_SIZE = 9

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const stripTags = (value) =>
  normalizeWhitespace(
    decodeHtmlEntities(String(value ?? ''))
      .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section)\b[^>]*>/gi, '\n')
      .replace(/<(p|div|li|ul|ol|h[1-6]|section)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

const splitCsv = (value) => normalizeWhitespace(value)
  ?.split(',')
  .map((part) => normalizeWhitespace(part))
  .filter(Boolean) || []

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString().slice(0, 10)
}

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const rangeMatch = normalized.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*years?/i)
  if (rangeMatch) {
    return `${rangeMatch[1]}-${rangeMatch[2]} years`
  }

  const plusMatch = normalized.match(/(\d+)\+\s*years?/i)
  if (plusMatch) {
    return `${plusMatch[1]}+ years`
  }

  return normalized.toLowerCase()
}

const normalizeLocation = (value) => normalizeWhitespace(value)

const deriveCity = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized) return null

  return normalizeWhitespace(
    normalized
      .split(',')[0]
      .split(' - ')[0]
      .split('(')[0],
  )
}

const inferCountry = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized) return null
  if (/\bindia\b/i.test(normalized)) return 'India'
  return null
}

const buildSearchFormData = (payload) => {
  const form = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    form.append(key, value)
  })
  return form
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
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
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Careers \| GreyOrange\s*<\/title>/i.test(page)
    && /meta\s+name=["']description["'][^>]+content=["']GreyOrange Careers["']/i.test(page)
    && /Join GreyOrange - Building the world'?s first fully automated flexible warehouse/i.test(page)
    && /<base href=["']\/greyorange\/["']/i.test(page)
}

export const hasVerifiedCompanyConfig = (payload = {}) => {
  const company = payload?.reponseObject?.company
  return payload?.responseStatus === 'SUCCESS'
    && Number(payload?.responseCode) === 200
    && Number(company?.id) === 16090
    && normalizeWhitespace(company?.folder)?.toLowerCase() === 'greyorange'
    && normalizeWhitespace(company?.companyName) === 'GreyOrange'
    && normalizeWhitespace(company?.careerSiteUrl) === 'careers.greyorange.com'
    && normalizeWhitespace(company?.domainName) === 'careers.greyorange.com'
}

export const buildSearchPayload = ({ page = 1, keywords = '' } = {}) => ({
  filterCri: JSON.stringify({
    selectedCall: 'sort',
    paginationStartNo: (Math.max(1, Number(page) || 1) - 1) * DEFAULT_PAGE_SIZE,
    sortCriteria: {
      name: 'modifiedDate',
      isAscending: false,
    },
    anyOfTheseWords: normalizeWhitespace(keywords) || '',
  }),
  domain: SEARCH_DOMAIN,
  companyId: COMPANY_ID,
})

export const buildPublicJobUrl = (jobUrl) =>
  `${PUBLIC_JOB_BASE_URL}/${normalizeWhitespace(jobUrl) || ''}`

export const extractSearchResults = (payload) => {
  const records = payload?.data?.data
  if (!Array.isArray(records)) {
    throw new Error('GreyOrange verified GreyOrange search payload no longer matches the public jobs surface')
  }

  return records
    .map((item) => item?._source || item)
    .map((record) => {
      const sourceUrl = buildPublicJobUrl(record?.jobUrl)

      return {
        title: normalizeWhitespace(record?.jobTitle),
        company: COMPANY,
        department: normalizeWhitespace(record?.departmentName),
        location: normalizeLocation(record?.location),
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

export const extractPaginationSummary = (payload) => ({
  hasNext: Boolean(payload?.data?.hasMoreData),
  pageSize:
    Number.parseInt(normalizeWhitespace(payload?.data?.facetedSearchConfig?.paginationHowMuch) || '', 10)
    || DEFAULT_PAGE_SIZE,
  totalCount: Number(payload?.data?.totalCount) || 0,
})

const buildDetailPayload = (jobUrl) => JSON.stringify({
  jobUrl: normalizeWhitespace(jobUrl),
  externalSource: 'CareerSite',
  campusUrl: 'empty',
  companyId: DETAIL_COMPANY_ID,
})

export const extractJobDetail = (payload, listing = {}) => {
  const title = normalizeWhitespace(payload?.jobTitle)
  if (!title) {
    throw new Error('GreyOrange verified GreyOrange detail payload no longer exposes public job details')
  }

  const sourceUrl = listing.sourceUrl || buildPublicJobUrl(payload?.jobUrl)

  return {
    title,
    company: COMPANY,
    department:
      normalizeWhitespace(payload?.department?.departmentName || payload?.departmentName)
      || listing.department
      || null,
    location:
      normalizeLocation(payload?.jobConfigurationData?.Location || payload?.location)
      || listing.location
      || null,
    city:
      deriveCity(payload?.jobConfigurationData?.Location || payload?.location)
      || listing.city
      || null,
    country:
      inferCountry(payload?.jobConfigurationData?.Location || payload?.location)
      || listing.country
      || null,
    jobId: normalizeWhitespace(payload?.jobCode) || listing.jobId || null,
    requisitionId: normalizeWhitespace(payload?.referenceNumber) || listing.requisitionId || null,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    experienceRequired: normalizeExperience(payload?.yrsOfExperience) || listing.experienceRequired || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: splitCsv(payload?.skillSet),
    postingDate: normalizeDate(payload?.createDate) || listing.postingDate || null,
    closingDate: null,
    jobDescription:
      stripTags(payload?.jobConfigurationData?.['Job Description'] || payload?.longDescription)
      || listing.jobDescription
      || null,
  }
}

export const createGreyOrangeScraper = ({
  maxJobs = null,
  maxPages = Number.POSITIVE_INFINITY,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('GreyOrange verified GreyOrange careers page no longer matches the official first-party surface')
    }

    const companyConfig = await fetchJson(COMPANY_CONFIG_URL, { method: 'GET' })
    if (!hasVerifiedCompanyConfig(companyConfig)) {
      throw new Error('GreyOrange verified GreyOrange careers configuration no longer matches the public Zwayam company config')
    }

    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages; page += 1) {
      const searchPayload = buildSearchPayload({ page })
      const listingPayload = await fetchJson(SEARCH_API_URL, {
        method: 'POST',
        body: buildSearchFormData(searchPayload),
      })

      const listings = extractSearchResults(listingPayload)
      const summary = extractPaginationSummary(listingPayload)

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailPayload = await fetchJson(DETAIL_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: buildDetailPayload(listing.sourceUrl.split('/').pop()),
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

      if (!summary.hasNext) {
        break
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createGreyOrangeScraper(options).run(options)

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
