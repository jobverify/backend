import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const root = new URL('./fixtures/2026-11-05-current-binding/', import.meta.url)
const metadata = JSON.parse(fs.readFileSync(new URL('metadata.json', root)))
const captured = new Map(metadata.responses.map(row => {
  const bytes = gunzipSync(fs.readFileSync(new URL(row.file, root)))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256)
  return [row.requestedUrl, bytes.toString('utf8')]
}))
const CAREERS = 'https://woven.toyota/en/careers/'
const CLIENT = 'https://woven.toyota/_next/static/chunks/2ccvjo_8i5ll_.js'
const FIRST = 'https://api.lever.co/v0/postings/woven-by-toyota?mode=json&skip=0&limit=100'
const SECOND = 'https://api.lever.co/v0/postings/woven-by-toyota?mode=json&skip=100&limit=100'
const options = (transform = (_url, body) => body, extra = {}) => ({
  // Only the careers page and relevant declared client are needed in this
  // focused fixture. Other client requests fail explicitly, never as empty HTML.
  fetchPage: async url => {
    if (![CAREERS, CLIENT].includes(url)) throw Error('Unrecorded unrelated client chunk')
    return { status: 200, url, html: transform(url, captured.get(url)) }
  },
  fetchJson: async url => {
    assert.ok([FIRST, SECOND].includes(url), 'Unexpected native pagination GET: ' + url)
    return JSON.parse(captured.get(url))
  },
  now: () => '2026-11-05T20:03:12.399Z',
  ...extra,
})
const syntheticIndia = () => {
  // Synthetic country/content contract variant, not a genuine India vacancy.
  const row = JSON.parse(captured.get(FIRST))[0]
  row.country = 'IN'
  row.categories.location = 'Bengaluru, India'
  row.categories.allLocations = ['Bengaluru, India']
  return row
}

test('Woven recognizes its current declared native client after the readable function name was minified', async () => {
  const jobs = await run(options())
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 145)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('Woven accepts formatting-only changes to the same reviewed current client', async () => {
  const jobs = await run(options((url, body) => url === CLIENT ? '\n/* static data only */\n' + body : body))
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 145)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('Woven current binding still maps an explicit synthetic native India location', async () => {
  const jobs = await run(options(undefined, { fetchJson: async () => [syntheticIndia()] }))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(jobs[0].postingDate, null)
  assert.ok(jobs[0].sourceDescription.length > 100)
})

test('Woven current binding rejects a native endpoint changed to another tenant', async () => {
  let nativeRequested = false
  await assert.rejects(run(options((url, body) => url === CLIENT
    ? body.replaceAll('postings/woven-by-toyota', 'postings/other') : body,
  { fetchJson: async () => { nativeRequested = true; return [] } })), /binding/i)
  assert.equal(nativeRequested, false)
})

test('Woven rejects additional downloaded statements without executing them', async () => {
  const key = '__wovenDownloadedCodeExecuted'
  delete globalThis[key]
  try {
    await assert.rejects(run(options((url, body) => url === CLIENT
      ? 'globalThis.__wovenDownloadedCodeExecuted = true;\n' + body : body)), /binding/i)
    assert.equal(Object.hasOwn(globalThis, key), false)
  } finally { delete globalThis[key] }
})

test('Woven current binding retains incomplete evidence for an unresolved secondary location', async () => {
  const row = syntheticIndia()
  row.categories.allLocations.push('Remote')
  const jobs = await run(options(undefined, { fetchJson: async () => [row] }))
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})
