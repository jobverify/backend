import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'

import { createFedilityInvestmentsScraper, run } from './script.js'
import { HOME, BOARD, FEED } from '../fidelity/nativeContract.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readInventoryDelegationEvidence } from '../../scraper-support/utils/inventoryDelegationEvidence.js'
import { buildScraperAttemptDiagnostics } from '../../scraper-support/runner.js'
import { buildPublishingGapReport } from '../../scripts/publishingGapReport.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('../fidelity/fixtures/runtime-native-20261021.json.gz', import.meta.url))))
const blocked = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-home403-20261031.json.gz', import.meta.url))))
for (const page of fixture.packets) assert.equal(createHash('sha256').update(page.body).digest('hex'), page.bodySha256)
assert.equal(createHash('sha256').update(blocked.packet.body).digest('hex'), blocked.packet.sha256)
const oldest = new Date(Math.min(...fixture.packets.map(page => Date.parse(page.checkedAt)))).toISOString()
const read = (change = () => {}) => {
  const used = new Set(), seen = []
  return { used, seen, fetchPage: async (url, options) => {
    const at = fixture.packets.findIndex((page, index) => !used.has(index) && page.url === url)
    assert.ok(at >= 0, 'Extra or unrecorded canonical HTTP request ' + url)
    used.add(at)
    const native = fixture.packets[at], page = { status: native.status, url: native.finalURL,
      body: native.body, capturedAt: native.checkedAt }
    change(page, { url, options, at })
    seen.push({ requested: url, ...page })
    return Object.freeze(page)
  } }
}
const verifyCanonical = jobs => {
  assert.equal(jobs.length, 14)
  assert.ok(jobs.every(job => job.source === 'fidelity' && job.company === 'Fidelity Investments'
    && job.sourceDetailComplete === true && job.sourceListingComplete === false))
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
}

test('historical actual19 native packets carry exact declared delegation with their oldest actual clock and canonical jobs', async () => {
  const transport = read(), jobs = await run({ now: fixture.checkedAt, fetchPage: transport.fetchPage })
  verifyCanonical(jobs)
  assert.equal(transport.used.size, 19)
  const proof = readInventoryDelegationEvidence(jobs)
  assert.ok(proof)
  assert.equal(proof.source, 'fedilityinvestments')
  assert.deepEqual(proof.sources, ['fidelity'])
  assert.equal(proof.preservesChildSourceAndCompany, true)
  assert.equal(proof.verifiedAt, oldest)
  assert.equal(proof.evidence.url, HOME)
  assert.deepEqual(proof.evidence.responses, transport.seen.filter(page => [HOME, BOARD, FEED].includes(page.requested))
    .map(page => ({ url: page.requested, finalUrl: page.url, status: page.status,
      sha256: createHash('sha256').update(page.body).digest('hex') })))
  assert.equal(proof.evidence.responses.length, 5)
  assert.notEqual(proof.verifiedAt.slice(0, 10), '2026-10-31', 'Historical replay must not be restamped current')
})

test('registered historical spelling keeps typed proof through decoration without another employer or HTTP read', async () => {
  const provider = getScraperCatalog().find(row => row.source === 'fedilityinvestments'), transport = read()
  const jobs = await createCatalogScraper(provider).run({ now: fixture.checkedAt, fetchPage: transport.fetchPage })
  verifyCanonical(jobs)
  assert.equal(provider.companyName, 'Fidelity Investments')
  assert.equal(transport.used.size, 19)
  assert.equal(readInventoryDelegationEvidence(jobs)?.source, 'fedilityinvestments')
})

test('actual historical native clock reaches attempt diagnostics and exact declared URL matching without a second employer', async () => {
  const catalog = getScraperCatalog().filter(row => ['fedilityinvestments', 'fidelity'].includes(row.source))
  const provider = catalog.find(row => row.source === 'fedilityinvestments'), transport = read()
  const jobs = await createCatalogScraper(provider).run({ now: fixture.checkedAt, fetchPage: transport.fetchPage })
  const diagnostics = buildScraperAttemptDiagnostics(jobs, undefined, provider)
  assert.equal(diagnostics.inventoryDelegationEvidence.verifiedAt, oldest)
  assert.equal(diagnostics.inventoryDelegationEvidence.evidence.url, provider.inventoryDelegation.evidence.url)
  const report = buildPublishingGapReport({ catalog, now: new Date(fixture.checkedAt), runtime: {
    databaseAvailable: true, generatedAt: fixture.checkedAt, publicCompanyNames: ['Fidelity Investments'],
    inventory: [{ source: 'fedilityinvestments', savedJobs: 0, visibleJobs: 0, visibleCompanies: [] },
      { source: 'fidelity', savedJobs: 14, visibleJobs: 14, visibleCompanies: ['Fidelity Investments'] }],
    statuses: [{ source: 'fedilityinvestments', latestAttempt: { success: true, completedAt: fixture.checkedAt,
      inventoryDelegationEvidence: diagnostics.inventoryDelegationEvidence } }],
  } })
  const wrapper = report.rows.find(row => row.source === 'fedilityinvestments')
  assert.equal(wrapper.inventoryDelegation.evidenceOrigin, 'runtime-attempt')
  assert.equal(wrapper.inventoryDelegation.evidenceFresh, true)
  assert.equal(wrapper.visibleJobs, 0)
  assert.equal(report.summary.distinctVisibleCompanies, 1)
})

test('historical replay proof cannot refresh current report freshness from caller now or catalog dates', async () => {
  const catalog = getScraperCatalog().filter(row => ['fedilityinvestments', 'fidelity'].includes(row.source))
  const transport = read(), jobs = await run({ now: fixture.checkedAt, fetchPage: transport.fetchPage })
  const proof = readInventoryDelegationEvidence(jobs)
  const report = buildPublishingGapReport({ catalog, now: new Date('2026-10-31T10:00:00Z'), runtime: {
    databaseAvailable: false, statuses: [{ source: 'fedilityinvestments', latestAttempt: { success: true,
      completedAt: '2026-10-31T09:59:00Z', inventoryDelegationEvidence: proof } }],
  } })
  const wrapper = report.rows.find(row => row.source === 'fedilityinvestments')
  assert.equal(wrapper.inventoryDelegation.evidenceFresh, false)
  assert.equal(wrapper.inventoryDelegation.fresh, false)
  assert.equal(wrapper.completeSuccessfulCheck, false)
})

test('wrapper native default HTTP captures actual read time and hashes without a new homepage request', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(fixture.checkedAt) })
  const transport = read(), expectedAt = new Date(Date.now() + 1).toISOString()
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.redirect, 'follow')
    assert.ok(options.signal)
    const page = await transport.fetchPage(url, options)
    t.mock.timers.tick(1)
    const response = new Response(page.body, { status: page.status })
    Object.defineProperty(response, 'url', { value: page.url })
    return response
  })
  const jobs = await createFedilityInvestmentsScraper().run({ now: fixture.checkedAt })
  verifyCanonical(jobs)
  assert.equal(transport.used.size, 19)
  const proof = readInventoryDelegationEvidence(jobs)
  assert.ok(proof)
  assert.equal(proof.verifiedAt, expectedAt)
  assert.equal(proof.evidence.responses[0].sha256, fixture.packets[0].bodySha256)
})

test('relationship observation on a cap0 result retains incomplete inventory and does not manufacture verified zero', async () => {
  const transport = read(), jobs = await run({ now: fixture.checkedAt, fetchPage: transport.fetchPage, maxJobs: 0 })
  assert.equal(jobs.length, 0)
  assert.equal(transport.used.size, 19)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryDelegationEvidence(jobs)?.verifiedAt, oldest)
})

for (const [label, change] of [
  ['untimed legacy transport', page => { delete page.capturedAt }],
  ['historical checkedAt alias alone', page => { page.checkedAt = page.capturedAt; delete page.capturedAt }],
  ['invalid capture clock', page => { page.capturedAt = 'not a native clock' }],
  ['invalid calendar capture clock', page => { page.capturedAt = '2026-02-30T01:00:00Z' }],
  ['future capture clock', page => { page.capturedAt = '2999-01-01T00:00:00Z' }],
  ['non-string capture clock', page => { page.capturedAt = Date.parse(page.capturedAt) }],
  ['capture clock accessor', page => { const at = page.capturedAt; delete page.capturedAt; Object.defineProperty(page, 'capturedAt', { get: () => at }) }],
]) test(label + ' preserves guarded canonical jobs without minting delegation proof', async () => {
  const transport = read(change), jobs = await run({ now: fixture.checkedAt, fetchPage: transport.fetchPage })
  verifyCanonical(jobs)
  assert.equal(readInventoryDelegationEvidence(jobs), null)
})

test('one untimed or future native detail cannot be dropped while selecting a newer relationship clock', async () => {
  for (const change of [page => { delete page.capturedAt }, page => { page.capturedAt = '2999-01-01T00:00:00Z' }]) {
    const transport = read((page, { url }) => { if (url === fixture.packets[2].url) change(page) })
    const jobs = await run({ now: fixture.checkedAt, fetchPage: transport.fetchPage })
    verifyCanonical(jobs)
    assert.equal(readInventoryDelegationEvidence(jobs), null)
  }
})

test('optional untrusted body-hash metadata cannot substitute for hashing the exact native body', async () => {
  const transport = read(page => { page.sha256 = '0'.repeat(64) })
  const jobs = await run({ now: fixture.checkedAt, fetchPage: transport.fetchPage })
  const proof = readInventoryDelegationEvidence(jobs)
  assert.ok(proof)
  assert.equal(proof.evidence.responses[0].sha256, fixture.packets[0].bodySha256)
})

for (const [label, change] of [
  ['foreign homepage response URL', page => { page.url = 'https://fidelityinternational.com/' }],
  ['different employer identity', page => { page.body = page.body.replaceAll('Fidelity Business Services India Pvt. Ltd.', 'Fidelity International') }],
  ['hidden native relationship', page => { page.body = '<div hidden>' + page.body + '</div>' }],
  ['changed active recruitment handoff', page => { page.body = page.body.replaceAll('href="/in/jobs/"', 'href="https://other.example/jobs/"') }],
]) test(label + ' cannot create proof or bypass the canonical current identity guard', async () => {
  const transport = read((page, { url }) => { if (url === HOME) change(page) })
  await assert.rejects(run({ now: fixture.checkedAt, fetchPage: transport.fetchPage }))
  assert.equal(transport.used.size, 1)
})

test('current captured public403 remains unavailable and never falls back to historical success', async () => {
  let requests = 0
  await assert.rejects(run({ fetchPage: async url => {
    requests++
    assert.equal(url, HOME)
    const page = blocked.packet
    return { status: page.status, url: page.finalUrl, body: page.body, capturedAt: page.capturedAt }
  } }), error => error.httpStatus === 403 && error.failureKind === 'upstream_blocked')
  assert.equal(requests, 1)
})

test('pre-cancelled wrapper invokes no native HTTP and retains exact frozen caller reason', async t => {
  const reason = Object.freeze(Error('stop Fidelity relationship before HTTP'))
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Pre-cancelled wrapper must not fetch'))
  await assert.rejects(run({ signal: AbortSignal.abort(reason) }), error => error === reason)
})

test('in-flight wrapper native cancellation cannot become success or a new proof attempt', async t => {
  const controller = new AbortController(), reason = Object.freeze(Error('stop Fidelity native relationship read'))
  let requests = 0
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requests++
    controller.abort(reason)
    assert.equal(options.signal.aborted, true)
    throw Error('native HTTP replaced caller cancellation')
  })
  await assert.rejects(run({ signal: controller.signal }), error => error === reason)
  assert.equal(requests, 1)
})
