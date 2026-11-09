import { createHash } from 'node:crypto'
import { decodeHTML } from 'entities'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { extractActiveDescription, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'

export const CORPORATE_CAREERS_URL = 'https://ascendion.com/who-we-are/careers/'
const CAREERS = 'https://jobs.ascendion.com/careers'
const hash = body => createHash('sha256').update(body).digest('hex')
const text = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const idOf = value => typeof value === 'string' && /^[\w-]{1,160}$/.test(value) ? value
  : Number.isSafeInteger(value) && value > 0 ? String(value) : null
const fault = (message, identity = false) => Object.assign(new Error(`Ascendion ${message}`), {
  code: identity ? 'ASCENDION_NATIVE_IDENTITY' : 'ASCENDION_NATIVE_INCOMPLETE', abortRetries: true,
})
const bound = (value, fallback, maximum) => Number.isSafeInteger(value) && value > 0 ? Math.min(value, maximum) : fallback

// Only an explicit native country name/code supplies a country. In particular,
// the corporate India link, a city, "Remote" and the query are not countries.
const standardCountry = value => {
  const token = text(value).split(',').at(-1)?.trim()
  return /^[A-Z]{2}$/.test(token) && nativeCountryName(token) ? token : /^India$/i.test(token) ? 'IN' : null
}
const displayCountry = value => {
  const token = text(value).split(',').at(-1)?.trim()
  if (/^(?:India|IN)$/i.test(token)) return 'IN'
  if (/^(?:United States(?: of America)?|USA|US)$/i.test(token)) return 'US'
  if (/^(?:United Kingdom|UK|GB)$/i.test(token)) return 'GB'
  return null
}

export const inspectNativeWorkplaces = (position = {}, detail = {}) => {
  const owner = Object.hasOwn(detail, 'locations') || Object.hasOwn(detail, 'standardizedLocations') ? detail : position
  const locations = Array.isArray(owner.locations) ? owner.locations : []
  const standardized = Array.isArray(owner.standardizedLocations) ? owner.standardizedLocations : []
  const workplaces = Array.from({ length: Math.max(locations.length, standardized.length, 1) }, (_, index) => {
    const location = text(locations[index]) || null
    const standardizedLocation = text(standardized[index]) || null
    const nativeCode = standardCountry(standardizedLocation)
    const displayCode = displayCountry(location)
    const countryConflict = Boolean(nativeCode && displayCode && nativeCode !== displayCode)
    return { index, primary: index === 0, location, standardizedLocation,
      countryCode: countryConflict ? null : nativeCode || displayCode,
      countryEvidence: countryConflict ? 'conflicting-native-country' : nativeCode ? 'native-standardized-location-country'
        : displayCode ? 'native-location-explicit-country' : 'unresolved-native-country', countryConflict }
  })
  // A separate primary field may not silently introduce another workplace.
  if (text(owner.location) && !locations.some(location => text(location) === text(owner.location))) {
    workplaces.push({ index: workplaces.length, primary: true, location: text(owner.location), standardizedLocation: null,
      countryCode: displayCountry(owner.location), countryEvidence: 'separate-native-primary-location', countryConflict: false })
  }
  return { workplaces, india: workplaces.filter(location => location.countryCode === 'IN'),
    unresolved: workplaces.filter(location => !location.countryCode) }
}

const criteriaPresent = (html, title) => {
  let content = extractActiveDescription(html) || ''
  if (!content || /(?:Standard Job Title[\s\S]*No\. of Positions[\s\S]*){2}/i.test(content)) return false
  // The published company introduction mentions engineering, experience and
  // leadership. Those words do not prove this position has authored criteria.
  content = content
    .replace(/\bAbout Ascendion\b/gi, ' ')
    .replace(/\bAscendion is (?:an?|the)\b[\s\S]*?Learn more at (?:www\.)?ascendion\.com\.?/gi, ' ')
    .replace(/\bAscendion\s*\|\s*Engineering to elevate life\b/gi, ' ')
    .replace(/\bWe have a culture built[\s\S]*?Come,?\s*change the world with us:/gi, ' ')
    .replace(/\bBuild the coolest tech for (?:the )?world['’]?s leading brands\b/gi, ' ')
    .replace(/\bSolve complex problems\s*[–-]\s*and learn new skills\b/gi, ' ')
    .replace(/\bExperience the power of transforming digital engineering for Fortune 500 clients\b/gi, ' ')
    .replace(/\bMaster your craft with leading training programs and hands-on experience\b/gi, ' ')
    .replace(/\bExperience a community of change makers![\s\S]*?allows everyone to be their best at Ascendion\.?/gi, ' ')
  content = content.split(/Want to change the world\?/i)[0]
  const titlePattern = text(title).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (titlePattern) content = content.replace(new RegExp(titlePattern, 'gi'), ' ')
  return /\b(?:qualifications?|requirements?|responsibilities|skills?|experience|proficien\w*|knowledge|degree|certification|develop\w*|build\w*|design\w*|maintain\w*|implement\w*|monitor\w*|manag\w*|support\w*|test\w*|lead\w*|automat\w*|integrat\w*)\b/i.test(content)
}

const fingerprint = row => JSON.stringify([idOf(row.id), text(row.name), row.displayJobId, row.atsJobId,
  row.locations, row.standardizedLocations, row.positionUrl, row.workLocationOption])

export async function collectAscendionNative({ mapPositionToJob, buildSearchUrl, buildDetailUrl, defaults = {} }, options = {}) {
  const settings = { ...defaults, ...options }
  const signal = options.signal
  const cancelled = () => { if (signal?.aborted) throw signal.reason }
  cancelled()
  const began = Date.now()
  const deadlineMs = bound(settings.deadlineMs, 300_000, 300_000)
  const requestTimeoutMs = bound(settings.requestTimeoutMs, 20_000, 20_000)
  const maxRequests = bound(settings.maxRequests, 400, 600)
  const maxPages = bound(settings.maxPages, 60, 100)
  const maxResponseBytes = bound(settings.maxResponseBytes, 15_000_000, 15_000_000)
  const maxTotalBytes = bound(settings.maxTotalBytes, 40_000_000, 40_000_000)
  const concurrency = bound(settings.detailConcurrency, 6, 8)
  const stop = new AbortController()
  const retainedResponses = [], failures = [], exclusions = [], unknownCountryObservations = [], details = new Map()
  let requests = 0, totalBytes = 0, fatalIdentity = null

  const read = async (url, stage, json = false) => {
    cancelled()
    if (stop.signal.aborted) throw stop.signal.reason
    if (requests >= maxRequests) throw fault('request budget exhausted')
    requests++
    const remaining = deadlineMs - (Date.now() - began)
    if (remaining <= 0) throw fault('source deadline exceeded')
    const controller = new AbortController()
    const signals = [controller.signal, stop.signal, ...(signal ? [signal] : [])]
    const requestSignal = AbortSignal.any(signals)
    const timeout = setTimeout(() => controller.abort(fault('request timeout/deadline exceeded')), Math.min(requestTimeoutMs, remaining))
    const requestedAt = new Date().toISOString()
    let abortListener
    try {
      const operation = async () => {
        let raw, finalUrl = url, status = 200, representation = 'native-response-body', payload
        if (json && typeof options.fetchJson === 'function') {
          payload = await options.fetchJson(url, { signal: requestSignal, timeoutMs: requestTimeoutMs })
          cancelled()
          raw = JSON.stringify(payload)
          representation = 'injected-parsed-json-serialization'
        } else if (typeof options.fetchText === 'function') {
          const result = await options.fetchText(url, { signal: requestSignal, timeoutMs: requestTimeoutMs })
          cancelled()
          if (typeof result === 'string' || Buffer.isBuffer(result)) raw = result
          else { raw = result?.body; finalUrl = result?.url || url; status = result?.status ?? 200 }
        } else {
          const response = await (options.fetchImpl || globalThis.fetch)(url, {
            method: 'GET', signal: requestSignal, redirect: 'follow',
            headers: { Accept: json ? 'application/json' : 'text/html,text/javascript', 'User-Agent': settings.userAgent || 'Mozilla/5.0' },
          })
          cancelled()
          finalUrl = response.url || url
          status = response.status
          if (response.body?.getReader) {
            const reader = response.body.getReader(), chunks = []
            let bytes = 0
            const cancelReader = () => { try { Promise.resolve(reader.cancel(requestSignal.reason)).catch(() => {}) } catch {} }
            requestSignal.addEventListener('abort', cancelReader, { once: true })
            try {
              while (true) {
                const item = await reader.read()
                cancelled()
                if (requestSignal.aborted) throw requestSignal.reason
                if (item.done) break
                const chunk = Buffer.from(item.value)
                bytes += chunk.length
                if (bytes > maxResponseBytes || totalBytes + bytes > maxTotalBytes) throw fault('response byte budget exceeded')
                chunks.push(chunk)
              }
              raw = Buffer.concat(chunks)
            } catch (error) { cancelReader(); throw error }
            finally { requestSignal.removeEventListener('abort', cancelReader); try { reader.releaseLock() } catch {} }
          } else raw = await response.text()
        }
        cancelled()
        if (requestSignal.aborted) throw requestSignal.reason
        if (typeof raw !== 'string' && !Buffer.isBuffer(raw)) throw fault('reader did not return a response body')
        const body = Buffer.isBuffer(raw) ? raw : Buffer.from(raw)
        totalBytes += body.length
        if (body.length > maxResponseBytes || totalBytes > maxTotalBytes) throw fault('response byte budget exceeded')
        const receipt = { url, finalUrl, method: 'GET', stage, status, requestedAt, completedAt: new Date().toISOString(),
          bytes: body.length, bodySHA256: hash(body), rawBodyBase64: body.toString('base64'), bodyRepresentation: representation }
        retainedResponses.push(receipt)
        if (new URL(finalUrl).href !== new URL(url).href) throw fault('response identity redirected outside the requested native document', true)
        if (status !== 200) throw fault(`HTTP ${status} during ${stage}`)
        if (json) {
          try { payload ??= JSON.parse(body.toString()) } catch { throw fault('native JSON body is malformed') }
          if (payload?.status !== 200 || payload?.error?.message || payload?.metadata?.isFallback === true) throw fault('native API failed or supplied a fallback document')
          return { value: payload, receipt }
        }
        return { value: body.toString(), receipt }
      }
      return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => {
        abortListener = () => reject(requestSignal.reason)
        requestSignal.addEventListener('abort', abortListener, { once: true })
        if (requestSignal.aborted) abortListener()
      })])
    } catch (error) { cancelled(); throw error }
    finally { clearTimeout(timeout); if (abortListener) requestSignal.removeEventListener('abort', abortListener) }
  }

  // The current India card owns this scope; the domain's other regional cards
  // are distinct published surfaces, not evidence that Remote means India.
  const corporate = (await read(CORPORATE_CAREERS_URL, 'official-handoff')).value
  const corporateDocument = readNativeDocument(corporate)
  const indiaCards = corporateDocument.nodes(node => node.tag === 'div' && corporateDocument.hasClass(node, 'promo-grid__card'))
    .filter(card => corporateDocument.nodes(node => node.tag === 'p' && corporateDocument.hasClass(node, 'promo-grid__card-label'), card)
      .some(label => corporateDocument.text(label) === 'India'))
  const indiaLinks = indiaCards.length === 1 ? corporateDocument.nodes(node => node.tag === 'a' && node.attrs.href, indiaCards[0]) : []
  if (indiaLinks.length !== 1 || new URL(indiaLinks[0].attrs.href, CORPORATE_CAREERS_URL).href !== CAREERS) throw fault('official India careers handoff identity is missing or changed', true)
  const career = (await read(CAREERS, 'native-careers')).value
  let boot
  try { boot = JSON.parse(decodeHTML(career.match(/<code\b[^>]*id=["']pcsx-data["'][^>]*>([\s\S]*?)<\/code>/i)?.[1] || '')) }
  catch { throw fault('native careers identity/configuration is missing', true) }
  const pcsx = boot.configs?.pcsxConfig
  if (boot.domain !== 'ascendion.com' || pcsx?.enabled !== true || pcsx.branding?.companyName !== 'Ascendion') throw fault('native careers employer identity does not match Ascendion', true)
  const careerDocument = readNativeDocument(career)
  const publishedScripts = careerDocument.nodes(node => node.tag === 'script' && /\/pcsxPwa\.[a-f\d]+\.js$/.test(node.attrs.src || ''))
  const published = publishedScripts.length === 1 ? publishedScripts[0].attrs.src : null
  let protocolUrl
  try { protocolUrl = new URL(published, CAREERS).href } catch {}
  if (!protocolUrl || !/^https:\/\/jobs\.ascendion\.com\/gen\/js\/pcsxPwa\.[a-f\d]+\.js$/.test(protocolUrl)) throw fault('published native protocol identity is missing', true)
  const protocol = (await read(protocolUrl, 'published-protocol')).value
  if (!protocol.includes('/api/pcsx/search?domain=') || !protocol.includes('/api/pcsx/position_details?')
    || !protocol.includes('&start=') || !protocol.includes('position_id:')) throw fault('published native GET protocol changed', true)

  const enumerate = async stage => {
    const rows = [], byId = new Map(), pages = []
    let count = null, complete = false, offset = 0
    for (let page = 0; page < maxPages; page++) {
      try {
        const { value: payload, receipt } = await read(buildSearchUrl({ start: offset }), stage, true)
        const data = payload.data
        if (!Array.isArray(data?.positions) || !Number.isSafeInteger(data.count) || data.count < 0 || data.count > 100_000) throw fault('native listing shape/count is invalid')
        if (count !== null && count !== data.count) throw fault('native listing count changed')
        count = data.count
        const ids = []
        for (const position of data.positions) {
          const id = idOf(position.id)
          if (!id || !text(position.name) || position.positionUrl !== `/careers/job/${id}`) throw fault('native listing identity is invalid', true)
          ids.push(id)
          if (byId.has(id)) {
            if (fingerprint(byId.get(id)) !== fingerprint(position)) throw fault('duplicate native listing identity changed', true)
            failures.push({ stage, kind: 'duplicate-native-id', id })
          } else byId.set(id, position)
          rows.push(position)
        }
        pages.push({ start: offset, rawRows: data.positions.length, count, ids, bodySHA256: receipt.bodySHA256 })
        if (!data.positions.length) { complete = byId.size === count && rows.length === count; break }
        offset += data.positions.length
        if (rows.length > count || offset > 100_000) throw fault('native raw rows exceed declared count')
      } catch (error) {
        cancelled()
        if (error?.code === 'ASCENDION_NATIVE_IDENTITY') throw error
        failures.push({ stage, kind: 'native-pagination', message: error?.message || 'Native listing unavailable' })
        break
      }
    }
    if (!complete) failures.push({ stage, kind: 'incomplete-native-inventory' })
    return { rows, positions: [...byId.values()], count, complete, pages }
  }

  const opening = await enumerate('native-pagination')
  const positions = opening.positions
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, positions.length) }, async () => {
    while (!fatalIdentity && cursor < positions.length) {
      cancelled()
      const position = positions[cursor++], id = idOf(position.id)
      try {
        const { value: payload, receipt } = await read(buildDetailUrl(id), 'native-detail', true)
        const detail = payload.data
        if (!detail || idOf(detail.id) !== id || !text(detail.name) || text(detail.name) !== text(position.name)
          || detail.positionUrl !== `/careers/job/${id}` || detail.publicUrl !== `${CAREERS}/job/${id}`
          || detail.displayJobId !== position.displayJobId || detail.atsJobId !== position.atsJobId
          || [detail.companyName, detail.employerName, typeof detail.company === 'string' ? detail.company : detail.company?.name,
            typeof detail.employer === 'string' ? detail.employer : detail.employer?.name]
            .some(value => value != null && text(value) !== 'Ascendion')) throw fault(`native detail identity does not match requested position ${id}`, true)
        const locationSet = value => JSON.stringify((Array.isArray(value) ? value : []).map(text))
        if (locationSet(position.locations) !== locationSet(detail.locations)
          || locationSet(position.standardizedLocations) !== locationSet(detail.standardizedLocations)) {
          failures.push({ stage: 'native-country', kind: 'listing-detail-workplace-mismatch', id })
        }
        const countries = inspectNativeWorkplaces(position, detail)
        const complete = typeof detail.jobDescription === 'string' && criteriaPresent(detail.jobDescription, detail.name)
        details.set(id, { detail, countries, complete, descriptionEvidence: { nativeField: 'data.jobDescription',
          completeNativeFieldRetained: typeof detail.jobDescription === 'string', bodySHA256: receipt.bodySHA256,
          htmlSHA256: hash(String(detail.jobDescription || '')), authoredCriteriaPresent: complete } })
        if (!complete) failures.push({ stage: 'native-content', kind: 'missing-authored-criteria', id })
        if (countries.unresolved.length) unknownCountryObservations.push({ id, workplaces: countries.unresolved })
      } catch (error) {
        cancelled()
        if (error?.code === 'ASCENDION_NATIVE_IDENTITY') { fatalIdentity = error; stop.abort(error); break }
        if (fatalIdentity) break
        failures.push({ stage: 'native-detail', kind: 'detail-unavailable', id, message: error?.message || 'Native detail unavailable' })
      }
    }
  }))
  cancelled()
  if (fatalIdentity) { fatalIdentity.retainedResponses = retainedResponses; throw fatalIdentity }
  const closing = await enumerate('closing-inventory')
  const same = (left, right) => JSON.stringify(left.map(fingerprint).sort()) === JSON.stringify(right.map(fingerprint).sort())
  const closingMatches = opening.complete && closing.complete && opening.count === closing.count && same(opening.positions, closing.positions)
  if (!closingMatches) failures.push({ stage: 'closing-inventory', kind: 'closing-inventory-mismatch' })
  if (unknownCountryObservations.length) failures.push({ stage: 'native-country', kind: 'unresolved-native-workplaces', count: unknownCountryObservations.length })
  let jobs = []
  for (const position of positions) {
    const id = idOf(position.id), item = details.get(id)
    if (!item) continue
    if (!item.countries.india.length) {
      exclusions.push({ id, exclusionReason: item.countries.unresolved.length ? 'unresolved-native-country' : 'explicit-non-india-native-workplaces', workplaces: item.countries.workplaces })
      continue
    }
    const job = mapPositionToJob(position, item.detail)
    jobs.push({ ...job, source: 'ascendion', link: job.applyUrl || job.sourceUrl, scrapedAt: new Date().toISOString(),
      sourceDescriptionHtml: item.detail.jobDescription ?? null, sourceWorkplaces: item.countries.workplaces,
      sourceDetailComplete: item.complete, ...(item.complete ? {} : { sourceDetailFailureKind: 'missing-authored-criteria' }),
      sourceDescriptionEvidence: item.descriptionEvidence })
  }
  const maxJobs = Number.isSafeInteger(settings.maxJobs) && settings.maxJobs >= 0 ? settings.maxJobs : null
  if (maxJobs !== null && jobs.length > maxJobs) { jobs = jobs.slice(0, maxJobs); failures.push({ stage: 'output-limit', kind: 'selected-job-limit' }) }
  const sourceScopeComplete = opening.complete && closingMatches && failures.length === 0 && details.size === positions.length
  const evidence = { source: 'ascendion', scope: 'current-official-India-careers-PCSX-surface', sourceScopeComplete,
    cleanupSafe: sourceScopeComplete, observedListingCount: positions.length, observedNativeRowCount: opening.rows.length,
    nativeQueryReportedCount: opening.count, companyGlobalTotal: null, companyIndiaTotal: sourceScopeComplete ? jobs.length : null,
    candidateDetails: positions.length, jobs: jobs.map(job => ({ id: job.jobId })), exclusions, failures,
    unknownCountryObservations, listingPaginationComplete: opening.complete, closingInventoryMatches: closingMatches,
    nativeDetailAudit: [...details].map(([id, item]) => ({ id, nativeTitle: item.detail.name,
      nativePositionUrl: item.detail.positionUrl, nativePublicUrl: item.detail.publicUrl,
      workplaces: item.countries.workplaces, sourceDetailComplete: item.complete, descriptionEvidence: item.descriptionEvidence })),
    openingPages: opening.pages, closingPages: closing.pages, retainedResponses,
    bounds: { requestTimeoutMs, deadlineMs, maxRequests, requests, maxResponseBytes, maxTotalBytes, totalBytes, detailConcurrency: concurrency },
    protocolUrl, officialHandoff: { url: CORPORATE_CAREERS_URL, label: 'India', nativeCareers: CAREERS } }
  const { jobs: extracted, exclusions: excluded, retainedResponses: responses, openingPages, closingPages,
    nativeDetailAudit, unknownCountryObservations: unknown, ...rest } = evidence
  const compact = { ...rest, extractedDetailJobs: extracted.length, excludedDetailJobs: excluded.length,
    firstExtractedJobID: jobs[0]?.jobId || null, retainedResponseCount: responses.length,
    retainedResponsesOnFirstExtractedJob: true, fullBatchEvidenceOnFirstExtractedJob: true,
    unknownCountryObservationCount: unknown.length }
  jobs = jobs.map((job, index) => ({ ...job, sourceListingComplete: sourceScopeComplete, sourceScopeComplete,
    staleCleanupSafe: sourceScopeComplete, nativeCollectionEvidence: index === 0 ? evidence : compact }))
  attachSourceObservationEvidence(jobs, { source: 'ascendion', recordKind: 'vacancy-rows',
    observedRecordCount: positions.length, observedVacancyCount: positions.length, sourceScopeComplete: false })
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: evidence, configurable: true })
  attachInventoryEvidence(jobs, { status: sourceScopeComplete ? jobs.length ? 'complete-inventory' : 'verified-empty' : 'discovery-only',
    surface: CAREERS, firstParty: true, listingComplete: sourceScopeComplete,
    pagesFetched: opening.pages.length + closing.pages.length,
    reportedTotal: sourceScopeComplete ? jobs.length : null, indiaFacetCount: sourceScopeComplete ? jobs.length : null,
    verifiedAt: new Date().toISOString(), reason: sourceScopeComplete ? 'current-official-India-handoff;full-native-fields;all-countries-explicit;matching-opening-and-closing-inventory'
      : 'partial-native-observations;unresolved-country-content-pagination-or-bound;cleanup-forbidden' })
  cancelled()
  return jobs
}
