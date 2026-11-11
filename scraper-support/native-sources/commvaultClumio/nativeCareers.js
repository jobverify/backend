import { createPublicIO } from '../publicIO.js'
import { boundedDeclaredPublicGet } from '../boundedDeclaredPublicGet.js'
import { nativeEnvelopeFailed } from '../declaredGreenhouse/nativeCareers.js'
import { requireNative, nativeJSON, postURI, criteria, officeIndex } from '../declaredGreenhouse/nativeData.js'
import { text } from '../cisVeeam/publishedData.js'
import { attachInventoryEvidence } from '../../utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../utils/sourceObservationEvidence.js'
import { PROFILE as profile, primaryModel, ownRole, combinedGeography, combinedFields } from './nativeData.js'

// Own observer promises before choosing caller cancellation over callback errors.
const checkedObserver = (start, signal) => new Promise((resolve, reject) => {
  let settled = false
  const finish = (failed, value) => {
    if (settled) return
    settled = true;signal?.removeEventListener('abort', abort)
    if (signal?.aborted) reject(signal.reason)
    else if (failed) reject(value)
    else resolve(value)
  }
  const abort = () => finish(true, signal.reason)
  signal?.addEventListener('abort', abort, { once: true })
  Promise.resolve().then(() => { signal?.throwIfAborted();return start() }).then(value => finish(false, value), error => finish(true, error))
  if (signal?.aborted) abort()
})

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const hostStarts = new Map()
const waitForHost = async (url, signal) => {
  const host = new URL(url).hostname, start = Math.max(Date.now(), hostStarts.get(host) || 0);hostStarts.set(host, start + 500)
  if (start > Date.now()) await new Promise((resolve, reject) => {
    const aborted = () => { clearTimeout(timer);signal?.removeEventListener('abort', aborted);reject(signal.reason || Error('Public GET aborted')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', aborted);resolve() }, start - Date.now())
    signal?.addEventListener('abort', aborted, { once: true });if (signal?.aborted) aborted()
  })
  signal?.throwIfAborted()
}
const parallel = async (ids, visit, signal) => {
  let next = 0
  const settled = await Promise.allSettled(Array.from({ length: 4 }, async () => {
    while (next < ids.length) { signal?.throwIfAborted();await visit(ids[next++]) }
  }))
  const failure = settled.find(r => r.status === 'rejected');if (failure) throw failure.reason
}
const identity = job => [job.jobId, job.internalJobId, job.requisitionId, job.title, job.company, job.sourceUrl, job.applyUrl]
export const createCommvaultClumioScraper = (defaults = {}) => ({ name: profile.source, async run(passed = {}) {
  const options = { ...defaults, ...passed }, { signal, maxJobs = null, onAudit = () => {}, onRecords = () => {}, now = () => new Date().toISOString() } = options
  signal?.throwIfAborted()
  requireNative(maxJobs === null || Number.isSafeInteger(maxJobs) && maxJobs >= 0, 'maxJobs must be a nonnegative safe integer or null')
  requireNative(!(options.fetchText || options.fetchJson) || options.fetchPage || options.fetchImpl, 'Parsed/text-only injection has no original HTTP provenance')
  let observedAt
  try { signal?.throwIfAborted();observedAt = now() } finally { signal?.throwIfAborted() }
  requireNative(typeof observedAt === 'string' && Number.isFinite(Date.parse(observedAt)), 'Invalid observation clock')
  const base = profile.publicAPIBase, feedURL = base + '/jobs?content=true', officesURL = base + '/offices', ownURL = id => base + '/jobs/' + id + '?pay_transparency=true'
  const allowedURLs = new Set([profile.primaryURL, base, feedURL, officesURL]), held = new Set()
  const allowed = url => allowedURLs.has(url.href) && !held.has(url.hostname)
  const originalFetch = options.fetchImpl || globalThis.fetch
  const fetchPage = options.fetchPage || (async url => {
    await waitForHost(url, signal);requireNative(allowed(new URL(url)), 'public host became unavailable while queued')
    return boundedDeclaredPublicGet(url, { fetchImpl: originalFetch,
      signal: AbortSignal.any([AbortSignal.timeout(15000), ...(signal ? [signal] : [])]),
      overflowError: Error('Declared Greenhouse: native entity exceeds input limit') })
  })
  const io = createPublicIO({ ...options, fetchPage, allowed }), observations = new Map(), order = new Map(), history = []
  const load = async url => { const page = await io.load(url, { fresh: true });if ([401, 403, 429].includes(page?.status)) held.add(new URL(url).hostname);return page }
  const original = page => page?.usable && page.transportQualified && page.bodyBase64 && typeof page.originalText === 'string'
  const readJSON = async (url, result, label) => {
    const page = await load(url)
    try { const value = nativeJSON(page);requireNative(!nativeEnvelopeFailed(value), label + ' error envelope');return value }
    catch (error) { signal?.throwIfAborted();result.issues.push(error.message);return null }
  }
  const collect = async phase => {
    const result = { phase, publisherQualified: false, nativeListingComplete: false, nativeOfficeHierarchyQualified: false, qualified: false,
      nativePostIds: [], issues: [], originalFirstPartyFeed: null, originalFirstPartyLinks: [], originalNativeBoard: null, originalNativeOffices: null, originalNativeFeed: null }
    let corporate = [], links = new Map(), declared = false
    const page = await load(profile.primaryURL)
    try {
      requireNative(original(page), 'corporate careers original transport unavailable')
      const model = primaryModel(page.originalText);corporate = model.records;links = model.links;declared = true
    } catch (error) { signal?.throwIfAborted();result.issues.push(error.message) }
    result.originalFirstPartyFeed = structuredClone(corporate);result.originalFirstPartyLinks = [...links].map(([id, url]) => ({ id, url }))
    result.originalNativeBoard = await readJSON(base, result, 'native board')
    result.originalNativeOffices = await readJSON(officesURL, result, 'native offices')
    result.originalNativeFeed = await readJSON(feedURL, result, 'native posts')
    result.publisherQualified = declared && result.originalNativeBoard?.name === profile.publisherName
    const payload = result.originalNativeFeed, records = Array.isArray(payload?.jobs) ? payload.jobs : [], supplied = new Map(), inline = new Map()
    for (const row of records) {
      if (!Number.isSafeInteger(row?.id) || row.id <= 0) { result.issues.push('Malformed native listing identity; original retained');continue }
      const id = String(row.id);if (!supplied.has(id)) supplied.set(id, []);supplied.get(id).push(row)
    }
    for (const row of corporate) {
      const id = String(row?.job_id)
      if (!/^[1-9]\d*$/.test(id)) { result.issues.push('Malformed corporate listing identity; original retained');continue }
      if (!inline.has(id)) inline.set(id, []);inline.get(id).push(row)
    }
    let index = { nodes: new Map(), posts: new Map() }
    try { index = officeIndex(result.originalNativeOffices);result.nativeOfficeHierarchyQualified = true } catch (error) { result.issues.push(error.message) }
    const ids = [...new Set([...supplied.keys(), ...inline.keys(), ...links.keys(), ...[...index.posts.keys()].map(String)])]
    result.nativePostIds = ids;result.reportedNativePostCount = payload?.meta?.total ?? null
    const noPagination = [payload, payload?.meta].every(value => value && (value.hasMore == null || value.hasMore === false)
      && ['next', 'nextPage', 'nextCursor'].every(key => value[key] == null))
    result.nativeListingComplete = declared && Array.isArray(payload?.jobs) && Number.isSafeInteger(payload.meta?.total) && payload.meta.total === records.length
      && records.length === supplied.size && corporate.length === inline.size && noPagination && ids.length === supplied.size
      && ids.every(id => supplied.get(id)?.length === 1 && inline.get(id)?.length === 1 && links.has(id))
    result.qualified = result.publisherQualified && result.nativeListingComplete && result.nativeOfficeHierarchyQualified
    for (const id of ids) { allowedURLs.add(ownURL(id));if (links.has(id)) allowedURLs.add(links.get(id));if (!order.has(id)) order.set(id, order.size) }
    await parallel(ids, async id => {
      const listing = supplied.get(id)?.[0] ?? null, first = inline.get(id)?.[0] ?? null
      const job = { source: profile.source, company: profile.publisherName, jobId: id, title: text(listing?.title || first?.title),
        internalJobId: listing?.internal_job_id ?? first?.internal_job_id ?? null, requisitionId: listing?.requisition_id ?? first?.requisition_id ?? null,
        sourceUrl: links.get(id) ?? null, applyUrl: listing?.absolute_url ?? null, jobDescription: null,
        country: null, city: null, state: null, location: null, locations: [], sourceCountryScopeUnresolved: true, sourceNativeCountryConflict: false,
        sourceCurrentNativePostingIdentityQualified: false, sourceCurrentNativeRoleQualified: false, sourceNativeDetailQualified: false, sourceBrandScopeQualified: false,
        sourceNativePhase: phase, sourceNativeIssues: [], sourceFirstPartyListingRecord: structuredClone(first), sourceNativeListingRecord: structuredClone(listing),
        sourceNativeListingConflicts: structuredClone((supplied.get(id) || []).length > 1 ? supplied.get(id) : []),
        sourceFirstPartyListingConflicts: structuredClone((inline.get(id) || []).length > 1 ? inline.get(id) : []),
        sourceScopeComplete: false, sourceDetailComplete: false, lifecycleCleanupAllowed: false }
      const response = await load(ownURL(id))
      let native = null, role = null, nativeQualified = false
      try {
        native = nativeJSON(response);job.sourceNativeRecord = structuredClone(native);job.sourceNativeOwnBodySHA256 = response.bodySHA256
        requireNative(!nativeEnvelopeFailed(native) && native.id === Number(id) && native.company_name === profile.publisherName
          && (native.internal_job_id === null || Number.isSafeInteger(native.internal_job_id) && native.internal_job_id > 0)
          && Array.isArray(native.offices) && (native.metadata == null || Array.isArray(native.metadata)) && postURI(native.absolute_url, id, profile), 'native own post identity/shape changed')
        // Retain complete native criteria even if the corporate detail is held.
        Object.assign(job, criteria(native));requireNative(job.jobDescription, 'native full criteria unavailable')
        job.sourceNativePostKind = native.internal_job_id === null ? 'prospect' : 'job'
        nativeQualified = true
      } catch (error) { signal?.throwIfAborted();job.sourceNativeIssues.push(error.message) }
      try {
        requireNative(links.has(id), 'no actually published corporate own-role URI')
        const corporatePage = await load(links.get(id));job.sourceFirstPartyOwnBodySHA256 = corporatePage?.bodySHA256
        requireNative(original(corporatePage), 'corporate own-role original response unavailable')
        role = ownRole(corporatePage.originalText, id, job.title)
        Object.assign(job, { sourceFirstPartyBodyText: role.body, sourceFirstPartyRoleOwnedText: role.roleOwned,
          sourceFirstPartyNativeHandoffs: role.originalNativeHandoffs, sourceBrandScopeQualified: role.brandQualified,
          sourceBrandScopeQualification: 'role-owned-Clumio-reference;exclusive-brand-or-legal-employer-attribution-unqualified' })
        job.jobDescription = [job.jobDescription, 'Published corporate own-role criteria: ' + role.body].filter(Boolean).join('\n\n')
      } catch (error) { signal?.throwIfAborted();job.sourceNativeIssues.push(error.message) }
      job.sourceDescription = job.jobDescription
      try {
        requireNative(nativeQualified && role && listing && first && supplied.get(id).length === 1 && inline.get(id).length === 1, 'paired unique corporate/native role models unavailable')
        for (const key of ['internal_job_id', 'requisition_id', 'title', 'company_name', 'absolute_url', 'location']) requireNative(equal(listing[key], native[key]), 'native list/own conflict: ' + key)
        requireNative(text(first.title) === text(native.title) && first.internal_job_id === native.internal_job_id && (first.requisition_id ?? null) === (native.requisition_id ?? null), 'corporate/native role identity conflict')
        Object.assign(job, combinedGeography(native, index, first), combinedFields(native, first, role), {
          sourceNativeDetailQualified: true, sourceCurrentNativePostingIdentityQualified: result.publisherQualified,
          applyUrl: native.absolute_url, link: native.absolute_url, detailUrl: ownURL(id), applicationUrlIsGeneric: false,
          companyCareerPage: profile.primaryURL, companyDomain: 'commvault.com', atsPlatform: 'greenhouse',
          sourceNativeApplication: { activationVerified: false, applicantEligibilityQualified: false } })
        job.sourceCurrentNativeRoleQualified = job.sourceCurrentNativePostingIdentityQualified && !job.sourceNativeCountryConflict
      } catch (error) { signal?.throwIfAborted();job.sourceNativeIssues.push(error.message) }
      const earlier = observations.get(id)
      if (earlier) {
        if (!earlier.sourceNativeDetailQualified) Object.assign(job, {
          sourceCurrentNativePostingIdentityQualified: false, sourceCurrentNativeRoleQualified: false, sourceNativeTemporalQualification: 'opening-paired-identity-unqualified' })
        if (earlier.sourceNativeDetailQualified && job.sourceNativeDetailQualified && !equal(identity(earlier), identity(job))) Object.assign(job, {
          sourceCurrentNativePostingIdentityQualified: false, sourceCurrentNativeRoleQualified: false, sourceNativeTemporalQualification: 'opening-closing-identity-or-public-handoff-changed' })
        history.push({ id, earlier: structuredClone(earlier), current: structuredClone(job) })
        if (earlier.sourceNativeDetailQualified && !job.sourceNativeDetailQualified) observations.set(id, { ...earlier,
          sourceCurrentNativePostingIdentityQualified: false, sourceCurrentNativeRoleQualified: false, sourceNativeClosingObservation: job,
          sourceNativeTemporalQualification: 'earlier-complete-positive-retained-closing-pair-held' })
        else observations.set(id, job)
      } else observations.set(id, job)
    }, signal)
    return result
  }
  let opening, closing, fatal, collectionFailed = false
  try { opening = await collect('opening');signal?.throwIfAborted();closing = await collect('closing') } catch (error) { collectionFailed = true;fatal = error }
  const before = new Set(opening?.nativePostIds || []), after = new Set(closing?.nativePostIds || [])
  for (const [id, job] of observations) if (!closing?.publisherQualified || !before.has(id) || !after.has(id)) Object.assign(job, {
    sourceCurrentNativePostingIdentityQualified: false, sourceCurrentNativeRoleQualified: false, sourceNativeTemporalQualification: 'paired-own-identity-and-current-closing-publisher-required' })
  const all = [...observations.values()].sort((a, b) => order.get(a.jobId) - order.get(b.jobId));history.sort((a, b) => order.get(a.id) - order.get(b.id))
  const audit = { source: profile.source, countryFilter: profile.countryFilter, opening, closing, observations: all, observationHistory: history, rawPages: io.rawPages, issues: io.issues,
    sourceScopeComplete: false, lifecycleCleanupAllowed: false, authoritativeSourceTotal: null, authoritativeIndiaFacetCount: null,
    qualification: 'Corporate and native original public models before role-brand/country selection. Whole employer, exclusive brand/legal employer, recruitment, application activation, database and publication remain unqualified.' }
  await checkedObserver(() => { const detached = structuredClone(audit);signal?.throwIfAborted();return onAudit(detached) }, signal)
  await checkedObserver(() => { const detached = structuredClone(all);signal?.throwIfAborted();return onRecords(detached) }, signal)
  signal?.throwIfAborted();if (collectionFailed) throw fatal
  const candidates = all.filter(job => job.sourceCurrentNativePostingIdentityQualified && job.sourceBrandScopeQualified && job.sourceNativePostKind === 'job' && job.jobDescription)
  const jobs = (maxJobs === null ? candidates : candidates.slice(0, maxJobs)).map(job => ({ ...job, scrapedAt: observedAt }))
  Object.defineProperty(jobs, 'sourceAudit', { value: audit })
  attachSourceObservationEvidence(jobs, { source: profile.source, recordKind: all.some(job => job.sourceNativePostKind === 'prospect') ? 'mixed' : 'vacancy-rows',
    observedRecordCount: all.length, observedVacancyCount: all.filter(job => job.sourceNativePostKind === 'job').length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
  return attachInventoryEvidence(jobs, { status: 'discovery-only', firstParty: io.rawPages.some(p => p.transportQualified), surface: profile.primaryURL,
    listingComplete: false, reportedTotal: null, indiaFacetCount: null, pagesFetched: io.rawPages.filter(p => p.usable).length, verifiedAt: observedAt,
    reason: 'current-corporate-and-native-role-models-before-brand-country-selection;whole-source-recruitment-application-database-publication-unqualified' })
} })
