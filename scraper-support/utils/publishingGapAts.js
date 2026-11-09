import { runApiPortalScraper } from '../apiPortal/engine.js'
import { expandApiPortalProviderTemplate } from '../providers/apiPortalTemplates.js'
import { extractAshbyJobs } from './ashbyApi.js'
import { fetchJsonWithRetry } from './fetch.js'
import { filterIndiaJobs } from './indiaLocationFilter.js'
import { attachInventoryEvidence, readInventoryEvidence, isFreshCompleteInventoryEvidence, mapJobsWithInventoryEvidence } from './inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { greenhouseLocationLabels, greenhouseLocationSegments, greenhouseCountryLabels, hasUnhandledGreenhouseGeography, selectGreenhouseLocation, NATIVE_INDIA_LOCATION } from './greenhouseLocations.js'
import { selectLeverLocation, selectLeverCountry } from './leverLocations.js'
import { greenhouseUsWorksiteScope } from './greenhouseWorksiteCountry.js'
import { identifyPublicAtsBoard } from './publicAtsIdentity.js'
import { reconcileGreenhouseOfficeCountries, greenhouseOfficeCountryForRole, withGreenhouseOfficeCountries, greenhouseOfficeProofReason } from './greenhouseOfficeCountry.js'
import { isGreenhouseProspectPost, greenhouseProspectPostIds, withGreenhousePostingKind, excludeGreenhouseProspects, greenhouseProspectReason } from './greenhouseProspects.js'
import { decodeNativeEntities } from './activeNativeHtml.js'

// Generic remote work is not evidence that an employer accepts applicants in India.
const INDIA_LOCATION = NATIVE_INDIA_LOCATION
const TALENT_POOL = /talent (community|network|pool)|speculative|future opportunities|general application/i
// apiPortal's country defaults to the provider filter; only source location text proves eligibility.
const indiaLocation = (job) => INDIA_LOCATION.test([job.location, job.city].filter(Boolean).join(' '))
const httpUrl = (value) => { try { return ['https:', 'http:'].includes(new URL(value).protocol) } catch { return false } }
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const countryNames = new Map()
const foreignCountryLabels = new Set(['United States of America', 'USA', 'U.S.A.', 'US', 'UK', 'UAE', 'GBR', 'SGP'])
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = regionNames.of(code)
  if (name && name !== code && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)) {
    countryNames.set(code.toLowerCase(), code)
    countryNames.set(name.toLowerCase(), code)
    if (code !== 'IN') foreignCountryLabels.add(name)
  }
}
for (const [name, code] of Object.entries({ IND: 'IN', USA: 'US', 'United States of America': 'US', GBR: 'GB', UK: 'GB', SGP: 'SG', CAN: 'CA', AUS: 'AU' })) countryNames.set(name.toLowerCase(), code)
const nativeCountry = value => typeof value === 'string' ? countryNames.get(value.trim().toLowerCase()) || null : null
const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const foreignCountryPattern = new RegExp(`(?:^|[^\\p{L}])(?:${[...foreignCountryLabels].sort((a, b) => b.length - a.length).map(escapePattern).join('|')})(?=$|[^\\p{L}])`, 'iu')
const nativeText = value => typeof value === 'string' && value.trim().length > 0
const GLOBAL_LOCATION = /\b(?:worldwide|global|anywhere|any\s+location|all\s+locations|APAC|EMEA|AMER|LATAM|Asia[- ]Pacific)\b/i
const unresolvedLocationSegment = (label, country) => {
  const parts = String(label || '').split(/\s*(?:[;|/+&\n]|\s+(?:or|and)\s+)\s*/i).filter(Boolean)
  return !parts.length ? !country : parts.some(part => GLOBAL_LOCATION.test(part)
    // A native postal country scopes this location object, including a label
    // with several cities. Separate secondary locations retain their own scope.
    || (!INDIA_LOCATION.test(part) && !foreignCountryPattern.test(part) && !country))
}
export const validatePublicPostingScope = (records, kind, provider, { countryProofs = null, officeCountryScope,
  officeCountryProofs = null } = {}) => {
  const reasons = new Set()
  const officeScope = kind === 'greenhouse' ? officeCountryScope || reconcileGreenhouseOfficeCountries(records, provider) : null
  if (officeCountryProofs && officeScope) officeCountryProofs.push(...officeScope.proofs)
  const fail = reason => { throw new Error(`[${provider.source}] Invalid ${kind} inventory: ${reason}`) }
  for (const record of records) {
    if (kind === 'greenhouse' && isGreenhouseProspectPost(record)) continue
    if (record?.isListed === false || TALENT_POOL.test(record?.title || record?.text || '')) continue
    if (kind === 'greenhouse') {
      let postingUrl
      try { postingUrl = new URL(record?.absolute_url) } catch { fail('invalid native application URL') }
      if (postingUrl.username || postingUrl.password) fail('invalid native posting authority')
      const postingBoard = identifyPublicAtsBoard(postingUrl.href)
      if (postingBoard && (postingBoard.atsPlatform !== kind || postingBoard.boardToken !== provider.boardToken)) fail('foreign native posting account')
      if (postingBoard?.atsPlatform === kind) {
        if (postingUrl.searchParams.getAll('for').some(account => account !== provider.boardToken)) fail('foreign native posting account')
        const pathId = postingUrl.pathname.match(/\/jobs\/(\d+)\/?$/)?.[1]
        const suppliedIds = [...(pathId == null ? [] : [pathId]), ...postingUrl.searchParams.getAll('token')]
        if (suppliedIds.some(id => id !== String(record.id))) fail('native posting identity mismatch')
      }
      if (postingUrl.searchParams.getAll('gh_jid').some(id => id !== String(record.id))) fail('native posting query identity mismatch')
    }
    if (kind === 'lever') {
      if (typeof record?.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,255}$/i.test(record.id)) fail('missing native role identity')
      for (const [field, suffix] of [['hostedUrl', ''], ['applyUrl', '/apply']]) {
        let url
        try { url = new URL(record[field]) } catch { fail('invalid native role URL identity') }
        if (url.origin !== `https://jobs.${provider.leverRegion === 'eu' ? 'eu.' : ''}lever.co` || url.username || url.password
          || url.pathname.replace(/\/+$/, '') !== `/${encodeURIComponent(provider.boardToken)}/${record.id}${suffix}`) {
          fail('foreign board or native role URL identity')
        }
      }
    }
    const primary = kind === 'greenhouse' ? record?.location?.name : record?.categories?.location
    if (kind === 'greenhouse' && hasUnhandledGreenhouseGeography(record)) reasons.add('native-location-scope-unresolved')
    const greenhouseCountries = kind === 'greenhouse' ? [...new Set(greenhouseCountryLabels(record))] : []
    const countryValue = kind === 'lever' ? record?.country : greenhouseCountries.length === 1 ? greenhouseCountries[0] : null
    if (countryValue != null && typeof countryValue !== 'string') fail('invalid native country')
    const country = nativeCountry(countryValue)
    const worksite = kind === 'greenhouse' && !country ? greenhouseUsWorksiteScope(record, provider) : null
    if (worksite && countryProofs) countryProofs.push(worksite.proof)
    const mappingRecord = kind === 'greenhouse' ? withGreenhouseOfficeCountries(record, provider, officeScope) : record
    const officeLabels = new Map()
    for (const office of Array.isArray(record?.offices) ? record.offices : []) {
      const entry = greenhouseOfficeCountryForRole(record, office, provider, officeScope)
      if (entry) officeLabels.set(office.name.trim(), entry.country)
    }
    const mappedLocation = kind === 'greenhouse' ? selectGreenhouseLocation(mappingRecord) : selectLeverLocation(record)
    const primaryIndia = (typeof mappedLocation === 'string' && INDIA_LOCATION.test(mappedLocation))
      || (kind === 'lever' && selectLeverCountry(record) === 'India')
    const candidates = kind === 'greenhouse' ? greenhouseLocationLabels(record).map(label => ({ label,
      country: country || (worksite?.locations.includes(label) ? worksite.country : null) || officeLabels.get(label),
    })) : [{ label: primary, country }]
    if (!candidates.length) candidates.push({ label: null })
    if (kind === 'lever' && record?.categories?.allLocations != null) {
      if (!Array.isArray(record.categories.allLocations)) fail('invalid native location inventory')
      candidates.push(...record.categories.allLocations.filter(label => label !== primary).map(label => ({ label })))
    }
    if (kind === 'greenhouse' && record?.offices != null) {
      if (!Array.isArray(record.offices)) fail('invalid native office inventory')
      for (const office of record.offices) {
        if (!office || typeof office !== 'object' || Array.isArray(office)
          || (office.name != null && typeof office.name !== 'string')
          || (office.location != null && typeof office.location !== 'string')) fail('invalid native office')
        const officeLabel = office?.location || office?.name
        const entry = greenhouseOfficeCountryForRole(record, office, provider, officeScope)
        candidates.push(...(officeLabel ? greenhouseLocationSegments(officeLabel).map(label => ({ label, country: entry?.country })) : [{ label: officeLabel }]))
        // A descriptive office name need not repeat its explicit address. But
        // alternate India/global evidence in that name must remain visible.
        if (office?.location && typeof office.name === 'string'
          && (INDIA_LOCATION.test(office.name) || GLOBAL_LOCATION.test(office.name))) candidates.push({ label: office.name })
      }
    }
    if (nativeText(countryValue) && !country) reasons.add('native-location-scope-unresolved')
    for (const candidate of candidates) {
      if (candidate.label != null && typeof candidate.label !== 'string') fail('invalid native location')
      const india = INDIA_LOCATION.test(candidate.label || '')
      const foreign = foreignCountryPattern.test(candidate.label || '')
      if ((india && foreign) || (candidate.country && candidate.country !== 'IN' && india)
        || (candidate.country === 'IN' && foreign)) fail('contradictory country/location')
      if (unresolvedLocationSegment(candidate.label, candidate.country)) {
        reasons.add('native-location-scope-unresolved')
      }
      // The current mapper selects the primary location. Native India metadata
      // or additional offices must not disappear into an authoritative zero.
      if (!primaryIndia && (india || candidate.country === 'IN')) reasons.add('native-india-location-unmapped')
    }
  }
  return [...reasons]
}
export const publicAtsInventoryError = payload => payload && !Array.isArray(payload) && (payload.success === false || payload.ok === false
  || payload.hasError === true || payload.failed === true || Boolean(payload.error)
  || (Array.isArray(payload.errors) ? payload.errors.length > 0 : Boolean(payload.errors))
  || /^(?:error|failed|failure|unavailable)$/i.test(String(payload.status || ''))
  || (Number.isFinite(Number(payload.status)) && Number(payload.status) >= 400)
  || (Number.isFinite(Number(payload.statusCode)) && Number(payload.statusCode) >= 400))
const validateAshbyInventory = (payload, records, provider) => {
  const fail = reason => { throw new Error(`[${provider.source}] Invalid ashby inventory: ${reason}`) }
  if (payload.apiVersion != null && payload.apiVersion !== '1') fail('unsupported native schema')
  const reasons = payload.apiVersion === '1' ? [] : ['native-api-version-unavailable']
  const identities = new Set()
  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record) || typeof record.isListed !== 'boolean') fail('unknown active status')
    if (!nativeText(record.id) || !/^[a-z0-9][a-z0-9._-]{0,255}$/i.test(record.id) || identities.has(record.id)) fail('missing or repeated native identity')
    identities.add(record.id)
    if (!record.isListed) continue
    if (!nativeText(record.title)) fail('missing title')
    for (const [field, suffix] of [['jobUrl', ''], ['applyUrl', '/application']]) {
      if (!nativeText(record[field])) fail('non-string application identity')
      let url
      try { url = new URL(record[field]) } catch { fail('invalid application identity') }
      if (url.origin !== 'https://jobs.ashbyhq.com' || url.username || url.password || url.search || url.hash
        || url.pathname !== `/${encodeURIComponent(provider.boardToken)}/${encodeURIComponent(record.id)}${suffix}`) fail('foreign board or role identity')
    }
    for (const field of ['descriptionHtml', 'descriptionPlain']) {
      if (record[field] != null && typeof record[field] !== 'string') fail('non-string native content')
    }
    if (record.secondaryLocations != null && !Array.isArray(record.secondaryLocations)) fail('invalid secondary location inventory')
    const candidates = [{ location: record.location, address: record.address }, ...(record.secondaryLocations || [])]
    let unknownScope = false
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)
        || (candidate.location != null && typeof candidate.location !== 'string')
        || (candidate.address != null && (typeof candidate.address !== 'object' || Array.isArray(candidate.address)))) fail('invalid native location')
      if (candidate.address?.postalAddress != null && (typeof candidate.address.postalAddress !== 'object'
        || Array.isArray(candidate.address.postalAddress))) fail('invalid postal location')
      const address = candidate.address?.postalAddress || candidate.address || {}
      if (typeof address !== 'object' || Array.isArray(address)) fail('invalid postal location')
      for (const field of ['addressCountry', 'addressLocality', 'addressRegion']) {
        if (address[field] != null && typeof address[field] !== 'string') fail('non-string native location')
      }
      const country = nativeCountry(address.addressCountry)
      const labelIndia = INDIA_LOCATION.test(candidate.location || '')
      const labelForeign = foreignCountryPattern.test(candidate.location || '')
      if (country && country !== 'IN' && labelIndia) fail('contradictory country/location')
      if ((country === 'IN' || labelIndia) && labelForeign) fail('contradictory country/location')
      if (country === 'IN' && nativeText(candidate.location)
        && !filterIndiaJobs([{ country: 'India', location: candidate.location }]).length) fail('contradictory country/location')
      // Missing countries are documented by Ashby. Retain unknown scope instead
      // of certifying a globally remote or unrecognized label as zero India.
      if (unresolvedLocationSegment(candidate.location, country) || (nativeText(address.addressCountry) && !country)) unknownScope = true
    }
    if (unknownScope) reasons.push('native-location-scope-unresolved')
  }
  return [...new Set(reasons)]
}

export const createPublishingGapAtsScraper = (provider) => ({
  async run({ fetchJson = (url, options) => fetchJsonWithRetry(url, { ...options, timeoutMs: 20000, label: provider.source }), signal } = {}) {
    signal?.throwIfAborted()
    const kind = provider.atsPlatform
    if (!['greenhouse', 'ashby', 'lever'].includes(kind)) throw new Error(`Unsupported ATS: ${kind}`)
    const token = encodeURIComponent(provider.boardToken)
    const url = kind === 'greenhouse'
      ? `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`
      : kind === 'ashby'
        ? `https://api.ashbyhq.com/posting-api/job-board/${token}`
        : `https://api.${provider.leverRegion === 'eu' ? 'eu.' : ''}lever.co/v0/postings/${token}?mode=json`
    const payload = await fetchJson(url, { signal })
    signal?.throwIfAborted()
    if (publicAtsInventoryError(payload)) throw new Error(`[${provider.source}] Failed ${kind} inventory envelope`)
    const records = kind === 'lever' ? payload : payload?.jobs
    if (!Array.isArray(records)) throw new Error(`[${provider.source}] Invalid ${kind} inventory`)
    if (kind === 'greenhouse') {
      const identities = new Set()
      for (const record of records) {
        if (record?.id == null) continue
        const id = String(record.id)
        if (identities.has(id)) throw new Error(`[${provider.source}] Invalid greenhouse inventory: duplicate native identity`)
        identities.add(id)
      }
    }
    const reported = payload?.meta?.total ?? payload?.total ?? null
    if (payload?.hasMore === true || (reported != null && Number(reported) !== records.length)) {
      throw new Error(`[${provider.source}] Incomplete ${kind} inventory`)
    }
    const prospectIds = kind === 'greenhouse' ? greenhouseProspectPostIds(records, provider) : []
    const countryProofs = [], officeCountryProofs = []
    const officeCountryScope = kind === 'greenhouse' ? reconcileGreenhouseOfficeCountries(records, provider) : null
    const nativeReasons = kind === 'ashby' ? validateAshbyInventory(payload, records, provider)
      : validatePublicPostingScope(records, kind, provider, { countryProofs, officeCountryScope, officeCountryProofs })
    const active = records.filter((record) => record?.isListed !== false)
    if (active.some((record) => !record?.id || !(record.title || record.text))) {
      throw new Error(`[${provider.source}] Malformed ${kind} inventory record`)
    }
    if (active.some((record) => !httpUrl(kind === 'greenhouse' ? record.absolute_url : record.applyUrl))) {
      throw new Error(`[${provider.source}] Invalid ${kind} application URL`)
    }
    let mapped
    if (kind === 'ashby') {
      const nativeById = new Map(records.map(record => [record.id, record]))
      mapped = extractAshbyJobs({ payload, companyName: provider.companyName }).map(job => {
        const native = nativeById.get(job.jobId)
        const description = hasSourceDescription({ sourceDescription: native.descriptionHtml })
          ? native.descriptionHtml : native.descriptionPlain || null
        return { ...job, jobDescription: description, sourceDescription: description }
      })
    } else {
      const config = expandApiPortalProviderTemplate({ ...provider, template: kind, templateOptions: { boardToken: provider.boardToken, region: provider.leverRegion } })
      // Greenhouse updated_at is an edit timestamp, not the original posting date.
      if (kind === 'greenhouse') config.config.mapping.postingDate = 'first_published'
      if (kind === 'greenhouse') config.config.mapping.location = { strategy: 'greenhouse-location' }
      if (kind === 'greenhouse') excludeGreenhouseProspects(config)
      const mappingPayload = kind === 'greenhouse' ? { ...payload,
        jobs: records.map(record => withGreenhousePostingKind(withGreenhouseOfficeCountries(record, provider, officeCountryScope))),
      } : payload
      mapped = await runApiPortalScraper({ provider: config, fetchJson: async () => mappingPayload })
      if (kind === 'greenhouse') {
        const nativeById = new Map(records.map(record => [String(record.id), record]))
        mapped = mapJobsWithInventoryEvidence(mapped, job => {
          const native = nativeById.get(String(job.jobId))
          const raw = native?.content
          if (typeof raw !== 'string') return { ...job, nativeDescriptionRaw: raw ?? null,
            nativeSourceRecord: native ? structuredClone(native) : null }
          // The public API commonly wraps HTML in one entity-encoding layer.
          // Existing HTML must keep its inner literal entities (e.g. examples).
          const alreadyHTML = /<\/?[a-z][a-z\d:-]*(?:\s[^<>]*|\/?)>/i.test(raw)
          const encodedHTML = /(?:&lt;|&#0*60;|&#x0*3c;)\/?[a-z][a-z\d:-]*(?:\s|&gt;|&#0*62;|&#x0*3e;)/i.test(raw)
          const description = !alreadyHTML && encodedHTML ? decodeNativeEntities(raw) : raw
          return { ...job, sourceDescription: description, jobDescription: description,
            nativeDescriptionHTML: description, nativeDescriptionRaw: raw, nativeSourceRecord: structuredClone(native) }
        })
      }
    }
    signal?.throwIfAborted()
    const located = filterIndiaJobs(mapped).filter(job => indiaLocation(job)
      || (['ashby', 'lever'].includes(kind) && /^(?:india|in|ind)$/i.test(job.country || '')))
    const jobs = located.filter((job) => !TALENT_POOL.test(job.title)).map((job) => ({
      ...job,
      ...(kind === 'greenhouse' && /^india$/i.test(job.city || '') ? { city: getValidIndiaCityForJob({ ...job, city: null }) } : {}),
      source: provider.source,
      company: provider.companyName,
      link: job.applyUrl,
      postingDate: job.postingDate || null,
      scrapedAt: new Date().toISOString(),
    }))
    const innerEvidence = readInventoryEvidence(mapped)
    const incompleteReasons = [...nativeReasons]
    if (provider.sourceScopeComplete === false) incompleteReasons.push('provider-source-scope-unresolved')
    // Ashby's helper only maps the validated complete single response. The API
    // portal engine additionally owns Greenhouse/Lever pagination and details;
    // its evidence and lifecycle guards cannot be promoted by this wrapper.
    if (kind !== 'ashby' && !isFreshCompleteInventoryEvidence(innerEvidence)) {
      incompleteReasons.push(innerEvidence?.reason || 'inner-inventory-evidence-unavailable')
    }
    if (mapped.some(job => job.sourceListingComplete === false)) incompleteReasons.push('inner-source-listing-incomplete')
    if (jobs.some(job => !hasSourceDescription(job))) incompleteReasons.push('selected-role-description-unavailable')
    const listingComplete = incompleteReasons.length === 0
    if (!listingComplete) for (const job of jobs) job.sourceListingComplete = false
    if (provider.sourceScopeComplete === false) for (const job of jobs) {
      job.sourceScopeComplete = false
      job.lifecycleCleanupAllowed = false
    }
    return attachInventoryEvidence(jobs, {
      status: listingComplete ? records.length === 0 ? 'verified-empty' : 'complete-inventory' : 'discovery-only',
      surface: url,
      firstParty: kind === 'ashby' || innerEvidence?.firstParty === true,
      listingComplete,
      pagesFetched: innerEvidence?.pagesFetched ?? 1,
      reportedTotal: innerEvidence?.reportedTotal ?? (kind === 'greenhouse' ? null : records.length),
      indiaFacetCount: nativeReasons.some(reason => /location-scope-unresolved|location-unmapped/.test(reason)) ? null : located.length,
      verifiedAt: new Date().toISOString(),
      reason: (listingComplete ? `${kind}-public-posting-api-complete-single-response`
        : `${kind}-public-posting-api-incomplete:${incompleteReasons.join(';')}`)
        + (countryProofs.length ? `:native-worksite-country-verified:${countryProofs.map(proof => `${proof.jobId}=${proof.country}@${proof.sha256}`).join(',')}` : '')
        + greenhouseOfficeProofReason(officeCountryProofs) + greenhouseProspectReason(prospectIds),
      // The proof identifies source records and office IDs without replacing
      // the original native response or claiming a new publisher country field.
    })
  },
})
