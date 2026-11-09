import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { run, CAREER_PAGE_URL } from './script.js'
import { nativeSearchUrl } from './nativeInventory.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const captured = JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261107/current-controller.json.gz', import.meta.url))))
const sha = value => createHash('sha256').update(value).digest('hex')
const currentControllerURL = 'https://careers.epam.com/_next/static/chunks/pages/_app-53434e61b53ad06f.js'
const api = JSON.parse(captured.responses.find(row => row.url === nativeSearchUrl(0)).body)
const evidenceKey = Symbol.for('jobverify.epam-native-inventory')

test.beforeEach(t => t.mock.method(globalThis, 'fetch', async () => { throw Error('Unrecorded network in EPAM controller regression') }))

async function replay(mutate = value => value) {
  const calls = []
  const jobs = await run({ maxPages: 1, transport: async (url, init) => {
    calls.push(url)
    assert.equal(init.method, 'GET')
    assert.equal(init.redirect, 'manual')
    assert.equal(init.headers['x-anywhere-tenant'], 'anywhere')
    assert.equal(init.headers['User-Agent'], 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36')
    const record = captured.responses.find(row => row.url === url)
    assert.ok(record, `No original response for ${url}`)
    assert.equal(sha(record.body), record.sha256)
    return mutate({ url: record.finalURL, status: record.status, headers: { 'content-type': record.contentType }, body: Buffer.from(record.body) }, url)
  } })
  return { jobs, calls, batch: jobs[evidenceKey] }
}

test('EPAM current controller regression retains three genuine original response bodies', () => {
  assert.equal(captured.responses.length, 3)
  for (const row of captured.responses) {
    assert.equal(row.status, 200)
    assert.equal(row.finalURL, row.url)
    assert.equal(Buffer.byteLength(row.body), row.bytes)
    assert.equal(sha(row.body), row.sha256)
  }
  const controller = captured.responses.find(row => row.url === currentControllerURL)
  assert.equal(controller.sha256, 'dec7833162b39f8f5c3aa8dc876875c7982775d0e8b724dd254b178ca3e52d12')
  assert.equal(api.data.total, 253)
  assert.equal(api.data.jobs.length, 50)
})

test('EPAM reads the genuine current client and preserves all fifty full first-page India models', async () => {
  const { jobs, calls, batch } = await replay()
  assert.equal(jobs.length, 50)
  assert.deepEqual(calls, [CAREER_PAGE_URL, currentControllerURL, nativeSearchUrl(0)])
  assert.equal(batch.controllerVerified, true)
  assert.equal(batch.bodyGaps.length, 0)
  assert.deepEqual(jobs.map(row => row.nativeRecord), api.data.jobs)
  for (const row of jobs) {
    assert.equal(row.country, 'India')
    assert.equal(row.sourceDetailComplete, true)
    assert.ok(row.jobDescription.length > 100)
    assert.equal(row.postingDate, row.nativeRecord.created_at)
    assert.equal(row.sourceScopeComplete, false)
    assert.equal(row.lifecycleCleanupAllowed, false)
  }
  assert.equal(batch.complete, false)
  assert.equal(batch.closingMatches, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(batch.failures.some(row => row.code === 'page-limit'))
})

for (const [name, change, code] of [
  ['unreviewed executable tail', response => ({ ...response, body: Buffer.concat([response.body, Buffer.from(';window.changedRecruitment=true;')]) }), 'native-public-controller-changed'],
  ['foreign controller response authority', response => ({ ...response, url: 'https://unrelated.invalid/controller.js' }), 'native-http-status-or-final-url-changed'],
  ['wrong controller representation', response => ({ ...response, headers: { 'content-type': 'text/html' } }), 'native-content-type-changed'],
  ['denied current controller', response => ({ ...response, status: 403 }), 'native-http-status-or-final-url-changed'],
]) test(`EPAM does not reach native listings after ${name}`, async () => {
  const { jobs, calls, batch } = await replay((response, url) => url === currentControllerURL ? change(response) : response)
  assert.equal(jobs.length, 0)
  assert.deepEqual(calls, [CAREER_PAGE_URL, currentControllerURL])
  assert.ok(batch.failures.some(row => row.code === code))
  assert.equal(batch.complete, false)
  assert.equal(batch.cleanupAllowed, false)
})
