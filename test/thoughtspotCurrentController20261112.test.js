import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'

import { createThoughtSpotScraper, CAREERS_URL, LISTING_URL } from '../scraper/thoughtspot/native.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../scraper-support/utils/inventoryEvidence.js'
import { extractionDetailHealth } from '../scraper-support/utils/extractionDetailHealth.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/thoughtspot-current-controller-20261112.json.gz', import.meta.url))))
const currentMap = 'https://www.thoughtspot.com/_next/static/chunks/90155-e2c8eae2e1b199ea.js'
const currentLoader = 'https://www.thoughtspot.com/_next/static/chunks/webpack-7384f84f48791def.js'
const listingComponent = 'https://www.thoughtspot.com/_next/static/chunks/42179.dd76c7957fb6f98e.js'
const roleURL = fixture.responses.find(row => row.url.startsWith('https://ats.rippling.com/thoughtspot/jobs/')).url

const replay = (mutate, options = {}) => {
  const reads = [], occurrences = new Map()
  const transport = async url => {
    options.signal?.throwIfAborted()
    reads.push(url)
    const index = occurrences.get(url) || 0
    occurrences.set(url, index + 1)
    const candidates = fixture.responses.filter(row => row.url === url)
    assert.ok(candidates.length, 'Only retained advertised first-party responses may be read: ' + url)
    const row = candidates[Math.min(index, candidates.length - 1)]
    const response = { url, status: row.status, headers: { 'content-type': row.contentType }, bodyComplete: true,
      body: Buffer.from(row.body), requestedAt: row.startedAt, completedAt: row.completedAt }
    mutate?.(response, { url, index })
    return response
  }
  return { reads, run: () => createThoughtSpotScraper().run({ transport, ...options }),
    collect: () => createThoughtSpotScraper().collect({ transport, ...options }) }
}
const changedJSON = (response, change) => {
  const value = JSON.parse(response.body)
  change(value)
  response.body = Buffer.from(JSON.stringify(value))
}
const changedNextData = (response, change) => {
  let html = response.body.toString()
  const match = html.match(/<script\b[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  assert.ok(match)
  const data = JSON.parse(match[1])
  change(data)
  html = html.replace(match[1], JSON.stringify(data))
  response.body = Buffer.from(html)
}
const evidence = jobs => jobs[Symbol.for('jobverify.native-html-evidence')]

test('ThoughtSpot current public delegation reconciles all52 publisher rows and12 full India roles', async () => {
  const source = replay()
  const jobs = await source.run()
  assert.equal(jobs.length, 12)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 12)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 12)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), false)
  assert.equal(extractionDetailHealth(jobs).complete, true)
  assert.equal(evidence(jobs).observedListingCount, 52)
  assert.equal(evidence(jobs).closingInventoryMatches, true)
  assert.deepEqual(evidence(jobs).failures, [])
  assert.deepEqual(source.reads.filter(url => url.includes('/_next/')).sort(), [listingComponent, currentMap, currentLoader].sort())
})

for (const [label, url, edit] of [
  ['component-to-module mapping', currentMap, body => body.replace('a.e(42179)', 'a.e(42178)')],
  ['webpack chunk mapping', currentLoader, body => body.replace('42179:"dd76c7957fb6f98e"', '42179:"0000000000000000"')],
  ['native enumeration component', listingComponent, body => body.replace('/api/getCareersListing', '/api/unreviewedCareers')],
]) test('ThoughtSpot rejects changed ' + label + ' bytes before certifying source scope', async () => {
  const jobs = await replay((response, state) => { if (state.url === url) response.body = Buffer.from(edit(response.body.toString())) }).run()
  assert.equal(jobs.length, 12)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.ok(evidence(jobs).failures.some(failure => /controller or unfiltered enumeration contract changed/.test(failure.message)))
})

for (const [label, mutate] of [
  ['mixed old map and new loader', response => { response.body = Buffer.from(response.body.toString().replace('90155-e2c8eae2e1b199ea.js', '90155-e179c67d0f81b18d.js')) }],
  ['changed recruiting template', response => changedNextData(response, data => { data.props.pageProps.page.bodyJsx += '<div>Unreviewed recruiting surface</div>' })],
  ['additional public hiring iframe', response => { response.body = Buffer.from(response.body.toString().replace('</body>', '<iframe src="https://example.invalid/jobs"></iframe></body>')) }],
  ['active srcdoc iframe', response => { response.body = Buffer.from(response.body.toString().replace('</body>', '<iframe srcdoc="Unreviewed recruiting surface"></iframe></body>')) }],
  ['active blank iframe', response => { response.body = Buffer.from(response.body.toString().replace('</body>', '<iframe></iframe></body>')) }],
]) test('ThoughtSpot retains known roles but blocks cleanup for ' + label, async () => {
  const jobs = await replay((response, state) => { if (state.url === CAREERS_URL) mutate(response) }).run()
  assert.equal(jobs.length, 12)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

for (const [label, mutate] of [
  ['truncated controller', response => { response.bodyComplete = false }],
  ['wrong controller MIME', response => { response.headers['content-type'] = 'text/html' }],
  ['denied controller', response => { response.status = 403 }],
]) test('ThoughtSpot preserves full known roles without accepting a ' + label, async () => {
  const jobs = await replay((response, state) => { if (state.url === currentMap) mutate(response) }).run()
  assert.equal(jobs.length, 12)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('ThoughtSpot added native envelope metadata cannot masquerade as complete unpaginated inventory', async () => {
  const jobs = await replay((response, state) => {
    if (state.url === LISTING_URL) changedJSON(response, data => { data.hasMore = false })
  }).run()
  assert.equal(jobs.length, 12)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(evidence(jobs).failures.some(failure => /public envelope or pagination metadata/.test(failure.message)))
})

test('ThoughtSpot unknown country on a foreign publisher row keeps source scope incomplete', async () => {
  const jobs = await replay((response, state) => {
    if (state.url === LISTING_URL) changedJSON(response, data => {
      const location = data.data.find(row => row.locations.every(item => item.countryCode !== 'IN')).locations[0]
      location.countryCode = 'ZZ'
      location.country = 'Unknown'
    })
  }).run()
  assert.equal(jobs.length, 12)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.ok(evidence(jobs).unknownRawFailures.length > 0)
})

test('ThoughtSpot closing worldwide row drift blocks complete promotion even with12 full India descriptions', async () => {
  const jobs = await replay((response, state) => {
    if (state.url === LISTING_URL && state.index === 1) changedJSON(response, data => { data.data[0].name += ' changed during collection' })
  }).run()
  assert.equal(jobs.length, 12)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(evidence(jobs).closingInventoryMatches, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

for (const [label, change] of [
  ['mismatched native role identity', data => { data.query.jobId = '00000000-0000-0000-0000-000000000000' }],
  ['empty employer role criteria', data => { data.props.pageProps.apiData.jobPost.description = { company: '', role: '' } }],
]) test('ThoughtSpot cannot certify a role with ' + label, async () => {
  const jobs = await replay((response, state) => { if (state.url === roleURL) changedNextData(response, change) }).run()
  assert.equal(jobs.length, 11)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.ok(evidence(jobs).failures.some(failure => failure.stage === 'native-detail'))
})

test('ThoughtSpot caller cancellation during the current public controller read keeps its exact reason', async () => {
  const controller = new AbortController()
  const reason = new Error('cancel ThoughtSpot controller proof')
  const source = replay((_response, state) => { if (state.url === currentMap) controller.abort(reason) }, { signal: controller.signal })
  await assert.rejects(source.run(), error => error === reason)
})
