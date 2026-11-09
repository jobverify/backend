import { attachInventoryEvidence } from './inventoryEvidence.js'
import { nativeCountryName, nativeLocationCountryName } from '../shared/nativeJobPosting.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { readNativeWithSignal } from './nativePagination.js'
import { mapWithConcurrency } from './mapWithConcurrency.js'

const changed = (source, message) => Object.assign(new Error(`[${source}] Oracle inventory changed: ${message}`), {
  softFailure: true, upstreamOutage: false, failureKind: 'upstream_inventory_changed',
})
const contract = (source, message) => Object.assign(new Error(`[${source}] Oracle native contract changed: ${message}`), {
  softFailure: true, upstreamOutage: false, failureKind: 'upstream_contract_changed',
})

const nativeLocations = record => {
  const locations = [{ code: record.PrimaryLocationCountry, label: record.PrimaryLocation }]
  locations.push(...(Array.isArray(record.secondaryLocations) ? record.secondaryLocations : [])
    .map(location => ({ code: location?.CountryCode, label: location?.Name || location?.LocationName })))
  return locations
}
const resolvedCountry = location => nativeCountryName(location.code) || nativeLocationCountryName(location.label)
const countryScope = (record, source) => {
  if (record.secondaryLocations != null && !Array.isArray(record.secondaryLocations)) return false
  const locations = nativeLocations(record)
  return locations.map(location => {
    const code = nativeCountryName(location.code), label = nativeLocationCountryName(location.label)
    if (code && label && code !== label) throw contract(source, 'conflicting native location countries')
    return Boolean(code || label)
  }).every(Boolean)
}

// API collectors must follow the native inventory, rather than inheriting a
// browser UI page cap or treating country-filtered rows as the raw page size.
export const collectOracleRequisitionJobs = async ({
  source, siteNumber, buildSearchUrl, buildJobDetailApiUrl, extractSearchResults, extractJobDetail,
  fetchJson, maxPages = Infinity, maxJobs = null, signal, detailConcurrency = 1,
  isNativeRoleId = value => /^\d{1,32}$/.test(String(value ?? '')),
}) => {
  if (!(maxPages === Infinity || Number.isSafeInteger(maxPages) && maxPages > 0)) throw new RangeError('maxPages must be a positive integer or Infinity')
  if (maxJobs != null && !(Number.isSafeInteger(maxJobs) && maxJobs > 0)) throw new RangeError('maxJobs must be a positive integer or null')
  if (!Number.isSafeInteger(detailConcurrency) || detailConcurrency < 1 || detailConcurrency > 10) throw new RangeError('detailConcurrency must be an integer from 1 to 10')
  const read = async (url, requestSignal = signal) => {
    try {
      return await readNativeWithSignal(() => fetchJson(url, { signal: requestSignal }), requestSignal)
    } catch (error) {
      signal?.throwIfAborted()
      requestSignal?.throwIfAborted()
      throw error
    }
  }
  const enumerate = async () => {
    const records = [], ids = new Set()
    let total = null, pages = 0, exhausted = false, scopeComplete = true
    for (let page = 0; page < maxPages; page++) {
      const offset = page * 24, payload = await read(buildSearchUrl({ page }))
      if (!Array.isArray(payload?.items) || payload.items.length !== 1) throw contract(source, 'missing native inventory envelope')
      const collection = payload.items[0]
      if (!Array.isArray(collection?.requisitionList) || !Number.isSafeInteger(collection.TotalJobsCount)
        || collection.TotalJobsCount < 0 || collection.TotalJobsCount > 100000
        || collection.Limit !== 24 || collection.Offset != null && collection.Offset !== offset
        || collection.SiteNumber != null && collection.SiteNumber !== siteNumber) throw contract(source, 'invalid native site, total, limit or offset')
      if (total === null) total = collection.TotalJobsCount
      if (collection.TotalJobsCount !== total) throw changed(source, 'native total changed during pagination')
      const rows = collection.requisitionList
      if (rows.length > Math.min(24, total - offset)) throw contract(source, 'native page exceeds the requested range')
      pages++
      for (const record of rows) {
        if (!record || !isNativeRoleId(record.Id) || typeof record.Title !== 'string' || !record.Title.trim()) throw contract(source, 'invalid native role identity')
        const id = String(record.Id)
        if (ids.has(id)) throw changed(source, 'duplicate or overlapping native role identity')
        ids.add(id)
        if (!countryScope(record, source)) scopeComplete = false
        records.push(record)
      }
      // A native page can be short while later offsets still contain jobs.
      // Follow the API offsets and retain the count discrepancy for the result.
      if (offset + 24 >= total) { exhausted = true; break }
    }
    return { records, total, pages, exhausted, complete: exhausted && records.length === total, scopeComplete }
  }

  const opening = await enumerate()
  const listings = extractSearchResults({ items: [{ requisitionList: opening.records }] })
  const limited = maxJobs != null && listings.length > maxJobs
  const selected = limited ? listings.slice(0, maxJobs) : listings
  const rawById = new Map(opening.records.map(record => [String(record.Id), record]))
  const detailController = new AbortController()
  const detailSignal = detailConcurrency === 1 ? signal : signal
    ? AbortSignal.any([signal, detailController.signal]) : detailController.signal
  const jobs = await mapWithConcurrency(selected, detailConcurrency, async listing => {
    try {
      let payload
      try {
        payload = await read(buildJobDetailApiUrl(listing.jobId), detailSignal)
      } catch (error) {
        signal?.throwIfAborted()
        detailSignal?.throwIfAborted()
        return { ...listing, sourceDetailComplete: false, sourceDetailFailureKind: 'upstream' }
      }
      const detail = Array.isArray(payload?.items) ? payload.items.length === 1 ? payload.items[0] : null : payload
      if (!detail || String(detail.Id) !== String(listing.jobId)
        || typeof detail.Title !== 'string' || !detail.Title.trim()) throw contract(source, 'listing/detail role identity does not match')
      const job = extractJobDetail(payload, listing)
      if (job.title !== listing.title) throw contract(source, 'listing/detail role title does not match')
      const detailScopeComplete = countryScope(detail, source)
      const raw = rawById.get(String(listing.jobId))
      const openingCountry = resolvedCountry(nativeLocations(raw)[0]), detailCountry = resolvedCountry(nativeLocations(detail)[0])
      if (openingCountry && detailCountry && openingCountry !== detailCountry) throw contract(source, 'listing/detail role countries conflict')
      const detailIndia = nativeLocations(detail).some(location => resolvedCountry(location) === 'India')
      if (detailScopeComplete && !detailIndia) throw contract(source, 'listing/detail India worksite countries conflict')
      const hasBody = job.sourceDetailComplete !== false && hasSourceDescription({ sourceDescription:
        [detail.ExternalDescriptionStr, detail.ExternalResponsibilitiesStr, detail.ExternalQualificationsStr]
          .filter(value => typeof value === 'string').join('\n') })
      const detailComplete = hasBody && detailScopeComplete && detailIndia
      return { ...job, sourceDetailComplete: detailComplete,
        ...(!detailComplete ? { sourceDetailFailureKind: !hasBody ? 'missing-content' : 'native-location-scope-unresolved' } : {}) }
    } catch (error) {
      // A fatal identity/scope error owns the hydration cohort: settle active
      // readers and stop queued workers before the caller releases transport.
      detailController.abort(error)
      throw error
    }
  })

  let pagesFetched = opening.pages
  if (opening.exhausted && !limited) {
    const closing = await enumerate()
    pagesFetched += closing.pages
    if (!closing.exhausted || closing.total !== opening.total
      || JSON.stringify(opening.records) !== JSON.stringify(closing.records)) throw changed(source, 'closing inventory changed after detail hydration')
  }
  const complete = opening.complete && opening.scopeComplete && !limited
  const detailsComplete = jobs.every(job => job.sourceDetailComplete)
  for (const job of jobs) Object.assign(job, {
    source, sourceListingComplete: complete, sourceScopeComplete: complete,
    lifecycleCleanupAllowed: complete && detailsComplete,
    link: job.applyUrl || job.sourceUrl, scrapedAt: new Date().toISOString(),
  })
  // A foreign-only location query is retained as an observation, not a claim
  // that every India hiring surface has been exhaustively checked.
  return attachInventoryEvidence(jobs, {
    status: complete && jobs.length ? 'complete-inventory' : 'discovery-only',
    surface: buildSearchUrl(), firstParty: true, listingComplete: complete && jobs.length > 0,
    pagesFetched, reportedTotal: opening.total, indiaFacetCount: complete ? listings.length : null,
    verifiedAt: new Date().toISOString(), reason: !opening.exhausted ? 'native-page-limit-reached'
      : !opening.complete ? 'native-inventory-count-unreconciled'
      : limited ? 'native-job-limit-reached' : !opening.scopeComplete ? 'native-location-scope-unresolved'
        : !jobs.length ? 'no-qualified-india-roles-on-native-query' : 'native-api-inventory-exhausted-and-reconciled',
  })
}
