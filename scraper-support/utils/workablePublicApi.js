import { attachInventoryEvidence } from './inventoryEvidence.js'
import { extractActiveDescription } from './activeNativeHtml.js'
import { buildHttpError } from './fetch.js'

const text = value => typeof value === 'string' ? value.trim() : ''
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const shortRegionNames = new Intl.DisplayNames(['en'], { type: 'region', style: 'short' })
const fail = message => { throw Object.assign(new Error('Workable public inventory ' + message), {
  name: 'WorkableInventoryContractError', failureKind: 'parser_or_contract_error', abortRetries: true,
}) }
const inventoryChanged = message => { throw Object.assign(new Error('Workable public inventory ' + message), {
  name: 'WorkableInventoryChangedError', failureKind: 'upstream_inventory_changed', softFailure: true,
  upstreamOutage: false,
}) }
const assertNativePayload = payload => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.success === false
    || payload.error || (Array.isArray(payload.errors) ? payload.errors.length : payload.errors)
    || (payload.status != null && ![200, 'ok', 'success'].includes(payload.status))) fail('upstream error response')
}
const nativePublication = (value, currentTime) => {
  if (value == null || value === '') return null
  if (typeof value !== 'string') fail('publication timestamp is malformed')
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/)
  if (!match) fail('publication timestamp is malformed')
  const [year, month, day, hour = 0, minute = 0, second = 0] = match.slice(1).map(part => part == null ? undefined : Number(part))
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const timestamp = Date.parse(value)
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59
    || !Number.isFinite(timestamp) || timestamp > currentTime) fail('publication timestamp is impossible or future')
  return new Date(timestamp).toISOString()
}

const defaultFetchJson = async (url, options = {}) => {
  const callerSignal = options.signal
  callerSignal?.throwIfAborted()
  const signal = callerSignal
    ? AbortSignal.any([callerSignal, AbortSignal.timeout(30000)])
    : AbortSignal.timeout(30000)
  let response
  try {
    signal.throwIfAborted()
    response = await fetch(url, { ...options, signal, redirect: 'follow', headers: {
      Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
      ...options.headers,
    } })
    callerSignal?.throwIfAborted()
    signal.throwIfAborted()
    if (response.status !== 200 || response.url !== url) {
      try { await response.body?.cancel?.() } catch {}
      if (response.status !== 200) throw buildHttpError(response, url)
      fail('HTTP status or redirect identity changed for ' + url)
    }
    const payload = await response.json()
    callerSignal?.throwIfAborted()
    signal.throwIfAborted()
    return payload
  } catch (error) {
    if (callerSignal?.aborted || signal.aborted) {
      // Keep abort disposal owned until settlement; caller reasons stay opaque.
      try { await response?.body?.cancel?.() } catch {}
      callerSignal?.throwIfAborted()
      signal.throwIfAborted()
    }
    throw error
  }
}

const locationKey = location => [location.countryCode, location.city, location.region].map(value => text(value).toLowerCase()).join('|')

const validateLocation = location => {
  if (!location || typeof location !== 'object' || Array.isArray(location)
    || typeof location.countryCode !== 'string' || !/^[A-Z]{2}$/.test(location.countryCode) || !text(location.country)
    || /^(?:unknown|global|anywhere|worldwide|remote|multiple)$/i.test(location.country)
    || ['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(location.countryCode) || regionNames.of(location.countryCode) === location.countryCode
    || ![regionNames.of(location.countryCode), shortRegionNames.of(location.countryCode)]
      .some(name => name.toLowerCase() === text(location.country).toLowerCase())
    || ((location.countryCode === 'IN') !== /^india$/i.test(location.country))) fail('country/location scope is missing or contradictory')
  for (const key of ['city', 'region']) {
    if (location[key] != null && typeof location[key] !== 'string') fail('location fields are malformed')
  }
  return { city: text(location.city), region: text(location.region), country: text(location.country), countryCode: location.countryCode }
}

const validateRecord = (record, accountUid, currentTime) => {
  if (!record || !Number.isSafeInteger(record.id) || record.id < 1
    || !/^[A-Z0-9]{6,32}$/.test(record.shortcode || '') || !text(record.title)
    || record.accountUid !== accountUid || record.state !== 'published' || record.isInternal !== false
    || record.approvalStatus !== 'approved') fail('public record identity, account or state changed')
  nativePublication(record.published, currentTime)
  if (!Array.isArray(record.locations) || !record.locations.length) fail('explicit location list is missing')
  const primary = validateLocation(record.location)
  const locations = record.locations.map(validateLocation)
  if (!locations.some(location => locationKey(location) === locationKey(primary))) fail('primary location disagrees with the explicit location list')
  return [...new Map(locations.map(location => [locationKey(location), location])).values()]
}

export const mapWorkablePublicDetail = (record, detail, locations, config, scrapedAt) => {
  assertNativePayload(detail)
  const currentTime = Date.parse(scrapedAt)
  const detailLocations = validateRecord(detail, config.accountUid, currentTime)
  const listingPublished = nativePublication(record.published, currentTime), detailPublished = nativePublication(detail.published, currentTime)
  if (listingPublished && detailPublished && listingPublished !== detailPublished) inventoryChanged('detail publication timestamp changed during enumeration')
  if (detail.id !== record.id || detail.shortcode !== record.shortcode || text(detail.title) !== text(record.title)
    || locations.map(locationKey).sort().join('\n') !== detailLocations.map(locationKey).sort().join('\n')) inventoryChanged('detail identity or location changed during enumeration')
  const requiredSections = config.requiredContentSections || ['description', 'requirements', 'benefits']
  const sections = ['description', 'requirements', 'benefits'].map(key => {
    const raw = detail[key]
    if (raw != null && typeof raw !== 'string') fail('detail employer content section is malformed: ' + key)
    const content = typeof raw === 'string' ? extractActiveDescription(raw) || '' : ''
    if (requiredSections.includes(key) && !content) fail('detail employer content section is missing: ' + key)
    return content
  })
  const sourceDescription = sections[0] + (sections[1] ? '\n\nRequirements\n' + sections[1] : '')
    + (sections[2] ? '\n\nBenefits\n' + sections[2] : '')
  const indiaLocations = detailLocations.filter(location => location.countryCode === 'IN')
  if (!indiaLocations.length) fail('India detail no longer has an explicit India location')
  const locationLabels = indiaLocations.map(location => [...new Set([location.city, location.region, 'India'].filter(Boolean))].join(', '))
  const cities = [...new Set(indiaLocations.map(location => location.city).filter(Boolean))]
  const sourceUrl = `https://apply.workable.com/${config.tenant}/j/${record.shortcode}/`
  const applyUrl = sourceUrl + 'apply/'
  return {
    title: text(detail.title), company: config.company, source: config.source,
    jobId: record.shortcode, requisitionId: record.shortcode,
    sourceUrl, applyUrl, link: applyUrl,
    location: locationLabels.join(' / '), locations: locationLabels,
    city: cities.length === 1 ? cities[0] : null, country: 'India',
    department: Array.isArray(detail.department) ? detail.department.map(text).filter(Boolean).join(' / ') || null : text(detail.department) || null,
    remoteStatus: detail.remote === true || detail.workplace === 'remote' ? 'Remote' : detail.workplace === 'hybrid' ? 'Hybrid' : detail.workplace === 'on_site' ? 'On-site' : null,
    employmentType: null, postingDate: detailPublished || listingPublished, closingDate: null,
    jobDescription: sourceDescription, sourceDescription, requiredSkills: [],
    experienceRequired: null, minimumQualification: null, preferredQualification: null,
    companyCareerPage: config.careersUrl, companyDomain: config.companyDomain,
    atsPlatform: 'workable-native-api', scrapedAt,
  }
}

export const createWorkablePublicApiScraper = config => ({
  async run({ fetchJson = defaultFetchJson, signal, now = () => new Date().toISOString(), maxPages = 1000, maxJobs = 0 } = {}) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(config?.tenant || '') || !text(config.source) || !text(config.company)
      || !text(config.accountUid) || config.boardIdentityVerified !== true) fail('requires a verified tenant/account binding')
    if (!Number.isSafeInteger(maxPages) || maxPages < 1 || !Number.isSafeInteger(maxJobs) || maxJobs < 0) fail('pagination/output limit configuration is invalid')
    if (config.requiredContentSections != null && (!Array.isArray(config.requiredContentSections)
      || !config.requiredContentSections.includes('description')
      || new Set(config.requiredContentSections).size !== config.requiredContentSections.length
      || config.requiredContentSections.some(key => !['description', 'requirements', 'benefits'].includes(key)))) fail('invalid employer content policy')
    const scrapedAt = now(), currentTime = Date.parse(scrapedAt)
    if (typeof scrapedAt !== 'string' || !Number.isFinite(currentTime)) fail('invalid check time')
    const url = `https://apply.workable.com/api/v3/accounts/${config.tenant}/jobs`
    const records = [], ids = new Set(), shortcodes = new Set(), cursors = new Set()
    let total = null, pagesFetched = 0, token
    do {
      signal?.throwIfAborted()
      if (pagesFetched >= maxPages) fail('pagination limit would leave an incomplete inventory')
      const body = { query: '', location: [], department: [], worktype: [], remote: [], ...(token === undefined ? {} : { token }) }
      const payload = await fetchJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
      pagesFetched++
      assertNativePayload(payload)
      if (!payload || payload.error || payload.errors || payload.success === false
        || !Array.isArray(payload.results) || !Number.isSafeInteger(payload.total) || payload.total < 0) fail('response contract or authoritative total is inconsistent')
      if (total !== null && payload.total !== total) inventoryChanged('authoritative total changed during enumeration')
      total = payload.total
      for (const record of payload.results) {
        const locations = validateRecord(record, config.accountUid, currentTime)
        if (ids.has(record.id) || shortcodes.has(record.shortcode)) fail('contains a duplicate job identity')
        ids.add(record.id); shortcodes.add(record.shortcode)
        records.push({ record, locations })
      }
      if (records.length > total) fail('record count exceeds the authoritative total')
      if (Object.hasOwn(payload, 'nextPage')) {
        if (!text(payload.nextPage) || typeof payload.nextPage !== 'string' || cursors.has(payload.nextPage)) fail('cursor is malformed or repeats a previous cursor')
        // Workable can emit a final cursor when the last nonempty page reaches
        // the exact total. Follow it and require a cursorless terminal response;
        // the total and duplicate checks still reject any additional records.
        if (!payload.results.length) fail('cursor contradicts the authoritative record count')
        cursors.add(payload.nextPage)
        token = payload.nextPage
      } else token = undefined
    } while (token !== undefined)
    if (records.length !== total) fail('terminal page leaves an incomplete inventory count')
    const india = records.filter(({ locations }) => locations.some(location => location.countryCode === 'IN'))
    const jobs = []
    for (const { record, locations } of india) {
      signal?.throwIfAborted()
      const detail = await fetchJson(`https://apply.workable.com/api/v2/accounts/${config.tenant}/jobs/${record.shortcode}`, { signal })
      if (!detail) fail('India detail is missing')
      jobs.push(mapWorkablePublicDetail(record, detail, locations, config, scrapedAt))
    }
    signal?.throwIfAborted()
    const selected = maxJobs > 0 ? jobs.slice(0, maxJobs) : jobs
    const limited = selected.length !== jobs.length
    selected.forEach(job => { job.sourceListingComplete = !limited })
    return attachInventoryEvidence(selected, {
      status: limited ? 'discovery-only' : total === 0 ? 'verified-empty' : 'complete-inventory',
      surface: url, firstParty: true, listingComplete: !limited,
      pagesFetched, reportedTotal: total, indiaFacetCount: india.length, verifiedAt: now(),
      reason: `Counted unfiltered Workable cursor inventory; observedRecords=${records.length}; validatedIndiaDetails=${jobs.length}; returnedJobs=${selected.length}; terminal cursor omitted.${limited ? ' Output cap preserves incomplete lifecycle markers.' : ''}`,
    })
  },
})
