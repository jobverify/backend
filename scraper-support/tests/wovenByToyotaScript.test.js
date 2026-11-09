import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { statSync, readFileSync } from 'node:fs'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import * as woven from '../../scraper/wovenbytoyota/script.js'

const root = new URL('../../scraper/wovenbytoyota/fixtures/', import.meta.url)
const official = JSON.parse(readFileSync(new URL('careers-response.json', root)))
const clients = JSON.parse(readFileSync(new URL('client-api-responses.json', root)))
const fixturePage = async url => {
  const response = [official, ...clients].find(page => page.url === url)
  if (!response) throw new Error('Unrecorded unrelated client chunk')
  return { status: response.status, url, html: response.body }
}
const run = options => woven.run({ fetchPage: fixturePage, ...options })

test('Woven by Toyota verifies a fresh official client binding before trusting native zero', async () => {
  for (const changed of [
    { status: 503, url: official.url, html: official.body },
    { status: 200, url: 'https://other.example/careers/', html: official.body },
    { status: 200, url: official.url, html: official.body.replace('</body>', '') },
  ]) await assert.rejects(run({ fetchPage: async () => changed, fetchJson: async () => [] }))
  await assert.rejects(run({ fetchPage: async url => {
    const response = await fixturePage(url)
    return url === official.url ? response : { ...response, html: response.html.replaceAll('postings/woven-by-toyota', 'postings/other') }
  }, fetchJson: async () => [] }))
})

test('Woven by Toyota honors cancellation and bounds a stalled transport', async () => {
  const controller = new AbortController()
  controller.abort(Error('stop Woven'))
  await assert.rejects(run({ signal: controller.signal, fetchJson: async () => assert.fail('must not fetch') }), /stop Woven/)
  await assert.rejects(run({ timeoutMs: 20, fetchJson: () => new Promise(() => {}) }), /timed out/i)
  await assert.rejects(run({ timeoutMs: 20, fetchPage: () => new Promise(() => {}), fetchJson: async () => [] }), /timed out/i)
})

test('importing Woven by Toyota with another scripts dry-run flag causes no execution', () => {
  const artifact = 'scraper/wovenbytoyota/jobs.json'
  const before = statSync(artifact).mtimeMs
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', "process.argv.push('--dry-run'); await import('./scraper/wovenbytoyota/script.js'); console.log('import-only')"], { cwd: process.cwd(), encoding: 'utf8', timeout: 5000 })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), 'import-only')
  assert.equal(statSync(artifact).mtimeMs, before)
})

const id = '84925f74-a6aa-4b90-a92b-7006f1f88779'
const row = extra => ({ id, text: 'Software Engineer', categories: { location: 'Bengaluru, India', allLocations: ['Bengaluru, India'], commitment: 'Full-time' },
  country: 'IN', descriptionPlain: 'Build safe mobility software.', lists: [{ text: 'Requirements', content: '<p>Develop reliable systems.</p>' }],
  hostedUrl: `https://jobs.lever.co/woven-by-toyota/${id}`, applyUrl: `https://jobs.lever.co/woven-by-toyota/${id}/apply`,
  createdAt: 1788231211096, ...extra })

test('Woven by Toyota enumerates the captured unfiltered two-page native inventory', async () => {
  const pages = JSON.parse(readFileSync(new URL('../../scraper/wovenbytoyota/fixtures/listing-responses.json', import.meta.url)))
  let calls = 0
  const jobs = await run({ fetchJson: async (url, options) => {
    assert.ok(options.signal)
    const capture = pages[calls++]
    assert.equal(url, capture.url)
    return JSON.parse(capture.body)
  } })
  assert.equal(calls, 2)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 148)
  assert.equal(readInventoryEvidence(jobs).pagesFetched, 4)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
})

test('Woven by Toyota maps source-backed India roles and secondary India locations', async () => {
  const job = row({ country: 'JP', categories: { location: 'Tokyo', allLocations: ['Tokyo', 'Bengaluru, India'] } })
  const jobs = await run({ fetchJson: async () => [job] })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Woven by Toyota')
  assert.equal(jobs[0].source, 'wovenbytoyota')
  assert.equal(jobs[0].jobId, id)
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(jobs[0].applyUrl, job.applyUrl)
  assert.match(jobs[0].jobDescription, /Build safe mobility/)
  assert.match(jobs[0].jobDescription, /Develop reliable systems/)
  assert.equal(jobs[0].postingDate, null)
  assert.equal(jobs[0].nativeCreatedAt, job.createdAt)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('Woven by Toyota preserves missing descriptions with incomplete health evidence', async () => {
  const jobs = await run({ fetchJson: async () => [row({ descriptionPlain: '', lists: [] })] })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Woven by Toyota records explicit native zero and never certifies unknown remote scope', async () => {
  const empty = await run({ fetchJson: async () => [] })
  assert.equal(readInventoryEvidence(empty).status, 'verified-empty')
  const unresolved = await run({ fetchJson: async () => [row({ country: null, categories: { location: 'Remote', allLocations: ['Remote'] } })] })
  assert.equal(unresolved.length, 0)
  assert.equal(readInventoryEvidence(unresolved).listingComplete, false)
  assert.equal(readInventoryEvidence(unresolved).indiaFacetCount, null)
  const secondary = await run({ fetchJson: async () => [row({ country: 'JP', categories: { location: 'Tokyo', allLocations: ['Tokyo', 'Unknown new office'] } })] })
  assert.equal(readInventoryEvidence(secondary).indiaFacetCount, null)
})

test('Woven by Toyota rejects failure envelopes and foreign or mismatched native identities', async () => {
  for (const payload of [{ error: 'blocked' }, { ok: false }, { failed: true }, { jobs: [] },
    [row({ applyUrl: `https://jobs.lever.co/other/${id}/apply` })],
    [row({ country: 'US' })],
    [row({ country: null, categories: { location: 'Bengaluru, Canada', allLocations: ['Bengaluru, Canada'] } })],
    [row(), row()],
  ]) await assert.rejects(run({ fetchJson: async () => payload }))
})

test('Woven by Toyota refuses a page cap that would certify a full page as terminal', async () => {
  const pages = JSON.parse(readFileSync(new URL('../../scraper/wovenbytoyota/fixtures/listing-responses.json', import.meta.url)))
  await assert.rejects(run({ maxPages: 1, fetchJson: async () => JSON.parse(pages[0].body) }), /incomplete|page limit/i)
})

test('Woven by Toyota section headings alone cannot manufacture missing employer content', async () => {
  const jobs = await run({ fetchJson: async () => [row({ descriptionPlain: '', lists: [{ text: 'Requirements', content: '<p>&nbsp;</p>' }] })] })
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Woven by Toyota captures prove the official board binding with intact response hashes', () => {
  const root = new URL('../../scraper/wovenbytoyota/fixtures/', import.meta.url)
  const metadata = JSON.parse(readFileSync(new URL('metadata.json', root)))
  for (const entry of metadata.responses) {
    const bytes = readFileSync(new URL(entry.file, root))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.captureSha256)
    const decoded = JSON.parse(bytes)
    const capture = entry.responseIndex == null ? decoded : decoded[entry.responseIndex]
    assert.equal(capture.status, 200)
    assert.equal(createHash('sha256').update(capture.body).digest('hex'), entry.bodySha256)
  }
  const client = JSON.parse(readFileSync(new URL('client-api-responses.json', root)))[0]
  assert.equal(new URL(client.url).origin, 'https://woven.toyota')
  assert.ok(client.body.includes('https://api.lever.co/v0/postings/woven-by-toyota?'))
  assert.ok(client.body.includes('getLeverPostingsUrl'))
})
