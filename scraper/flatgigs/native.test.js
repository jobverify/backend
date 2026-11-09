import test from 'node:test'
import assert from 'node:assert/strict'
import { collect, readNativeAudit } from './native.js'
import { DETAILS_URL, CAREERS_URL } from './nativeContract.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { getScraperCatalog, createCatalogScraper, decorateJobsWithProviderMetadata } from '../../scraper-support/providers/index.js'
import { packets, primary, details, titleData, detailData, clone, jsonp, changedPacket, fixtureReader } from './test-data/fixture.mjs'
const provider = getScraperCatalog().find(provider => provider.source === 'flatgigs')
const hypotheticalClosing = (body = details.body) => ({ ...changedPacket(details, body), startedAt: '2026-10-31T18:51:17.000Z', capturedAt: '2026-10-31T18:51:18.000Z', evidenceOrigin: 'CONTROLLED_HYPOTHETICAL_SIXTH_RESPONSE_NOT_A_NATIVE_CAPTURE' })
const gapAssertions = jobs => {
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap'); assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null); assert.equal(evidence.indiaFacetCount, null); assert.equal(evidence.verifiedAt, null)
}
test('actual five retained responses preserve three partial India observations without inventing an actual sixth', async () => {
  const fixture = fixtureReader(), jobs = await collect({ fetchPacket: fixture.read }), audit = readNativeAudit(jobs)
  assert.equal(jobs.length, 3); assert.equal(fixture.seen.length, 6)
  assert.deepEqual(fixture.seen.map(row => row.url), [...packets.map(packet => packet.url), DETAILS_URL])
  assert.equal(audit.responsesAcquired, 5); assert.equal(audit.requestAttempts, 6)
  assert.equal(audit.openingObservationQualified, true); assert.equal(audit.detailObservationQualified, true)
  assert.equal(audit.sameModeClosingQualified, false); assert.equal(audit.closingObservationQualified, false)
  assert.equal(audit.observedListingCount, 104); assert.equal(audit.observedRecordCount, 73)
  assert.equal(audit.rawOpening.jobs.length, 104); assert.equal(audit.rawDetails.jobs.length, 104)
  assert.equal(audit.sourceScopeComplete, false); assert.equal(audit.lifecycleEligible, false)
  assert.equal(audit.companyGlobalTotal, null); assert.equal(audit.companyIndiaTotal, null)
  assert.equal(audit.packets[0].capturedAt, primary.capturedAt); assert.equal(audit.packets[4].capturedAt, details.capturedAt)
  assert.ok(jobs.every(job => job.nativeSameModeClosingQualified === false && job.jobDescription.length > 1000))
  assert.equal(readSourceObservationEvidence(jobs, 'flatgigs').observedVacancyCount, 73)
  gapAssertions(jobs)
})
test('a labelled hypothetical sixth can validate same-mode reconciliation without company authority', async () => {
  const fixture = fixtureReader({}, [...packets, hypotheticalClosing()]), jobs = await collect({ fetchPacket: fixture.read }), audit = readNativeAudit(jobs)
  assert.equal(audit.sameModeClosingQualified, true); assert.equal(audit.responsesAcquired, 6)
  assert.equal(audit.packets[5].evidenceOrigin, 'CONTROLLED_HYPOTHETICAL_SIXTH_RESPONSE_NOT_A_NATIVE_CAPTURE')
  assert.ok(jobs.every(job => job.nativeSameModeClosingQualified === true))
  gapAssertions(jobs)
})
test('reusing the old detail packet clock is not an independently timed closing', async () => {
  const fixture = fixtureReader({}, [...packets, clone(details)]), jobs = await collect({ fetchPacket: fixture.read })
  assert.equal(readNativeAudit(jobs).sameModeClosingQualified, false); gapAssertions(jobs)
})
for (const kind of ['missing', 'numeric', 'inherited', 'accessor']) test('closing ' + kind + ' timestamp cannot mint proof and getters are never invoked', async () => {
  const closing = hypotheticalClosing(); let getters = 0
  if (kind === 'missing') delete closing.capturedAt
  if (kind === 'numeric') closing.capturedAt = 1793472678000
  if (kind === 'inherited') { delete closing.capturedAt; Object.setPrototypeOf(closing, { capturedAt: '2026-10-31T18:51:18.000Z' }) }
  if (kind === 'accessor') Object.defineProperty(closing, 'capturedAt', { get() { getters++; return '2026-10-31T18:51:18.000Z' }, enumerable: true })
  const sequence = [...packets, closing]; let index = 0
  const jobs = await collect({ fetchPacket: async url => { const packet = sequence[index++]; assert.equal(packet.url, url); return packet } })
  assert.equal(getters, 0); assert.equal(readNativeAudit(jobs).sameModeClosingQualified, false); gapAssertions(jobs)
})
for (const status of [401, 403, 429]) test('late HTTP' + status + ' stops and preserves verified same-run role content', async () => {
  const denied = { ...hypotheticalClosing(), status }, fixture = fixtureReader({}, [...packets, denied])
  const jobs = await collect({ fetchPacket: fixture.read }), audit = readNativeAudit(jobs)
  assert.equal(jobs.length, 3); assert.ok(jobs.every(job => job.jobDescription.length > 1000))
  assert.equal(audit.responsesAcquired, 5); assert.equal(audit.requestAttempts, 6)
  assert.equal(audit.lastError.status, status); assert.equal(audit.sameModeClosingQualified, false)
  gapAssertions(jobs)
})
test('detail denial retains title-bound positive partials and makes no closing request', async () => {
  const denied = { ...details, status: 403 }, fixture = fixtureReader({}, [...packets.slice(0, 4), denied])
  const jobs = await collect({ fetchPacket: fixture.read }), audit = readNativeAudit(jobs)
  assert.equal(jobs.length, 3); assert.ok(jobs.every(job => job.jobDescription === null))
  assert.equal(fixture.seen.length, 5); assert.equal(audit.responsesAcquired, 4)
  assert.equal(readSourceObservationEvidence(jobs, 'flatgigs').observedVacancyCount, 73)
  gapAssertions(jobs)
})
test('pre-inventory access denial is unavailable with unknown totals, never empty success', async () => {
  const fixture = fixtureReader({}, [{ ...primary, status: 403 }])
  await assert.rejects(collect({ fetchPacket: fixture.read }), error => error.status === 403 && error.inventoryEvidence.reportedTotal === null && error.inventoryEvidence.indiaFacetCount === null)
  assert.equal(fixture.seen.length, 1)
})
test('unqualified employer identity or native client flow cannot reach the widget endpoint', async () => {
  const wrong = changedPacket(primary, primary.body.replace('<title>Career - Flatgigs</title>', '<title>Other</title>')), first = fixtureReader({}, [wrong])
  await assert.rejects(collect({ fetchPacket: first.read })); assert.equal(first.seen.length, 1)
  const bad = changedPacket(packets[2], 'while(true){};' + packets[2].body), second = fixtureReader({}, [packets[0], packets[1], bad])
  await assert.rejects(collect({ fetchPacket: second.read })); assert.equal(second.seen.length, 3)
})
test('malformed closing data preserves earlier positives and raw receipts', async () => {
  const bad = hypotheticalClosing('whrcallback({"name":"Other","name":"Flatgigs","description":"","jobs":[]});')
  const jobs = await collect({ fetchPacket: fixtureReader({}, [...packets, bad]).read }), audit = readNativeAudit(jobs)
  assert.equal(jobs.length, 3); assert.equal(audit.responsesAcquired, 6)
  assert.equal(audit.closingObservationQualified, false); assert.equal(audit.sameModeClosingQualified, false)
  assert.ok(audit.packets[5].body.includes('"name":"Other"')); gapAssertions(jobs)
})
test('closing inventory mismatch remains partial and cannot certify full source or closing scope', async () => {
  const changed = clone(detailData), foreign = changed.jobs.find(row => row.country !== 'India' && changed.jobs.filter(other => other.shortcode === row.shortcode).length === 1).shortcode
  changed.jobs = changed.jobs.filter(row => row.shortcode !== foreign)
  const jobs = await collect({ fetchPacket: fixtureReader({}, [...packets, hypotheticalClosing(jsonp(changed))]).read }), audit = readNativeAudit(jobs)
  assert.equal(audit.closingInventoryMatches, false); assert.equal(audit.sameModeClosingQualified, false)
  assert.equal(audit.observedRecordCount, 73); assert.equal(audit.rawClosing.jobs.length, 103)
  gapAssertions(jobs)
})
test('changed closing criteria do not overwrite contradictory earlier native criteria', async () => {
  const changed = clone(detailData), id = '73D0145CD3'
  for (const row of changed.jobs.filter(row => row.shortcode === id)) row.description += '<p>CONTROLLED_CHANGED_NATIVE_CRITERION</p>'
  const jobs = await collect({ fetchPacket: fixtureReader({}, [...packets, hypotheticalClosing(jsonp(changed))]).read }), job = jobs.find(job => job.jobId === id)
  assert.equal(job.sourceDescription, null); assert.equal(job.nativeIdentityQualified, false)
  assert.ok(job.nativeRawEvidence.details.every(row => !row.description.includes('CONTROLLED_CHANGED_NATIVE_CRITERION')))
  assert.ok(job.nativeRawEvidence.closing.every(row => row.description.includes('CONTROLLED_CHANGED_NATIVE_CRITERION')))
  gapAssertions(jobs)
})
test('pre-aborted and in-flight callers retain their exact reasons without fallback requests', async () => {
  for (const stage of ['before', 'during-detail']) {
    const controller = new AbortController(), reason = Object.freeze({ stage }), seen = []
    if (stage === 'before') controller.abort(reason)
    await assert.rejects(collect({ signal: controller.signal, fetchPacket: async url => {
      seen.push(url)
      if (seen.length === 5) { controller.abort(reason); return new Promise(() => {}) }
      return clone(packets[seen.length - 1])
    } }), error => error === reason)
    assert.equal(seen.length, stage === 'before' ? 0 : 5)
  }
})
test('a stalled injected evidence request is bounded and leaves positive partial observations', async () => {
  let calls = 0
  const jobs = await collect({ requestTimeoutMs: 5, fetchPacket: async () => { calls++; return calls === 5 ? new Promise(() => {}) : clone(packets[calls - 1]) } })
  assert.equal(calls, 5); assert.equal(jobs.length, 3); assert.equal(readNativeAudit(jobs).lastError.code, 'native_timeout')
})
test('qualified controlled empty snapshots remain partial through real decoration', async () => {
  const empty = { name: 'Flatgigs', description: detailData.description, jobs: [] }, sequence = [...packets.slice(0, 3), changedPacket(packets[3], jsonp(empty)), changedPacket(packets[4], jsonp(empty)), hypotheticalClosing(jsonp(empty))]
  const raw = await collect({ fetchPacket: fixtureReader({}, sequence).read }), audit = readNativeAudit(raw)
  assert.equal(raw.length, 0); assert.equal(audit.openingObservationQualified, true); assert.equal(audit.closingObservationQualified, true)
  assert.equal(audit.sameModeClosingQualified, true); assert.equal(audit.observedRecordCount, 0)
  const jobs = decorateJobsWithProviderMetadata(raw, provider)
  assert.equal(readSourceObservationEvidence(jobs, 'flatgigs').observedVacancyCount, 0); gapAssertions(jobs)
})
test('current registered module/default HTTP path replays the actual five responses and explicitly lacks a sixth', async () => {
  const original = globalThis.fetch, calls = []; let cursor = 0
  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method, redirect: options.redirect, body: options.body, authorization: options.headers.Authorization })
    const packet = packets[cursor++]
    if (!packet) throw Object.assign(new Error('Controlled missing sixth native receipt'), { code: 'CONTROLLED_MISSING_RETAINED_RESPONSE' })
    assert.equal(packet.url, url)
    const result = new Response(packet.body, { status: packet.status, headers: { 'content-type': packet.contentType, ...(packet.redirectLocation ? { location: packet.redirectLocation } : {}) } })
    Object.defineProperty(result, 'url', { value: packet.finalUrl }); return result
  }
  try {
    const captureClock = phase => phase === 'startedAt' ? packets[cursor]?.startedAt || null : packets[cursor - 1]?.capturedAt || null
    const jobs = await createCatalogScraper(provider).run({ captureClock })
    assert.equal(jobs.length, 3); assert.equal(calls.length, 6)
    assert.deepEqual(calls.map(call => call.url), [...packets.map(packet => packet.url), DETAILS_URL])
    assert.ok(calls.every(call => call.method === 'GET' && call.redirect === 'manual' && !call.body && !call.authorization))
    assert.ok(jobs.every(job => job.atsPlatform === 'workable-widget-v1' && job.nativeSameModeClosingQualified === false))
    assert.equal(jobs[0].nativeCollectionEvidence.successfulResponses, 5)
    assert.equal(jobs[0].nativeCollectionEvidence.oldestCapturedAt, primary.capturedAt)
    assert.equal(readSourceObservationEvidence(jobs, 'flatgigs').observedVacancyCount, 73); gapAssertions(jobs)
  } finally { globalThis.fetch = original }
})
test('real decoration cannot turn an explicitly unqualified native country into a provider India default', async () => {
  const data = clone(detailData)
  for (const row of data.jobs) if (row.country === 'India') row.locations[0].hidden = true
  const opening = clone(data); for (const row of opening.jobs) delete row.description
  const sequence = [...packets.slice(0, 3), changedPacket(packets[3], jsonp(opening)), changedPacket(packets[4], jsonp(data)), hypotheticalClosing(jsonp(data))]
  const jobs = await createCatalogScraper(provider).run({ fetchPacket: fixtureReader({}, sequence).read })
  assert.equal(jobs.length, 3); assert.ok(jobs.every(job => job.country === '' && job.location === '' && job.nativeGeographyQualified === false))
  assert.equal(readSourceObservationEvidence(jobs, 'flatgigs').companyIndiaTotal, null)
})
test('a future closing capture cannot qualify an observed same-mode closing', async () => {
  const closing = { ...hypotheticalClosing(), startedAt: '2099-01-01T00:00:00.000Z', capturedAt: '2099-01-01T00:00:01.000Z' }
  const jobs = await collect({ fetchPacket: fixtureReader({}, [...packets, closing]).read })
  assert.equal(readNativeAudit(jobs).sameModeClosingQualified, false); gapAssertions(jobs)
})
test('a detail receipt whose capture precedes its own request cannot qualify a closing chain', async () => {
  const wrongDetail = { ...details, startedAt: '2026-10-31T18:51:16.500Z' }
  const jobs = await collect({ fetchPacket: fixtureReader({}, [...packets.slice(0, 4), wrongDetail, hypotheticalClosing()]).read })
  assert.equal(readNativeAudit(jobs).sameModeClosingQualified, false); gapAssertions(jobs)
})
