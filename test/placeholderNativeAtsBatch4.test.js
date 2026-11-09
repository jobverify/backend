import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { resolveZeroJobOutcome } from '../scraper-support/runner.js'

const source = 'docker'
const folder = new URL('../scraper/docker/fixtures/current-20261029/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder), 'utf8'))
const receipts = manifest.requests.map(row => {
  const body = gunzipSync(fs.readFileSync(new URL(row.filename, folder)))
  assert.equal(createHash('sha256').update(body).digest('hex'), row.bodySHA256)
  return { ...row, body }
})
const apiURL = 'https://api.ashbyhq.com/posting-api/job-board/docker'
const payload = JSON.parse(receipts.find(row => row.requestedURL === apiURL).body)
assert.equal(payload.jobs.length, 51)
const role = payload.jobs[0]
const run = options => createCatalogScraper(getScraperCatalog().find(row => row.source === source)).run(options)
const replay = (t, mutate) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.href || input.url
    calls.push(url)
    assert.equal(init.method || 'GET', 'GET')
    const row = receipts.find(row => row.requestedURL === url)
    assert.ok(row, 'Uncaptured live HTTP is forbidden: ' + url)
    const current = mutate ? mutate({ ...row, body: Buffer.from(row.body) }) : row
    const response = new Response(current.body, { status: current.status, headers: current.headers })
    Object.defineProperty(response, 'url', { value: current.finalURL })
    return response
  })
  return calls
}
const withIndiaRole = row => {
  if (row.requestedURL !== apiURL) return row
  const data = JSON.parse(row.body)
  Object.assign(data.jobs[0], { location: 'Bengaluru, India', secondaryLocations: [],
    address: { postalAddress: { addressLocality: 'Bengaluru', addressRegion: 'Karnataka', addressCountry: 'India' } } })
  return { ...row, body: Buffer.from(JSON.stringify(data)) }
}

test('registered Docker reads the current corporate embed and native 51-role feed without claiming a company-wide zero', async t => {
  const calls = replay(t)
  const jobs = await run()
  assert.deepEqual(calls, [manifest.provider.companyCareerPage, apiURL])
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).firstParty, true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.notEqual(resolveZeroJobOutcome({ provider: {} }, jobs, []), 'fetched-zero')
  assert.equal(getScraperCatalog().find(row => row.source === source).backfillMode, 'live-parser')
})

test('registered Docker includes a native role with explicit India country instead of discarding every feed result', async t => {
  replay(t, withIndiaRole)
  const jobs = await run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, role.id)
  assert.equal(jobs[0].title, role.title)
  assert.equal(jobs[0].company, 'Docker')
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(jobs[0].jobDescription, role.descriptionHtml)
  assert.equal(jobs[0].sourceDescription, role.descriptionHtml)
  assert.equal(jobs[0].postingDate, role.publishedAt)
  assert.equal(jobs[0].sourceUrl, role.jobUrl)
  assert.equal(jobs[0].applyUrl, role.applyUrl)
  assert.equal(jobs[0].officialAtsBinding.verified, true)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('Docker never queries a native account after the current corporate embed is removed', async t => {
  const calls = replay(t, row => row.requestedURL !== apiURL
    ? { ...row, body: Buffer.from('<html><body>Docker careers. No advertised job-board handoff.</body></html>') } : row)
  await assert.rejects(run(), /binding|supported-ats/)
  assert.ok(calls.every(url => url !== apiURL))
})

for (const changed of ['country', 'role identity', 'inventory envelope']) test('Docker rejects a native ' + changed + ' contradiction', async t => {
  replay(t, row => {
    if (row.requestedURL !== apiURL) return row
    const data = JSON.parse(withIndiaRole(row).body)
    if (changed === 'country') data.jobs[0].address.postalAddress.addressCountry = 'United States'
    else if (changed === 'role identity') data.jobs[0].applyUrl = 'https://jobs.ashbyhq.com/unrelated/' + role.id + '/application'
    else { data.success = false; data.error = 'Native inventory unavailable'; data.jobs = [] }
    return { ...row, body: Buffer.from(JSON.stringify(data)) }
  })
  await assert.rejects(run())
})

test('Docker honors cancellation before any corporate or native request', async t => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Cancelled extraction must not fetch'))
  const controller = new AbortController()
  controller.abort(Error('Cancelled Docker source'))
  await assert.rejects(run({ signal: controller.signal }), /Cancelled Docker source/)
})
