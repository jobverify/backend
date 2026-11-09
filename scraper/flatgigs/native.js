import { createHash } from 'node:crypto'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { inspectOfficialPage, inspectNativeClient } from './nativeBinding.js'
import { readWidgetInventory, projectIndiaObservations, inventoriesMatch } from './nativeWidget.js'
import { fetchNativePacket, readEvidencePacket } from './nativeTransport.js'
import { SOURCE, COMPANY, CAREERS_URL, EMBED_URL, CLIENT_URL, gap, failure, iso, need } from './nativeContract.js'
export { SOURCE, COMPANY, CAREERS_URL }

const ownData = value => {
  need(value && typeof value === 'object', 'missing native response metadata')
  const data = Object.create(null)
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) if (Object.hasOwn(descriptor, 'value')) data[key] = descriptor.value
  return data
}
const packet = (input, url) => {
  const raw = ownData(input), expected = url === EMBED_URL ? 302 : 200
  if (raw.status !== expected) throw failure('native HTTP ' + String(raw.status), { status: raw.status, code: [401, 403].includes(raw.status) ? 'access_denied' : raw.status === 429 ? 'rate_limited' : 'native_unavailable' })
  need(raw.url === url && raw.finalUrl === url, 'native receipt URL identity contradiction')
  need(typeof raw.body === 'string' && Buffer.byteLength(raw.body) <= 8 * 1024 * 1024, 'missing or oversized native receipt body')
  need(url === EMBED_URL ? raw.redirectLocation === CLIENT_URL : !raw.redirectLocation, 'native receipt redirect contradiction')
  need(typeof raw.contentType === 'string' && (url === CAREERS_URL || url === EMBED_URL ? /^text\/html(?:\s*;|$)/i.test(raw.contentType) : /^(?:application|text)\/javascript(?:\s*;|$)/i.test(raw.contentType)), 'native receipt content type contradiction')
  const bytes = Buffer.byteLength(raw.body), sha256 = createHash('sha256').update(raw.body).digest('hex')
  need(raw.bytes == null || raw.bytes === bytes, 'native receipt byte fingerprint contradiction')
  need(raw.sha256 == null || raw.sha256 === sha256, 'native receipt body fingerprint contradiction')
  return { url, finalUrl: url, status: raw.status, contentType: raw.contentType, redirectLocation: raw.redirectLocation || null, body: raw.body, bytes, sha256, startedAt: iso(raw.startedAt), capturedAt: iso(raw.capturedAt), captureClockInjected: raw.captureClockInjected === true, evidenceOrigin: typeof raw.evidenceOrigin === 'string' ? raw.evidenceOrigin : null, originalMetadata: Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'body')) }
}
const errorData = error => ({ name: error?.name || 'Error', message: String(error?.message || error), code: error?.code || null, status: error?.status ?? null })
const compactPacket = value => ({ url: value.url, status: value.status, bytes: value.bytes, sha256: value.sha256, startedAt: value.startedAt, capturedAt: value.capturedAt })

export const readNativeAudit = jobs => Object.getOwnPropertyDescriptor(jobs || {}, 'nativeCollectionEvidence')?.value || null

export const collect = async ({ signal, fetchPacket, fetchImpl, requestTimeoutMs = 20000, maximumBytes, captureClock } = {}) => {
  signal?.throwIfAborted()
  const receipts = []; let attempts = 0, official = null, client = null, opening = null, detail = null, closing = null, closingPacket = null, detailPacket = null, lastError = null
  const read = async url => {
    signal?.throwIfAborted(); attempts++
    const raw = fetchPacket ? await readEvidencePacket(fetchPacket, url, { signal, requestTimeoutMs }) : await fetchNativePacket(url, { signal, fetchImpl, requestTimeoutMs, maximumBytes, captureClock })
    signal?.throwIfAborted()
    const qualified = packet(raw, url); receipts.push(qualified); return qualified
  }
  try {
    const employer = await read(CAREERS_URL); official = inspectOfficialPage(employer.body); signal?.throwIfAborted()
    await read(official.scriptURL)
    const script = await read(CLIENT_URL); client = inspectNativeClient(script.body, official); signal?.throwIfAborted()
    const titlePacket = await read(client.titlesURL)
    opening = readWidgetInventory(titlePacket.body, { mode: 'titles', observedAt: titlePacket.capturedAt }); signal?.throwIfAborted()
    detailPacket = await read(client.detailsURL)
    detail = readWidgetInventory(detailPacket.body, { mode: 'details', observedAt: detailPacket.capturedAt }); signal?.throwIfAborted()
    closingPacket = await read(client.detailsURL)
    closing = readWidgetInventory(closingPacket.body, { mode: 'details', observedAt: closingPacket.capturedAt }); signal?.throwIfAborted()
  } catch (error) {
    signal?.throwIfAborted()
    if (!opening || !opening.groups.length && !detail?.groups.length) {
      if (error && typeof error === 'object' && error.abortRetries === true) { error.inventoryEvidence = gap(error.message, receipts.length); throw error }
      throw failure(error?.message || 'native source unavailable', { cause: error, inventoryEvidence: gap(error?.message || 'native source unavailable', receipts.length) })
    }
    lastError = errorData(error)
  }
  const crossModeMatches = inventoriesMatch(opening, detail, { omitDescription: true }), closingMatches = closing ? inventoriesMatch(detail, closing) : null
  const processingReference = new Date().toISOString()
  const closingTimes = Boolean(detailPacket?.startedAt && detailPacket?.capturedAt && closingPacket?.startedAt && closingPacket?.capturedAt && detailPacket.startedAt <= detailPacket.capturedAt && detailPacket.capturedAt <= processingReference && closingPacket.startedAt >= detailPacket.capturedAt && closingPacket.capturedAt > detailPacket.capturedAt && closingPacket.startedAt <= closingPacket.capturedAt && closingPacket.capturedAt <= processingReference)
  const sameModeClosingQualified = Boolean(crossModeMatches && closingMatches && closingTimes)
  const jobs = projectIndiaObservations(opening, detail, closing)
  for (const job of jobs) { job.nativeSameModeClosingQualified = sameModeClosingQualified; job.nativePublisherHandoffQualified = Boolean(official && client); job.nativeCurrentAvailabilityQualified = false }
  const observedIds = new Set([opening, detail, closing].flatMap(snapshot => snapshot?.groups.map(group => group.shortcode) || [])), latest = closing || detail || opening
  const times = receipts.map(value => value.capturedAt).filter(Boolean).sort(), oldestCapturedAt = times.length === receipts.length ? times[0] : null
  const reason = lastError ? 'native-widget-positive-partial-observations-with-unavailable-closing-or-detail' : !sameModeClosingQualified ? 'native-widget-observations-with-unqualified-same-mode-closing' : 'matching-widget-observations-with-unqualified-company-and-legal-employer-scope'
  const compact = { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: observedIds.size, observedVacancyCount: observedIds.size, observedListingCount: latest.rawRowCount, distinctVariantCount: latest.distinctVariantCount, extraLocationVariants: latest.extraVariantCount, openingObservedRecordCount: opening.groups.length, detailObservedRecordCount: detail?.groups.length ?? null, closingObservedRecordCount: closing?.groups.length ?? null, openingObservationQualified: true, detailObservationQualified: Boolean(detail), closingObservationQualified: Boolean(closing), sameModeClosingQualified, successfulResponses: receipts.length, oldestCapturedAt, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null, lifecycleEligible: false, legalEmployerQualified: false, reciprocalDomainQualified: false, rawProvenanceLimit: 'One publisher account; location variants and native API criteria are observations, not legal-employer/current-availability or whole-company scope proof' }
  const audit = { ...compact, requestAttempts: attempts, responsesAcquired: receipts.length, crossModeInventoryMatches: crossModeMatches, closingInventoryMatches: closingMatches, packets: receipts, rawOpening: opening.raw, rawDetails: detail?.raw || null, rawClosing: closing?.raw || null, official, client, lastError, transportOrigin: fetchPacket ? 'injected-retained-evidence' : captureClock || fetchImpl ? 'HTTP-path-with-injected-replay-component' : 'native-http-get' }
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: audit })
  if (jobs.length) jobs[0].nativeCollectionEvidence = { ...compact, packetReferences: receipts.map(compactPacket), reason }
  attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: observedIds.size, observedVacancyCount: observedIds.size, sourceScopeComplete: false })
  return attachInventoryEvidence(jobs, gap(reason, receipts.length))
}
