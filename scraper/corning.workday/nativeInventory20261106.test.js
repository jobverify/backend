import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = new URL('./test-data-20261106/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', fixture), 'utf8'))
const requestKey = (url, init) => (init.method || 'GET') + ':' + url + ':' + (init.body || '')
const requests = new Map(manifest.requests.map(row => [requestKey(row.url, row), row]))
const observations = jobs => jobs[Symbol.for('jobverify.verified-recruitment-observations')]
const registered = () => createCatalogScraper(getScraperCatalog().find(row => row.source === 'corning'))
const replay = mutate => async (url, init = {}) => {
  const receipt = requests.get(requestKey(url, init))
  assert.ok(receipt, 'No undeclared fixture request: ' + url)
  let body = gunzipSync(readFileSync(new URL(receipt.hash + '.gz', fixture)))
  assert.equal(createHash('sha256').update(body).digest('hex'), receipt.hash)
  if (mutate) body = Buffer.from(mutate(body.toString('utf8'), receipt))
  const response = new Response(body, { status: receipt.status, headers: { 'content-type': receipt.contentType } })
  Object.defineProperty(response, 'url', { value: receipt.finalURL })
  return response
}
const read = mutate => registered().run({ fetchImpl: replay(mutate), now: () => '2026-11-06T17:00:00.000Z' })

test('Corning registered source hydrates all 32 native India records across both declared pages', async () => {
  const jobs = await read()
  assert.deepEqual(jobs.map(row => row.jobId).sort(), [...manifest.expectedIds].sort())
  assert.equal(new Set(jobs.map(row => row.jobId)).size, 32)
  assert.ok(jobs.every(row => row.country === 'India' && row.nativeHiringOrganization.name === 'Corning'
    && row.jobDescription.length >= 100 && row.sourceScopeComplete === false && row.lifecycleCleanupAllowed === false
    && row.applyUrl.startsWith('https://careers.corning.com/us/en/job/')))
  const inventories = observations(jobs).nativeInventoryReads.filter(row => row.kind === 'phenom-india')
  assert.deepEqual(inventories.map(row => [row.offset, row.reportedTotal]), [[0, 32], [20, 32]])
  assert.equal(observations(jobs).sourceScopeComplete, false)
  assert.equal(observations(jobs).lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('Corning rejects a native role whose own typed countries become non-India', async () => {
  const jobs = await read((body, receipt) => receipt.url.includes('/job/77925/')
    ? body.replaceAll('"India"', '"United States"') : body)
  assert.equal(jobs.length, 31)
  assert.ok(jobs.every(row => row.jobId !== '77925'))
})

test('Corning rejects a foreign native employer even on its declared corporate role URL', async () => {
  const jobs = await read((body, receipt) => receipt.url.includes('/job/77925/')
    ? body.replaceAll('"Corning"', '"Unrelated Employer"') : body)
  assert.equal(jobs.length, 31)
  assert.ok(jobs.every(row => row.jobId !== '77925'))
  assert.ok(observations(jobs).unresolved.includes('native-employer-mismatch'))
})

test('Corning withholds an on-hold native role despite its visible schema', async () => {
  const jobs = await read((body, receipt) => receipt.url.includes('/job/77925/')
    ? body.replaceAll('"postingStatus":"Open"', '"postingStatus":"On Hold"') : body)
  assert.equal(jobs.length, 31)
  assert.ok(jobs.every(row => row.jobId !== '77925'))
  assert.ok(observations(jobs).exclusions.some(row => row.reason === 'native-role-on-hold'))
})

test('Corning keeps changed native pagination unresolved with lifecycle cleanup disabled', async () => {
  const jobs = await read((body, receipt) => receipt.method === 'POST' && JSON.parse(receipt.body).from === 20
    ? body.replaceAll('"totalHits":32', '"totalHits":33') : body)
  assert.ok(jobs.length < 32)
  assert.ok(observations(jobs).failures.some(row => /pagination changed/.test(row.message)))
  assert.equal(observations(jobs).sourceScopeComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
