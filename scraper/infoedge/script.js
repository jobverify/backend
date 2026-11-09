import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { INFOEDGE_CATALOG } from './catalog.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'
import { extractActiveDescription } from './nativeContent.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = INFOEDGE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_LANDING_URL = PROVIDER_METADATA.careersLandingUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_BASE_URL = CAREERS_LANDING_URL.replace(/\/$/, '')
export const LISTING_API_URL = 'https://public.zwayam.com/jobs/search'
export const DETAIL_API_URL = 'https://public.zwayam.com/jobs-service/v1/jobs/careersite'
export const TENANT_GROUP_ID = PROVIDER_METADATA.zwayamTenantGroupId

const SEARCH_COMPANY_ID = PROVIDER_METADATA.zwayamCompanyId
const DETAIL_COMPANY_ID = PROVIDER_METADATA.zwayamDetailCompanyId
const DOMAIN = PROVIDER_METADATA.companyDomain
const DEFAULT_PAGE_SIZE = 12
const DEFAULT_MAX_PAGES = 500
const DEFAULT_MAX_JOBS = 10000
const DEFAULT_DETAIL_CONCURRENCY = 3

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

const stripTags = extractActiveDescription

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
    if (month) {
      const iso=`${year}-${month}-${day.padStart(2, '0')}`
      const parsed=new Date(iso)
      if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==iso)inventoryFailure('invalid native calendar date')
      return iso
    }
  }

  if (/^\d{13}$/.test(normalized)) {
    const parsed = new Date(Number.parseInt(normalized, 10))
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10)
    }
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) inventoryFailure('invalid native date')
  if (/^\d{4}-\d{2}-\d{2}/.test(normalized) && parsed.toISOString().slice(0,10)!==normalized.slice(0,10)) inventoryFailure('invalid native calendar date')

  return parsed.toISOString().slice(0, 10)
}

const unwrapSearchRecord = (record = {}) => record?._source ?? record
const unwrapDetailPayload = (payload = {}) => payload?.reponseObject ?? payload?.data ?? payload

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

const hasStructuredPublicDetailEvidence = (detailRecord = {}, listing = {}) => {
  const listingRecord = listing._listingRecord || listing
  const listingJobId = normalizeWhitespace(
    listing.jobId || listingRecord?.jobCode || listingRecord?.newJobCode,
  )
  const detailJobId = normalizeWhitespace(detailRecord?.jobCode)
  const jobIdsAlign = !listingJobId || !detailJobId || listingJobId === detailJobId
  const title = normalizeWhitespace(
    detailRecord?.jobTitle || detailRecord?.jobConfigurationData?.['Job Title'] || listing.title,
  )
  const jobUrl = normalizeWhitespace(detailRecord?.jobUrl || listingRecord?.jobUrl)
  const location = normalizeWhitespace(
    detailRecord?.jobConfigurationData?.Location || detailRecord?.location || listing.location,
  )
  const description = normalizeWhitespace(
    detailRecord?.jobConfigurationData?.Description
      || detailRecord?.longDescription
      || detailRecord?.shortDescription
      || detailRecord?.mediumDescriptionWithoutHtml,
  )
  const skills = splitCsv(
    detailRecord?.jobConfigurationData?.['Skills Required']
      || detailRecord?.skillSet
      || detailRecord?.desiredSkill,
  )

  return Boolean(
    jobIdsAlign
    && title
    && (jobUrl || detailJobId)
    && (location || description || skills.length > 0),
  )
}

export const isIndiaJob = (record = {}) =>
  (Array.isArray(record?.jobLocationRecord) && record.jobLocationRecord.some(
    (location) => /india/i.test(normalizeWhitespace(location?.country) || ''),
  ))
  || /india/i.test(normalizeWhitespace(record?.locAgg) || '')
  || /india/i.test(normalizeWhitespace(record?.location) || '')

export const buildSearchPayload = ({ page = 1, paginationStartNo, keywords = '' } = {}) => ({
  filterCri: JSON.stringify({
    paginationStartNo: paginationStartNo ?? (Math.max(1, Number(page) || 1) - 1) * DEFAULT_PAGE_SIZE,
    selectedCall: 'sort',
    sortCriteria: {
      name: 'modifiedDate',
      isAscending: false,
    },
    anyOfTheseWords: normalizeWhitespace(keywords) || '',
  }),
  domain: DOMAIN,
  companyId: SEARCH_COMPANY_ID,
})

export const buildJobDetailUrl = (jobUrl) => {
  const normalizedJobUrl = normalizeWhitespace(jobUrl)
  if (!normalizedJobUrl) return null

  return `${CAREERS_BASE_URL}/jobview/${encodeURIComponent(normalizedJobUrl)}`
}

export const buildDetailRequest = (record = {}) => ({
  jobUrl: normalizeWhitespace(record?.jobUrl || record?.sourceUrl)?.split('/').pop()?.split('?')[0] || null,
  externalSource: 'CareerSite',
  campusUrl: 'empty',
  companyId: DETAIL_COMPANY_ID,
})

const extractSearchRecords = (payload = {}) => {
  const records = payload?.data?.data
  if (!Array.isArray(records)) {
    throw new Error('InfoEdge Zwayam search response no longer matches the expected payload')
  }
  return records.map(unwrapSearchRecord)
}

const mapSearchRecord = (record = {}) => {
  const location = getFormattedLocation(record)
  return {
    title: normalizeWhitespace(record?.jobTitle),
    company: COMPANY_NAME,
    department: chooseDepartment(record?.DepartmentName, record?.text9, record?.departmentName),
    location,
    city: extractCity(record),
    jobId: normalizeWhitespace(record?.jobCode || record?.newJobCode),
    requisitionId: normalizeWhitespace(record?.referenceNumber || record?.refNumber),
    sourceUrl: buildJobDetailUrl(record?.jobUrl),
    applyUrl: buildJobDetailUrl(record?.jobUrl),
    employmentType: null,
    experienceRequired: normalizeWhitespace(record?.experienceUIField || record?.yrsOfExperience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: Array.isArray(record?.mandatorySkills)
      ? record.mandatorySkills.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
      : splitCsv(record?.skillSet || record?.desiredSkill),
    postingDate: normalizeDate(record?.createDate || record?.createdDate),
    closingDate: normalizeDate(record?.endtDate || record?.endDate),
    jobDescription: stripTags(record?.shortDescription || record?.mediumDescriptionWithoutHtml),
    _listingRecord: record,
  }
}

export const extractSearchResults = (payload = {}) => extractSearchRecords(payload)
  .filter((record) => isIndiaJob(record))
  .map((record) => mapSearchRecord(record))
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
  const detailRecord = unwrapDetailPayload(payload)
  const listingRecord = listing._listingRecord || listing
  const jobCode = normalizeWhitespace(detailRecord?.jobCode || listing.jobId || listingRecord?.jobCode)
  const jobUrl = normalizeWhitespace(detailRecord?.jobUrl || listingRecord?.jobUrl)
  const hasPublicDetailEvidence = hasStructuredPublicDetailEvidence(detailRecord, listing)

  return {
    title: normalizeWhitespace(detailRecord?.jobTitle) || listing.title || null,
    company: COMPANY_NAME,
    department: chooseDepartment(
      detailRecord?.department?.departmentName,
      detailRecord?.departmentName,
      listing.department,
      listingRecord?.DepartmentName,
      listingRecord?.text9,
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
        || detailRecord?.jobType
        || detailRecord?.jobConfigurationData?.['Employment Type'],
    ),
    experienceRequired: normalizeWhitespace(
      detailRecord?.jobConfigurationData?.['Years Of Exp']
        || detailRecord?.yrsOfExperience
        || listing.experienceRequired,
    ),
    minimumQualification: normalizeWhitespace(
      detailRecord?.jobConfigurationData?.['Education/Qualification']
        || detailRecord?.eduqualification,
    ),
    preferredQualification: null,
    requiredSkills: splitCsv(
      detailRecord?.jobConfigurationData?.['Skills Required']
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
    jobDescription: stripTags(
      detailRecord?.jobConfigurationData?.Description,
    ),
    publicExperienceChecked: hasPublicDetailEvidence,
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

  const timeout = AbortSignal.timeout(Math.max(1, Math.min(20000, Number(options.timeoutMs) || 20000)))
  request.signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
  const response = await fetch(url, request)
  if (response.status !== 200 || response.url !== url) {
    throw new Error(`HTTP ${response.status} or endpoint identity changed for ${url}`)
  }

  return response.json()
}


const ISO_COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const knownCountries = new Set(ISO_COUNTRY_CODES.flatMap(code => [code.toLowerCase(), regionNames.of(code).toLowerCase()]))
const inventoryFailure = (message) => { throw new Error('InfoEdge Zwayam inventory ' + message) }
const assertNativeEnvelope = payload => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.error
    || (Array.isArray(payload.errors) ? payload.errors.length : payload.errors) || payload.success === false
    || (payload.statusCode != null && payload.statusCode !== 200)
    || (payload.code != null && payload.code !== 200)) inventoryFailure('upstream error envelope')
}
const text = value => String(value ?? '').trim().replace(/\s+/g, ' ')
const countryOf = record => {
  const locations = record.jobLocationRecord || []
  if (!Array.isArray(locations)) inventoryFailure('country locations are malformed')
  if (locations.some(location=>!location||typeof location!=='object'||Array.isArray(location)||typeof location.country!=='string') || (record.country!=null&&typeof record.country!=='string')) inventoryFailure('country fields must be strings')
  for(const location of locations){
    for(const key of ['city','state','formattedLocation','location'])if(location[key]!=null&&typeof location[key]!=='string')inventoryFailure('location fields must be strings')
    const formatted=text(location.formattedLocation),city=text(location.city)
    if(formatted&&city&&text(formatted.split(',')[0]).toLowerCase()!==city.toLowerCase())inventoryFailure('native city contradicts full location')
  }
  let countries = locations.map(location => text(location.country).toLowerCase())
  if (record.country != null) countries.push(text(record.country).toLowerCase())
  if (countries.some(country => !knownCountries.has(country))) inventoryFailure('country is missing or unknown')
  if (!countries.length) {
    const direct = text(record.country).toLowerCase()
    const tail = text(record.locAgg || record.location).split(',').pop().trim().toLowerCase()
    const country = direct || tail
    if (!knownCountries.has(country)) inventoryFailure('country is unverified')
    countries = [country]
  }
  const india = countries.every(country => country === 'india' || country === 'in')
  if (countries.some(country => country === 'india' || country === 'in') && !india) inventoryFailure('country locations conflict')
  const places = [record.location, record.locAgg, ...locations.flatMap(location => [location.location, location.formattedLocation])]
  if (!india && places.some(place => /\bindia\b/i.test(text(place)))) inventoryFailure('country contradicts an India address')
  if (india && places.some(place => { const tail = text(place).split(',').pop().trim().toLowerCase(); return knownCountries.has(tail) && tail !== 'india' && tail !== 'in' })) inventoryFailure('country contradicts a foreign address')
  return india
}
const verifyListing = record => {
  const primitiveId=value=>(typeof value==='string'||typeof value==='number')&&/^\d+$/.test(String(value))
  if(!record||typeof record!=='object'||Array.isArray(record)||!['companyId','id','jobCode'].every(key=>primitiveId(record[key]))||(record.newJobCode!=null&&!primitiveId(record.newJobCode)))inventoryFailure('listing primitive identities are malformed')
  for(const key of ['jobTitle','jobUrl','careerSiteUrl','location','locAgg','city'])if(record[key]!=null&&typeof record[key]!=='string')inventoryFailure('listing text fields are malformed')
  if (!record || String(record.companyId) !== DETAIL_COMPANY_ID) inventoryFailure('employer identity changed')
  if (record.careerSiteUrl && text(record.careerSiteUrl) !== DOMAIN) inventoryFailure('portal identity changed')
  if (!Number.isSafeInteger(Number(record.id)) || Number(record.id) <= 0 || !/^\d+$/.test(text(record.jobCode)) || !text(record.jobTitle) || !/^[a-z0-9_, -]+$/i.test(text(record.jobUrl))) inventoryFailure('listing identity is malformed')
  if (record.newJobCode && String(record.newJobCode) !== String(record.jobCode)) inventoryFailure('listing job codes conflict')
  if (record.status !== 1) inventoryFailure('listing public status changed')
  return countryOf(record)
}
const verifyPage = (payload, offset, previous) => {
  assertNativeEnvelope(payload)
  const data = payload?.data
  if (!data || !Array.isArray(data.data)) inventoryFailure('response payload changed')
  assertNativeEnvelope(data)
  const total = Number(data.totalCount), size = Number(data.facetedSearchConfig?.paginationHowMuch)
  const primitiveCount = value => ['number','string'].includes(typeof value) && /^\d+$/.test(String(value))
  if (!primitiveCount(data.totalCount) || !primitiveCount(data.facetedSearchConfig?.paginationHowMuch) || !Number.isSafeInteger(total) || total < 0 || total > 10000 || !Number.isSafeInteger(size) || size < 1 || size > 100 || typeof data.hasMoreData !== 'boolean') inventoryFailure('count or paging metadata changed')
  if (previous && (total !== previous.total || size !== previous.size)) inventoryFailure('count or page size changed during traversal')
  if (data.data.length !== Math.min(size, Math.max(total - offset, 0)) || data.hasMoreData !== (offset + data.data.length < total)) inventoryFailure('page rows do not reconcile with the advertised count')
  return { records: data.data.map(record => record?._source ?? record), total, size, hasMore: data.hasMoreData }
}
const verifyDetail = (payload, listing) => {
  assertNativeEnvelope(payload)
  const detail = payload?.reponseObject ?? payload?.data ?? payload
  assertNativeEnvelope(detail)
  if(!detail||typeof detail!=='object'||Array.isArray(detail)||!['companyId','id','jobCode'].every(key=>(typeof detail[key]==='string'||typeof detail[key]==='number')&&/^\d+$/.test(String(detail[key]))))inventoryFailure('detail primitive identities are malformed')
  for(const key of ['jobTitle','jobUrl','careerSiteUrl','location'])if(detail[key]!=null&&typeof detail[key]!=='string')inventoryFailure('detail text fields are malformed')
  if (!detail || String(detail.companyId) !== DETAIL_COMPANY_ID || String(detail.id) !== String(listing.id) || String(detail.jobCode) !== String(listing.jobCode) || text(detail.jobTitle) !== text(listing.jobTitle) || text(detail.jobUrl) !== text(listing.jobUrl)) inventoryFailure('detail identity changed')
  if (detail.careerSiteUrl && text(detail.careerSiteUrl) !== DOMAIN) inventoryFailure('detail portal identity changed')
  if (detail.status !== 1) inventoryFailure('detail public status changed')
  if(detail.privateJobShare!=null&&detail.privateJobShare!=='N')inventoryFailure('detail private publication status')
  if(detail.jobVisibiltyLevel!=null&&!['N','E','L','R'].includes(detail.jobVisibiltyLevel))inventoryFailure('detail visibility unavailable')
  if ((detail.country != null || detail.jobLocationRecord != null) && !countryOf(detail)) inventoryFailure('detail country contradicts India')
  const location = text(detail.location)
  const accepted = [listing.location, listing.locAgg, ...(listing.jobLocationRecord || []).flatMap(place => [place.location, place.formattedLocation])].map(place => text(place).toLowerCase())
  if (!location || !accepted.includes(location.toLowerCase())) inventoryFailure('detail location no longer agrees with the verified India listing')
  const tail = location.split(',').pop().trim().toLowerCase()
  if (knownCountries.has(tail) && tail !== 'india' && tail !== 'in') inventoryFailure('detail location is foreign')
  if (typeof detail.jobConfigurationData?.Description !== 'string') inventoryFailure('detail description is missing')
  return detail
}
const fullListingDescription = record => {
  const description = text(record.mediumDescriptionWithoutHtml)
  return ['Normal', 'Enhanced', 'Limited', 'Recommended'].includes(record.jobVisibility)
    && description.length >= 100 && !/(?:\.\.\.|…)\s*$/.test(description)
    && description === text(record.metaDescription)
    ? extractActiveDescription(description) : null
}
const unavailableDetail = error => error?.name !== 'SyntaxError'
  && (error?.name === 'TimeoutError' || /^HTTP (?:403|429|502|503|504)\b/i.test(error?.message || ''))


const unavailableSnapshot = unavailableDetail

const firstPageSnapshot = page => JSON.stringify({ total: page.total, size: page.size, hasMore: page.hasMore, records: page.records.map(record => Object.fromEntries(['id', 'jobCode', 'newJobCode', 'companyId', 'careerSiteUrl', 'jobTitle', 'jobUrl', 'status', 'jobVisibility', 'location', 'locAgg', 'country', 'jobLocationRecord', 'referenceNumber', 'DepartmentName', 'departmentName', 'text9', 'createDate', 'createdDate', 'endtDate', 'endDate', 'experienceUIField', 'yrsOfExperience', 'mandatorySkills', 'skillSet', 'mediumDescriptionWithoutHtml', 'metaDescription', 'shortDescription'].map(key => [key, record[key] ?? null]))) })
export const createInfoEdgeScraper = ({ maxPages = DEFAULT_MAX_PAGES, maxJobs = DEFAULT_MAX_JOBS, detailConcurrency = DEFAULT_DETAIL_CONCURRENCY } = {}) => ({
  async run({ fetchJson, now = () => new Date().toISOString(), signal, requestTimeoutMs = 20000 } = {}) {
    signal?.throwIfAborted()
    const checkedAt=new Date(now()).getTime()
    if(!Number.isFinite(checkedAt))inventoryFailure('invalid check time')
    const validateDates=record=>{
      for(const field of ['createdDate','createDate'])if(record[field]!=null&&record[field]!==''){
        const date=normalizeDate(record[field]);if(Date.parse(date)>checkedAt)inventoryFailure('native posting date is future')
      }
      for(const field of ['endtDate','endDate'])if(record[field]!=null&&record[field]!=='')normalizeDate(record[field])
    }
    const requestJson = fetchJson || ((url, options) => defaultFetchJson(url, { ...options, timeoutMs: requestTimeoutMs }))
    const cancellation = signal ? { signal } : {}
    const pageLimit = Math.max(1, Math.min(500, Math.floor(Number(maxPages) || 1)))
    const jobLimit = Math.max(1, Math.min(10000, Math.floor(Number(maxJobs) || 1)))
    const indiaListings = [], seen = new Set(), seenNativeIds = new Set()
    let summary = null, initialSnapshot = null, offset = 0, pages = 0, listingComplete = false
    while (pages < pageLimit) {
      signal?.throwIfAborted()
      const payload = await requestJson(LISTING_API_URL, { method: 'POST', form: buildSearchPayload({ paginationStartNo: offset }), ...cancellation })
      signal?.throwIfAborted()
      const page = verifyPage(payload, offset, summary); summary = page; pages += 1
      if (initialSnapshot == null) initialSnapshot = firstPageSnapshot(page)
      for (const record of page.records) {
        const india = verifyListing(record), id = String(record.jobCode)
        validateDates(record)
        if (seen.has(id)) inventoryFailure('duplicate job identity prevents count reconciliation')
        const nativeId = String(Number(record.id))
        if (seenNativeIds.has(nativeId)) inventoryFailure('duplicate native job identity prevents count reconciliation')
        seenNativeIds.add(nativeId)
        seen.add(id); if (india) indiaListings.push(record)
      }
      offset += page.records.length
      if (!page.hasMore) { listingComplete = offset === page.total; break }
    }
    let detailUnavailable = false, detailsComplete = true
    const selected = indiaListings.slice(0, jobLimit)
    if (selected.length < indiaListings.length) listingComplete = false
    const results = await mapWithConcurrency(selected, Math.max(1, Math.min(6, Number(detailConcurrency) || 1)), async record => {
      const listing = mapSearchRecord(record)
      let job = null
      if (!detailUnavailable) {
        try {
          signal?.throwIfAborted()
          const payload = await requestJson(DETAIL_API_URL, { method: 'POST', json: buildDetailRequest(record), ...cancellation })
          signal?.throwIfAborted()
          validateDates(verifyDetail(payload, record)); job = extractJobDetail(payload, listing)
        } catch (error) {
          signal?.throwIfAborted()
          if (!unavailableDetail(error)) throw error
          detailUnavailable = true; detailsComplete = false
        }
      }
      if (!job) {
        detailsComplete = false
        const description = fullListingDescription(record)
        if (!description) return null
        job = { ...listing, jobDescription: description, publicExperienceChecked: false }
      }
      const detailComplete=Boolean(job.jobDescription)
      if (!detailComplete) { detailsComplete = false; job.jobDescription=null }
      const { _listingRecord, ...publicJob } = job
      return { ...publicJob, country: 'India', source: SOURCE, link: job.applyUrl || job.sourceUrl, sourceDetailComplete:detailComplete, ...(detailComplete?{}:{sourceDetailStatus:'missing-content',sourceListingComplete:false}), scrapedAt: now() }
    })
    signal?.throwIfAborted()
    const jobs = results.filter(Boolean)
    let recheckPayload, snapshotUnavailable = false
    try {
      recheckPayload = await requestJson(LISTING_API_URL, { method: 'POST', form: buildSearchPayload({ paginationStartNo: 0 }), ...cancellation })
    } catch (error) {
      signal?.throwIfAborted()
      if (!listingComplete || detailsComplete || jobs.length === 0 || !unavailableSnapshot(error)) throw error
      snapshotUnavailable = true
    }
    signal?.throwIfAborted()
    if (!snapshotUnavailable) {
      const recheck = verifyPage(recheckPayload, 0, summary)
      recheck.records.forEach(verifyListing)
      if (firstPageSnapshot(recheck) !== initialSnapshot) inventoryFailure('first-page snapshot changed after details')
    }
    const complete = !snapshotUnavailable && listingComplete && detailsComplete && jobs.length === indiaListings.length
    if (!complete) jobs.forEach(job => { job.sourceListingComplete = false })
    return attachInventoryEvidence(jobs, { status: complete ? (summary?.total ? 'complete-inventory' : 'verified-empty') : 'coverage-gap', surface: CAREERS_URL, firstParty: true, listingComplete: complete, pagesFetched: pages, reportedTotal: summary?.total, indiaFacetCount: listingComplete && !snapshotUnavailable ? indiaListings.length : null, verifiedAt: now(), reason: complete ? 'counted-publisher-listing-and-matching-native-India-details' : 'configured-limit-or-unavailable-details; publisher-full-description-subset-only' + (snapshotUnavailable ? '; final-snapshot-unavailable; fresh-counted-rows-only' : '') })
  },
})

export const run = async (options = {}) => createInfoEdgeScraper(options).run(options)

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
