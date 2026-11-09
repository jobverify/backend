import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LIVSPACE_CATALOG } from './catalog.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = LIVSPACE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_LANDING_URL = PROVIDER_METADATA.careersLandingUrl
export const JOBS_LIST_URL = PROVIDER_METADATA.jobsListUrl
export const ZWAYAM_DOMAIN = PROVIDER_METADATA.zwayamDomain
export const LISTING_API_URL = 'https://public.zwayam.com/jobs/search'
export const DETAIL_API_URL = 'https://public.zwayam.com/jobs-service/v1/jobs/careersite'
export const TENANT_GROUP_ID = PROVIDER_METADATA.zwayamTenantGroupId
export const SEARCH_COMPANY_ID = PROVIDER_METADATA.zwayamCompanyId
export const DETAIL_COMPANY_ID = PROVIDER_METADATA.zwayamDetailCompanyId
export const DEFAULT_PAGE_SIZE = 9
export const DEFAULT_MAX_PAGES = 30
export const DEFAULT_MAX_JOBS = 500

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

const substantiveDescription = (...values) => {
  for (const value of values) {
    const text = stripTags(value)
    if (text && /\p{L}/u.test(text) && !/^n\/?a$/i.test(text)
      && !/^IC Gandhinagar Select$/i.test(text)) return text
  }
  return null
}

const splitCsv = (value) => normalizeWhitespace(value)
  ?.split(',')
  .map((part) => normalizeWhitespace(part))
  .filter(Boolean) || []

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

const surfaceFailure = (message, failureKind = 'surface_drift') => Object.assign(new Error(message), {
  softFailure: true, abortRetries: true, failureKind,
})

const unwrapPayload = (payload = {}) => {
  if (typeof payload !== 'string') return payload

  try {
    const parsed = JSON.parse(payload)
    return typeof parsed === 'string' ? JSON.parse(parsed) : parsed
  } catch {
    return payload
  }
}

const unwrapSearchRecord = (record = {}) => record?._source ?? record

const getFormattedLocation = (record = {}) => normalizeWhitespace(
  record?.jobLocationRecord?.[0]?.formattedLocation
    || record?.jobLocationRecord?.[0]?.location
    || record?.locAgg
    || record?.location,
)

const extractCity = (record = {}) => normalizeWhitespace(
  record?.jobLocationRecord?.[0]?.city
    || record?.city
    || getFormattedLocation(record)?.split(',')?.[0],
)

const chooseDepartment = (...values) => {
  for (const value of values) {
    const normalized = normalizeWhitespace(value)
    if (!normalized || /^all departments$/i.test(normalized)) continue
    return normalized
  }
  return null
}

const chooseLocation = (detailRecord = {}, listing = {}) => {
  const detailLocation = getFormattedLocation(detailRecord)
  const listingRecord = listing._listingRecord || listing
  const listingLocation = getFormattedLocation(listingRecord)

  if (detailLocation && /india/i.test(detailLocation)) return detailLocation
  return listingLocation || detailLocation || null
}

export const extractZwayamHandoffUrl = (html = '') => {
  const match = String(html ?? '').match(/https:\/\/careers\.livspace\.com\/livspace\/?/i)
  if (!match) return null

  return match[0].endsWith('/') ? match[0] : `${match[0]}/`
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const text = stripTags(rawHtml) || ''

  return /<title>\s*Where passion for design meets technology\s*<\/title>/i.test(rawHtml)
    && /let['’]s shape the future of home interiors, together/i.test(text)
    && /view open positions/i.test(text)
    && extractZwayamHandoffUrl(rawHtml) === CAREERS_LANDING_URL
}

export const hasPublicBoardShell = (html = '') => {
  const rawHtml = String(html ?? '')

  return /<title>\s*Careers\s*\|\s*Livspace\s*<\/title>/i.test(rawHtml)
    && /<base href="\/livspace\/">/i.test(rawHtml)
    && /<app-root\b/i.test(rawHtml)
    && /main\.[A-Za-z0-9]+\.js/i.test(rawHtml)
}

// Exact public location labels, rather than the employer's country, establish scope.
const INDIA_CITY_STATE_PAIRS = new Set([
  'ahmedabad,gujarat', 'hyderabad,telangana', 'surat,gujarat',
  'chennai,tamil nadu', 'bangalore,karnataka', 'bengaluru,karnataka',
  'mumbai,maharashtra', 'gurgaon,haryana', 'gurugram,haryana',
  'pune,maharashtra', 'noida,uttar pradesh', 'patna,bihar',
  'bhopal,madhya pradesh',
])
const FOREIGN_COUNTRY_CODES = new Set()
const FOREIGN_COUNTRY_LABELS = (() => {
  const labels = new Set([
    'united states of america', 'usa', 'us', 'uae', 'uk',
    'hong kong', 'macau', 'macao', 'taiwan', 'turkey', 'türkiye',
    'czech republic', 'south korea', 'north korea',
  ])
  const names = new Intl.DisplayNames(['en'], { type: 'region' })
  // ICU recognizes region names; unrecognized codes echo the code unchanged.
  // Compare entire comma-separated country tokens, never location substrings.
  for (let first = 65; first <= 90; first += 1) {
    for (let second = 65; second <= 90; second += 1) {
      const code = String.fromCharCode(first, second)
      if (['IN', 'ZZ', 'EU', 'EZ', 'UN', 'QO', 'XA', 'XB'].includes(code)) continue
      const name = names.of(code)
      if (name && name !== code) {
        labels.add(name.toLowerCase())
        FOREIGN_COUNTRY_CODES.add(code)
      }
    }
  }
  return labels
})()
const locationTokens = (value) => (normalizeWhitespace(value) || '')
  .toLowerCase().split(',').map((part) => part.trim())

const classifyLocationLabel = (value) => {
  const tokens = locationTokens(value)
  const last = tokens.at(-1)
  const hasIndia = tokens.some((token) => token === 'india' || token === 'in')
  const hasForeign = tokens.some((token) => FOREIGN_COUNTRY_LABELS.has(token))
  if (hasIndia && hasForeign) return 'conflict'
  if (hasForeign) return 'foreign'
  if (last === 'india' || last === 'in') return 'india'
  if (tokens.length === 2 && INDIA_CITY_STATE_PAIRS.has(tokens.join(','))) return 'india'
  // Chandigarh is both a city and an Indian union territory.
  if (tokens.length === 1 && last === 'chandigarh') return 'india'
  return 'unknown'
}

export const classifyJobCountry = (record = {}) => {
  const locations = Array.isArray(record?.jobLocationRecord) ? record.jobLocationRecord : []
  const countries = [record?.country, ...locations.map((location) => location?.country)]
    .map(normalizeWhitespace).filter((value) => value && !/^(unknown|none|null|undefined)$/i.test(value))
  const signals = countries.map((value) => {
    if (/^(india|in|ind)$/i.test(value)) return 'india'
    if (FOREIGN_COUNTRY_LABELS.has(value.toLowerCase()) || FOREIGN_COUNTRY_CODES.has(value.toUpperCase())) return 'foreign'
    return 'unknown'
  })
  for (const label of [record?.locAgg, record?.location, record?.jobConfigurationData?.Location,
    ...locations.flatMap((location) => [location?.formattedLocation, location?.location])]) {
    signals.push(classifyLocationLabel(label))
  }
  if (signals.includes('conflict') || signals.includes('india') && signals.includes('foreign')) return 'conflict'
  if (signals.includes('foreign')) return 'foreign'
  if (signals.includes('india')) return 'india'
  return 'unknown'
}

export const isIndiaJob = (record = {}) => classifyJobCountry(record) === 'india'

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

  return `${CAREERS_LANDING_URL.replace(/\/$/, '')}/jobview/${encodeURIComponent(normalizedJobUrl)}`
}

export const buildDetailRequest = (record = {}) => ({
  jobUrl: normalizeWhitespace(record?.jobUrl || record?.sourceUrl)?.split('/').pop()?.split('?')[0] || null,
  externalSource: 'CareerSite',
  campusUrl: 'empty',
  companyId: DETAIL_COMPANY_ID,
})

const extractSearchRecords = (payload = {}) => {
  const normalizedPayload = unwrapPayload(payload)
  const records = normalizedPayload?.data?.data
  if (!Array.isArray(records)) {
    throw surfaceFailure('Livspace Zwayam search response no longer matches the expected payload')
  }

  return records.map(unwrapSearchRecord)
}

const mapSearchRecord = (record = {}) => ({
  title: normalizeWhitespace(record?.jobTitle),
  company: COMPANY_NAME,
  department: chooseDepartment(record?.DepartmentName, record?.departmentName, record?.text9),
  location: getFormattedLocation(record),
  city: extractCity(record),
  jobId: normalizeWhitespace(record?.jobCode || record?.newJobCode),
  requisitionId: normalizeWhitespace(record?.referenceNumber || record?.refNumber),
  sourceUrl: buildJobDetailUrl(record?.jobUrl),
  applyUrl: buildJobDetailUrl(record?.jobUrl),
  employmentType: normalizeWhitespace(record?.employmentType || record?.jobTypeFieldDisplayName),
  experienceRequired: normalizeWhitespace(record?.experienceUIField || record?.yrsOfExperience),
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: Array.isArray(record?.mandatorySkills)
    ? record.mandatorySkills.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
    : splitCsv(record?.skillSet || record?.desiredSkill),
  postingDate: normalizeDate(record?.createDate || record?.createdDate),
  closingDate: normalizeDate(record?.endtDate || record?.endDate),
  jobDescription: substantiveDescription(record?.shortDescription, record?.mediumDescriptionWithoutHtml),
  _listingRecord: record,
})

export const extractSearchResults = (payload = {}) => extractSearchRecords(payload)
  .filter((record) => isIndiaJob(record))
  .map((record) => mapSearchRecord(record))
  .filter((job) => job.title && job.jobId && job.sourceUrl)

export const extractPaginationSummary = (payload = {}) => {
  const normalizedPayload = unwrapPayload(payload)

  return {
    hasNext: Boolean(normalizedPayload?.data?.hasMoreData),
    pageSize: Number.parseInt(
      normalizeWhitespace(normalizedPayload?.data?.facetedSearchConfig?.paginationHowMuch) || '',
      10,
    ) || DEFAULT_PAGE_SIZE,
    totalCount: Number(normalizedPayload?.data?.totalCount) || 0,
  }
}

export const extractJobDetail = (payload = {}, listing = {}) => {
  const detailRecord = unwrapPayload(payload)
  const listingRecord = listing._listingRecord || listing
  const jobCode = normalizeWhitespace(detailRecord?.jobCode || listing.jobId || listingRecord?.jobCode)
  const jobUrl = normalizeWhitespace(detailRecord?.jobUrl || listingRecord?.jobUrl)

  const nativeDescriptions = [
    detailRecord?.jobConfigurationData?.['Job Description'],
    detailRecord?.longDescription,
    detailRecord?.mediumDescription,
    detailRecord?.shortDescription,
  ]
  const hasNativeFullDescriptionField = nativeDescriptions.slice(0, 3).some((value) => value !== undefined)
  const description = substantiveDescription(
    ...nativeDescriptions,
    ...(hasNativeFullDescriptionField ? [] : [listing.jobDescription]),
  )

  return {
    title: normalizeWhitespace(detailRecord?.jobTitle) || listing.title || null,
    company: COMPANY_NAME,
    department: chooseDepartment(
      detailRecord?.department?.departmentName,
      detailRecord?.departmentName,
      listing.department,
      listingRecord?.DepartmentName,
    ),
    location: chooseLocation(detailRecord, listing) || listing.location || null,
    city: extractCity(detailRecord) || listing.city || extractCity(listingRecord),
    jobId: jobCode,
    requisitionId: normalizeWhitespace(
      detailRecord?.referenceNumber
        || detailRecord?.refNumber
        || listing.requisitionId
        || listingRecord?.referenceNumber,
    ),
    sourceUrl: buildJobDetailUrl(jobUrl) || listing.sourceUrl || null,
    applyUrl: buildJobDetailUrl(jobUrl) || listing.applyUrl || null,
    employmentType: normalizeWhitespace(
      detailRecord?.employmentType
        || detailRecord?.jobTypeFieldDisplayName
        || detailRecord?.jobConfigurationData?.['Employment Type'],
    ),
    experienceRequired: normalizeWhitespace(
      detailRecord?.jobConfigurationData?.Experience
        || detailRecord?.yrsOfExperience
        || listing.experienceRequired,
    ),
    minimumQualification: normalizeWhitespace(
      detailRecord?.jobConfigurationData?.['Education/Qualification']
        || detailRecord?.eduqualification,
    ),
    preferredQualification: null,
    requiredSkills: splitCsv(
      detailRecord?.jobConfigurationData?.['Mandatory Skills']
        || detailRecord?.mandatorySkills
        || detailRecord?.skillSet
        || detailRecord?.desiredSkill,
    ),
    postingDate: normalizeDate(
      detailRecord?.createdDate
        || detailRecord?.createDate
        || listing.postingDate
        || listingRecord?.createDate,
    ),
    closingDate: normalizeDate(detailRecord?.endtDate || detailRecord?.endDate || listing.closingDate),
    jobDescription: description,
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    },
    redirect: 'follow',
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

  if (TENANT_GROUP_ID) {
    headers.TenantGroupId = TENANT_GROUP_ID
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

export const createLivspaceScraper = ({
  maxPages = DEFAULT_MAX_PAGES,
  maxJobs = DEFAULT_MAX_JOBS,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersPageHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersPageHtml)) {
      throw surfaceFailure('Livspace verified official careers page no longer matches the known public surface')
    }

    const handoffUrl = extractZwayamHandoffUrl(careersPageHtml)
    if (handoffUrl !== CAREERS_LANDING_URL) {
      throw surfaceFailure('Livspace verified official careers page no longer exposes the known Zwayam handoff')
    }

    const boardShellHtml = await fetchText(CAREERS_LANDING_URL)
    if (!hasPublicBoardShell(boardShellHtml)) {
      throw surfaceFailure('Livspace verified public Zwayam board no longer matches the known public surface')
    }

    const jobs = []
    const seenJobIds = new Set()
    const unresolvedIds = []
    const missingCriteriaIds = []
    let expectedTotal = null
    let reachedLastPage = false
    let pagesFetched = 0

    for (let page = 1; page <= maxPages; page += 1) {
      const listingPayload = await fetchJson(LISTING_API_URL, {
        method: 'POST',
        form: buildSearchPayload({ page }),
      })
      const records = extractSearchRecords(listingPayload)
      pagesFetched += 1
      const summary = extractPaginationSummary(listingPayload)
      const rawData = unwrapPayload(listingPayload)?.data
      const rawTotal = rawData?.totalCount
      if (typeof rawData?.hasMoreData !== 'boolean') {
        throw surfaceFailure('Livspace public listing pagination marker is invalid')
      }
      const validTotalType = typeof rawTotal === 'number'
        || typeof rawTotal === 'string' && /^\d+$/.test(rawTotal.trim())
      if (!validTotalType || !Number.isSafeInteger(Number(rawTotal)) || Number(rawTotal) < 0) {
        throw surfaceFailure('Livspace public listing total is invalid')
      }
      if (expectedTotal === null) expectedTotal = summary.totalCount
      if (summary.totalCount !== expectedTotal || !records.length && (expectedTotal > 0 || summary.hasNext)) {
        throw surfaceFailure('Livspace public listing inventory is incomplete or its total changed')
      }

      // Validate unfiltered identity/counts, including foreign and unresolved rows.
      for (const record of records) {
        if (record?.companyId != null && String(record.companyId) !== String(DETAIL_COMPANY_ID)) {
          throw surfaceFailure('Livspace public listing company identity does not match its tenant')
        }
      }
      const listings = records.map(mapSearchRecord)
      for (const listing of listings) {
        if (!listing.title || !listing.jobId || !listing.sourceUrl) {
          throw surfaceFailure('Livspace public listing record has invalid job identity')
        }
        if (seenJobIds.has(listing.jobId)) throw surfaceFailure('Livspace public listing repeats a duplicate job identity')
        seenJobIds.add(listing.jobId)
      }
      if (seenJobIds.size > expectedTotal) throw surfaceFailure('Livspace public listing exceeds its advertised total')

      for (const listing of listings) {
        const listingScope = classifyJobCountry(listing._listingRecord)
        if (listingScope === 'conflict') throw surfaceFailure('Livspace listing country scope conflicts with its location', 'incomplete_location_scope')
        if (listingScope === 'foreign') continue
        let job = listing
        let detailPayload = null
        let detailComplete = false
        try {
          detailPayload = unwrapPayload(await fetchJson(DETAIL_API_URL, {
            method: 'POST',
            json: buildDetailRequest(listing._listingRecord),
          }))
        } catch {
          // The complete public listing remains usable when detail access fails.
        }
        let scope = listingScope
        if (detailPayload !== null) {
          if (normalizeWhitespace(detailPayload?.jobCode) !== listing.jobId
            || normalizeWhitespace(detailPayload?.jobUrl) !== listing._listingRecord.jobUrl
            || detailPayload?.companyId != null && String(detailPayload.companyId) !== String(DETAIL_COMPANY_ID)) {
            throw surfaceFailure('Livspace public detail job/company identity does not match the listing')
          }
          const detailScope = classifyJobCountry(detailPayload)
          if (detailScope === 'conflict' || listingScope === 'india' && detailScope === 'foreign') {
            throw surfaceFailure('Livspace public detail country scope conflicts with the India listing', 'incomplete_location_scope')
          }
          if (detailScope !== 'unknown') scope = detailScope
          job = extractJobDetail(detailPayload, listing)
          // A matching detail DTO alone does not establish full employer criteria.
          // Only its own native full-JD fields can provide that authority.
          detailComplete = Boolean(substantiveDescription(
            detailPayload?.jobConfigurationData?.['Job Description'],
            detailPayload?.longDescription,
            detailPayload?.mediumDescription,
          ))
        }
        if (scope === 'foreign') continue
        if (scope !== 'india') {
          unresolvedIds.push(listing.jobId)
          continue
        }
        if (!detailComplete) {
          missingCriteriaIds.push(listing.jobId)
          job = { ...job, jobDescription: null }
        }
        if (jobs.length >= maxJobs) throw surfaceFailure('Livspace public listing inventory is incomplete at the configured job limit')
        jobs.push({
          ...job,
          country: 'India',
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          companyCareerPage: CAREERS_URL,
          companyDomain: PROVIDER_METADATA.companyDomain,
          atsPlatform: PROVIDER_METADATA.atsPlatform,
          scrapedAt: now(),
          sourceDetailComplete: detailComplete,
          // Matching native details were inspected for experience, including its absence.
          // This does not certify a populated description; that has its own missing flag.
          publicExperienceChecked: detailPayload !== null,
          sourceDescriptionMissing: !normalizeWhitespace(job.jobDescription),
          ...(!detailComplete ? { sourceDetailFailureKind: 'missing-content' } : {}),
          sourceScopeComplete: false,
          lifecycleCleanupAllowed: false,
        })
      }
      if (!summary.hasNext) {
        reachedLastPage = true
        break
      }
    }
    if (!reachedLastPage || seenJobIds.size !== expectedTotal) {
      throw surfaceFailure('Livspace public listing inventory is incomplete against its advertised total')
    }
    if (!jobs.length && unresolvedIds.length) throw surfaceFailure('Livspace public listing has unresolved country scope', 'incomplete_location_scope')
    for (const job of jobs) {
      job.sourceListingComplete = unresolvedIds.length === 0 && missingCriteriaIds.length === 0
      job.sourceListingTotal = expectedTotal
      job.sourceListingFetched = seenJobIds.size
      if (unresolvedIds.length) job.sourceLocationScopeUnresolvedIds = [...unresolvedIds]
    }
    const complete = unresolvedIds.length === 0 && missingCriteriaIds.length === 0
    return attachInventoryEvidence(jobs, {
      status: !complete ? 'coverage-gap' : expectedTotal === 0 ? 'verified-empty' : 'complete-inventory',
      surface: LISTING_API_URL,
      firstParty: true,
      listingComplete: complete,
      pagesFetched,
      reportedTotal: expectedTotal,
      indiaFacetCount: complete ? jobs.length : null,
      verifiedAt: now(),
      reason: (unresolvedIds.length
        ? 'Complete unfiltered Zwayam pagination; some location scopes remain unresolved'
        : 'Official Livspace handoff, tenant identity, complete unfiltered Zwayam pagination and validated country scope')
        + (missingCriteriaIds.length ? '; unavailable-native-full-criteria:' + missingCriteriaIds.join(',') : ''),
    })
  },
})

export const run = async (options = {}) => createLivspaceScraper(options).run(options)

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
