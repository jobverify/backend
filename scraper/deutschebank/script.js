import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

import { DEUTSCHE_BANK_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DEUTSCHE_BANK_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.officialHomepageUrl
export const SEARCH_ROLES_URL = PROVIDER_METADATA.companyCareerPage
export const COUNTRY_LOOKUP_URL = PROVIDER_METADATA.publicCountryLookupUrl
export const SEARCH_API_URL = PROVIDER_METADATA.publicSearchApiUrl
export const JOB_DETAIL_API_PREFIX = PROVIDER_METADATA.publicJobDetailApiPrefix
export const VERIFIED_INDIA_COUNTRY_ID = PROVIDER_METADATA.verifiedIndiaCountryId

export const MATCHED_OBJECT_DESCRIPTOR = [
  'Facet:ProfessionCategory',
  'Facet:UserArea.ProDivision',
  'Facet:Profession',
  'Facet:PositionLocation.CountrySubDivision',
  'Facet:PositionOfferingType.Code',
  'Facet:PositionSchedule.Code',
  'Facet:PositionLocation.City',
  'Facet:PositionLocation.Country',
  'Facet:JobCategory.Code',
  'Facet:CareerLevel.Code',
  'Facet:PositionHiringYear',
  'Facet:PositionFormattedDescription.Content',
  'PositionID',
  'PositionTitle',
  'PositionURI',
  'ScoreThreshold',
  'OrganizationName',
  'PositionFormattedDescription.Content',
  'PositionLocation.CountryName',
  'PositionLocation.CountrySubDivisionName',
  'PositionLocation.CityName',
  'PositionLocation.Longitude',
  'PositionLocation.Latitude',
  'PositionIndustry.Name',
  'JobCategory.Name',
  'CareerLevel.Name',
  'PositionSchedule.Name',
  'PositionOfferingType.Name',
  'PublicationStartDate',
  'UserArea.GradEduInstCountry',
  'PositionImport',
  'PositionHiringYear',
  'PositionID',
]

export const SORT_CRITERIA = [
  {
    Criterion: 'PublicationStartDate',
    Direction: 'DESC',
  },
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(?:br|\/p|\/div|\/li|\/td|\/tr|\/table|\/tbody|\/main|\/section|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const extractHtmlTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''
  const title = extractHtmlTitle(page)

  return title === 'Home - Deutsche Bank Careers'
    && /href=["'](?:https:\/\/careers\.db\.com)?\/professionals\/search-roles\/?["']/i.test(page)
    && text.includes('Professionals')
    && text.includes('Search Roles')
}

export const hasSearchRolesPageSignal = (html = '') => {
  const page = String(html ?? '')
  const title = extractHtmlTitle(page)

  return title === 'Search Roles - Deutsche Bank Careers'
    && /id=["']job-module["']/i.test(page)
    && /data-jobmodule=["']PROFESSIONAL["']/i.test(page)
    && /(?:jobplatform\.js\?\d+|careersJs\.js\?v\d+)/i.test(page)
}

export const extractVerifiedIndiaCountryId = (payload = {}) => {
  const items = Array.isArray(payload?.lookup?.items) ? payload.lookup.items : []
  const india = items.find((item) => normalizeWhitespace(item?.label) === PROVIDER_METADATA.verifiedIndiaCountryLabel)
  return Number.isFinite(Number(india?.id)) ? Number(india.id) : null
}

export const buildIndiaSearchCriteria = () => ([
  {
    CriterionName: 'PositionLocation.Country',
    CriterionValue: VERIFIED_INDIA_COUNTRY_ID,
  },
])

export const buildSearchRequestPayload = ({
  count = 1,
  criteria = [],
} = {}) => ({
  LanguageCode: 'en',
  SearchParameters: {
    FirstItem: 1,
    CountItem: Number(count),
    MatchedObjectDescriptor: MATCHED_OBJECT_DESCRIPTOR,
    Sort: SORT_CRITERIA,
  },
  SearchCriteria: Array.isArray(criteria) ? criteria : [],
})

export const buildSearchApiUrl = (payload) => {
  const url = new URL(`${SEARCH_API_URL}/`)
  url.searchParams.set('data', JSON.stringify(payload))
  return url.toString()
}

export const buildPublicJobUrl = (jobId) =>
  `${SEARCH_ROLES_URL}#/professional/job/${encodeURIComponent(String(jobId ?? ''))}`

export const buildJobDetailUrl = (jobId) =>
  `${JOB_DETAIL_API_PREFIX}${encodeURIComponent(String(jobId ?? ''))}.json`

export const extractSearchResultItems = (payload = {}) => {
  const items = payload?.SearchResult?.SearchResultItems
  if (!Array.isArray(items)) {
    throw new Error('Deutsche Bank verified public search API no longer returns SearchResultItems')
  }
  return items
}

const extractSearchResultCountAll = (payload = {}) => {
  const count = payload?.SearchResult?.SearchResultCountAll
  if (!Number.isFinite(Number(count))) {
    throw new Error('Deutsche Bank verified public search API no longer returns SearchResultCountAll')
  }

  return Number(count)
}

const mapSearchResultItem = (item = {}) => {
  const descriptor = item?.MatchedObjectDescriptor || {}
  const jobId = normalizeWhitespace(descriptor?.PositionID)
  const title = normalizeWhitespace(descriptor?.PositionTitle)
  const rawCity = normalizeWhitespace(descriptor?.PositionLocation?.[0]?.CityName)
  const city = rawCity ? (normalizeCity(rawCity) || rawCity) : null
  const postingDate = normalizeWhitespace(descriptor?.PublicationStartDate)

  if (!jobId || !title || !city) {
    throw new Error('Deutsche Bank verified public search API no longer exposes the expected India listing fields')
  }

  return {
    jobId,
    title,
    city,
    postingDate,
    sourceUrl: buildPublicJobUrl(jobId),
  }
}

const extractFieldValueFromDetailHtml = (html, label) => {
  const pattern = new RegExp(
    `<strong>\\s*${escapeRegExp(label)}\\s*:?\\s*<\\/strong>\\s*([^<]+)`,
    'i',
  )
  return normalizeWhitespace(String(html ?? '').match(pattern)?.[1] || '')
}

const extractTitleFromDetailHtml = (html) =>
  stripTags(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '')

const extractJobDescription = (html) => {
  const sections = []

  for (const match of String(html ?? '').matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>\s*([\s\S]*?)(?=<h2\b|<\/div>\s*<\/div>|$)/gi)) {
    const heading = stripTags(match[1])
    const body = stripTags(match[2])

    if (heading && body) {
      sections.push(`${heading}\n${body}`)
      continue
    }

    if (heading) {
      sections.push(heading)
    }
  }

  return sections.length > 0 ? sections.join('\n\n') : null
}

export const mapListingAndDetailToJob = (listing, detailPayload, {
  scrapedAt = new Date().toISOString(),
} = {}) => {
  const applyUrl = normalizeWhitespace(detailPayload?.apply_uri)
  const detailHtml = String(detailPayload?.html ?? '')
  const title = extractTitleFromDetailHtml(detailHtml) || listing?.title || null
  const visibleLocation = extractFieldValueFromDetailHtml(detailHtml, 'Location')
  const normalizedCity = normalizeCity(visibleLocation || listing?.city || '')
    || normalizeWhitespace(visibleLocation || listing?.city || '')
    || null
  const jobId = normalizeWhitespace(listing?.jobId)
  const requisitionId = extractFieldValueFromDetailHtml(detailHtml, 'Job ID') || jobId
  const employmentType = extractFieldValueFromDetailHtml(detailHtml, 'Regular/Temporary')
    || extractFieldValueFromDetailHtml(detailHtml, 'Full/Part-Time')
    || null
  const postingDate = extractFieldValueFromDetailHtml(detailHtml, 'Listed')
    || normalizeWhitespace(listing?.postingDate)
    || null

  if (!jobId || !title || !normalizedCity) {
    throw new Error('Deutsche Bank verified public job detail payload no longer exposes the expected job fields')
  }

  return {
    title,
    company: COMPANY,
    department: null,
    location: `${normalizedCity}, India`,
    city: normalizedCity,
    state: null,
    country: 'India',
    sourceUrl: listing.sourceUrl || buildPublicJobUrl(jobId),
    applyUrl: applyUrl || listing.sourceUrl || buildPublicJobUrl(jobId),
    jobId,
    requisitionId,
    employmentType,
    workplaceType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    compensation: null,
    postingDate,
    closingDate: null,
    jobDescription: extractJobDescription(detailHtml),
    source: SOURCE,
    companyCareerPage: SEARCH_ROLES_URL,
    companyDomain: PROVIDER_METADATA.companyDomain,
    atsPlatform: PROVIDER_METADATA.atsPlatform,
    link: applyUrl || listing.sourceUrl || buildPublicJobUrl(jobId),
    scrapedAt,
  }
}

const mapSearchPayloadToListings = (payload) => extractSearchResultItems(payload).map(mapSearchResultItem)

export const createDeutscheBankScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Deutsche Bank verified official careers homepage changed materially')
    }

    const searchRolesPage = await fetchPage(SEARCH_ROLES_URL)
    if (searchRolesPage.status !== 200 || !hasSearchRolesPageSignal(searchRolesPage.html)) {
      throw new Error('Deutsche Bank verified search roles surface changed materially')
    }

    const countryLookup = await fetchJson(COUNTRY_LOOKUP_URL)
    const indiaCountryId = extractVerifiedIndiaCountryId(countryLookup)
    if (indiaCountryId !== VERIFIED_INDIA_COUNTRY_ID) {
      throw new Error('Deutsche Bank verified India country lookup changed materially')
    }

    const criteria = buildIndiaSearchCriteria()
    const firstPagePayload = await fetchJson(
      buildSearchApiUrl(buildSearchRequestPayload({ count: 1, criteria })),
    )
    const resultCountAll = extractSearchResultCountAll(firstPagePayload)
    if (resultCountAll === 0) {
      return []
    }

    const firstListings = mapSearchPayloadToListings(firstPagePayload)
    const listings = resultCountAll > firstListings.length
      ? mapSearchPayloadToListings(await fetchJson(
        buildSearchApiUrl(buildSearchRequestPayload({ count: resultCountAll, criteria })),
      ))
      : firstListings

    const scrapedAt = now()
    const jobs = await Promise.all(
      listings.map(async (listing) => {
        const detailPayload = await fetchJson(buildJobDetailUrl(listing.jobId))
        return mapListingAndDetailToJob(listing, detailPayload, { scrapedAt })
      }),
    )

    return jobs
  },
})

export const run = async (options = {}) => createDeutscheBankScraper(options).run(options)

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
