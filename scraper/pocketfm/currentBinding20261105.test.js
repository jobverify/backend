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
const HOME = 'https://pocketfm.com/'
const LOADER = 'https://pocketfm.com/_next/static/chunks/2akfgnfxmaoaa.js'
const FOOTER = 'https://pocketfm.com/_next/static/chunks/17-9h4731tfb2.js'
const API = 'https://api.lever.co/v0/postings/pocketfm?mode=json&skip=0&limit=100'
const ids = ['2436065b-281d-4347-8366-9a60b99dc5a5', '5b82d0d8-4ca5-4d87-ad95-eb5b8e5fb9c8']
const options = (transform = (_url, body) => body, extra = {}) => ({
  fetchText: async url => {
    assert.ok(captured.has(url), 'Unrecorded fixture GET: ' + url)
    return transform(url, captured.get(url))
  },
  fetchJson: async url => {
    assert.equal(url, API)
    return JSON.parse(captured.get(url))
  },
  ...extra,
})

// Catches pinning either old asset name: the complete current native responses
// must become reachable through the current first-party declaration.
test('Pocket FM follows the captured current loader to its careers footer and retains both India jobs', async () => {
  const jobs = await run(options())
  assert.deepEqual(jobs.map(job => job.jobId).sort(), ids)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 14)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  for (const job of jobs) {
    assert.equal(job.country, 'India')
    assert.equal(job.postingDate, null)
    assert.ok(job.sourceDescription.length > 100)
  }
})

test('Pocket FM accepts a synthetic filename rotation with the same reviewed client semantics', async () => {
  // Synthetic deployment-name variant of genuine bodies, not a new capture.
  const renamed = new Map([...captured].map(([url, body]) => [
    url.replace('2akfgnfxmaoaa.js', 'rotated-parent123.js').replace('17-9h4731tfb2.js', 'rotated-footer123.js'),
    body.replaceAll('2akfgnfxmaoaa.js', 'rotated-parent123.js').replaceAll('17-9h4731tfb2.js', 'rotated-footer123.js'),
  ]))
  const jobs = await run(options(undefined, { fetchText: async url => {
    assert.ok(renamed.has(url), 'Unrecorded rotated GET: ' + url)
    return renamed.get(url)
  } }))
  assert.deepEqual(jobs.map(job => job.jobId).sort(), ids)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 14)
})

test('Pocket FM rejects a parent declared only inside an inert template', async () => {
  const changed = captured.get(HOME).replace(/<script[^>]+src="\/_next\/static\/chunks\/2akfgnfxmaoaa\.js"[^>]*><\/script>/,
    '<template>$&</template>')
  assert.notEqual(changed, captured.get(HOME))
  await assert.rejects(run(options((url, body) => url === HOME ? changed : body)), /binding|asset/i)
})

test('Pocket FM rejects a changed footer module target before requesting native jobs', async () => {
  let nativeRequested = false
  await assert.rejects(run(options((url, body) => url === LOADER ? body.replace('t(516114)', 't(999999)') : body,
    { fetchJson: async () => { nativeRequested = true; return [] } })), /binding|client/i)
  assert.equal(nativeRequested, false)
})

test('Pocket FM rejects a foreign tenant even if a comment repeats the expected careers string', async () => {
  await assert.rejects(run(options((url, body) => url === FOOTER
    ? body.replace('https://jobs.lever.co/pocketfm', 'https://jobs.lever.co/other')
      + '\n// href:"https://jobs.lever.co/pocketfm",translationKey:"careers"\n'
    : body)), /binding|client/i)
})

test('Pocket FM never executes downloaded client statements', async () => {
  const key = '__pocketFmDownloadedCodeExecuted'
  delete globalThis[key]
  try {
    await assert.rejects(run(options((url, body) => url === FOOTER
      ? 'globalThis.__pocketFmDownloadedCodeExecuted = true;\n' + body : body)), /binding|client/i)
    assert.equal(Object.hasOwn(globalThis, key), false)
  } finally { delete globalThis[key] }
})

test('Pocket FM rejects a current parent URL with an unreviewed query', async () => {
  await assert.rejects(run(options((url, body) => url === HOME
    ? body.replaceAll('2akfgnfxmaoaa.js', '2akfgnfxmaoaa.js?unreviewed=1') : body)), /binding|asset/i)
})

test('Pocket FM rejects duplicate active parent declarations', async () => {
  await assert.rejects(run(options((url, body) => url === HOME
    ? body.replace('</head>', '<script src="/_next/static/chunks/2akfgnfxmaoaa.js"></script></head>') : body)), /binding|asset/i)
})

test('Pocket FM current binding preserves India candidates when their employer content is missing', async () => {
  const records = JSON.parse(captured.get(API))
  for (const row of records.filter(row => row.country === 'IN')) {
    for (const field of ['description', 'descriptionPlain', 'descriptionBody', 'descriptionBodyPlain', 'opening', 'openingPlain', 'additional', 'additionalPlain', 'salaryDescription', 'salaryDescriptionPlain']) row[field] = ''
    row.lists = []
  }
  const jobs = await run(options(undefined, { fetchJson: async () => records }))
  assert.deepEqual(jobs.map(job => job.jobId).sort(), ids)
  assert.equal(jobs[0].sourceDescription, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Pocket FM current binding does not hide a contradictory native country', async () => {
  const records = JSON.parse(captured.get(API))
  records.find(row => row.country === 'IN').country = 'JP'
  await assert.rejects(run(options(undefined, { fetchJson: async () => records })), /country|geograph|contradict/i)
})
