import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { run, CAREERS_URL, WORKDAY_BOARD_URL, JOBS_API_URL } from './script.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden, isCompleteScraperAttempt } from '../../scraper-support/utils/inventoryEvidence.js'

import { extractionDetailHealth } from '../../scraper-support/utils/extractionDetailHealth.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261109.json.gz', import.meta.url))))
for (const packet of fixture.responses) assert.equal(createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
const initial = fixture.responses.find(row => row.url === JOBS_API_URL && row.requestBody && !Object.keys(JSON.parse(row.requestBody).appliedFacets).length)
const filtered = fixture.responses.find(row => row.url === JOBS_API_URL && row.requestBody && Object.keys(JSON.parse(row.requestBody).appliedFacets).length)
const clone = value => structuredClone(value)

function harness({ mutateNative, mutateFiltered, mutatePage, maxPages, signal, expandedBoard } = {}) {
  const calls = [], seen = new Map()
  const options = {
    now: () => '2026-11-09T00:00:00.000Z', ...(maxPages === undefined ? {} : { maxPages }), signal,
    fetchPage: async url => {
      const packet = fixture.responses.find(row => row.url === url)
      assert.ok(packet, 'Unexpected HTML request ' + url)
      const count = (seen.get(url) || 0) + 1; seen.set(url, count)
      const page = { status: packet.status, url: packet.finalUrl, html: packet.body, contentType: packet.headers['content-type'] }
      mutatePage?.(page, url, count)
      calls.push({ kind: 'html', url })
      return page
    },
    fetchJson: async (url, body) => {
      assert.equal(url, JOBS_API_URL)
      const request = JSON.parse(body), isFiltered = Object.keys(request.appliedFacets).length > 0
      const payload = JSON.parse((isFiltered ? filtered : initial).body)
      if (!isFiltered && expandedBoard) { payload.total = expandedBoard.rows.length; payload.jobPostings = clone(expandedBoard.rows.slice(request.offset, request.offset + 20)) }
      if (isFiltered) mutateFiltered?.(payload)
      calls.push({ kind: 'legacy-list', request })
      return payload
    },
    fetchNativeJson: async (url, body) => {
      const count = (seen.get('native:' + url) || 0) + 1; seen.set('native:' + url, count)
      const packet = url === JOBS_API_URL ? initial : fixture.responses.find(row => row.url === url)
      assert.ok(packet || expandedBoard?.details.has(url), 'Unexpected native request ' + url)
      const result = packet ? { status: packet.status, url: packet.finalUrl, contentType: packet.headers['content-type'], payload: JSON.parse(packet.body) } : { status: 200, url, contentType: 'application/json', payload: clone(expandedBoard.details.get(url)) }
      if (url === JOBS_API_URL && expandedBoard) { const request = JSON.parse(body); result.payload.total = expandedBoard.rows.length; result.payload.jobPostings = clone(expandedBoard.rows.slice(request.offset, request.offset + 20)) }
      mutateNative?.(result, url, count)
      calls.push({ kind: 'native', url, body })
      return result
    },
  }
  return { calls, run: () => run(options) }
}

// Bodies are retained current native responses. Replay transport metadata and
// repeated closing detail reads are controlled; the live check is separate.
test('Aptos current native inventory qualifies two India roles and reconciles all four raw roles', async () => {
  const reader = harness(), jobs = await reader.run(), evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'complete-inventory', JSON.stringify(jobs.nativeCollectionEvidence))
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 4)
  assert.equal(evidence.indiaFacetCount, 2)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), false)
  const detailHealth = extractionDetailHealth(jobs)
  assert.equal(detailHealth.complete, true)
  assert.equal(isCompleteScraperAttempt({ success: true, completedAt: evidence.verifiedAt, detailHealth, inventoryEvidence: evidence }, { now: new Date(evidence.verifiedAt) }), true)
  assert.deepEqual(jobs.map(job => job.requisitionId).sort(), ['JR100183', 'JR100189'])
  for (const job of jobs) {
    const packet = fixture.responses.find(row => row.url.endsWith(new URL(job.sourceUrl).pathname.replace('/Aptos', '')))
    const info = JSON.parse(packet.body).jobPostingInfo
    assert.equal(job.title, info.title)
    assert.equal(job.sourceDescription, info.jobDescription)
    assert.equal(job.jobDescription, info.jobDescription)
    assert.equal(job.country, 'India')
    assert.equal(job.nativeEmployer, 'Aptos India Private Limited')
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.sourceScopeComplete, true)
    assert.equal(job.lifecycleCleanupAllowed, true)
  }
  assert.equal(reader.calls.filter(row => row.kind === 'native').length, 10)
  assert.equal(jobs.nativeCollectionEvidence.rawRoles, 4)
  assert.equal(jobs.nativeCollectionEvidence.foreignRoles, 2)
})

const firstIndia = '/Software-Developer--L1_JR100189'
const cases = [
  ['unreviewed remote scope', (packet, url) => { if (url.includes('/US-Remote/')) packet.payload.jobPostingInfo.remoteType = 'Remote - India' }],
  ['duplicate native posting UID', (packet, url) => { if (url.includes('Sr-Software-Developer-L3')) packet.payload.jobPostingInfo.id = '44c4988a3ffe100b7f9e8c03893d0000' }],
  ['generic company introduction without role criteria', (packet, url) => { if (url.endsWith(firstIndia)) packet.payload.jobPostingInfo.jobDescription = packet.payload.jobPostingInfo.jobDescription.split('<p>Key Responsibilities')[0] }],
  ['unlisted native recommendation', (packet, url) => { if (url.includes('/US-Remote/')) packet.payload.similarJobs = [{ title: 'Unlisted India Engineer', externalPath: '/job/IN-Bangalore-Office/Unlisted_JR999999' }] }],
  ['missing country metadata', (packet, url) => { if (url.endsWith(firstIndia)) delete packet.payload.jobPostingInfo.country }],
  ['conflicting native country', (packet, url) => { if (url.endsWith(firstIndia)) packet.payload.jobPostingInfo.country.descriptor = 'United States of America' }],
  ['foreign role gains an unreviewed India worksite', (packet, url) => { if (url.includes('/US-Remote/')) packet.payload.jobPostingInfo.additionalLocations = ['India'] }],
  ['listing detail title mismatch', (packet, url) => { if (url.endsWith(firstIndia)) packet.payload.jobPostingInfo.title = 'Other title' }],
  ['foreign detail URL', (packet, url) => { if (url.endsWith(firstIndia)) packet.payload.jobPostingInfo.externalUrl = 'https://example.com/job/JR100189' }],
  ['wrong requisition', (packet, url) => { if (url.endsWith(firstIndia)) packet.payload.jobPostingInfo.jobReqId = 'JR999999' }],
  ['inactive native role', (packet, url) => { if (url.endsWith(firstIndia)) packet.payload.jobPostingInfo.posted = false }],
  ['missing description', (packet, url) => { if (url.endsWith(firstIndia)) packet.payload.jobPostingInfo.jobDescription = '<p> </p>' }],
  ['truncated raw inventory', (packet, url) => { if (url === JOBS_API_URL) packet.payload.jobPostings.pop() }],
  ['duplicate raw inventory', (packet, url) => { if (url === JOBS_API_URL) packet.payload.jobPostings[1] = clone(packet.payload.jobPostings[0]) }],
  ['unreviewed listing schema', (packet, url) => { if (url === JOBS_API_URL) packet.payload.jobPostings[0].otherLocations = ['India'] }],
  ['unreviewed detail schema', (packet, url) => { if (url.endsWith(firstIndia)) packet.payload.jobPostingInfo.extraCountry = 'India' }],
  ['unknown office country scope', (packet, url) => { if (url.includes('/US-Remote/')) packet.payload.jobPostingInfo.location = 'Remote' }],
  ['closing description changes', (packet, url, count) => { if (url.endsWith(firstIndia) && count === 2) packet.payload.jobPostingInfo.jobDescription += '<p>Changed closing criteria.</p>' }],
  ['closing total changes', (packet, url, count) => { if (url === JOBS_API_URL && count === 2) packet.payload.total++ }],
  ['native HTTP denial', packet => { packet.status = 403 }],
  ['native observed URL mismatch', packet => { packet.url = 'https://example.com/changed' }],
  ['native non JSON response', packet => { packet.contentType = 'text/html' }],
]
for (const [name, mutateNative] of cases) test('Aptos retains a cleanup hold for ' + name, async () => {
  const jobs = await harness({ mutateNative }).run(), evidence = readInventoryEvidence(jobs)
  assert.notEqual(evidence?.status, 'complete-inventory')
  assert.equal(evidence?.listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.ok(jobs.nativeCollectionEvidence.reason)
})
for (const [name, mutateFiltered] of [
  ['missing filtered India role', payload => { payload.jobPostings.pop() }],
  ['duplicate filtered India role', payload => { payload.jobPostings[1] = clone(payload.jobPostings[0]) }],
]) test('Aptos retains a hold for ' + name, async () => {
  const jobs = await harness({ mutateFiltered }).run()
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})
test('Aptos requires an active first-party handoff, including the closing read', async () => {
  for (const changedRead of [1, 2]) {
    const jobs = await harness({ mutatePage(page, url, count) {
      if (url === CAREERS_URL && count === changedRead) page.html = page.html.replace(/href=([\'"])https:\/\/aptos\.wd108\.myworkdayjobs\.com/g, 'hidden href=$1https://aptos.wd108.myworkdayjobs.com')
    } }).run()
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
    assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  }
})
test('Aptos never upgrades capped source results or an aborted read', async () => {
  const jobs = await harness({ maxPages: 0 }).run()
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  const controller = new AbortController(); controller.abort(new Error('controlled cancellation'))
  await assert.rejects(harness({ signal: controller.signal }).run(), /controlled cancellation/)
})

test('Aptos retains a scope hold for an active competing corporate hiring channel', async () => {
  const jobs = await harness({ mutatePage(page, url) {
    if (url === CAREERS_URL) page.html += '<a href="https://example.com/india-jobs">Apply for our India jobs</a>'
  } }).run()
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})
test('Aptos stops candidate page admission on caller cancellation and retains its opaque reason', async () => {
  const controller = new AbortController(), reason = Object.freeze({ cancellation: 'opaque' }), seen = []
  const reader = harness()
  await assert.rejects(run({ signal: controller.signal,
    fetchPage: async url => {
      const packet = fixture.responses.find(row => row.url === url)
      return { status: 200, url, html: packet.body, contentType: 'text/html' }
    },
    fetchJson: async (url, body, options) => {
      seen.push(JSON.parse(body)); assert.equal(options?.signal, controller.signal)
      controller.abort(reason); return JSON.parse(initial.body)
    },
  }), error => error === reason)
  assert.equal(seen.length, 1)
  assert.equal(reader.calls.length, 0)
})

test('Aptos preserves opaque cancellation before classifying an invalid careers response', async () => {
  const controller = new AbortController(), reason = Object.freeze({ cancellation: 'careers-read' })
  await assert.rejects(run({ signal: controller.signal, fetchPage: async url => {
    controller.abort(reason); return { status: 403, url, html: 'Denied', contentType: 'text/html' }
  } }), error => error === reason)
})
test('Aptos default JSON reader stops on an opaque caller cancellation before another POST', async t => {
  const controller = new AbortController(), reason = Object.freeze({ cancellation: 'default-json-read' }), seen = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    seen.push(url); assert.equal(init.method, 'POST'); controller.abort(reason)
    return new Response(initial.body, { status: 200, headers: { 'content-type': 'application/json' } })
  })
  await assert.rejects(run({ signal: controller.signal, fetchPage: async url => {
    const packet = fixture.responses.find(row => row.url === url)
    return { status: 200, url, html: packet.body, contentType: 'text/html' }
  } }), error => error === reason)
  assert.equal(seen.length, 1)
})
function derivedExpandedBoard() {
  // Explicitly DERIVED future-growth/cap control, using the unchanged current
  // foreign role body and country. This is not a retained live inventory.
  const rows = clone(JSON.parse(initial.body).jobPostings), details = new Map()
  const original = fixture.responses.find(row => row.url.includes('/US-Remote/'))
  for (let i = 0; i < 20; i++) {
    const id = 'JR' + (200000 + i), title = 'DERIVED future foreign role ' + i
    const path = '/job/US-Remote/Derived-' + id + '_' + id, detail = JSON.parse(original.body)
    Object.assign(detail.jobPostingInfo, { id: (1000 + i).toString(16).padStart(32, '0'), title,
      jobReqId: id, jobPostingId: path.split('/').at(-1), externalUrl: WORKDAY_BOARD_URL + path })
    rows.push({ title, externalPath: path, locationsText: 'US Remote', postedOn: 'Posted Today', bulletFields: ['Remote', id] })
    details.set(JOBS_API_URL.replace(/\/jobs$/, '') + path, detail)
  }
  return { rows, details }
}
test('Aptos enumerates future native pages by raw offsets and retains finite caps', async () => {
  const expandedBoard = derivedExpandedBoard(), reader = harness({ expandedBoard }), jobs = await reader.run()
  assert.equal(readInventoryEvidence(jobs)?.status, 'complete-inventory', JSON.stringify(jobs.nativeCollectionEvidence))
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 24)
  assert.equal(jobs.length, 2)
  assert.deepEqual(reader.calls.filter(row => row.kind === 'native' && row.url === JOBS_API_URL)
    .map(row => JSON.parse(row.body).offset), [0, 20, 0, 20])
  const capped = await harness({ expandedBoard, maxPages: 1 }).run()
  assert.equal(readInventoryEvidence(capped)?.listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(capped), true)
})

test('Aptos restores the opaque caller reason when the default HTML body reader rejects', async t => {
  const controller = new AbortController(), reason = Object.freeze({ cancellation: 'html-body' })
  t.mock.method(globalThis, 'fetch', async url => ({ status: 200, url, text: async () => {
    controller.abort(reason); throw new DOMException('The operation was aborted.', 'AbortError')
  } }))
  await assert.rejects(run({ signal: controller.signal }), error => error === reason)
})
