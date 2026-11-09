import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const CAREERS_PAGE_URL = 'https://dtici.daimlertruck.com/career/'
export const SEARCH_API_URL = 'https://global-jobboard-api-jobsearch.daimlertruck.com/search/'
export const DTICI_PARENT_ORGANIZATION_ID = '366989'
export const DTICI_COMPANY_ORGANIZATION_ID = '4068'
export const ORGANIZATIONS_LOOKUP_URL = 'https://global-jobboard-api-jobsearch.daimlertruck.com/lookup/parentorganization/lang/EN'
const DTICI_ORGANIZATION_IDS = [DTICI_PARENT_ORGANIZATION_ID, DTICI_COMPANY_ORGANIZATION_ID]
const OFFICIAL_EMPLOYER = 'Daimler Truck Innovation Center India Private Limited'

const COMPANY_NAME = 'Daimler Truck Innovation Center India (DTICI)'
const SOURCE = 'daimlertruckinnovationcenterindia'

const requestedFields = [
  'PositionTitle',
  'PositionURI',
  'PositionLocation',
  'PositionLocation.CountryCode',
  'PositionLocation.CountryName',
  'PositionLocation.CityName',
  'PositionFormattedDescription',
  'PositionID',
  'PublicationStartDate',
  'PositionSchedule',
  'ParentOrganization',
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const decodeHtmlEntities = value => String(value ?? '').replace(/&(lt|gt|amp|quot|apos|nbsp);|&#(\d+);|&#x([0-9a-f]+);/gi, (match, named, decimal, hex) => {
  if (named) return {lt:'<',gt:'>',amp:'&',quot:'"',apos:"'",nbsp:' '}[named.toLowerCase()]
  const code = Number.parseInt(decimal || hex, decimal ? 10 : 16)
  return code <= 0x10ffff ? String.fromCodePoint(code) : match
})

const normalizeDescription = (value) => normalizeWhitespace(decodeHtmlEntities(value)
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')) || null

const getDescriptor = (entry) => entry?.MatchedObjectDescriptor || entry || {}

const getLocation = (descriptor) => descriptor.PositionLocation?.[0] || {}

const getApplyUrl = (descriptor) => descriptor.PositionURI
  ? new URL(descriptor.PositionURI, 'https://jobsearch.daimlertruck.com/').href
  : null

const getEmploymentType = (descriptor) => {
  const schedule = descriptor.PositionSchedule?.map((item) => item?.Name).join(' ') || ''
  if (/intern|praktik|ausbildung|apprentice|trainee/i.test(schedule)) return 'Internship'
  if (/teilzeit|part.?time/i.test(schedule)) return 'Part-time'
  if (/contract|befrist/i.test(schedule)) return 'Contract'
  return 'Full-time'
}

export const buildSearchRequest = (firstItem = 1) => ({
  LanguageCode: 'EN',
  SearchParameters: {
    FirstItem: firstItem,
    CountItem: 100,
    Sort: [{ Criterion: 'PublicationStartDate', Direction: 'DESC' }],
    MatchedObjectDescriptor: requestedFields,
  },
  SearchCriteria: [{
    CriterionName: 'ParentOrganization',
    CriterionValue: DTICI_ORGANIZATION_IDS,
  }],
})

export const normalizeJob = (entry, scrapedAt) => {
  const descriptor = getDescriptor(entry)
  if (!DTICI_ORGANIZATION_IDS.includes(String(descriptor.ParentOrganization))) return null

  const jobId = String(descriptor.PositionID || descriptor.ID || entry?.MatchedObjectId || '')
  const title = normalizeWhitespace(descriptor.PositionTitle)
  if (!jobId || !title) return null

  const location = getLocation(descriptor)
  if (String(location.CountryCode).toUpperCase() !== 'IN' && !/^(India|Indien)$/i.test(location.CountryName || '')) return null
  const city = normalizeWhitespace(location.CityName) || null
  const applyUrl = getApplyUrl(descriptor)

  return {
    title,
    company: COMPANY_NAME,
    department: null,
    location: city ? `${city}, India` : 'India',
    city,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: CAREERS_PAGE_URL,
    applyUrl,
    employmentType: getEmploymentType(descriptor),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: descriptor.PublicationStartDate || null,
    closingDate: descriptor.PublicationEndDate || null,
    jobDescription: normalizeDescription(descriptor.PositionFormattedDescription),
    attachmentUrl: null,
    source: SOURCE,
    link: applyUrl || CAREERS_PAGE_URL,
    scrapedAt,
  }
}

const requestHeaders = {Accept:'application/json', 'User-Agent':'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)'}
const requestSignal = signal => signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000)
const defaultFetchJson = async (url, options) => {
  const response = await fetch(url, {...options, signal:requestSignal(options?.signal)})
  if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status} for ${url}`), {status:response.status})
  return response.json()
}
const defaultFetchText = async (url, options) => {
  const response = await fetch(url, {...options, signal:requestSignal(options?.signal)})
  if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status} for ${url}`), {status:response.status})
  return response.text()
}

const validateOrganizations = payload => {
  if (payload?.lookup?.tablename !== 'parentorganization' || !Array.isArray(payload.lookup.items)) throw new Error('DTICI public organization lookup payload changed')
  for (const id of DTICI_ORGANIZATION_IDS) {
    const records = payload.lookup.items.filter(item => String(item.id) === id)
    const expected = id === DTICI_PARENT_ORGANIZATION_ID ? 'Bengaluru, '+OFFICIAL_EMPLOYER : OFFICIAL_EMPLOYER
    if (records.length !== 1 || records[0].label !== expected) throw new Error('DTICI public organization identity changed')
  }
}

const validateInventory = (payload, total) => {
  const result = payload?.SearchResult
  if (!result || !Array.isArray(result.SearchResultItems)
    || !Number.isInteger(result.SearchResultCountAll) || result.SearchResultCountAll < 0
    || result.SearchResultCount !== result.SearchResultItems.length
    || result.UserArea?.ExecutionError !== 0
    || (total !== null && total !== result.SearchResultCountAll)
    || result.SearchResultItems.length > result.SearchResultCountAll) throw new Error('DTICI public inventory payload is malformed, errored or inconsistent')
  return result
}

const trustedDetailUrl = entry => {
  const url = new URL(getApplyUrl(getDescriptor(entry)))
  const id = String(entry.MatchedObjectId || getDescriptor(entry).ID || '')
  if (url.protocol !== 'https:' || url.hostname !== 'jobsearch.daimlertruck.com'
    || url.username || url.password || !/^\/+index\.php$/.test(url.pathname)
    || url.searchParams.get('ac') !== 'jobad' || !/^\d+$/.test(id) || url.searchParams.get('id') !== id) throw new Error('DTICI listing detail URL does not match its trusted identity')
  return url.href
}

const enrichFromDetail = (entry, html) => {
  let posting
  for (const match of String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed
    try {parsed = JSON.parse(match[1])} catch {throw new Error('DTICI detail JobPosting payload is malformed')}
    const candidates = Array.isArray(parsed) ? parsed : [parsed]
    for (const item of candidates) if (item?.['@type'] === 'JobPosting') {
      if (posting) throw new Error('DTICI detail has ambiguous job identity')
      posting = item
    }
  }
  const descriptor = getDescriptor(entry)
  if (!posting || posting.hiringOrganization?.name !== OFFICIAL_EMPLOYER
    || posting.identifier?.name !== OFFICIAL_EMPLOYER
    || String(posting.identifier.value) !== String(descriptor.PositionID)
    || normalizeWhitespace(posting.title) !== normalizeWhitespace(descriptor.PositionTitle)
    || !normalizeDescription(posting.description) || !Array.isArray(posting.jobLocation) || !posting.jobLocation.length
    || posting.jobLocation.some(place => !place.address?.addressCountry || !place.address?.addressLocality)) throw new Error('DTICI official detail employer, job identity, description or location changed')
  return {...entry, MatchedObjectDescriptor:{...descriptor,
    PositionLocation:posting.jobLocation.map(place => ({CityName:place.address.addressLocality, CountryCode:place.address.addressCountry})),
    PositionFormattedDescription:posting.description, PublicationEndDate:posting.validThrough || null,
  }}
}

export const createDaimlerTruckInnovationCenterIndiaScraper = (options = {}) => ({
  async run(runtime = {}) {
    const settings = {...options,...runtime}
    const fetchJson = settings.fetchJson || defaultFetchJson
    const fetchText = settings.fetchText || defaultFetchText
    const signal = settings.signal
    const now = settings.now || (() => new Date().toISOString())
    signal?.throwIfAborted()
    validateOrganizations(await fetchJson(ORGANIZATIONS_LOOKUP_URL, {method:'GET',headers:requestHeaders,signal}))
    const jobs = []
    const seen = new Set()
    let total = null
    let firstItem = 1
    let pagesFetched = 0
    do {
      signal?.throwIfAborted()
      const query = new URLSearchParams({data:JSON.stringify(buildSearchRequest(firstItem))})
      const result = validateInventory(await fetchJson(SEARCH_API_URL+'?'+query, {method:'GET',headers:requestHeaders,signal}),total)
      total = result.SearchResultCountAll
      pagesFetched += 1
      if (!result.SearchResultItems.length && seen.size < total) throw new Error('DTICI inventory is incomplete before its reported total')
      for (let entry of result.SearchResultItems) {
        const descriptor = getDescriptor(entry)
        const id = String(entry.MatchedObjectId || descriptor.ID || '')
        if (!id || seen.has(id) || !descriptor.PositionID || !normalizeWhitespace(descriptor.PositionTitle)
          || !DTICI_ORGANIZATION_IDS.includes(String(descriptor.ParentOrganization))) throw new Error('DTICI duplicate or foreign organization job identity')
        seen.add(id)
        const detailUrl = trustedDetailUrl(entry)
        const location = getLocation(descriptor)
        let enriched = false
        if (!normalizeDescription(descriptor.PositionFormattedDescription) || (!location.CountryCode && !location.CountryName)) {
          entry = enrichFromDetail(entry, await fetchText(detailUrl, {signal}))
          enriched = true
        }
        const job = normalizeJob(entry,now())
        if (job) jobs.push({...job,...(enriched?{sourceUrl:detailUrl}:{})})
      }
      firstItem += result.SearchResultItems.length
    } while (seen.size < total)
    if (seen.size !== total) throw new Error('DTICI inventory contradicts its reported total')
    return attachInventoryEvidence(jobs, {status:total === 0?'verified-empty':'complete-inventory',
      surface:SEARCH_API_URL,firstParty:true,listingComplete:true,pagesFetched,reportedTotal:total,indiaFacetCount:jobs.length,verifiedAt:now(),
      reason:'Verified native GET search for exact DTICI city and legal-company organizations with complete inventory and India detail identity',
    })
  },
})

export const run = async (options = {}) => createDaimlerTruckInnovationCenterIndiaScraper().run(options)
