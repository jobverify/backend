import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const folder = new URL('../scraper/hightouch/fixtures/current-20261030/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder), 'utf8'))
const records = manifest.requests.map(row => {
  const body = gunzipSync(fs.readFileSync(new URL(row.filename, folder)))
  assert.equal(createHash('sha256').update(body).digest('hex'), row.bodySHA256)
  return { ...row, body }
})
const CAREERS = 'https://hightouch.com/careers'
const BOARD = 'https://jobs.ashbyhq.com/hightouch-inc'
const FEED = 'https://api.ashbyhq.com/posting-api/job-board/hightouch-inc?includeCompensation=true'
const FIRST = '3f686548-a559-4452-8cf1-0e25894e270f'
const ROLE = CAREERS + '/' + FIRST
const SYNTHETIC_INDIA = '9eca924a-4805-47ff-8649-01be37ad53cd'
const PROOF = Symbol.for('jobverify.official-ats-discovery')
const rawFeed = JSON.parse(records.find(row => row.requestedURL === FEED).body)
const run = options => createCatalogScraper(getScraperCatalog().find(row => row.source === 'hightouch'))
  .run({ now: () => manifest.capturedAt, ...options })
function next(row, change) {
  return { ...row, body: Buffer.from(row.body.toString().replace(/(<script\b[^>]*\bid="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,
    (_, before, raw, after) => { const data = JSON.parse(raw); change(data); return before + JSON.stringify(data).replaceAll('<', '\\u003c') + after })) }
}
function feed(row, change) {
  const data = JSON.parse(row.body); change(data)
  return { ...row, body: Buffer.from(JSON.stringify(data)) }
}
const text = (row, old, value) => ({ ...row, body: Buffer.from(row.body.toString().replaceAll(old, value)) })
function replay(t, change) {
  const calls = [], counts = new Map()
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.href || input.url
    assert.equal(init.method || 'GET', 'GET'); assert.equal(init.body, undefined)
    const row = records.find(row => row.requestedURL === url)
    assert.ok(row, 'Uncaptured native HTTP is forbidden: ' + url)
    const occurrence = (counts.get(url) || 0) + 1
    counts.set(url, occurrence); calls.push(url)
    const current = change ? change({ ...row, body: Buffer.from(row.body) }, occurrence) : row
    const response = new Response(current.body, { status: current.status, headers: current.headers })
    Object.defineProperty(response, 'url', { value: current.finalURL })
    return response
  })
  return calls
}
// This is a synthetic country transformation to test future India extraction,
// not a live Hightouch opening. Complete native response structures are kept.
function syntheticIndiaAt(row, selectedId) {
  if (row.requestedURL === FEED) return feed(row, data => {
    const job = data.jobs.find(job => job.id === selectedId)
    job.location = 'Bengaluru, India'
    job.address = { postalAddress: { addressCountry: 'India', addressLocality: 'Bengaluru', addressRegion: 'Karnataka' } }
  })
  if (row.requestedURL === CAREERS) {
    let oldLocation
    row = next(row, data => {
      const job = data.props.pageProps.jobPostings.find(job => job.id === selectedId)
      oldLocation = job.locationName; job.locationName = 'Bengaluru, India'
    })
    const pattern = new RegExp('(<a\\b[^>]*href="/careers/' + selectedId + '"[^>]*>)([\\s\\S]*?)(</a>)', 'g')
    row.body = Buffer.from(row.body.toString().replace(pattern, (_, before, content, after) => before + content.replaceAll(oldLocation, 'Bengaluru, India') + after))
  }
  return row
}
const syntheticIndia = row => syntheticIndiaAt(row, SYNTHETIC_INDIA)

test('registered Hightouch reconciles86 website/native role summaries and retains unknown remote-country coverage', async t => {
  const calls = replay(t), jobs = await run()
  assert.equal(jobs.length, 0)
  assert.equal(calls.length, 10)
  assert.equal(calls.filter(url => url === FEED).length, 2)
  assert.equal(calls.filter(url => url === CAREERS).length, 2)
  assert.equal(jobs[PROOF].nativeInventory.observedNativeRoles, 86)
  assert.equal(jobs[PROOF].nativeInventory.snapshots, 2)
  assert.equal(jobs[PROOF].nativeInventory.unresolvedCountryScope, true)
  assert.deepEqual(jobs[PROOF].binding.qualifyingRoleIds, [FIRST, 'eaa2fdb6-3f48-4fa2-9947-e1a397a176ab'])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(getScraperCatalog().find(row => row.source === 'hightouch').backfillMode, 'live-parser')
})

test('synthetic India replay preserves original native publication, complete description and compensation', async t => {
  replay(t, syntheticIndia)
  const jobs = await run(), native = rawFeed.jobs.find(job => job.id === SYNTHETIC_INDIA)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, SYNTHETIC_INDIA)
  assert.equal(jobs[0].title, 'Solutions Engineering Manager')
  assert.equal(jobs[0].company, 'Hightouch')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].nativePublishedAt, '2025-12-29T20:23:14.323+00:00')
  assert.equal(jobs[0].postingDate, native.publishedAt)
  assert.ok(jobs[0].sourceDescription.startsWith(native.descriptionHtml))
  assert.equal(jobs[0].sourceNativePosting.descriptionHtml, native.descriptionHtml)
  assert.deepEqual(jobs[0].nativeCompensation, native.compensation)
  assert.equal(jobs[0].nativeEmployerBrand, 'Hightouch')
  assert.equal(jobs[0].nativeLegalEmployer, null)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('Hightouch requires active first-party role cards before reading a native account', async t => {
  const calls = replay(t, row => row.requestedURL === CAREERS ? text(row, 'href="/careers/', 'href="/retired/') : row)
  await assert.rejects(run(), /role|card|primary|inventory/i)
  assert.deepEqual(calls, [CAREERS])
})

test('Hightouch requires typed current website inventory instead of unrelated Next data', async t => {
  replay(t, row => row.requestedURL === CAREERS ? next(row, data => { delete data.props.pageProps.jobPostings }) : row)
  await assert.rejects(run(), /inventory|jobPostings/i)
})

test('Hightouch rejects a changed first-party role Next route', async t => {
  replay(t, row => row.requestedURL === ROLE ? next(row, data => { data.query.slug = 'unrelated' }) : row)
  await assert.rejects(run(), /route|identity/i)
})

test('Hightouch rejects a foreign native account in the currently advertised application link', async t => {
  replay(t, row => row.requestedURL === ROLE ? next(row, data => { data.props.pageProps.posting.applyLink = 'https://jobs.ashbyhq.com/unrelated/' + FIRST }) : row)
  await assert.rejects(run(), /account|application|binding/i)
})

test('Hightouch binds first-party structured hiring organization to the expected employer', async t => {
  replay(t, row => row.requestedURL === ROLE ? text(row, '"name":"Hightouch"', '"name":"Other Employer"') : row)
  await assert.rejects(run(), /employer|organization|identity|schema/i)
})

test('Hightouch verifies native board branding before accepting the public feed', async t => {
  replay(t, row => row.requestedURL === BOARD ? text(row, 'Hightouch Jobs', 'Other Employer Jobs') : row)
  await assert.rejects(run(), /board|employer|brand/i)
})

test('Hightouch does not accept a corporate HTTP denial as an empty inventory', async t => {
  replay(t, row => row.requestedURL === CAREERS ? { ...row, status: 429 } : row)
  await assert.rejects(run(), /HTTP.*429/i)
})

test('Hightouch rejects a native error envelope rather than turning it into a successful empty result', async t => {
  replay(t, row => row.requestedURL === FEED ? feed(row, data => { data.error = 'Unavailable'; data.jobs = [] }) : row)
  await assert.rejects(run(), /error|failed|unavailable/i)
})

test('Hightouch rejects a native duplicate identity', async t => {
  replay(t, row => row.requestedURL === FEED ? feed(row, data => { data.jobs[1] = data.jobs[0] }) : row)
  await assert.rejects(run(), /identity|duplicate|repeat|inventory/i)
})

test('Hightouch reconciles native listed status with the first-party role inventory', async t => {
  replay(t, row => row.requestedURL === FEED ? feed(row, data => { data.jobs[0].isListed = false }) : row)
  await assert.rejects(run(), /listed|inventory|summary/i)
})

test('Hightouch rejects future native publication dates before geography filtering', async t => {
  replay(t, row => row.requestedURL === FEED ? feed(row, data => { data.jobs[0].publishedAt = '2099-01-01T00:00:00Z' }) : row)
  await assert.rejects(run(), /publication|date|future/i)
})

test('Hightouch requires the full native description for every listed record', async t => {
  replay(t, row => row.requestedURL === FEED ? feed(row, data => { data.jobs[0].descriptionHtml = ''; data.jobs[0].descriptionPlain = '' }) : row)
  await assert.rejects(run(), /content|description/i)
})

test('Hightouch detects native description changes in the closing snapshot even without India selections', async t => {
  replay(t, (row, occurrence) => row.requestedURL === FEED && occurrence === 2 ? feed(row, data => { data.jobs[0].descriptionHtml += '<p>Updated responsibilities.</p>' }) : row)
  await assert.rejects(run(), /changed|closing|reconcil/i)
})

test('Hightouch detects native compensation changes in the closing snapshot', async t => {
  replay(t, (row, occurrence) => row.requestedURL === FEED && occurrence === 2 ? feed(row, data => { data.jobs[0].compensation.compensationTierSummary = '$1 - $2' }) : row)
  await assert.rejects(run(), /changed|closing|reconcil/i)
})

test('Hightouch respects output limits after completing the native and first-party closing checks', async t => {
  const calls = replay(t, row => syntheticIndiaAt(syntheticIndia(row), 'd47b2d53-0ec4-4216-a722-ae4199bf7247'))
  const jobs = await run({ maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(calls.length, 10)
  assert.equal(jobs[PROOF].nativeInventory.observedSelectedIndiaRoles, 2)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('Hightouch honors caller cancellation before sending HTTP', async t => {
  const calls = replay(t), controller = new AbortController()
  controller.abort(new Error('cancel Hightouch'))
  await assert.rejects(run({ signal: controller.signal }), /cancel Hightouch/)
  assert.deepEqual(calls, [])
})

test('Hightouch bounds an oversized native response before parsing it', async t => {
  replay(t, row => row.requestedURL === CAREERS ? { ...row, body: Buffer.alloc(3 * 1024 * 1024 + 1, 65) } : row)
  await assert.rejects(run(), /byte bound/i)
})

test('Hightouch can bind a coherent one-role board without requiring a second vacancy', async t => {
  const calls = replay(t, row => {
    if (row.requestedURL === FEED) return feed(row, data => { data.jobs = data.jobs.filter(job => job.id === FIRST) })
    if (row.requestedURL === CAREERS) {
      row = next(row, data => { data.props.pageProps.jobPostings = data.props.pageProps.jobPostings.filter(job => job.id === FIRST) })
      row.body = Buffer.from(row.body.toString().replace(/<a\b[^>]*href="\/careers\/([a-f\d-]{36})"[^>]*>[\s\S]*?<\/a>/g,
        (html, id) => id === FIRST ? html : ''))
    }
    return row
  })
  const jobs = await run()
  assert.equal(jobs.length, 0)
  assert.equal(calls.length, 8)
  assert.equal(jobs[PROOF].nativeInventory.observedNativeRoles, 1)
  assert.deepEqual(jobs[PROOF].binding.qualifyingRoleIds, [FIRST])
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('Hightouch rejects explicit India country against the actual exclusive North America label', async t => {
  replay(t, row => row.requestedURL === FEED ? feed(row, data => { data.jobs[0].address = { postalAddress: { addressCountry: 'India' } } }) : row)
  await assert.rejects(run(), /country|region|geography/i)
})

test('Hightouch checks exclusive-region contradictions in secondary native locations too', async t => {
  replay(t, row => row.requestedURL === FEED ? feed(row, data => {
    data.jobs[0].secondaryLocations = [{ location: 'Remote (Europe)', address: { postalAddress: { addressCountry: 'India' } } }]
  }) : row)
  await assert.rejects(run(), /country|region|geography/i)
})

test('Hightouch rejects an explicit foreign country with a known contradictory India city and state pair', async t => {
  replay(t, row => row.requestedURL === FEED ? feed(row, data => {
    data.jobs[0].address = { postalAddress: { addressCountry: 'United States', addressLocality: 'Bengaluru', addressRegion: 'Karnataka' } }
  }) : row)
  await assert.rejects(run(), /country|state|geography/i)
})

test('Hightouch checks contradictory country and India city-state pairs in secondary locations', async t => {
  replay(t, row => row.requestedURL === FEED ? feed(row, data => {
    data.jobs[0].secondaryLocations = [{ location: 'New York', address: { postalAddress: { addressCountry: 'United States', addressLocality: 'Bengaluru', addressRegion: 'Karnataka' } } }]
  }) : row)
  await assert.rejects(run(), /country|state|geography/i)
})

test('Hightouch treats native IND country as India when checking the exclusive region', async t => {
  replay(t, row => row.requestedURL === FEED ? feed(row, data => { data.jobs[0].address = { postalAddress: { addressCountry: 'IND' } } }) : row)
  await assert.rejects(run(), /country|region|geography/i)
})

test('Hightouch checks a direct postal address rather than requiring a nested address wrapper', async t => {
  replay(t, row => row.requestedURL === FEED ? feed(row, data => { data.jobs[0].address = { addressCountry: 'India' } }) : row)
  await assert.rejects(run(), /country|region|geography/i)
})

test('Hightouch checks direct IND postal addresses in secondary regions', async t => {
  replay(t, row => row.requestedURL === FEED ? feed(row, data => {
    data.jobs[0].secondaryLocations = [{ location: 'Remote (Europe)', address: { addressCountry: 'IND' } }]
  }) : row)
  await assert.rejects(run(), /country|region|geography/i)
})

test('Hightouch accepts a consistent native IND alias and preserves its raw country value', async t => {
  replay(t, row => {
    row = syntheticIndia(row)
    return row.requestedURL === FEED ? feed(row, data => { data.jobs.find(job => job.id === SYNTHETIC_INDIA).address.postalAddress.addressCountry = 'IND' }) : row
  })
  const jobs = await run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceNativePosting.address.postalAddress.addressCountry, 'IND')
})

test('Hightouch accepts a consistent direct native India postal address', async t => {
  replay(t, row => {
    row = syntheticIndia(row)
    return row.requestedURL === FEED ? feed(row, data => {
      const job = data.jobs.find(job => job.id === SYNTHETIC_INDIA)
      job.address = job.address.postalAddress
    }) : row
  })
  const jobs = await run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceNativePosting.address.addressCountry, 'India')
})
