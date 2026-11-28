import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'

import {createCatalogScraper, getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {runCurrentGatiInventory} from './nativeInventory.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/current-declared-client-20261128.json.gz', import.meta.url))))
const retained = JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/current-declared-client-20261106.json.gz', import.meta.url))))
const origin = 'https://allcargologistics.darwinbox.in'
const home = origin + '/ms/candidatev2/main/careers/home'
const seed = origin + '/ms/candidatev2/main/careers/allJobs'
const client = origin + '/ms/candidatev2/main.f5e76c3f4b395062.js'
const configuration = origin + '/ms/candidateapi/getCompanyConfig?is_preview=false&companyId=main'
const listing = origin + '/ms/candidateapi/job/alljobs?companyId=main'
const originalBody = row => Buffer.from(row.bodyBase64, 'base64').toString('utf8')
const currentRows = new Map(fixture.responses.map(row => [row.url, {...row, body: originalBody(row)}]))
const retainedApiRows = new Map(retained.responses.filter(row => row.url.includes('/ms/candidateapi/'))
  .map(row => [row.url, {...row, body: originalBody(row)}]))

// Current corporate/native shell/client bytes are genuine. Successful native
// payloads below are explicitly retained/controlled test inputs, never fresh
// current inventory evidence. The default replay stops at the first API read.
function transport({controlledNative = false, change = row => row} = {}) {
  const reads = [], counts = new Map(), boundary = Object.freeze({unobservedCurrentNativeAPI: true})
  return {reads, boundary, fetchImpl: async (url, init = {}) => {
    const occurrence = (counts.get(url) ?? 0) + 1
    counts.set(url, occurrence)
    reads.push({url, method: init.method ?? 'GET', body: init.body})
    assert.equal(new URL(url).hostname === 'allcargologistics.darwinbox.in'
      || ['https://www.gati.com/', 'https://www.allcargologistics.com/', 'https://www.allcargologistics.com/about-us/careers'].includes(url), true)
    if (url.includes('/ms/candidateapi/') && !controlledNative) throw boundary
    const captured = currentRows.get(url) ?? retainedApiRows.get(url)
    assert.ok(captured, 'Only the captured current prefix and retained native contract may be read: ' + url)
    if (url === listing) {
      assert.equal(init.method, 'POST')
      assert.deepEqual(JSON.parse(init.body), {companyId: 'main', sort_option: 'new', limit: 10, page: 1})
    } else assert.equal(init.method ?? 'GET', 'GET')
    const row = change({...captured, headers: {...captured.headers}}, {url, occurrence, init})
    const headers = {...row.headers, ...(url === seed ? {'set-cookie': 'offline_public_session=controlled; Path=/'} : {})}
    return Object.defineProperty(new Response(row.body, {status: row.status, headers}), 'url', {value: row.finalURL ?? row.url})
  }}
}

test('six original current Gati bodies bind the actual corporate handoff and exact own-host candidate main', () => {
  assert.equal(fixture.source, 'gati')
  assert.equal(fixture.currentNativeInventoryObserved, false)
  assert.equal(fixture.responses.length, 6)
  for (const row of fixture.responses) {
    const bytes = Buffer.from(row.bodyBase64, 'base64')
    assert.equal(bytes.length, row.bytes)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.bodySHA256)
    assert.equal(row.method, 'GET')
    assert.equal(row.finalURL, row.url)
  }
  const program = currentRows.get(client)
  assert.equal(program.status, 200)
  assert.equal(program.bytes, 1291632)
  assert.equal(program.bodySHA256, 'fca478943f06f1e5ce96b92bb2184c39c65c75e92d859eb7ec4738e9995f9766')
  assert.ok(currentRows.get('https://www.allcargologistics.com/about-us/careers').body.includes(home))
  for (const url of [home, seed]) assert.ok(currentRows.get(url).body.includes('main.f5e76c3f4b395062.js'))
})

test('genuine current opening reaches only the first unobserved native API boundary after exact main verification', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('No live network in current-client regression'))
  const io = transport()
  await assert.rejects(runCurrentGatiInventory({fetchImpl: io.fetchImpl}), error => error === io.boundary)
  assert.equal(io.reads.filter(row => row.url === client).length, 1)
  assert.equal(io.reads.at(-1).url, configuration)
  assert.equal(io.reads.some(row => row.url === listing), false)
})

test('altered complete current main bytes remain rejected before configuration or listing', async () => {
  const io = transport({change: row => row.url === client ? {...row, body: row.body + ';window.changedHiring=true;'} : row})
  await assert.rejects(runCurrentGatiInventory({fetchImpl: io.fetchImpl}), /client executable bytes changed/)
  assert.equal(io.reads.some(row => row.url.includes('/ms/candidateapi/')), false)
})

test('an unknown native client declaration is not broadened into an arbitrary release or fallback', async () => {
  const io = transport({change: row => row.url === home ? {...row, body: row.body.replaceAll('main.f5e76c3f4b395062.js', 'main.ffffffffffffffff.js')} : row})
  await assert.rejects(runCurrentGatiInventory({fetchImpl: io.fetchImpl}), /unreviewed declared native client URL/)
  assert.equal(io.reads.some(row => row.url === client || row.url.includes('/ms/candidateapi/')), false)
})

test('a foreign native base stays rejected before any program or API read', async () => {
  const io = transport({change: row => row.url === home ? {...row, body: row.body.replace('href="/ms/candidatev2/"', 'href="https://foreign.invalid/ms/candidatev2/"')} : row})
  await assert.rejects(runCurrentGatiInventory({fetchImpl: io.fetchImpl}), /unreviewed native client base URL/)
  assert.equal(io.reads.some(row => row.url === client || row.url.includes('/ms/candidateapi/')), false)
})

test('conflicting home and allJobs release declarations cannot silently select either known release', async () => {
  const io = transport({change: row => row.url === seed ? {...row, body: row.body.replaceAll('main.f5e76c3f4b395062.js', 'main.819c4120b20f8091.js')} : row})
  await assert.rejects(runCurrentGatiInventory({fetchImpl: io.fetchImpl}), /conflicting declared native client URLs/)
  assert.equal(io.reads.some(row => row.url === client || row.url.includes('/ms/candidateapi/')), false)
})

test('a current main redirect to another identity stays rejected', async () => {
  const io = transport({change: row => row.url === client ? {...row, finalURL: 'https://foreign.invalid/current.js'} : row})
  await assert.rejects(runCurrentGatiInventory({fetchImpl: io.fetchImpl}), /HTTP response URL changed/)
  assert.equal(io.reads.some(row => row.url.includes('/ms/candidateapi/')), false)
})

test('a current main response with the wrong content type stays rejected', async () => {
  const io = transport({change: row => row.url === client ? {...row, headers: {'content-type': 'application/json'}} : row})
  await assert.rejects(runCurrentGatiInventory({fetchImpl: io.fetchImpl}), /client content type changed/)
  assert.equal(io.reads.some(row => row.url.includes('/ms/candidateapi/')), false)
})

test('controlled retained zero envelopes exercise the exact current POST reader while company scope and cleanup remain held', async () => {
  const io = transport({controlledNative: true})
  const jobs = await runCurrentGatiInventory({fetchImpl: io.fetchImpl})
  assert.equal(jobs.length, 0)
  assert.equal(jobs.sourceAudit.nativeTotal, 0)
  assert.equal(jobs.sourceAudit.closingNativeTotal, 0)
  assert.equal(jobs.sourceAudit.sourceNativeOpening.clientUrl, client)
  assert.equal(jobs.sourceAudit.sourceNativeClosing.clientUrl, client)
  assert.ok(jobs.sourceAudit.reasons.includes('current-declared-client-company-scope-unqualified'))
  for (const field of ['complete', 'sourceScopeComplete', 'lifecycleCleanupAllowed']) assert.equal(jobs.sourceAudit[field], false)
  assert.equal(jobs.sourceAudit.globalJobs, null)
  assert.equal(jobs.sourceAudit.indiaJobs, null)
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.listingComplete, false)
  assert.notEqual(inventory.status, 'verified-empty')
  assert.equal(inventory.reportedTotal, null)
  assert.equal(inventory.indiaFacetCount, null)
  assert.equal(io.reads.filter(row => row.url === client).length, 2)
  assert.equal(io.reads.filter(row => row.url === listing && row.method === 'POST').length, 2)
  assert.equal(io.reads.some(row => row.url.includes('job?page=')), false)
})

test('registered current declaration with controlled native zero cannot become successful company/India zero', async () => {
  const io = transport({controlledNative: true})
  const provider = getScraperCatalog().find(row => row.source === 'gati')
  const jobs = await createCatalogScraper(provider).run({fetchImpl: io.fetchImpl})
  const assessment = assessSoftFailureAcquisition(provider, jobs)
  assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete, false)
  assert.equal(readSourceObservationEvidence(jobs, 'gati').observedVacancyCount, 0)
  assert.equal(assessment.indiaJobs, 0)
  assert.equal(assessment.eligibleJobs, 0)
  assert.equal(assessment.runnerOutcome.success, false)
  assert.equal(assessment.runnerOutcome.partial, true)
  assert.equal(assessment.runnerOutcome.failureKind, 'coverage_gap')
  assert.deepEqual(assessment.cleanupOptions, {replaceExisting: false})
})

const positive = {id: 'controlled-current-role', title: 'Software Engineer', country: 'India',
  city: 'Bangalore', employer: 'Gati', description: 'Controlled full original native criteria retained without publication qualification.'}
test('a controlled positive native row retains full country/criteria/employer data without invented qualification or empty inventory', async () => {
  const io = transport({controlledNative: true, change: row => row.url === listing ? {...row,
    body: JSON.stringify({status: 'success', data: [positive], job_counts: 1})} : row})
  const jobs = await runCurrentGatiInventory({fetchImpl: io.fetchImpl})
  assert.equal(jobs.length, 0)
  assert.deepEqual(jobs.sourceAudit.unresolvedNativeRoles, [positive])
  assert.deepEqual(jobs.sourceAudit.sourceNativeOpening.listing.data, [positive])
  assert.deepEqual(jobs.sourceAudit.sourceNativeClosing.listing.data, [positive])
  assert.equal(jobs.sourceAudit.nativeTotal, 1)
  assert.equal(jobs.sourceAudit.globalJobs, null)
  assert.equal(jobs.sourceAudit.indiaJobs, null)
  assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed, false)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('closing native positive drift stays raw and cannot reconcile to a complete source zero', async () => {
  const io = transport({controlledNative: true, change: (row, {occurrence}) => row.url === listing && occurrence === 2 ? {...row,
    body: JSON.stringify({status: 'success', data: [positive], job_counts: 1})} : row})
  const jobs = await runCurrentGatiInventory({fetchImpl: io.fetchImpl})
  assert.equal(jobs.sourceAudit.nativeTotal, 0)
  assert.equal(jobs.sourceAudit.closingNativeTotal, 1)
  assert.deepEqual(jobs.sourceAudit.unresolvedNativeRoles, [positive])
  assert.ok(jobs.sourceAudit.reasons.includes('closing-current-source-scope-changed'))
  assert.equal(jobs.sourceAudit.sourceScopeComplete, false)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('closing current program byte drift cannot reuse opening release verification', async () => {
  const io = transport({controlledNative: true, change: (row, {occurrence}) => row.url === client && occurrence === 2
    ? {...row, body: row.body + ';window.changedAtClose=true;'} : row})
  await assert.rejects(runCurrentGatiInventory({fetchImpl: io.fetchImpl}), /client executable bytes changed/)
  assert.equal(io.reads.filter(row => row.url === configuration).length, 1)
})

for (const status of [401, 403, 429]) {
  test(`current native configuration HTTP ${status} is terminal without another source read or zero claim`, async () => {
    const io = transport({controlledNative: true, change: row => row.url === configuration
      ? {...row, status, headers: {'content-type': 'text/html'}, body: '<html>Denied</html>'} : row})
    await assert.rejects(runCurrentGatiInventory({fetchImpl: io.fetchImpl}), error => {
      assert.equal(error.status, status)
      assert.equal(error.failureKind, 'blocked_or_access_denied')
      assert.equal(error.abortRetries, true)
      assert.equal(error.lifecycleCleanupAllowed, false)
      assert.equal(error.inventoryEvidence.listingComplete, false)
      assert.equal(error.inventoryEvidence.reportedTotal, null)
      assert.equal(error.inventoryEvidence.indiaFacetCount, null)
      return true
    })
    assert.equal(io.reads.at(-1).url, configuration)
    assert.equal(io.reads.filter(row => row.url === configuration).length, 1)
    assert.equal(io.reads.some(row => row.url === listing), false)
  })
}

test('the exact read-only listing POST remains terminal on denial without retrying another release or legacy API', async () => {
  const io = transport({controlledNative: true, change: row => row.url === listing
    ? {...row, status: 403, headers: {'content-type': 'text/html'}, body: '<html>Denied</html>'} : row})
  await assert.rejects(runCurrentGatiInventory({fetchImpl: io.fetchImpl}), error => error.status === 403 && error.abortRetries === true)
  assert.equal(io.reads.at(-1).url, listing)
  assert.equal(io.reads.filter(row => row.url === listing).length, 1)
  assert.equal(io.reads.some(row => row.url.includes('job?page=')), false)
})

test('changed controlled native legal employer configuration remains unreviewed without promoting company scope', async () => {
  const io = transport({controlledNative: true, change: row => {
    if (row.url !== configuration) return row
    const payload = JSON.parse(row.body)
    payload.message.company.company_name = 'Another Legal Employer'
    return {...row, body: JSON.stringify(payload)}
  }})
  const jobs = await runCurrentGatiInventory({fetchImpl: io.fetchImpl})
  assert.ok(jobs.sourceAudit.reasons.includes('unreviewed-native-payload:' + configuration))
  assert.equal(jobs.sourceAudit.sourceNativeOpening.company.message.company.company_name, 'Another Legal Employer')
  assert.equal(jobs.sourceAudit.sourceScopeComplete, false)
  assert.equal(jobs.sourceAudit.globalJobs, null)
  assert.equal(jobs.sourceAudit.indiaJobs, null)
  assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed, false)
})

test('genuine current registered opening and closing contain24 complete body receipts and two explicit native empty responses', () => {
  const current = fixture.currentRegistered
  assert.equal(current.responses.length, 24)
  assert.equal(current.outcome.captureBytes, 14690108)
  assert.equal(current.outcome.success, false)
  assert.equal(current.outcome.inventoryEvidence.listingComplete, false)
  for (const row of current.responses) {
    const bytes = Buffer.from(row.bodyBase64, 'base64')
    assert.equal(bytes.length, row.bytes)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.bodySHA256)
    assert.equal(row.finalURL, row.url)
  }
  const nativeListings = current.responses.filter(row => row.url === listing)
  assert.equal(nativeListings.length, 2)
  for (const row of nativeListings) {
    assert.equal(row.method, 'POST')
    assert.deepEqual(JSON.parse(row.requestBody), {companyId: 'main', sort_option: 'new', limit: 10, page: 1})
    assert.deepEqual(JSON.parse(originalBody(row)), {status: 'success', data: [], job_counts: 0})
  }
})

test('genuine current registered24-read replay retains measured configured-board zero with unknown company totals and cleanup forbidden', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Genuine current registered replay must stay offline'))
  const remaining = [...fixture.currentRegistered.responses]
  const provider = getScraperCatalog().find(row => row.source === 'gati')
  const jobs = await createCatalogScraper(provider).run({fetchImpl: async (url, init = {}) => {
    const row = remaining.shift()
    assert.ok(row, 'Only the24 original current public requests may be read')
    assert.equal(url, row.url)
    assert.equal(init.method ?? 'GET', row.method)
    assert.equal(init.body ?? null, row.requestBody)
    const headers = {...row.headers, ...(url === seed ? {'set-cookie': 'offline_public_session=controlled; Path=/'} : {})}
    return Object.defineProperty(new Response(originalBody(row), {status: row.status, headers}), 'url', {value: row.finalURL})
  }})
  assert.equal(remaining.length, 0)
  assert.equal(jobs.length, 0)
  const audit = jobs.nativeCollectionEvidence
  assert.equal(audit.receipts.length, 24)
  assert.equal(audit.nativeTotal, 0)
  assert.equal(audit.closingNativeTotal, 0)
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  assert.equal(audit.globalJobs, null)
  assert.equal(audit.indiaJobs, null)
  assert.deepEqual(audit.sourceNativeOpening.listing, {status: 'success', data: [], job_counts: 0})
  assert.deepEqual(audit.sourceNativeClosing.listing, audit.sourceNativeOpening.listing)
  assert.ok(audit.reasons.includes('current-declared-client-company-scope-unqualified'))
  assert.equal(readSourceObservationEvidence(jobs, 'gati').observedVacancyCount, 0)
  const assessment = assessSoftFailureAcquisition(provider, jobs)
  assert.equal(assessment.runnerOutcome.success, false)
  assert.equal(assessment.runnerOutcome.failureKind, 'coverage_gap')
  assert.equal(assessment.runnerOutcome.partial, true)
  assert.equal(assessment.runnerOutcome.processingComplete, true)
  assert.equal(assessment.inventoryEvidence.reportedTotal, null)
  assert.equal(assessment.inventoryEvidence.indiaFacetCount, null)
  assert.equal(assessment.inventoryEvidence.listingComplete, false)
  assert.deepEqual(assessment.cleanupOptions, {replaceExisting: false})
})
