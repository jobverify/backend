import { createNativeGreenhouseScraper, NATIVE_GREENHOUSE_PROFILES } from '../../scraper-support/native-sources/declaredGreenhouse/nativeCareers.js'
import { readLiteralModel } from '../../scraper-support/native-sources/literalModel.js'
import { geography, officeIndex, postURI } from '../../scraper-support/native-sources/declaredGreenhouse/nativeData.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence, readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { HOME, GENERAL, CLINICAL, LOADER, LOADER_SHA256, BOARD, API, PUBLIC_SCOPE, sha256,
  advertisedClinical, inspectPublicPage, verifyHostedBoard, verifyHostedDetail } from './publicInventory.js'

const MAX_AGGREGATE_BYTES = 2 * 1024 * 1024
const MAX_REQUESTS = 256
const PROFILE = { ...NATIVE_GREENHOUSE_PROFILES.biofourmis, publicDepartmentIndexURL: API + '/departments/' }
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const parseJSON = response => readLiteralModel(Buffer.from(response.bodyBase64, 'base64').toString('utf8')).value
const original = response => response?.status === 200 && response.url === response.finalURL
  && typeof response.bodyBase64 === 'string' && typeof response.originalText === 'string'
const fail = reason => { throw Error('Biofourmis public source: ' + reason) }
const abortable = async (start, signal) => {
  signal.throwIfAborted()
  let abort
  const cancelled = new Promise((_, reject) => {
    abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
  })
  // Attach the race before creating the task: a stream pull can synchronously
  // abort its caller and reject the read promise during reader.read().
  try { return await Promise.race([Promise.resolve().then(() => { signal.throwIfAborted();return start() }), cancelled]) }
  catch (error) { signal.throwIfAborted();throw error }
  finally { signal.removeEventListener('abort', abort) }
}
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).every(key => keys.includes(key)) && keys.every(key => Object.hasOwn(value, key))

// Keep the complete native collector and all original facts/history intact.
// Extra public-scope proof is conditional and never erases native positives.
export const createBiofourmisScraper = (defaults = {}) => ({ async run(passed = {}) {
  const options = { ...defaults, ...passed }, { now = () => new Date().toISOString() } = options
  options.signal?.throwIfAborted()
  const controller = new AbortController(), signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal
  if ((options.fetchJson || options.fetchText) && !options.fetchPage && !options.fetchImpl) fail('original HTTP responses are required')
  const phases = [], responses = [], failures = [], deniedHosts = new Set(), requests = []
  let phase = null, bytesRead = 0
  const issue = (code, fields = {}) => failures.push({ code, ...fields })
  const allowedURL = url => [HOME, GENERAL, CLINICAL, LOADER, BOARD, API, API + '/offices', API + '/departments/', API + '/jobs?content=true'].includes(url)
    || /^https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/biofourmis\/jobs\/[1-9]\d*\?pay_transparency=true$/.test(url)
    || /^https:\/\/job-boards\.greenhouse\.io\/biofourmis\/jobs\/[1-9]\d*$/.test(url)
  const sourceSignal = signal
  const request = async (url, phaseName, signal = sourceSignal) => {
    signal?.throwIfAborted()
    if (!allowedURL(url)) fail('unreviewed public URL blocked')
    if (deniedHosts.has(new URL(url).hostname)) fail('public host access denied; no retries or alternate clients')
    if (requests.length >= MAX_REQUESTS || bytesRead >= MAX_AGGREGATE_BYTES) fail('public request/aggregate byte budget exhausted')
    // Keep the effective per-request deadline while allowing the primary hook
    // to visit its several explicitly advertised public surfaces in sequence.
    const requestTimer = setTimeout(() => controller.abort(Error('Declared Greenhouse native read deadline')), 15000)
    try {
    const headers = { Accept: 'text/html,application/json,*/*;q=0.5', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify public careers inventory)' }
    requests.push({ url, phase: phaseName, method: 'GET', redirect: 'manual',
      transport: options.fetchPage ? 'injected-original-response' : 'node-fetch',
      requestedHeaders: options.fetchPage ? null : headers, credentials: options.fetchPage ? null : 'omit' })
    const requestSignal = signal
    let requestedAt = new Date().toISOString(), raw
    if (options.fetchPage) raw = await abortable(() => options.fetchPage(url, { signal: requestSignal }), requestSignal)
    else {
      const response = await abortable(() => (options.fetchImpl || globalThis.fetch)(url, { method: 'GET', redirect: 'manual', signal: requestSignal,
        credentials: 'omit', headers }), requestSignal)
      const reader = response.body?.getReader()
      if (!reader) fail('original response body unavailable')
      const chunks = []
      let bodyBytes = 0
      try {
        for (;;) {
          requestSignal.throwIfAborted()
          const { done, value } = await abortable(() => reader.read(), requestSignal)
          if (done) break
          chunks.push(value);bodyBytes += value.byteLength
          if (bytesRead + bodyBytes > MAX_AGGREGATE_BYTES) fail('2 MiB source aggregate byte limit exceeded')
        }
      } catch (error) { reader.cancel().catch(() => {});throw error }
      finally { reader.releaseLock() }
      raw = { url: response.url, status: response.status, headers: Object.fromEntries(response.headers),
        bodyBase64: Buffer.concat(chunks).toString('base64'), requestedAt, completedAt: new Date().toISOString() }
    }
    signal?.throwIfAborted();requestSignal.throwIfAborted()
    if (typeof raw?.bodyBase64 !== 'string') fail('original decoded response bytes unavailable')
    const body = Buffer.from(raw.bodyBase64, 'base64'), decoded = body.toString('utf8')
    bytesRead += body.length
    const retained = { url, finalURL: raw.url, status: raw.status, headers: raw.headers || {}, phase: phaseName,
      bodyBase64: body.toString('base64'), bodySHA256: sha256(body), bytes: body.length,
      originalText: Buffer.from(decoded).equals(body) ? decoded : null,
      // Replays keep original receipt times. Missing times never become fresh.
      requestedAt: raw.requestedAt ?? null, completedAt: raw.completedAt ?? null }
    responses.push(retained)
    const previewTrust = /<title[^>]*>\s*CodeSandbox Preview\s*<\/title>/i.test(decoded)
      && /You are opening a CodeSandbox preview, do you want to continue\?/i.test(decoded)
      && /\bid=["']btn-answer-yes["']/i.test(decoded)
    if ([401, 403, 429].includes(raw.status) || previewTrust
      || /<title[^>]*>\s*(?:just a moment|access denied|verify you are human|security check)/i.test(decoded.slice(0, 20000))) {
      deniedHosts.add(new URL(url).hostname)
      retained.accessChallenge = previewTrust ? 'codesandbox-preview-trust' : 'public-access-denied'
      issue('PUBLIC_ACCESS_CHALLENGE', { url, phase: phaseName, status: raw.status, kind: retained.accessChallenge, retryAllowed: false })
    }
    if (bytesRead > MAX_AGGREGATE_BYTES) fail('2 MiB source aggregate byte limit exceeded')
    return { ...raw, bodyBase64: retained.bodyBase64 }
    } finally { clearTimeout(requestTimer) }
  }
  const optional = async (url, phaseName, signal = sourceSignal) => {
    try { return await request(url, phaseName, signal) }
    catch (error) { signal?.throwIfAborted();issue('PUBLIC_PROOF_READ_FAILED', { url, phase: phaseName, message: error.message });return null }
  }
  const pageFor = (name, url) => responses.find(response => response.phase === name && response.url === url)
  const fetchPage = async (url, { signal = sourceSignal } = {}) => {
    signal?.throwIfAborted()
    if (url === GENERAL) {
      phase = phases.length === 0 ? 'opening' : 'closing';phases.push(phase)
      const primary = await request(url, phase, signal), home = await optional(HOME, phase, signal)
      const generalHTML = Buffer.from(primary.bodyBase64, 'base64').toString('utf8')
      const homeHTML = home ? Buffer.from(home.bodyBase64, 'base64').toString('utf8') : ''
      if (advertisedClinical(generalHTML, GENERAL) || advertisedClinical(homeHTML, HOME)) await optional(CLINICAL, phase, signal)
      await optional(BOARD, phase, signal)
      // The shared collector's visual tree deliberately omits hidden scripts.
      // This source's executable declaration must use original script semantics.
      try { if (inspectPublicPage(generalHTML, GENERAL).loaderDeclared) await optional(LOADER, phase, signal) }
      catch (error) { signal?.throwIfAborted();issue('PRIMARY_LOADER_UNVERIFIED', { url, phase, message: error.message }) }
      return primary
    }
    if (url === LOADER && pageFor(phase, LOADER)) {
      const retained = pageFor(phase, LOADER)
      return { ...retained, url: retained.finalURL }
    }
    const result = await request(url, phase, signal)
    if (url.startsWith(API + '/jobs/') && result.status === 200) {
      try {
        const record = parseJSON(result), offices = pageFor(phase, API + '/offices')
        const scope = geography(record, officeIndex(offices ? parseJSON(offices) : null))
        if (record.company_name === 'Biofourmis' && Number.isSafeInteger(record.internal_job_id) && record.internal_job_id > 0
          && postURI(record.absolute_url, record.id, PROFILE) && (scope.country === 'India' || scope.sourceCountryScopeUnresolved)) {
          await optional(record.absolute_url, phase, signal)
        }
      } catch (error) { signal?.throwIfAborted();issue('PUBLIC_DETAIL_CANDIDATE_UNRESOLVED', { url, phase, message: error.message }) }
    }
    return result
  }
  let nativeAudit
  let jobs = await createNativeGreenhouseScraper(PROFILE, { nativeReadTimeoutMs: 120000 }).run({ ...options, signal, fetchPage,
    onAudit: audit => { nativeAudit = audit } })
  // sourceAudit is the collector's original object, preserving its full models.
  const audit = jobs.sourceAudit || nativeAudit
  const proof = { complete: false, coreEmployerBinding: true, currentEmployerBinding: true, advertisedSurfacesComplete: true,
    nativeInventoryComplete: true, nativeReportedTotal: audit.closing?.reportedNativePostCount ?? null,
    countryPartitionComplete: true, selectedIndiaDetailsComplete: true, closingMatches: true,
    publicScope: PUBLIC_SCOPE, wholeCompanyScope: null, legalEmployer: null, verifiedAt: null, failures }
  const observedClock = Date.parse(now())
  const check = (key, code, fn, fields = {}) => {
    try { fn();return true } catch (error) { signal?.throwIfAborted();proof[key] = false;issue(code, { ...fields, message: error.message });return false }
  }
  const requirePage = (phaseName, url) => {
    const response = pageFor(phaseName, url)
    if (!original(response)) throw Error('Original successful public response unavailable (HTTP ' + (response?.status ?? 'unknown') + ')')
    return response
  }
  for (const phaseName of ['opening', 'closing']) {
    const phaseAudit = audit[phaseName]
    const coreBound = check('coreEmployerBinding', 'CORE_EMPLOYER_BINDING_UNVERIFIED', () => {
      const primary = requirePage(phaseName, GENERAL), loader = requirePage(phaseName, LOADER)
      inspectPublicPage(primary.originalText, GENERAL)
      if (loader.bodySHA256 !== LOADER_SHA256) throw Error('Current unfiltered ghSlug=biofourmis departments loader bytes changed')
      if (phaseAudit?.originalNativeBoard?.name !== 'Biofourmis') throw Error('Native publisher identity changed')
    }, { phase: phaseName })
    check('currentEmployerBinding', 'EMPLOYER_BINDING_UNVERIFIED', () => {
      if (!coreBound) throw Error('Current primary/loader/native employer binding unavailable')
      const home = requirePage(phaseName, HOME);inspectPublicPage(home.originalText, HOME, { homepage: true })
    }, { phase: phaseName })
    for (const url of [HOME, GENERAL]) check('advertisedSurfacesComplete', 'PUBLIC_SURFACE_UNVERIFIED', () => {
      const response = requirePage(phaseName, url), inspected = inspectPublicPage(response.originalText, url, { homepage: url === HOME })
      if (inspected.additional.length) throw Error('Unreviewed advertised recruiting surfaces: ' + inspected.additional.join(', '))
    }, { phase: phaseName, url })
    if ([HOME, GENERAL].some(url => advertisedClinical(pageFor(phaseName, url)?.originalText, url))) {
      const clinical = pageFor(phaseName, CLINICAL)
      check('advertisedSurfacesComplete', 'ADVERTISED_CAREERS_UNAVAILABLE', () => {
        const inspected = inspectPublicPage(requirePage(phaseName, CLINICAL).originalText, CLINICAL)
        if (inspected.additional.length) throw Error('Unreviewed clinical recruiting surface: ' + inspected.additional.join(', '))
      }, { phase: phaseName, url: CLINICAL, status: clinical?.status ?? null })
    }
    check('nativeInventoryComplete', 'NATIVE_INVENTORY_INCOMPLETE', () => {
      if (!phaseAudit?.nativeListingComplete || !phaseAudit.nativeOfficeHierarchyQualified || !phaseAudit.nativeDepartmentHierarchyQualified
        || phaseAudit.originalNativeBoard?.name !== 'Biofourmis' || phaseAudit.issues.length) throw Error('Full feed/office/department native reconciliation failed')
      if (!exactKeys(phaseAudit.originalNativeFeed, ['jobs', 'meta']) || !exactKeys(phaseAudit.originalNativeFeed.meta, ['total'])
        || !exactKeys(phaseAudit.originalNativeDepartments, ['departments']) || !exactKeys(phaseAudit.originalNativeOffices, ['offices']))
        throw Error('Unreviewed native inventory envelope or pagination metadata')
      verifyHostedBoard(requirePage(phaseName, BOARD).originalText, phaseAudit.originalNativeFeed)
    }, { phase: phaseName })
  }
  check('closingMatches', 'CLOSING_INVENTORY_CHANGED', () => {
    for (const field of ['originalNativeFeed', 'originalNativeOffices', 'originalNativeDepartments', 'originalNativeBoard'])
      if (!same(audit.opening?.[field], audit.closing?.[field])) throw Error('Opening and closing ' + field + ' changed')
    if (!same(audit.opening?.nativePostIds, audit.closing?.nativePostIds)
      || audit.observationHistory.some(row => !same(row.earlier.sourceNativeRecord, row.current.sourceNativeRecord))) throw Error('Opening and closing native role records changed')
  })
  // Recover only the shared visual-tree omission: independently validate both
  // original native own models under this source's executing-script binding.
  // Existing positives keep their original collector semantics and raw facts.
  if (proof.coreEmployerBinding && ['opening', 'closing'].some(name => audit[name]?.currentPrimaryDeclarationQualified === false)) {
    const recovered = audit.observations.filter(job => job.sourceNativeDetailQualified && job.sourceNativePostKind === 'job'
      && !job.sourceNativeCountryConflict && (job.country === 'India' || job.sourceCountryScopeUnresolved)
      && audit.observationHistory.some(row => String(row.postId) === job.jobId && row.earlier.sourceNativeDetailQualified
        && row.current.sourceNativeDetailQualified && same(row.earlier.sourceNativeRecord, row.current.sourceNativeRecord)))
    const selected = Number.isSafeInteger(options.maxJobs) ? recovered.slice(0, options.maxJobs) : recovered
    const previous = jobs, observations = readSourceObservationEvidence(previous, 'biofourmis')
    jobs = selected.map(job => ({ ...job, scrapedAt: now(), sourcePublicNativePostingIdentityQualified: true }))
    Object.defineProperty(jobs, 'sourceAudit', { value: audit })
    if (observations) attachSourceObservationEvidence(jobs, observations)
  }
  const india = audit.observations.filter(job => job.sourceNativePostKind === 'job' && job.sourceNativeCountries?.includes('India'))
  for (const job of audit.observations) {
    check('countryPartitionComplete', 'NATIVE_COUNTRY_OR_IDENTITY_UNRESOLVED', () => {
      if (!job.sourceNativeDetailQualified || job.sourceNativeCountryConflict || job.sourceCountryScopeUnresolved
        || !['job', 'prospect'].includes(job.sourceNativePostKind)) throw Error('Native posting identity, kind or all-location country scope unresolved: ' + job.jobId)
    }, { id: job.jobId })
    if (job.sourceNativePostKind !== 'job' || !job.sourceNativeCountries?.includes('India')) continue
    let detail = null, qualified = true
    for (const phaseName of ['opening', 'closing']) {
      try {
        const native = audit.observationHistory.find(row => String(row.postId) === job.jobId)?.[phaseName === 'opening' ? 'earlier' : 'current']?.sourceNativeRecord
        if (!native) throw Error('Paired original native detail missing')
        const response = requirePage(phaseName, native.absolute_url)
        detail = verifyHostedDetail(response.originalText, native, response.completedAt)
      } catch (error) { signal?.throwIfAborted();qualified = false;issue('INDIA_PUBLIC_DETAIL_UNVERIFIED', { id: job.jobId, phase: phaseName, message: error.message }) }
    }
    if (!qualified) proof.selectedIndiaDetailsComplete = false
    for (const target of [job, ...jobs.filter(row => row.jobId === job.jobId)]) Object.assign(target, {
      sourceDetailComplete: qualified, sourcePublicDetailComplete: qualified,
      ...(detail ? { sourceNativeHostedRecord: detail.nativeHostedRecord,
        sourcePublicFullPublishedDescription: detail.fullPublishedDescription,
        sourcePublicApplicationEvidence: qualified ? detail.application : { state: 'unverified', submitted: false } } : {}),
    })
  }
  check('selectedIndiaDetailsComplete', 'INDIA_SELECTION_TRUNCATED', () => {
    if (jobs.length !== india.length || jobs.some(job => job.country !== 'India' || job.sourceCountryScopeUnresolved)) throw Error('Selected India candidates incomplete or maxJobs truncated')
  })
  const receiptTimes = []
  check('closingMatches', 'CAPTURE_NOT_CURRENT', () => {
    if (!Number.isFinite(observedClock) || !responses.length) throw Error('Invalid proof clock')
    for (const response of responses) {
      const start = Date.parse(response.requestedAt), end = Date.parse(response.completedAt)
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end > observedClock || observedClock - end > 48 * 3600000)
        throw Error('Original receipt time missing, future, or older than 48 hours')
      receiptTimes.push(end)
    }
  })
  proof.complete = !failures.length && ['coreEmployerBinding', 'currentEmployerBinding', 'advertisedSurfacesComplete', 'nativeInventoryComplete',
    'countryPartitionComplete', 'selectedIndiaDetailsComplete', 'closingMatches'].every(key => proof[key])
  if (proof.complete) proof.verifiedAt = new Date(Math.max(...receiptTimes)).toISOString()
  for (const job of [...audit.observations, ...jobs]) Object.assign(job, {
    sourceScopeComplete: proof.complete, sourceListingComplete: proof.complete, lifecycleCleanupAllowed: proof.complete,
    sourcePublicInventoryScope: PUBLIC_SCOPE, sourceLegalEmployer: null, sourceWholeCompanyScope: null,
  })
  Object.assign(audit, { publicInventoryProof: proof, publicScopeResponses: responses, publicScopeRequests: requests,
    sourceScopeComplete: proof.complete, lifecycleCleanupAllowed: proof.complete, wholeCompanyScope: null, legalEmployer: null,
    originalNativeQualification: audit.qualification, publicInventoryScope: PUBLIC_SCOPE,
    qualification: proof.complete ? 'Current unfiltered employer-advertised public inventory verified; legal-company universality unknown.'
      : 'Public source scope remains incomplete. Original native models and independently qualified positives retained; no authoritative company zero or cleanup.' })
  attachInventoryEvidence(jobs, { status: proof.complete ? (proof.nativeReportedTotal === 0 ? 'verified-empty' : 'complete-inventory') : 'coverage-gap',
    firstParty: proof.currentEmployerBinding, surface: API + '/jobs?content=true', listingComplete: proof.complete,
    reportedTotal: proof.complete ? proof.nativeReportedTotal : null, indiaFacetCount: proof.complete ? india.length : null,
    pagesFetched: responses.filter(response => response.url === API + '/jobs?content=true' && original(response)).length,
    verifiedAt: proof.verifiedAt, reason: proof.complete ? 'Current employer-advertised unfiltered public native inventory, full India criteria/application form and stable closing verified.'
      : 'Incomplete public inventory proof: ' + [...new Set(failures.map(failure => failure.code))].join(', ') })
  await options.onAudit?.(structuredClone(audit))
  signal?.throwIfAborted()
  return jobs
} })
