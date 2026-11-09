import { readFileSync } from 'node:fs'
import { createPublicIO } from '../publicIO.js'
import { reviewedDeclaredAssetURLs, selectReviewedDeclaredAsset, matchesAuthoredIntegrity } from './reviewedDeclaredAssets.js'
import { boundedDeclaredPublicGet } from '../boundedDeclaredPublicGet.js'
import { attachInventoryEvidence } from '../../utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../utils/sourceObservationEvidence.js'
import { text } from '../cisVeeam/publishedData.js'
import { requireNative, nativeJSON, primaryDeclaration, postURI, criteria, officeIndex, geography, literalFields } from './nativeData.js'
import { departmentIndex, departmentPostIndex, routeContext, observeOwnRoute, primaryRouteStructure } from '../declaredGreenhouseRoutes/routeData.js'
import { withNativeRuntimeControls } from './runtimeControls.js'

export const NATIVE_GREENHOUSE_PROFILES = JSON.parse(readFileSync(new URL('./profiles.json', import.meta.url)))
export const nativeSourceMetadata = (profile, previous = {}) => ({ ...previous, source: profile.source, companyName: profile.companyName,
  companyCareerPage: profile.primaryURL, verifiedOn: null, verifiedAt: null, verifiedInventoryStatus: 'unverified', verifiedIndiaJobCount: null,
  verifiedPublicJobCount: null, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
  verifiedSurfaceSummary: 'Current declared published native models only; whole employer, India-zero, active recruitment, applications, persistence and publication remain unqualified.' })
// Shared by these opt-in readers only. Production native GET starts are spaced
// even when several source instances run concurrently; injected fetchPage owns
// its transport scheduling and is used for original-entity replay/capture.
const hostStarts = new Map()
const waitForHost = async (url, signal) => {
  const host = new URL(url).hostname, start = Math.max(Date.now(), hostStarts.get(host) || 0)
  hostStarts.set(host, start + 500)
  if (start > Date.now()) await new Promise((resolve, reject) => {
    let timer
    const aborted = () => { clearTimeout(timer);signal?.removeEventListener('abort', aborted);reject(signal.reason || Error('Native request aborted')) }
    timer = setTimeout(() => { signal?.removeEventListener('abort', aborted);resolve() }, start - Date.now())
    signal?.addEventListener('abort', aborted, { once: true });if (signal?.aborted) aborted()
  })
  signal?.throwIfAborted()
}
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
export const nativeEnvelopeFailed = data => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  const error = value => Array.isArray(value) ? value.length > 0 : value && typeof value === 'object' ? Object.keys(value).length > 0 : Boolean(value)
  const failedStatus = value => typeof value === 'number' ? value >= 400 : typeof value === 'string'
    && (/^(?:error|failed|failure|unavailable)$/i.test(value.trim()) || /^\d{3}$/.test(value.trim()) && Number(value) >= 400)
  return error(data.error) || error(data.errors) || [data.success, data.ok].some(value => value === false || value === 0 || value === 'false' || value === '0')
    || [data.status, data.statusCode, data.httpStatus].some(failedStatus) || nativeEnvelopeFailed(data.meta)
}
const failedEnvelope = nativeEnvelopeFailed
const postKind = record => record?.internal_job_id === null ? 'prospect'
  : Number.isSafeInteger(record?.internal_job_id) && record.internal_job_id > 0 ? 'job' : 'unresolved'
const identity = job => ({ postId: job.jobId, internalJobId: job.internalJobId, requisitionId: job.requisitionId, title: job.title, company: job.company, publicPostURI: job.applyUrl })
const parallel = async (items, visit, signal) => {
  let next = 0
  const settled = await Promise.allSettled(Array.from({ length: 4 }, async () => {
    while (next < items.length) { signal?.throwIfAborted();await visit(items[next++]) }
  }))
  const rejected = settled.find(item => item.status === 'rejected');if (rejected) throw rejected.reason
}
export const createNativeGreenhouseScraper = (profile, defaults = {}) => ({ async run(passed = {}) {
  requireNative(profile && typeof profile.boardToken === 'string', 'missing configured native profile')
  return withNativeRuntimeControls(profile, defaults, passed, async (options, controls) => {
  const { signal, maxJobs = null, onAudit = () => {}, now = () => new Date().toISOString() } = options
  const countryFilter = profile.countryFilter ?? 'India'
  signal?.throwIfAborted()
  requireNative(['India', 'Global'].includes(countryFilter), 'countryFilter must be India or Global')
  requireNative(maxJobs === null || Number.isSafeInteger(maxJobs) && maxJobs >= 0, 'maxJobs must be a nonnegative safe integer or null')
  const observedAt = now(), base = profile.publicAPIBase, feedURL = base + '/jobs?content=true', officesURL = base + '/offices'
  const allowedURLs = new Set([profile.primaryURL, base, feedURL, officesURL, ...(profile.declaration.scriptURL && profile.declaration.kind === 'active-declared-external-profile' ? [profile.declaration.scriptURL] : [])])
  if (profile.publicDepartmentIndexURL) allowedURLs.add(profile.publicDepartmentIndexURL)
  const allowed = url => allowedURLs.has(url.href) && !io.rawPages.some(page => [401, 403, 429].includes(page.status) && new URL(page.url).hostname === url.hostname)
  requireNative(!(options.fetchJson || options.fetchText) || options.fetchPage || options.fetchImpl,
    'Parsed fetchJson alone has no original HTTP provenance; provide fetchPage or fetchImpl with original Responses')
  for (const url of reviewedDeclaredAssetURLs(profile)) allowedURLs.add(url)
  const fetchOriginal = options.fetchImpl || globalThis.fetch
  const fetchOriginalPage = async (url, init, check) => {
    check()
    if (options.fetchPage) return options.fetchPage(url, init)
    await waitForHost(url, signal)
    check()
    requireNative(allowed(new URL(url)), 'native host became unavailable while queued')
    return boundedDeclaredPublicGet(url, { fetchImpl: (...args) => { check();return fetchOriginal(...args) },
      signal: AbortSignal.any([AbortSignal.timeout(15000), ...(signal ? [signal] : [])]),
      overflowError: Error('Declared Greenhouse: native entity exceeds input limit') })
  }
  const fetchPage = (url, init) => controls.read(check => fetchOriginalPage(url, init, check), { requestUrl:url, kind:'logical-native-page' })
  const io = createPublicIO({ ...options, fetchPage, allowed }), observations = new Map(), order = new Map(), history = []
  const load = (url, options = {}) => io.load(url, { fresh: true, ...options })
  let opening, closing, fatal = null, activeCollection = null
  // Retain detached incomplete facts on owned expiry; never mutate caller reasons.
  controls.retain(() => ({ source:profile.source, countryFilter, opening:opening??null, closing:closing??null, activeCollection,
    observations:[...observations.values()].sort((a,b)=>order.get(Number(a.jobId))-order.get(Number(b.jobId))).map(job=>({...job,
      sourceCurrentNativeRoleQualified:false, sourceCurrentNativePostingIdentityQualified:false,
      sourceNativeTemporalQualification:'owned-deadline-incomplete-collection',sourceScopeComplete:false,sourceDetailComplete:false,lifecycleCleanupAllowed:false})),
    observationHistory:history,rawPages:io.rawPages,issues:io.issues,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
    authoritativeSourceTotal:null,authoritativeIndiaFacetCount:null,incompleteCollection:true }))
  const ownURL = id => base + '/jobs/' + id + '?pay_transparency=true'
  const collect = async phase => {
    const result = { phase, publisherQualified: false, qualified: false, reportedNativePostCount: null, nativePostIds: [],
      originalNativeFeed: null, originalNativeOffices: null, originalNativeBoard: null, nativeListingComplete: false, nativeOfficeHierarchyQualified: false, issues: [] }
    activeCollection = result
    const read = async (url, label) => {
      const page = await io.load(url, { fresh: true })
      try { const value = nativeJSON(page);requireNative(!failedEnvelope(value), label + ' returned an error envelope');return value }
      catch (error) { signal?.throwIfAborted();result.issues.push(error.message);return null }
    }
    const page = await io.load(profile.primaryURL, { fresh: true })
    let declared = Boolean(page?.usable && page.transportQualified && typeof page.bodyBase64 === 'string'
      && typeof page.originalText === 'string' && primaryDeclaration(page.originalText, profile))
    if (profile.primaryStructure) {
      result.originalPrimaryRouteStructure = null
      try { requireNative(declared, 'original primary structure transport/declaration unavailable')
        result.originalPrimaryRouteStructure = primaryRouteStructure(profile, page.originalText) }
      catch (error) { signal?.throwIfAborted();declared = false;result.issues.push(error.message) }
    }
    if (declared && profile.declaration.kind === 'active-declared-external-profile') {
      const declaration = Object.hasOwn(profile.declaration, 'reviewedAlternates')
        ? selectReviewedDeclaredAsset(page.originalText, profile) : profile.declaration
      const asset = declaration ? await io.load(declaration.scriptURL, { fresh: true }) : null
      declared = Boolean(asset?.usable && asset.transportQualified && typeof asset.bodyBase64 === 'string'
        && asset.bodySHA256 === declaration.scriptSHA256 && matchesAuthoredIntegrity(declaration, asset.bodyBase64))
    }
    result.currentPrimaryDeclarationQualified = declared
    result.originalNativeBoard = await read(base, 'native board')
    result.originalNativeOffices = await read(officesURL, 'native offices')
    result.originalNativeFeed = await read(feedURL, 'native post list')
    let departments = { nodes: new Map(), posts: new Map() }
    if (profile.publicDepartmentIndexURL) {
      result.originalNativeDepartments = await read(profile.publicDepartmentIndexURL, 'current declared native departments')
      result.nativeDepartmentHierarchyQualified = false
      departments.posts = departmentPostIndex(result.originalNativeDepartments)
      try { departments = departmentIndex(result.originalNativeDepartments);result.nativeDepartmentHierarchyQualified = true }
      catch (error) { result.issues.push(error.message) }
    }
    const route = profile.ownRoute ? routeContext(profile, result, load, allowedURLs) : null
    result.publisherQualified = declared && result.originalNativeBoard?.name === profile.publisherName
    const payload = result.originalNativeFeed, records = Array.isArray(payload?.jobs) ? payload.jobs : []
    const supplied = new Map()
    for (const record of records) {
      if (!Number.isSafeInteger(record?.id) || record.id <= 0) { result.issues.push('Malformed native index identity; original retained');continue }
      if (!supplied.has(record.id)) supplied.set(record.id, [])
      supplied.get(record.id).push(record)
    }
    let index = { nodes: new Map(), posts: new Map() }
    try { index = officeIndex(result.originalNativeOffices);result.nativeOfficeHierarchyQualified = true } catch (error) { result.issues.push(error.message) }
    const ids = [...new Set([...supplied.keys(), ...index.posts.keys(), ...departments.posts.keys()])]
    result.nativePostIds = ids;result.reportedNativePostCount = payload?.meta?.total ?? null
    const noPagination = [payload, payload?.meta].every(container => container && (container.hasMore == null || container.hasMore === false)
      && ['next', 'nextPage', 'nextCursor'].every(key => container[key] == null))
    result.nativeListingComplete = Array.isArray(payload?.jobs) && Number.isSafeInteger(payload.meta?.total) && payload.meta.total === records.length
      && records.length === supplied.size && noPagination && [...index.posts.keys()].every(id => supplied.has(id))
    if (profile.publicDepartmentIndexURL) result.nativeListingComplete = result.nativeListingComplete && result.nativeDepartmentHierarchyQualified
      && departments.posts.size === supplied.size && [...departments.posts.keys()].every(id => supplied.has(id))
    result.qualified = result.publisherQualified && result.nativeListingComplete && result.nativeOfficeHierarchyQualified
    for (const id of ids) { allowedURLs.add(ownURL(id));if (!order.has(id)) order.set(id, order.size) }
    await parallel(ids, async id => {
      const matching = supplied.get(id) || [], listing = matching.length === 1 ? matching[0]
        : index.posts.get(id)?.[0]?.originalRecord ?? departments.posts.get(id)?.[0]?.originalRecord ?? null
      const job = { source: profile.source, jobId: String(id), internalJobId: listing?.internal_job_id ?? null, requisitionId: listing?.requisition_id ?? null,
        title: text(listing?.title), company: profile.publisherName, sourceUrl: listing?.absolute_url ?? null, applyUrl: listing?.absolute_url ?? null,
        detailUrl: ownURL(id), country: null, city: null, state: null, location: null, locations: [], jobDescription: null,
        sourceCountryScopeUnresolved: true, sourceNativeCountryConflict: false, sourceCurrentNativeRoleQualified: false,
        sourceCurrentNativePostingIdentityQualified: false, sourceNativeDetailQualified: false,
        sourceNativePhase: phase, sourceNativeIssues: [], sourceNativeOwnHostedPageReadThisRun: false,
        sourceNativeListingRecord: structuredClone(listing), sourceNativePostKind: postKind(listing),
         sourceNativeOfficeIndexDeclarations: structuredClone(index.posts.get(id) || []),
         ...(route ? { sourceNativeDepartmentIndexDeclarations: structuredClone(departments.posts.get(id) || []) } : {}),
        sourceScopeComplete: false, sourceDetailComplete: false, lifecycleCleanupAllowed: false }
      try {
        const response = await io.load(ownURL(id), { fresh: true }), native = nativeJSON(response)
        job.sourceNativeRecord = structuredClone(native);job.sourceNativeOwnBodySHA256 = response.bodySHA256
        requireNative(!failedEnvelope(native) && matching.length <= 1 && listing && native.id === id && native.company_name === profile.publisherName,
          'own published post identity/company/index conflict')
        requireNative(native.internal_job_id === null || Number.isSafeInteger(native.internal_job_id) && native.internal_job_id > 0, 'native internal job identity malformed')
        requireNative(postURI(native.absolute_url, id, profile), 'own public post URI changed or belongs to another board')
        for (const declaration of profile.publicDepartmentIndexURL ? [listing, ...(departments.posts.get(id) || []).map(row => row.originalRecord)] : [listing])
          for (const key of ['internal_job_id', 'requisition_id', 'title', 'company_name', 'absolute_url', 'location']) {
            if (!profile.publicDepartmentIndexURL || Object.hasOwn(declaration, key))
              requireNative(equal(declaration[key], native[key]), 'native index/own post field conflict: ' + key)
          }
        requireNative(Array.isArray(native.offices) && (native.metadata == null || Array.isArray(native.metadata)), 'own native offices/metadata malformed')
        const full = criteria(native)
        requireNative(full.jobDescription, 'complete native published criteria missing')
        Object.assign(job, { title: text(native.title), company: native.company_name, internalJobId: native.internal_job_id,
          requisitionId: native.requisition_id ?? null, sourceUrl: native.absolute_url, applyUrl: native.absolute_url, link: native.absolute_url,
          sourceNativePostKind: postKind(native), ...full, ...geography(native, index), ...literalFields(native),
          sourceNativeOfficeIndexDeclarations: structuredClone(index.posts.get(id) || []), companyCareerPage: profile.primaryURL,
          companyDomain: new URL(profile.primaryURL).hostname.replace(/^www\./, ''), atsPlatform: 'greenhouse',
          sourceNativePublicationQualification: 'current-employer-declaration-native-board-name-and-paired-public-post-GETs;hosted-page-currentness-and-active-recruitment-unverified' })
        job.sourceNativeDetailQualified = true
        if (route) {
          job.sourceNativeDepartmentIndexDeclarations = structuredClone(departments.posts.get(id) || [])
          await observeOwnRoute(profile, id, native, route, job)
        }
        job.sourceCurrentNativePostingIdentityQualified = result.publisherQualified
        job.sourceCurrentNativeRoleQualified = result.publisherQualified && !job.sourceNativeCountryConflict
      } catch (error) { signal?.throwIfAborted();job.sourceNativeIssues.push(error.message);io.issue('native-own-post-held', { phase, id, message: error.message }) }
      const earlier = observations.get(id)
      if (earlier) {
        if (!earlier.sourceNativeDetailQualified) Object.assign(job, {
          sourceCurrentNativePostingIdentityQualified: false, sourceCurrentNativeRoleQualified: false, sourceNativeTemporalQualification: 'opening-native-identity-unqualified' })
        if (route && !earlier.sourceNativeRoleRouteQualified) Object.assign(job, {
          sourceCurrentNativePostingIdentityQualified: false, sourceCurrentNativeRoleQualified: false, sourceNativeTemporalQualification: 'opening-published-own-route-unqualified' })
        if (earlier.jobDescription && job.jobDescription && !equal(identity(earlier), identity(job))) Object.assign(job, {
          sourceCurrentNativeRoleQualified: false, sourceCurrentNativePostingIdentityQualified: false, sourceNativeTemporalQualification: 'opening-closing-native-identity-or-public-handoff-changed',
          sourceNativeTemporalIdentityChange: { opening: identity(earlier), closing: identity(job) } })
        history.push({ postId: id, earlier: structuredClone(earlier), current: structuredClone(job) })
        if (earlier.jobDescription && !job.jobDescription) Object.assign(earlier, { sourceCurrentNativeRoleQualified: false, sourceCurrentNativePostingIdentityQualified: false,
          sourceNativeTemporalQualification: 'earlier-complete-native-record-retained-closing-own-post-held', sourceNativeClosingObservation: job })
        else observations.set(id, job)
      } else observations.set(id, job)
    }, signal)
    return result
  }
  try { opening = await collect('opening');signal?.throwIfAborted();closing = await collect('closing') } catch (error) { fatal = error }
  const current = new Set(closing?.nativePostIds || []), earlier = new Set(opening?.nativePostIds || [])
  for (const [id, job] of observations) if (!closing?.publisherQualified || !current.has(id) || !earlier.has(id)) Object.assign(job, {
    sourceCurrentNativeRoleQualified: false, sourceCurrentNativePostingIdentityQualified: false, sourceNativeTemporalQualification: 'native-post-not-present-in-both-phases-or-collection-unqualified' })
  const all = [...observations.values()].sort((a, b) => order.get(Number(a.jobId)) - order.get(Number(b.jobId)))
  history.sort((a, b) => order.get(a.postId) - order.get(b.postId))
  const audit = { source: profile.source, countryFilter, opening, closing, observations: all, observationHistory: history, rawPages: io.rawPages, issues: io.issues,
    sourceScopeComplete: false, lifecycleCleanupAllowed: false, authoritativeSourceTotal: null, authoritativeIndiaFacetCount: null,
    qualification: 'Complete original published native post models retained before prospect/country selection. Hosted pages, wider employer channels, active recruitment, applications, persistence and publication remain unverified.' }
  await controls.audit(check => { const detached = structuredClone(audit);check();return onAudit(detached, { signal }, check) });signal?.throwIfAborted();if (fatal) throw fatal
  const candidates = all.filter(job => job.jobDescription && job.sourceNativePostKind === 'job' && (countryFilter === 'Global'
    ? job.sourceCurrentNativePostingIdentityQualified
    : job.sourceCurrentNativeRoleQualified && !job.sourceNativeCountryConflict && (job.country === 'India' || job.sourceCountryScopeUnresolved)))
  const jobs = (Number.isSafeInteger(maxJobs) && maxJobs >= 0 ? candidates.slice(0, maxJobs) : candidates).map(job => ({ ...job, scrapedAt: observedAt }))
  Object.defineProperty(jobs, 'sourceAudit', { value: audit })
  attachSourceObservationEvidence(jobs, { source: profile.source, recordKind: all.some(job => job.sourceNativePostKind !== 'job') ? 'mixed' : 'vacancy-rows',
    observedRecordCount: all.length, observedVacancyCount: all.filter(job => job.sourceNativePostKind === 'job').length,
    sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
  return attachInventoryEvidence(jobs, { status: 'discovery-only', firstParty: io.rawPages.some(page => page.transportQualified), surface: feedURL,
    listingComplete: false, reportedTotal: null, indiaFacetCount: null, pagesFetched: io.rawPages.filter(page => page.usable).length, verifiedAt: observedAt,
    reason: 'current-native-published-post-models-before-country-selection;whole-employer-India-zero-active-recruitment-applications-and-publication-unqualified' })
  })
} })
