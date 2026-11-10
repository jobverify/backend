import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { WORKDAY_COUNTRY_INVENTORY_PROOF } from '../../scraper-support/myworkday/countryInventoryProof.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-union-20261110.json.gz', import.meta.url))))
for (const packet of capture.packets) assert.equal(createHash('sha256').update(packet.body).digest('hex'), packet.sha256)

async function replay(t, mutate = () => {}) {
  const queues = new Map(), calls = [], occurrences = new Map()
  for (const packet of capture.packets) {
    const key = JSON.stringify([packet.method, packet.requestUrl, packet.requestBody])
    if (!queues.has(key)) queues.set(key, [])
    queues.get(key).push(packet)
  }
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input), method = init.method || 'GET'
    const key = JSON.stringify([method, url, init.body || null]), queue = queues.get(key)
    assert.ok(queue?.length, 'Only actually captured current corporate/native requests are allowed: ' + key)
    const packet = structuredClone(queue.length > 1 ? queue.shift() : queue[0])
    const occurrence = (occurrences.get(key) || 0) + 1
    occurrences.set(key, occurrence)
    calls.push({ url, method, requestBody: init.body || null })
    mutate(packet, occurrence)
    const response = new Response(packet.body, { status: packet.status, headers: { 'content-type': packet.contentType } })
    Object.defineProperty(response, 'url', { value: packet.finalUrl })
    return response
  })
  const jobs = await run({ now: () => capture.capturedAt, nativeDetailRecovery: false, retainNativeProof: true,
    retryBaseDelayMs: 0, requestScheduler: { acquire: async () => () => {}, recordRateLimit() {}, minIntervalMs: 0 } })
  return { jobs, calls }
}

test('registered BlackBerry reconciles all three current boards and retains two proven India requisitions', async t => {
  const { jobs, calls } = await replay(t)
  assert.deepEqual(jobs.map(job => job.jobId).sort(), ['20250320', '20260163'])
  assert.ok(jobs.every(job => job.country === 'India' && job.nativeEmployer === '5300 BlackBerry India Private Limited'))
  assert.ok(jobs.every(job => job.sourceDescription.length > 1000 && job.nativeSourceRecord.jobPostingInfo.posted === true
    && job.nativeSourceRecord.jobPostingInfo.canApply === true))
  assert.ok(jobs.every(job => job.sourceScopeComplete === false && job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
  const proof = jobs[WORKDAY_COUNTRY_INVENTORY_PROOF]
  assert.deepEqual(proof.boards.map(board => [board.site, board.reportedTotal, board.observedIndia]),
    [['BlackBerry', 27, 1], ['QNX', 22, 2], ['Student', 1, 0]])
  assert.equal(proof.duplicateCount, 1)
  assert.equal(proof.completeSourceScope, false)
  assert.deepEqual(proof.boards.flatMap(board => board.unresolvedCountryRoles.map(row => row.requisitionId)).sort(), ['20260214', '20260301'])
  for (const board of proof.boards) {
    assert.equal(board.reconciliation.initial.count, board.reportedTotal)
    assert.equal(board.reconciliation.closing.count, board.reportedTotal)
    assert.equal(board.reconciliation.initial.sha256, board.reconciliation.closing.sha256)
  }
  for (const job of jobs) for (const provenance of job.nativeBoardProvenance) {
    const nativePath = '/wday/cxs/bb/' + provenance.site + '/job/'
    assert.ok(calls.filter(call => call.method === 'GET' && call.url.includes(nativePath)
      && call.url.includes('_' + job.jobId)).length >= 2, 'Each admitted native posting retains a separate closing detail read')
  }
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.notEqual(evidence.status, 'verified-empty')
})

test('BlackBerry partial recovery still rejects a changed closing native India country', async t => {
  await assert.rejects(replay(t, (packet, occurrence) => {
    if (packet.method !== 'GET' || !packet.requestUrl.includes('/wday/cxs/bb/BlackBerry/job/')
      || !packet.requestUrl.endsWith('_20250320') || occurrence < 2) return
    const payload = JSON.parse(packet.body)
    payload.jobPostingInfo.country = { descriptor: 'Canada', alpha2Code: 'CA', id: 'canada' }
    payload.jobPostingInfo.jobRequisitionLocation.country = { descriptor: 'Canada', alpha2Code: 'CA', id: 'canada' }
    packet.body = JSON.stringify(payload)
  }), /native India country|country.*conflict/i)
})

test('BlackBerry partial recovery still rejects closing listing identity drift', async t => {
  await assert.rejects(replay(t, (packet, occurrence) => {
    if (packet.method !== 'POST' || !packet.requestUrl.endsWith('/bb/BlackBerry/jobs')
      || JSON.parse(packet.requestBody).offset !== 20 || occurrence < 2) return
    const payload = JSON.parse(packet.body)
    payload.jobPostings[0].title += ' changed after opening'
    packet.body = JSON.stringify(payload)
  }), /closing complete-board role identity changed/i)
})

test('BlackBerry cannot omit a current corporate-bound board to manufacture a partial success', async t => {
  await assert.rejects(replay(t, packet => {
    if (packet.requestUrl === 'https://www.blackberry.com/en/careers') {
      packet.body = packet.body.replaceAll('bb.wd3.myworkdayjobs.com/Student', 'bb.wd3.myworkdayjobs.com/Unrelated')
    }
  }), error => {
    assert.equal(error.failureKind, 'incomplete_location_scope')
    assert.match(error.cause?.message || '', /no active anchor to the exact Workday board/i)
    return true
  })
})
