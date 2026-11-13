import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { extractSearchResults, CAREER_PAGE_URL } from './script.js'
import { collectNativeEpam, nativeSearchUrl } from './nativeInventory.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261111/current-controller.json.gz', import.meta.url))))
const sha = value => createHash('sha256').update(value).digest('hex')
const controllerURL = capture.responses[1].requestedURL
const nativePayload = JSON.parse(capture.responses[2].body)
const evidenceKey = Symbol.for('jobverify.epam-native-inventory')
test.beforeEach(t => t.mock.method(globalThis, 'fetch', async () => { throw Error('Unrecorded network in EPAM November11 regression') }))
async function replay(change = value => value) {
  const calls = []
  const jobs = await collectNativeEpam({ maxJobs: null,
    project: record => extractSearchResults({ data: { jobs: [record] } })[0],
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36' },
    options: { maxPages: 1, transport: async (url, init) => {
    calls.push(url); assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual')
    const row = capture.responses.find(record => record.requestedURL === url)
    assert.ok(row, 'No uncaptured response may stand in for a source hold')
    assert.equal(sha(row.body), row.bodySHA256)
    return change({ url: row.finalURL, status: row.status, headers: row.headers, body: Buffer.from(row.body) }, url)
  } } })
  return { jobs, calls, audit: jobs[evidenceKey] }
}
test('EPAM November11 client proof retains all three original bodies without claiming a closing transaction', () => {
  assert.equal(capture.responses.length, 3)
  for (const row of capture.responses) {
    assert.equal(row.status, 200); assert.equal(row.finalURL, row.requestedURL)
    assert.equal(Buffer.byteLength(row.body), row.bodyBytes); assert.equal(sha(row.body), row.bodySHA256)
  }
  assert.equal(capture.responses[1].bodySHA256, 'c6769eb0c0fdf432f63afb1204e9c9b81594ebaea3fc4144e0c0039aeebe6c4b')
  assert.equal(nativePayload.data.total, 255); assert.equal(nativePayload.data.jobs.length, 50)
})
test('EPAM reviewed current client allows the genuine fifty typed India models while the bounded partial scope stays explicit', async () => {
  const { jobs, calls, audit } = await replay()
  assert.equal(jobs.length, 50)
  assert.deepEqual(calls, [CAREER_PAGE_URL, controllerURL, nativeSearchUrl(0)])
  assert.equal(audit.controllerVerified, true)
  assert.deepEqual(jobs.map(job => job.nativeRecord), nativePayload.data.jobs)
  assert.equal(audit.bodyGaps.length, 0)
  for (const job of jobs) {
    assert.equal(job.country, 'India'); assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.postingDate, job.nativeRecord.created_at)
    assert.ok(job.jobDescription.length > 100)
    assert.equal(job.sourceScopeComplete, false); assert.equal(job.lifecycleCleanupAllowed, false)
  }
  assert.equal(audit.complete, false); assert.equal(audit.closingMatches, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(audit.failures.some(row => row.code === 'page-limit'))
})
for (const [name, change, code] of [
  ['unreviewed executable tail', response => ({ ...response, body: Buffer.concat([response.body, Buffer.from(';window.unreviewedRecruitmentChange=true;')]) }), 'native-public-controller-changed'],
  ['foreign client response', response => ({ ...response, url: 'https://other-employer.example/client.js' }), 'native-http-status-or-final-url-changed'],
  ['denied client', response => ({ ...response, status: 403 }), 'native-http-status-or-final-url-changed'],
]) test(`EPAM current client still holds ${name}`, async () => {
  const { jobs, calls, audit } = await replay((response, url) => url === controllerURL ? change(response) : response)
  assert.equal(jobs.length, 0); assert.deepEqual(calls, [CAREER_PAGE_URL, controllerURL])
  assert.equal(audit.complete, false); assert.equal(audit.cleanupAllowed, false)
  assert.ok(audit.failures.some(row => row.code === code))
})
