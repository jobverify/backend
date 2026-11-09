import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { CAREERS, parseArizeListing, parseArizeDetail, readArizeDate, runNativeArize } from './native.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixtureDir = new URL('./fixtures/current-20261029/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', fixtureDir), 'utf8'))
const records = new Map(manifest.requests.map(receipt => {
  const body = gunzipSync(fs.readFileSync(new URL(receipt.filename, fixtureDir)))
  assert.equal(createHash('sha256').update(body).digest('hex'), receipt.bodySHA256)
  return [receipt.url, { ...receipt, body, bodyComplete: true }]
}))
const listingHTML = records.get(CAREERS).body.toString()
const listing = parseArizeListing(listingHTML)
const row = listing.records[0], detailHTML = records.get(row.url).body.toString()
const transport = override => async (url, { signal }) => {
  signal?.throwIfAborted()
  assert.ok(records.has(url), `Uncaptured URL must not be fetched: ${url}`)
  const response = structuredClone(records.get(url))
  return override ? override(response, url) : response
}
// Deliberately synthetic India variants test future extraction behavior. The
// captured employer currently advertises no selected India roles in this list.
const indiaListing = listingHTML.replace('"location":"Remote (Singapore)"', '"location":"Remote (Hyderabad, India)"')
  .replace('"city":"Singapore"', '"city":"Hyderabad"')
  .replace('"flag":"\\ud83c\\uddf8\\ud83c\\uddec"', '"flag":"\\ud83c\\uddee\\ud83c\\uddf3"')
const indiaDetail = detailHTML.replaceAll('Remote (Singapore)', 'Remote (Hyderabad, India)')
const indiaTransport = override => transport((response, url) => {
  response.body = Buffer.from(url === CAREERS ? indiaListing : indiaDetail)
  return override ? override(response, url) : response
})

test('current Arize native listing enumerates 27 identities without inferring India from generic remote labels', () => {
  assert.equal(listing.records.length, 27)
  assert.equal(new Set(listing.records.map(record => record.id)).size, 27)
  assert.equal(listing.records.filter(record => /\bIndia\b/i.test(record.locations[0])).length, 0)
  assert.equal(listing.reportedTotal, null)
})

test('real Singapore role verifies full visible/schema content, native identity and original offset timestamp', () => {
  const fact = parseArizeDetail(detailHTML, row)
  assert.equal(fact.excluded, true)
  assert.equal(fact.nativeCountryAddresses[0].country, 'Singapore')
  assert.equal(fact.nativePostedDate.raw, '2026-05-06T10:55:59-04:00')
  assert.equal(fact.nativePostedDate.iso, '2026-05-06T14:55:59.000Z')
  assert.ok(fact.nativeVisibleDescriptionHTML.length > 4800)
  assert.equal(fact.nativeApplicationURL, row.url)
})

test('production catalog now executes native Arize collection while preserving unresolved whole-company scope', async () => {
  const provider = getScraperCatalog().find(provider => provider.source === 'arizeai')
  assert.equal(provider.parser, 'first-party-native-alpine-and-jobposting')
  const jobs = await createCatalogScraper(provider).run({ transport: transport() })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).firstParty, true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /observed-listing-records=27/)
})

test('a synthetic explicitly located India role retains all original content and publication data through the production extractor', async () => {
  assert.notEqual(indiaListing, listingHTML)
  const jobs = await runNativeArize({ transport: indiaTransport() })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].city, 'Hyderabad')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].source, 'arizeai')
  assert.equal(jobs[0].jobId, row.id)
  assert.equal(jobs[0].postingDate, '2026-05-06T10:55:59-04:00')
  assert.ok(jobs[0].sourceDescription.includes('What You'))
  assert.equal(jobs[0].applicationVisited, false)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('an inert or changed careers renderer and duplicate native identities cannot become an empty success', () => {
  const mutations = [listingHTML.replace('x-data="careersJobBoard()"', 'x-data="otherBoard()"'),
    listingHTML.replace(/<script>\s*(?=function careersJobBoard)/, '<script type="application/json">'),
    listingHTML.replace('`/role/?gh_jid=${job.id}`', '`/unrelated/?id=${job.id}`'),
    listingHTML.replace('"id":6030903004', '"id":5989512004')]
  for (const html of mutations) {
    assert.notEqual(html, listingHTML)
    assert.throws(() => parseArizeListing(html), /renderer|listing|template|duplicate/)
  }
})

test('mismatched employer, country flag, application identity and visible/schema content are rejected', () => {
  const mutations = [detailHTML.replace('"name":"Arize AI","sameAs"', '"name":"Other Employer","sameAs"'),
    detailHTML.replace('name="job_id" value="5989512004"', 'name="job_id" value="1"'),
    detailHTML.replace('"title":"AI Application Engineer, APJ","description"', '"title":"Different Role","description"')]
  for (const html of mutations) {
    assert.notEqual(html, detailHTML)
    assert.throws(() => parseArizeDetail(html, row), /employer|identity|title/)
  }
  assert.throws(() => parseArizeDetail(detailHTML, { ...row, nativeRecord: { ...row.nativeRecord, locationInfo: { ...row.nativeRecord.locationInfo, flag: '🇮🇳' } } }), /flag contradicts/)
  const extraDescription = detailHTML.replace('<h3>About Arize</h3>', '<h3>About Arize</h3><p>Additional visible content absent from native schema.</p>')
  assert.notEqual(extraDescription, detailHTML)
  assert.throws(() => parseArizeDetail(extraDescription, row), /content mismatch/)
})

test('native timezone conversion never repairs impossible source calendar dates or invents a date', () => {
  for (const date of ['2026-02-31T10:55:59-04:00', '2026-10-29T25:00:00Z', '2026-10-29T10:00:00+15:00', '2026-10-29T10:00:00+14:01']) {
    assert.throws(() => readArizeDate(date, { required: true }))
  }
  assert.equal(readArizeDate(null).raw, null)
  assert.throws(() => readArizeDate(null, { required: true }))
})

test('a changed closing listing remains a partial check and cannot authorize cleanup', async () => {
  let reads = 0
  const jobs = await runNativeArize({ transport: indiaTransport((response, url) => {
    if (url === CAREERS && ++reads === 3) response.body = Buffer.from(indiaListing.replace('AI Application Engineer, APJ', 'Changed role'))
    return response
  }) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('pre-cancelled Arize work performs no HTTP requests', async () => {
  const controller = new AbortController()
  controller.abort(Error('cancel Arize source'))
  await assert.rejects(runNativeArize({ signal: controller.signal, transport: async () => assert.fail('Cancelled source request') }), /cancel Arize/)
})
