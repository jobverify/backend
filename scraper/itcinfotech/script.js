import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'
export const OFFICIAL_CAREERS_URL = 'https://jobs.itcinfotech.com/itcinfotech/jobslist'
export const LISTING_API_URL = 'https://public.zwayam.com/jobs/search'
export const DETAIL_API_URL = 'https://public.zwayam.com/jobs-service/v1/jobs/careersite'

const COMPANY_NAME = 'ITC Infotech'
const SOURCE = 'itcinfotech'
const COMPANY_ID = '15154'
const PORTAL_DOMAIN = 'jobs.itcinfotech.com'
const DETAIL_BASE_URL = OFFICIAL_CAREERS_URL.replace(/\/jobslist$/, '')
const DEFAULT_MAX_PAGES = 500
const DEFAULT_MAX_JOBS = 10000
const DEFAULT_DETAIL_CONCURRENCY = 3

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeText = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeText(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const splitCsv = (value) => normalizeText(value)
  ?.split(',')
  .map((part) => normalizeText(part))
  .filter(Boolean) || []

const unwrapSearchRecord = (record = {}) => record?._source ?? record

const unwrapDetailPayload = (payload = {}) => payload?.reponseObject ?? payload?.data ?? payload

const normalizeDate = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized
  return parsed.toISOString().slice(0, 10)
}

const extractCity = (record = {}) => {
  const directCity = normalizeText(record?.jobLocationRecord?.[0]?.city || record?.city)
  if (directCity) return directCity

  const location = normalizeText(record?.location || record?.locAgg)
  if (!location) return null
  return normalizeText(location.split(',')[0])
}

export const buildListingRequest = (paginationStartNo = 0) => ({
  filterCri: JSON.stringify({
    paginationStartNo: Math.max(0, Number(paginationStartNo) || 0),
    selectedCall: 'sort',
    sortCriteria: {
      name: 'modifiedDate',
      isAscending: false,
    },
    anyOfTheseWords: '',
  }),
  domain: PORTAL_DOMAIN,
  companyId: 'MTUxNTQ=',
})

export const buildDetailRequest = (record = {}) => ({
  jobUrl: normalizeText(record?.jobUrl),
  externalSource: 'CareerSite',
  campusUrl: 'empty',
  companyId: COMPANY_ID,
})

export const buildJobDetailUrl = (jobUrl, jobId) => {
  const normalizedJobUrl = normalizeText(jobUrl)
  const normalizedJobId = normalizeText(jobId)
  if (!normalizedJobUrl || !normalizedJobId) return null

  return `${DETAIL_BASE_URL}/jobview/${encodeURIComponent(normalizedJobUrl)}?id=${encodeURIComponent(normalizedJobId)}`
}

export const transformItcInfotechJob = (listingRecord = {}, detailPayload = null) => {
  const detailRecord = unwrapDetailPayload(detailPayload || {})
  const title = normalizeText(detailRecord?.jobTitle || listingRecord?.jobTitle)
  const jobId = normalizeText(
    detailRecord?.jobCode
      || detailRecord?.jobId
      || listingRecord?.jobCode
      || listingRecord?.jobId,
  )
  const jobUrl = normalizeText(detailRecord?.jobUrl || listingRecord?.jobUrl)
  const location = normalizeText(
    detailRecord?.location
      || detailRecord?.locAgg
      || listingRecord?.location
      || listingRecord?.locAgg,
  )
  const link = buildJobDetailUrl(jobUrl, detailRecord?.id || listingRecord?.id || jobId)

  return {
    title,
    company: COMPANY_NAME,
    department: normalizeText(
      detailRecord?.department?.departmentName
        || detailRecord?.departmentName
        || listingRecord?.department?.departmentName
        || listingRecord?.departmentName,
    ),
    location,
    city: extractCity({
      ...listingRecord,
      ...detailRecord,
      location,
    }),
    jobId,
    requisitionId: normalizeText(
      detailRecord?.referenceNumber
        || detailRecord?.refNumber
        || listingRecord?.referenceNumber
        || listingRecord?.refNumber,
    ),
    sourceUrl: link,
    applyUrl: link,
    employmentType: normalizeText(
      detailRecord?.employmentType
        || detailRecord?.jobType
        || detailRecord?.jobConfigurationData?.['Employment Type'],
    ),
    experienceRequired: normalizeText(
      detailRecord?.yrsOfExperience
        || detailRecord?.experienceUIField
        || listingRecord?.experienceUIField
        || listingRecord?.yrsOfExperience,
    ),
    minimumQualification: normalizeText(
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
      detailRecord?.jobConfigurationData?.['Posted On']
        || detailRecord?.createDate
        || listingRecord?.createDate,
    ),
    closingDate: normalizeDate(detailRecord?.endtDate || detailRecord?.endDate),
    jobDescription: stripHtml(
      detailRecord?.jobConfigurationData?.Description
        || detailRecord?.longDescription
        || detailRecord?.shortDescription
        || listingRecord?.shortDescription,
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

  const timeout = AbortSignal.timeout(Math.max(1, Math.min(20000, Number(options.timeoutMs) || 20000)))
  request.signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
  const response = await fetch(url, request)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}


const ISO_COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const knownCountries = new Set(ISO_COUNTRY_CODES.flatMap(code => [code.toLowerCase(), regionNames.of(code).toLowerCase()]))
const inventoryFailure = (message) => { throw new Error('ITC Infotech Zwayam inventory ' + message) }
const text = value => String(value ?? '').trim().replace(/\s+/g, ' ')
const countryOf = record => {
  const locations = record.jobLocationRecord || []
  if (!Array.isArray(locations)) inventoryFailure('country locations are malformed')
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
  if (!record || String(record.companyId) !== COMPANY_ID) inventoryFailure('employer identity changed')
  if (record.careerSiteUrl && text(record.careerSiteUrl) !== PORTAL_DOMAIN) inventoryFailure('portal identity changed')
  if (!Number.isSafeInteger(Number(record.id)) || Number(record.id) <= 0 || !/^\d+$/.test(text(record.jobCode)) || !text(record.jobTitle) || !/^[a-z0-9_-]+$/i.test(text(record.jobUrl))) inventoryFailure('listing identity is malformed')
  if (record.newJobCode && String(record.newJobCode) !== String(record.jobCode)) inventoryFailure('listing job codes conflict')
  if (record.status !== 1) inventoryFailure('listing public status changed')
  return countryOf(record)
}
const verifyPage = (payload, offset, previous) => {
  const data = payload?.data
  if (!data || !Array.isArray(data.data)) inventoryFailure('response payload changed')
  const total = Number(data.totalCount), size = Number(data.facetedSearchConfig?.paginationHowMuch)
  if (data.totalCount == null || !/^\d+$/.test(String(data.totalCount)) || !Number.isSafeInteger(total) || total < 0 || total > 10000 || !Number.isSafeInteger(size) || size < 1 || size > 100 || typeof data.hasMoreData !== 'boolean') inventoryFailure('count or paging metadata changed')
  if (previous && (total !== previous.total || size !== previous.size)) inventoryFailure('count or page size changed during traversal')
  if (data.data.length !== Math.min(size, Math.max(total - offset, 0)) || data.hasMoreData !== (offset + data.data.length < total)) inventoryFailure('page rows do not reconcile with the advertised count')
  return { records: data.data.map(record => record?._source ?? record), total, size, hasMore: data.hasMoreData }
}
const verifyDetail = (payload, listing) => {
  const detail = payload?.reponseObject ?? payload?.data ?? payload
  if (!detail || String(detail.companyId) !== COMPANY_ID || String(detail.id) !== String(listing.id) || String(detail.jobCode) !== String(listing.jobCode) || text(detail.jobTitle) !== text(listing.jobTitle) || text(detail.jobUrl) !== text(listing.jobUrl)) inventoryFailure('detail identity changed')
  if (detail.careerSiteUrl && text(detail.careerSiteUrl) !== PORTAL_DOMAIN) inventoryFailure('detail portal identity changed')
  if (detail.status !== 1) inventoryFailure('detail public status changed')
  if ((detail.country != null || detail.jobLocationRecord != null) && !countryOf(detail)) inventoryFailure('detail country contradicts India')
  const location = text(detail.location)
  const accepted = [listing.location, listing.locAgg, ...(listing.jobLocationRecord || []).flatMap(place => [place.location, place.formattedLocation])].map(place => text(place).toLowerCase())
  if (!location || (!/\bindia\b/i.test(location) && !accepted.includes(location.toLowerCase()))) inventoryFailure('detail location no longer agrees with the verified India listing')
  const tail = location.split(',').pop().trim().toLowerCase()
  if (knownCountries.has(tail) && tail !== 'india' && tail !== 'in') inventoryFailure('detail location is foreign')
  if (typeof detail.jobConfigurationData?.Description !== 'string' || !text(detail.jobConfigurationData.Description)) inventoryFailure('detail description is missing')
  return detail
}
const fullListingDescription = record => {
  const description = text(record.mediumDescriptionWithoutHtml)
  return ['Normal', 'Enhanced', 'Limited', 'Recommended'].includes(record.jobVisibility)
    && description.length >= 100 && !/(?:\.\.\.|…)\s*$/.test(description)
    && description === text(record.metaDescription)
    ? description : null
}
const unavailableDetail = error => error?.name === 'TimeoutError' || (error?.name === 'Error' && /^HTTP (?:403|429|502|503|504)\b/.test(error.message || ''))


const firstPageSnapshot = page => JSON.stringify({ total: page.total, size: page.size, hasMore: page.hasMore, records: page.records.map(record => Object.fromEntries(['id', 'jobCode', 'newJobCode', 'companyId', 'careerSiteUrl', 'jobTitle', 'jobUrl', 'status', 'jobVisibility', 'location', 'locAgg', 'country', 'jobLocationRecord', 'referenceNumber', 'DepartmentName', 'departmentName', 'text9', 'createDate', 'createdDate', 'endtDate', 'endDate', 'experienceUIField', 'yrsOfExperience', 'mandatorySkills', 'skillSet', 'mediumDescriptionWithoutHtml', 'metaDescription', 'shortDescription'].map(key => [key, record[key] ?? null]))) })
export const createItcInfotechScraper = ({ maxPages = DEFAULT_MAX_PAGES, maxJobs = DEFAULT_MAX_JOBS, detailConcurrency = DEFAULT_DETAIL_CONCURRENCY } = {}) => ({
  async run({ fetchJson, now = () => new Date().toISOString(), signal, requestTimeoutMs = 20000 } = {}) {
    signal?.throwIfAborted()
    const requestJson = fetchJson || ((url, options) => defaultFetchJson(url, { ...options, timeoutMs: requestTimeoutMs }))
    const cancellation = signal ? { signal } : {}
    const pageLimit = Math.max(1, Math.min(500, Math.floor(Number(maxPages) || 1)))
    const jobLimit = Math.max(1, Math.min(10000, Math.floor(Number(maxJobs) || 1)))
    const indiaListings = [], seen = new Set(), seenNativeIds = new Set()
    let summary = null, initialSnapshot = null, offset = 0, pages = 0, listingComplete = false
    while (pages < pageLimit) {
      signal?.throwIfAborted()
      const payload = await requestJson(LISTING_API_URL, { method: 'POST', form: buildListingRequest(offset), ...cancellation })
      signal?.throwIfAborted()
      const page = verifyPage(payload, offset, summary); summary = page; pages += 1
      if (initialSnapshot == null) initialSnapshot = firstPageSnapshot(page)
      for (const record of page.records) {
        const india = verifyListing(record), id = String(record.jobCode)
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
      const listing = transformItcInfotechJob(record)
      let job = null
      if (!detailUnavailable) {
        try {
          signal?.throwIfAborted()
          const payload = await requestJson(DETAIL_API_URL, { method: 'POST', json: buildDetailRequest(record), ...cancellation })
          signal?.throwIfAborted()
          verifyDetail(payload, record); job = { ...transformItcInfotechJob(record, payload), publicExperienceChecked: true }
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
      if (!job.jobDescription || /^(?:jd|tbd|n\/a|na)$/i.test(text(job.jobDescription))) { detailsComplete = false; return null }
      const { _listingRecord, ...publicJob } = job
      return { ...publicJob, country: 'India', source: SOURCE, link: job.applyUrl || job.sourceUrl, scrapedAt: now() }
    })
    const jobs = results.filter(Boolean)
    let snapshotUnavailable = false, recheckPayload
    signal?.throwIfAborted()
    try {
      recheckPayload = await requestJson(LISTING_API_URL, { method: 'POST', form: buildListingRequest(0), ...cancellation })
    } catch (error) {
      signal?.throwIfAborted()
      const transportUnavailable = error?.name === 'TimeoutError'
        || (error?.name === 'Error' && /^HTTP (?:403|429|502|503|504)\b/.test(error.message || ''))
      if (!listingComplete || detailsComplete || jobs.length === 0 || !transportUnavailable) throw error
      snapshotUnavailable = true
    }
    signal?.throwIfAborted()
    if (!snapshotUnavailable) {
      const recheck = verifyPage(recheckPayload, 0, summary)
      recheck.records.forEach(verifyListing)
      if (firstPageSnapshot(recheck) !== initialSnapshot) inventoryFailure('first-page snapshot changed after details')
    }
    const complete = listingComplete && detailsComplete && !snapshotUnavailable && jobs.length === indiaListings.length
    if (!complete) jobs.forEach(job => { job.sourceListingComplete = false })
    return attachInventoryEvidence(jobs, { status: complete ? (jobs.length ? 'complete-inventory' : 'verified-empty') : 'coverage-gap', surface: OFFICIAL_CAREERS_URL, firstParty: true, listingComplete: complete, pagesFetched: pages, reportedTotal: summary?.total, indiaFacetCount: listingComplete && !snapshotUnavailable ? indiaListings.length : null, verifiedAt: now(), reason: snapshotUnavailable ? 'final-snapshot-unavailable; fully-counted-current-listing retained as incomplete native-description subset' : complete ? 'counted-publisher-listing-and-matching-native-India-details' : 'configured-limit-or-unavailable-details; publisher-full-description-subset-only' })
  },
})

export const run = (options = {}) => createItcInfotechScraper(options).run(options)
