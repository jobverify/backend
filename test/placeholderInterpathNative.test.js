import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { resolveZeroJobOutcome } from '../scraper-support/runner.js'

const folder = new URL('../scraper/interpathadvisory/fixtures/current-20261030/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder), 'utf8'))
const records = manifest.requests.map(row => {
  const body = gunzipSync(fs.readFileSync(new URL(row.filename, folder)))
  assert.equal(createHash('sha256').update(body).digest('hex'), row.bodySHA256)
  return { ...row, body }
})
const CAREERS = 'https://interpath.com/careers/'
const ACCOUNT = 'https://apply.workable.com/api/v1/accounts/interpath-advisory'
const API = 'https://apply.workable.com/api/v3/accounts/interpath-advisory/jobs'
const DETAIL = 'https://apply.workable.com/api/v2/accounts/interpath-advisory/jobs/'
const FIRST = '8EEF83FB04'
const detail = id => JSON.parse(records.find(row => row.requestedURL === DETAIL + id).body)
const run = options => createCatalogScraper(getScraperCatalog().find(row => row.source === 'interpathadvisory'))
  .run({ now: () => manifest.capturedAt, ...options })
const json = (row, change) => {
  const payload = JSON.parse(row.body)
  change(payload)
  return { ...row, body: Buffer.from(JSON.stringify(payload)) }
}
function replay(t, change) {
  const queues = new Map(), calls = []
  for (const row of records) {
    const key = JSON.stringify([row.method, row.requestedURL, row.requestBody])
    if (!queues.has(key)) queues.set(key, [])
    queues.get(key).push(row)
  }
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.href || input.url
    const key = JSON.stringify([init.method || 'GET', url, init.body || null]), queue = queues.get(key)
    assert.ok(queue?.length, 'Uncaptured live HTTP is forbidden: ' + key)
    calls.push({ url, method: init.method || 'GET', body: init.body || null })
    const row = queue.shift(), current = change ? change({ ...row, body: Buffer.from(row.body) }, calls) : row
    const response = new Response(current.body, { status: current.status, headers: current.headers })
    Object.defineProperty(response, 'url', { value: current.finalURL })
    return response
  })
  return calls
}

test('registered Interpath replaces the sentinel with fourteen native India records and both reconciled snapshots', async t => {
  const calls = replay(t), jobs = await run()
  assert.equal(jobs.length, 14)
  assert.equal(jobs[0].jobId, FIRST)
  assert.equal(calls.length, 50)
  assert.equal(calls.filter(row => row.url === CAREERS).length, 2)
  assert.equal(calls.filter(row => row.url === ACCOUNT).length, 2)
  assert.equal(calls.filter(row => row.url === API).length, 18)
  for (const job of jobs) {
    const native = detail(job.jobId)
    assert.equal(job.title, native.title)
    assert.equal(job.company, 'Interpath Advisory')
    assert.equal(job.country, 'India')
    assert.equal(job.postingDate, new Date(native.published).toISOString())
    assert.equal(job.nativeEmployerBrand, 'Interpath Advisory')
    assert.equal(job.sourceNativeEmployerEvidence.legalEmployer, null)
    assert.equal(job.sourceNativeEmployerEvidence.accountUid, native.accountUid)
    for (const field of ['description', 'requirements', 'benefits']) {
      assert.equal(job.sourceNativeDescriptionSections[field], native[field] ?? null)
    }
    assert.ok(job.sourceDescription.length > 300)
    assert.equal(job.sourceUrl, `https://apply.workable.com/interpath-advisory/j/${job.jobId}/`)
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
  assert.equal(jobs[0].postingDate, '2026-09-29T00:00:00.000Z')
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /closing-snapshot-reconciled/)
  assert.equal(getScraperCatalog().find(row => row.source === 'interpathadvisory').backfillMode, 'live-parser')
})

test('Interpath requires the current visible corporate board handoff before native account reads', async t => {
  const calls = replay(t, row => row.requestedURL === CAREERS
    ? { ...row, body: Buffer.from(row.body.toString().replaceAll('apply.workable.com', 'retired.invalid')) } : row)
  await assert.rejects(run(), /handoff/i)
  assert.ok(calls.every(row => row.url === CAREERS))
})

test('Interpath does not treat a blocked corporate page as an empty inventory', async t => {
  replay(t, row => row.requestedURL === CAREERS ? { ...row, status: 403, body: Buffer.from('Denied') } : row)
  await assert.rejects(run(), /careers page/i)
})

for (const [field, value] of [['uid', 'unrelated-account'], ['name', 'Unrelated Employer'], ['url', 'https://unrelated.example/']]) {
  test('Interpath rejects changed native employer account ' + field, async t => {
    replay(t, row => row.requestedURL === ACCOUNT ? json(row, payload => { payload[field] = value }) : row)
    await assert.rejects(run(), /account\/employer\/reciprocal/i)
  })
}

test('Interpath rejects contradictory native country fields before filtering roles', async t => {
  replay(t, row => row.requestedURL === API ? json(row, payload => {
    for (const record of payload.results) if (record.shortcode === FIRST) record.location.countryCode = 'US'
  }) : row)
  await assert.rejects(run(), /country\/location/i)
})

test('Interpath rejects duplicate native listing identities', async t => {
  replay(t, row => row.requestedURL === API ? json(row, payload => { payload.results[1] = payload.results[0] }) : row)
  await assert.rejects(run(), /duplicate/i)
})

test('Interpath rejects a native API error envelope rather than certifying zero', async t => {
  replay(t, row => row.requestedURL === API ? json(row, payload => { payload.success = false; payload.results = []; payload.total = 0 }) : row)
  await assert.rejects(run(), /upstream error/i)
})

test('Interpath requires complete native India description content', async t => {
  replay(t, row => row.requestedURL === DETAIL + FIRST ? json(row, payload => { payload.description = '' }) : row)
  await assert.rejects(run(), /content section|description/i)
})

test('Interpath excludes a hidden India location and retains incomplete evidence', async t => {
  replay(t, row => row.requestedURL === API ? json(row, payload => {
    for (const record of payload.results) if (record.shortcode === FIRST) record.locations[0].hidden = true
  }) : row)
  const jobs = await run()
  assert.equal(jobs.length, 13)
  assert.ok(jobs.every(job => job.jobId !== FIRST && job.lifecycleCleanupAllowed === false))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Interpath output limits retain incomplete scope after reading both complete native snapshots', async t => {
  const calls = replay(t), jobs = await run({ maxJobs: 3 })
  assert.equal(jobs.length, 3)
  assert.equal(calls.length, 50)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(jobs.every(job => job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
})

test('Interpath retains stable roles and marks incomplete evidence when a detail changes during closing', async t => {
  let visits = 0
  replay(t, row => row.requestedURL === DETAIL + FIRST && ++visits === 2
    ? json(row, payload => { payload.description += '<p>Native employer changed this content during collection.</p>' }) : row)
  const jobs = await run()
  assert.equal(jobs.length, 13)
  assert.ok(jobs.every(job => job.jobId !== FIRST && job.lifecycleCleanupAllowed === false))
  assert.match(readInventoryEvidence(jobs).reason, /closing-native-role-details-changed/)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Interpath keeps incomplete company coverage even if a future native account inventory is empty', async t => {
  replay(t, row => row.requestedURL === API ? json(row, payload => {
    payload.total = 0
    payload.results = []
    delete payload.nextPage
  }) : row)
  const jobs = await run()
  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.notEqual(resolveZeroJobOutcome({ provider: {} }, jobs, []), 'fetched-zero')
})

test('Interpath honors caller cancellation before any public request', async t => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Cancelled source must not fetch'))
  const controller = new AbortController()
  controller.abort(Error('Cancel Interpath source'))
  await assert.rejects(run({ signal: controller.signal }), /Cancel Interpath source/)
})
