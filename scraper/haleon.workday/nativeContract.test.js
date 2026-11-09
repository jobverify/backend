import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { getScraperCatalog } from '../../scraper-support/providers/index.js'
import { classifyProviderImplementation } from '../../scripts/reportScriptCatalogTopology.js'
import { createFirstPartyHTMLScraper } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { createSourceConfig } from './parser.js'
const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261022.json.gz', import.meta.url))))
const first = JSON.parse(Buffer.from(fixture.packets.find(p => p.body === 'search-0.body').rawBodyBase64, 'base64'))
const primaryIndia = first.data.positions.filter(p => p.locations.some(l => /,\s*India$/.test(l)))
const firstIndiaID = String(primaryIndia.find(row => {
  const packet = fixture.packets.find(p => p.body === 'detail-' + row.id + '.body')
  return JSON.parse(Buffer.from(packet.rawBodyBase64, 'base64')).data.positionUserActions.applyAction.applyUrl.startsWith('https://')
}).id)

function mock(mutate = value => value) {
  const requests = [], index = new Map(), calls = new Map()
  for (const packet of fixture.packets) index.set(packet.url, [...(index.get(packet.url) || []), packet])
  return { requests, transport: async url => {
    requests.push(url)
    const entries = index.get(url)
    assert.ok(entries, 'Unexpected fixture request: ' + url)
    const call = calls.get(url) || 0
    calls.set(url, call + 1)
    const packet = entries[Math.min(call, entries.length - 1)]
    // MIME headers are test protocol inputs; the retained fixture preserves raw
    // body bytes and timestamps without claiming unrecorded response headers.
    return mutate({ url, status: packet.status, headers: { 'content-type': new URL(url).pathname.startsWith('/api/pcsx/') ? 'application/json' : 'text/html' }, body: Buffer.from(packet.rawBodyBase64, 'base64'), bodyComplete: true,
      requestedAt: packet.requestedAt, completedAt: packet.completedAt }, requests.length)
  } }
}
const alterJSON = (response, fn) => { const payload = JSON.parse(response.body.toString('utf8')); fn(payload); return { ...response, body: Buffer.from(JSON.stringify(payload)) } }

test('selected Haleon executable replaces its empty sentinel and reads all global pages before mapping India', async () => {
  const m = mock(), jobs = await run({ transport: m.transport })
  assert.equal(jobs.length, 46)
  assert.equal(classifyProviderImplementation(getScraperCatalog().find(p => p.source === 'haleon')).type, 'script')
  const native = jobs[0].nativeCollectionEvidence
  assert.equal(native.observedListingCount, 336)
  assert.equal(native.pagesFetched, 34)
  assert.equal(native.candidateDetails, 49)
  assert.equal(native.failures.length, 3)
  assert.ok(native.failures.every(f => /application URL/.test(f.message)))
  assert.equal(native.listingPaginationComplete, true)
  assert.equal(native.closingInventoryMatches, true)
  assert.equal(m.requests.length, 86)
  assert.equal(jobs.filter(job => job.nativeFacts.nativeApplicationPostingID.endsWith('-1')).length, 11)
  assert.ok(m.requests.every(url => !/myworkdayjobs|\/apply|\/application/.test(url)))
  assert.ok(m.requests.filter(url => url.includes('/api/pcsx/search')).every(url => !new URL(url).searchParams.has('filter_country')))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.reportedTotal, 336)
  assert.equal(evidence.listingComplete, false)
  for (const job of jobs) {
    assert.equal(job.source, 'haleon')
    assert.equal(job.company, 'Haleon')
    assert.equal(job.country, 'India')
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.postingDate, new Date(job.nativePostedTs * 1000).toISOString())
    assert.equal(job.sourceDescription, job.nativeFacts.nativeDetail.jobDescription)
    assert.equal(job.applyUrl, job.nativeFacts.nativeDetail.positionUserActions.applyAction.applyUrl)
  }
})

test('incomplete native pagination preserves a positive subset without cleanup authority', async () => {
  const m = mock(r => r.url.includes('/api/pcsx/search') && new URL(r.url).searchParams.get('start') === '10' ? { ...r, status: 503, body: Buffer.from('unavailable') } : r)
  const jobs = await run({ transport: m.transport })
  assert.equal(jobs.length, primaryIndia.length - 1)
  assert.equal(jobs[0].nativeCollectionEvidence.listingPaginationComplete, false)
  assert.ok(jobs[0].nativeCollectionEvidence.failures.some(f => f.stage === 'native-pagination'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('missing descriptions, inconsistent countries and failed role details stay explicit partial failures', async () => {
  for (const variant of ['description', 'country', 'HTTP']) {
    const m = mock(r => {
      if (!r.url.includes('position_id=' + firstIndiaID + '&')) return r
      if (variant === 'HTTP') return { ...r, status: 503, body: Buffer.from('unavailable') }
      return alterJSON(r, p => { if (variant === 'description') p.data.jobDescription = ''; else p.data.standardizedLocations = ['London, ENG, GB'] })
    })
    const jobs = await run({ transport: m.transport })
    assert.equal(jobs.length, 45, variant)
    assert.ok(jobs.every(job => String(job.jobId) !== firstIndiaID))
    assert.equal(jobs[0].nativeCollectionEvidence.failures.filter(f => f.stage === 'native-detail').length, 4)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  }
})

test('native failed/error/truncated first pages cannot become zero-inventory proof', async () => {
  for (const variant of ['HTTP', 'envelope', 'total', 'duplicate', 'fallback']) {
    const m = mock(r => {
      if (!r.url.includes('/api/pcsx/search')) return r
      if (variant === 'HTTP') return { ...r, status: 503, body: Buffer.from('unavailable') }
      return alterJSON(r, p => {
        if (variant === 'envelope') p.error = { message: 'unavailable', body: '' }
        if (variant === 'total') p.data.positions.pop()
        if (variant === 'duplicate') p.data.positions[1] = p.data.positions[0]
        if (variant === 'fallback') p.metadata = { isFallback: true }
      })
    })
    await assert.rejects(run({ transport: m.transport }), /incomplete|forbidden/i, variant)
  }
})

test('complete zero India matches remain unverified while native global counts stay known', async () => {
  const m = mock(r => r.url.includes('/api/pcsx/search') ? alterJSON(r, p => {
    for (const row of p.data.positions) if (row.locations.some(l => /,\s*India$/.test(l))) { row.locations = ['London, United Kingdom']; row.standardizedLocations = ['London, ENG, GB'] }
  }) : r)
  const jobs = await run({ transport: m.transport })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 336)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(m.requests.filter(url => url.includes('position_details')).length, 0)
})

test('foreign application identity and future native timestamps are rejected without requesting their targets', async () => {
  for (const variant of ['application', 'wrong-requisition', 'future']) {
    const m = mock(r => r.url.includes('position_id=' + firstIndiaID + '&') ? alterJSON(r, p => {
      if (variant === 'application') p.data.positionUserActions.applyAction.applyUrl = 'https://other.example.test/apply'
      else if (variant === 'wrong-requisition') p.data.positionUserActions.applyAction.applyUrl = 'https://gsknch.wd3.myworkdayjobs.com/GSKCareers/job/Bengaluru/Other_999999-1/apply?source=Eightfold'
      else p.data.postedTs = 9999999999
    }) : r)
    const jobs = await run({ transport: m.transport })
    assert.equal(jobs.length, 45)
    assert.ok(!m.requests.some(url => url.includes('other.example.test')))
  }
})

test('JSON is opt-in per endpoint while default HTML readers and mismatched MIME types remain strict', async () => {
  const config = createSourceConfig()
  delete config.expectedContentType
  const m = mock()
  const blocked = await createFirstPartyHTMLScraper(config).collect({ transport: m.transport })
  assert.equal(blocked.jobs.length, 0)
  assert.ok(blocked.failures.some(f => /content type/.test(f.message)))
  for (const stage of ['corporate', 'API']) {
    const bad = mock(r => (stage === 'corporate' ? r.url === 'https://www.haleon.com/careers' : r.url.includes('/api/pcsx/'))
      ? { ...r, headers: { 'content-type': 'text/plain' } } : r)
    await assert.rejects(run({ transport: bad.transport }), /incomplete|forbidden/i)
  }
})
