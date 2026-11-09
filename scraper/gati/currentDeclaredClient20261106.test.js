import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { runCurrentGatiInventory } from './nativeInventory.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/current-declared-client-20261106.json.gz', import.meta.url))))
const origin = 'https://allcargologistics.darwinbox.in'
const seed = origin + '/ms/candidatev2/main/careers/allJobs'
const client = origin + '/ms/candidatev2/main.819c4120b20f8091.js'
const listing = origin + '/ms/candidateapi/job/alljobs?companyId=main'
function transport(change = row => row) {
  const requests = []
  return { requests, fetchImpl: async (url, init = {}) => {
    const row = fixture.responses.find(value => value.url === url)
    assert.ok(row, 'Only original captured public URLs may be requested: ' + url)
    requests.push({ url, method: init.method ?? 'GET', body: init.body })
    if (row.method) { assert.equal(init.method, row.method); assert.equal(init.body, row.requestBody) }
    else assert.equal(init.method ?? 'GET', 'GET')
    const original = Buffer.from(row.bodyBase64, 'base64')
    assert.equal(createHash('sha256').update(original).digest('hex'), row.bodySHA256)
    const current = change({ ...row, body: original.toString('utf8') })
    const headers = { ...current.headers, ...(url === seed ? { 'set-cookie': 'offline_public_session=synthetic; Path=/' } : {}) }
    const response = new Response(current.body, { status: current.status, headers })
    Object.defineProperty(response, 'url', { value: url })
    return response
  } }
}

test('original current client and declared POST replay observe native zero while company scope stays unqualified', async () => {
  const io = transport()
  const jobs = await runCurrentGatiInventory({ fetchImpl: io.fetchImpl })
  assert.equal(jobs.length, 0)
  assert.equal(jobs.sourceAudit.nativeTotal, 0)
  assert.equal(jobs.sourceAudit.closingNativeTotal, 0)
  assert.equal(jobs.sourceAudit.sourceScopeComplete, false)
  assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed, false)
  assert.equal(jobs.sourceAudit.globalJobs, null)
  assert.equal(jobs.sourceAudit.indiaJobs, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(io.requests.filter(row => row.url === client).length, 2)
  assert.equal(io.requests.filter(row => row.url === listing && row.method === 'POST').length, 2)
})

test('a declared unknown current client never selects a guessed bundle or listing endpoint', async () => {
  const io = transport(row => row.url.includes('/careers/') ? { ...row,
    body: row.body.replace('main.819c4120b20f8091.js', 'main.unknown.js') } : row)
  await assert.rejects(runCurrentGatiInventory({ fetchImpl: io.fetchImpl }), /unreviewed.*client|client.*unreviewed/i)
  assert.equal(io.requests.some(row => row.url === listing || row.url === client), false)
})

test('changed current executable bytes stop before the native listing rather than inheriting a reviewed URL', async () => {
  const io = transport(row => row.url === client ? { ...row, body: row.body + ';window.unreviewedRecruitment=true;' } : row)
  await assert.rejects(runCurrentGatiInventory({ fetchImpl: io.fetchImpl }), /client.*(?:bytes|contract)|(?:bytes|contract).*client/i)
  assert.equal(io.requests.some(row => row.url === listing), false)
})

test('a real public listing denial remains explicit and preserves the bounded current request receipts', async () => {
  const io = transport(row => row.url === listing ? { ...row, status: 403,
    headers: { 'content-type': 'text/html' }, body: '<html><title>Forbidden</title></html>' } : row)
  await assert.rejects(runCurrentGatiInventory({ fetchImpl: io.fetchImpl }), error => {
    assert.equal(error.status, 403)
    assert.equal(error.failureKind, 'blocked_or_access_denied')
    assert.equal(error.lifecycleCleanupAllowed, false)
    assert.equal(error.inventoryEvidence.listingComplete, false)
    assert.equal(error.receipts.filter(row => row.url === listing && row.method === 'POST').length, 1)
    return true
  })
})

test('a new native positive payload is retained unresolved and cannot become a verified empty source', async () => {
  const native = { id: 'controlled-unreviewed-positive', title: 'Controlled unresolved native role' }
  const io = transport(row => row.url === listing ? { ...row,
    body: JSON.stringify({ status: 'success', data: [native], job_counts: 1 }) } : row)
  const jobs = await runCurrentGatiInventory({ fetchImpl: io.fetchImpl })
  assert.equal(jobs.sourceAudit.nativeTotal, 1)
  assert.deepEqual(jobs.sourceAudit.unresolvedNativeRoles, [native])
  assert.equal(jobs.sourceAudit.sourceScopeComplete, false)
  assert.equal(jobs.sourceAudit.globalJobs, null)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('registered current native zero retains its original audit separately from unknown company totals', async () => {
  const io = transport()
  const provider = getScraperCatalog().find(row => row.source === 'gati')
  const jobs = await createCatalogScraper(provider).run({ fetchImpl: io.fetchImpl })
  assert.equal(readSourceObservationEvidence(jobs, 'gati')?.observedVacancyCount, 0)
  assert.equal(jobs.nativeCollectionEvidence.nativeTotal, 0)
  assert.equal(jobs.nativeCollectionEvidence.globalJobs, null)
  assert.equal(jobs.nativeCollectionEvidence.indiaJobs, null)
  assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete, false)
  assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed, false)
  assert.equal(jobs.nativeCollectionEvidence.receipts.filter(row => row.url === listing && row.method === 'POST').length, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('a zero total without an explicit native row array cannot establish observed native emptiness', async () => {
  const io = transport(row => row.url === listing ? { ...row,
    body: JSON.stringify({ status: 'success', job_counts: 0 }) } : row)
  const jobs = await runCurrentGatiInventory({ fetchImpl: io.fetchImpl })
  assert.equal(readSourceObservationEvidence(jobs, 'gati'), null)
  assert.equal(jobs.sourceAudit.sourceScopeComplete, false)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('conflicting alternate native envelopes retain their positive row without certifying observed zero', async () => {
  const native = { id: 'controlled-alternate-native-role', title: 'Controlled alternate role' }
  const payload = { status: 'success', data: [], job_counts: 0, message: { jobs: [native], jobscount: 1 } }
  const io = transport(row => row.url === listing ? { ...row, body: JSON.stringify(payload) } : row)
  const jobs = await runCurrentGatiInventory({ fetchImpl: io.fetchImpl })
  assert.equal(readSourceObservationEvidence(jobs, 'gati'), null)
  assert.equal(jobs.sourceAudit.nativeTotal, null)
  assert.deepEqual(jobs.sourceAudit.unresolvedNativeRoles, [native])
  assert.deepEqual(jobs.sourceAudit.sourceNativeOpening.listing, payload)
  assert.deepEqual(jobs.sourceAudit.sourceNativeClosing.listing, payload)
  assert.equal(jobs.sourceAudit.globalJobs, null)
  assert.equal(jobs.sourceAudit.indiaJobs, null)
  assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed, false)
})
