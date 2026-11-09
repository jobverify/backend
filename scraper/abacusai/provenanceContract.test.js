import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import * as native from './native.js'
import * as script from './script.js'
import catalog from './catalog.js'
import { fixture } from './test-data/fixture.mjs'
import { decorateJobsWithProviderMetadata, hydrateProviderCatalogEntry } from '../../scraper-support/providers/index.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
const capture = { ...fixture.capture, requests: fixture.packets }, bodies = fixture.packets.map(packet => packet.body)
const sha = value => createHash('sha256').update(value).digest('hex')
const clockValues = capture.requests.flatMap(row => [row.requestedAt, row.completedAt])
const caught = async action => { try { await action() } catch (error) { return error } assert.fail('Expected a rejection, never an empty result') }
function transport({ status = 200, homeBody = bodies[0], jobsBody = bodies[1], throwValue, abortController, abortReason, pending = false } = {}) {
  let clock = 0; const calls = []
  return { calls, options: { now: () => new Date(clockValues[Math.min(clock++, clockValues.length - 1)]), ...(abortController ? { signal: abortController.signal } : {}), requestTimeoutMs: pending ? 5 : 20000,
    fetchImpl: async (url, init) => {
      calls.push(url); assert.equal(init.redirect, 'manual')
      assert.ok([native.HOMEPAGE_URL, native.CAREERS_URL].includes(url))
      if (url === native.CAREERS_URL) {
        if (abortController) { abortController.abort(abortReason); return new Promise(() => {}) }
        if (throwValue !== undefined) throw throwValue
        if (pending) return new Promise(() => {})
      }
      const response = new Response(url === native.HOMEPAGE_URL ? homeBody : jobsBody, { status: url === native.HOMEPAGE_URL ? 200 : status,
        headers: { 'content-type': 'text/html; charset=utf-8', 'retry-after': '17' } })
      Object.defineProperty(response, 'url', { value: url }); return response
    } } }
}
const checkGap = (error, count, firstParty) => {
  assert.equal(error.inventoryEvidence?.status, 'coverage-gap'); assert.equal(error.inventoryEvidence.pagesFetched, count)
  assert.equal(error.inventoryEvidence.firstParty, firstParty); assert.equal(error.inventoryEvidence.listingComplete, false)
  assert.equal(error.inventoryEvidence.reportedTotal, null); assert.equal(error.inventoryEvidence.indiaFacetCount, null)
  assert.equal(error.nativePrimaryReceipts.packets.length, count)
  assert.equal(error.nativePrimaryReceipts.currentRoleAvailabilityProven, false); assert.equal(error.nativePrimaryReceipts.companyScopeComplete, false)
  for (const packet of error.nativePrimaryReceipts.packets) { assert.equal(packet.status, 200); assert.equal(packet.httpInterface, 'injected-http-interface'); assert.equal(packet.clockInjected, true); assert.match(packet.sha256, /^[a-f0-9]{64}$/) }
}
test('successful homepage survives careers403 as one exact successful packet', async () => {
  const io = transport({ status: 403 }), error = await caught(() => native.collect(io.options))
  checkGap(error, 1, true)
  assert.equal(error.code, 'access_denied'); assert.equal(error.status, 403); assert.equal(error.retryAfter, '17'); assert.equal(error.abortRetries, true)
  assert.ok(error.cause); assert.equal(error.cause.code, error.code); assert.equal(error.cause.status, 403); assert.equal(error.cause.retryAfter, '17')
  assert.equal(error.nativePrimaryReceipts.packets[0].sha256, capture.requests[0].sha256)
  assert.equal(error.nativePrimaryReceipts.packets[0].startedAt, capture.requests[0].requestedAt)
  assert.equal(error.inventoryEvidence.verifiedAt, capture.requests[0].completedAt)
})
test('two successful bodies survive a careers title contract failure', async () => {
  const bad = bodies[1].replace('Abacus.AI - Careers &amp; Jobs', 'Changed careers title'); assert.notEqual(bad, bodies[1])
  const error = await caught(() => native.collect(transport({ jobsBody: bad }).options))
  checkGap(error, 2, true); assert.equal(error.code, 'native_contract_unqualified'); assert.ok(error.cause)
  assert.equal(error.nativePrimaryReceipts.packets[1].sha256, sha(bad)); assert.equal(error.inventoryEvidence.verifiedAt, capture.requests[1].completedAt)
})
test('successful but unbound homepage remains firstParty false', async () => {
  const bad = bodies[0].replace('content="Abacus.AI"', 'content="Unrelated"'); assert.notEqual(bad, bodies[0])
  const io = transport({ homeBody: bad }), error = await caught(() => native.collect(io.options))
  checkGap(error, 1, false); assert.equal(error.nativePrimaryReceipts.binding, null); assert.equal(io.calls.length, 1)
})
for (const [name, mutate] of [
  ['duplicate head attribute', html => html.replace('property="og:site_name"', 'property="og:site_name" property="og:site_name"')],
  ['invalid numeric head entity', html => html.replace('Abacus.AI - Careers &amp; Jobs', 'Abacus.AI - Careers &amp; Jobs&#1114112;')],
  ['invalid numeric criteria entity', html => html.replace('jobs-job-description">', 'jobs-job-description">&#1114112;')],
]) test('native DOM failure retains both completed packets: ' + name, async () => {
  const bad = mutate(bodies[1]); assert.notEqual(bad, bodies[1])
  const error = await caught(() => native.collect(transport({ jobsBody: bad }).options))
  checkGap(error, 2, true); assert.equal(error.code, 'native_contract_unqualified'); assert.ok(error.cause?.cause)
  assert.equal(error.nativePrimaryReceipts.packets[1].sha256, sha(bad))
})
test('own timeout after homepage retains count and exact timeout cause', async () => {
  const error = await caught(() => native.collect(transport({ pending: true }).options))
  checkGap(error, 1, true); assert.equal(error.code, 'native_request_timed_out'); assert.equal(error.cause.code, error.code)
})
test('per-row primary packet references survive actual decoration and normalization', async () => {
  const raw = await native.collect(transport().options), provider = hydrateProviderCatalogEntry(catalog), decorated = decorateJobsWithProviderMetadata(raw, provider)
  assert.equal(decorated.nativePrimaryReceipts, undefined)
  assert.equal(raw.length, 3)
  for (const row of decorated) {
    assert.equal(row.nativeRoleObservation.primaryPacketReferences?.length, 2)
    for (const [index, ref] of row.nativeRoleObservation.primaryPacketReferences.entries()) {
      assert.equal(ref.sha256, capture.requests[index].sha256); assert.equal(ref.url, capture.requests[index].url)
      assert.equal(ref.bytes, capture.requests[index].bytes); assert.equal(ref.startedAt, capture.requests[index].requestedAt); assert.equal(ref.completedAt, capture.requests[index].completedAt)
      assert.equal(ref.httpInterface, 'injected-http-interface'); assert.equal(ref.clockInjected, true); assert.equal(Object.hasOwn(ref, 'body'), false)
    }
  }
  const normalized = decorated.map(row => normalizeScrapedJob(row, provider))
  assert.deepEqual(normalized.map(row => row.nativeRoleObservation.primaryPacketReferences), decorated.map(row => row.nativeRoleObservation.primaryPacketReferences))
  assert.equal(analyzePublishableJobs(normalized, { now: new Date(capture.completedAt) }).eligibleJobs.length, 0)
})
test('packet references retain replay tags in JSON output', async () => {
  const rows = JSON.parse(JSON.stringify(await script.run(transport().options)))
  assert.equal(rows[0].nativeRoleObservation.primaryPacketReferences?.length, 2)
  assert.equal(rows[0].nativeRoleObservation.primaryPacketReferences[0].httpInterface, 'injected-http-interface')
  assert.equal(rows[0].nativeRoleObservation.primaryPacketReferences[0].clockInjected, true)
})
test('raw public criteria and all unknown native fields stay unchanged', async () => {
  const rows = await native.collect(transport().options)
  for (const row of rows) {
    for (const field of ['jobDescription', 'sourceDescription', 'country', 'location', 'jobId', 'requisitionId', 'nativeLegalEmployer', 'postingDate', 'postedAt', 'closingDate']) assert.equal(row[field], null)
    assert.equal(row.sourceDetailComplete, false); assert.equal(row.sourceScopeComplete, false); assert.equal(row.sourceAvailabilityEvidence, undefined)
    assert.equal(row.nativeRoleObservation.qualifiedForPublicCriteria, false); assert.ok(row.nativeRoleObservation.descriptionText.length > 400)
  }
})
for (const reason of [Object.freeze({ opaque: 'shared' }), Object.freeze(Error('frozen reason')), null]) test('caller cancellation preserves opaque identity: ' + String(reason?.opaque || reason?.message || 'null'), async () => {
  const controller = new AbortController(), io = transport({ abortController: controller, abortReason: reason })
  assert.equal(await caught(() => native.collect(io.options)), reason)
})
test('unknown frozen transport errors are rethrown without mutation', async () => {
  const reason = Object.freeze(Error('unowned transport')), before = Object.getOwnPropertyDescriptors(reason)
  assert.equal(await caught(() => native.collect(transport({ throwValue: reason }).options)), reason)
  assert.deepEqual(Object.getOwnPropertyDescriptors(reason), before)
})
test('unknown hostile transport getters are never inspected', async () => {
  let reads = 0; const reason = new Proxy(Object.freeze({ marker: 'opaque' }), { get() { reads++; throw Error('must not inspect') } })
  // Returning a proxy from an async assertion helper would itself read .then.
  let actual
  try { await native.collect(transport({ throwValue: reason }).options) } catch (error) { actual = error }
  assert.equal(actual, reason); assert.equal(reads, 0)
})
for (const [name, field] of [['DISPOSITION', 'atsPlatform'], ['VERIFIED_ON', 'verifiedOn'], ['VERIFIED_SURFACE_SUMMARY', 'verifiedSurfaceSummary']]) test('original named export remains a metadata alias: ' + name, () => {
  assert.equal(Object.hasOwn(script, name), true); assert.equal(script[name], catalog[field])
  if (name === 'VERIFIED_ON') assert.equal(script[name], null)
})
