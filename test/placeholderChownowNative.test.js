import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createCatalogScraper, getScraperCatalog } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../scraper-support/utils/sourceObservationEvidence.js'
import { chownowClientURL } from '../scraper/chownow/native.js'

// The registered route intentionally uses the reviewed native public API.
// Old corporate-loader AST gates are no longer the active acquisition contract.
const API = 'https://api.lever.co/v0/postings/chownow?mode=json'
const original = () => JSON.parse(gunzipSync(fs.readFileSync(new URL('../scraper/chownow/fixtures/native-api-20261113.json.gz', import.meta.url))))
const run = options => createCatalogScraper(getScraperCatalog().find(row => row.source === 'chownow')).run(options)
const replay = (t, change = rows => rows) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    calls.push(url); assert.equal(url, API); assert.equal(init.method, 'GET')
    const response = new Response(JSON.stringify(change(original(), calls.length)), { headers: { 'content-type': 'application/json' } })
    Object.defineProperty(response, 'url', { value: url }); return response
  })
  return calls
}
const india = rows => {
  Object.assign(rows[0], { country: 'IN', categories: { ...rows[0].categories, location: 'Bengaluru, India', allLocations: ['Bengaluru, India'] } })
  return rows
}

test('registered ChowNow reconciles current native records while company and India totals stay unqualified', async t => {
  const calls = replay(t), jobs = await run()
  assert.deepEqual(calls, [API, API]); assert.equal(jobs.length, 0)
  assert.deepEqual(jobs.nativeCollectionEvidence.nativeRecords, original())
  assert.equal(readSourceObservationEvidence(jobs, 'chownow').observedVacancyCount, original().length)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('registered ChowNow retains future India original content sections and source publication time', async t => {
  replay(t, india); const [job] = await run(), role = original()[0]
  assert.equal(job.jobId, role.id); assert.equal(job.country, 'India')
  assert.ok(job.sourceDescription.includes(role.descriptionBody))
  assert.ok(role.lists.every(section => job.sourceDescription.includes(section.content)))
  assert.ok(job.sourceDescription.includes(role.additional))
  assert.equal(new Date(job.postingDate).getTime(), role.createdAt)
  assert.equal(job.sourceScopeComplete, false); assert.equal(job.lifecycleCleanupAllowed, false)
})

test('registered ChowNow preserves an absent native publication date without using observation time', async t => {
  replay(t, rows => { india(rows); delete rows[0].createdAt; return rows })
  assert.equal((await run())[0].postingDate, null)
})

for (const [label, change] of [
  ['foreign native account', rows => { rows[0].applyUrl = rows[0].applyUrl.replace('/chownow/', '/other/'); return rows }],
  ['duplicate posting identity', rows => [...rows, rows[0]]],
  ['country contradiction', rows => { rows[0].categories.location = 'Bengaluru, India'; return rows }],
  ['closing record drift', (rows, n) => { if (n === 2) rows[0].text += ' changed'; return rows }],
]) test('registered ChowNow rejects ' + label, async t => {
  replay(t, change); await assert.rejects(run())
})

test('registered ChowNow respects caller cancellation before fetching', async t => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Pre-aborted source must not fetch'))
  const controller = new AbortController(); controller.abort(Error('cancel ChowNow source'))
  await assert.rejects(run({ signal: controller.signal }), /cancel ChowNow source/)
})

test('retired ChowNow corporate HTML extractor still rejects an inert or absent native container', () => {
  assert.throws(() => chownowClientURL('<template><div id="jobs-container"><div class="jobs-list"></div></div></template>'), /container/)
})
