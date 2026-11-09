import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { statSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import * as rivian from '../../scraper/rivian/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

test('Rivian honors cancellation and bounds an uncooperative transport', async () => {
  const controller = new AbortController()
  controller.abort(Error('stop Rivian'))
  await assert.rejects(run({ signal: controller.signal, fetchJson: async () => assert.fail('must not fetch') }), /stop Rivian/)
  await assert.rejects(run({ timeoutMs: 20, fetchJson: () => new Promise(() => {}) }), /timed out/i)
})

test('Rivian import with a parent dry-run flag has no output side effects', () => {
  const artifact = 'scraper/rivian/jobs.json'
  const before = statSync(artifact).mtimeMs
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', "process.argv.push('--dry-run'); await import('./scraper/rivian/script.js'); console.log('import-only')"], { cwd: process.cwd(), encoding: 'utf8', timeout: 5000 })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), 'import-only')
  assert.equal(statSync(artifact).mtimeMs, before)
})

const fixture = name => JSON.parse(gunzipSync(readFileSync(new URL(`../../scraper/rivian/fixtures/${name}.json.gz`, import.meta.url))))
const fetchPage = async url => {
  const capture = fixture(url === rivian.OFFICIAL_CAREERS_URL ? 'work-response' : 'search-response')
  assert.equal(url, capture.url)
  return { status: capture.status, url: capture.finalUrl, html: capture.body }
}
const run = options => rivian.run({ fetchPage, ...options })

const pages = fixture('listing-responses')
const nativeRow = () => structuredClone(JSON.parse(pages[0].body).jobs[0])
const response = jobs => ({ jobs, totalCount: jobs.length, count: jobs.length })
const indiaRow = () => {
  const row = nativeRow(), data = row.data
  data.country = 'India'; data.country_code = 'IN'; data.city = 'Bengaluru'; data.state = 'Karnataka'
  data.full_location = 'Bengaluru, Karnataka, India'; data.short_location = data.full_location; data.location_name = 'Bengaluru (Karnataka)'
  data.meta_data.googlejobs.derivedInfo.locations = [{ postalAddress: { regionCode: 'IN', locality: 'Bengaluru', administrativeArea: 'Karnataka' } }]
  return row
}

test('Rivian reconciles all captured native pages and explicit country scope before India zero', async () => {
  let requests = 0
  const jobs = await run({ fetchJson: async (url, options) => {
    const capture = pages[requests++]
    assert.equal(url, capture.url)
    assert.ok(options.signal)
    return JSON.parse(capture.body)
  } })
  assert.equal(requests, 10)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 947)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('Rivian maps explicit India source content and native original publication', async () => {
  const row = indiaRow()
  const jobs = await run({ fetchJson: async () => response([row]) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, row.data.req_id)
  assert.equal(jobs[0].company, 'Rivian')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].applyUrl, row.data.apply_url)
  assert.equal(jobs[0].jobDescription, row.data.description)
  assert.equal(jobs[0].department, row.data.categories.map(item => item.name).join(' / '))
  assert.equal(jobs[0].postingDate, row.data.posted_date)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('Rivian includes India secondary locations on a foreign primary role', async () => {
  const row = nativeRow()
  row.data.multipleLocations = true
  row.data.meta_data.googlejobs.derivedInfo.locations.push({ postalAddress: { regionCode: 'IN', locality: 'Bengaluru', administrativeArea: 'Karnataka' } })
  const jobs = await run({ fetchJson: async () => response([row]) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
})

test('Rivian preserves missing employer descriptions as incomplete India roles', async () => {
  const row = indiaRow()
  row.data.description = null
  const jobs = await run({ fetchJson: async () => response([row]) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Rivian requires current counted empty inventory and rejects failures/truncation', async () => {
  const empty = await run({ fetchJson: async () => response([]) })
  assert.equal(readInventoryEvidence(empty).status, 'verified-empty')
  for (const payload of [{ ...response([]), ok: false }, { ...response([]), failed: true },
    { ...response([]), error: 'blocked' }, { jobs: [] }, { ...response([]), totalCount: 1, count: 1 },
  ]) await assert.rejects(run({ fetchJson: async () => payload }))
  await assert.rejects(run({ maxPages: 1, fetchJson: async () => JSON.parse(pages[0].body) }), /page limit|incomplete/i)
})

test('Rivian rejects foreign employers, mismatched role URLs, unknown or contradictory geography', async () => {
  for (const change of [
    r => { r.data.hiring_organization = 'Other' },
    r => { r.data.apply_url = 'https://unrelated.icims.com/jobs/34081/login' },
    r => { r.data.meta_data.googlejobs.derivedInfo.locations[0].postalAddress.regionCode = 'ZZ' },
    r => { r.data.country_code = 'IN' },
    r => { r.data.meta_data.googlejobs.derivedInfo.locations = [] },
    r => { r.data.posted_date = '2026-02-31T12:00:00+0000' },
  ]) { const row = nativeRow(); change(row); await assert.rejects(run({ fetchJson: async () => response([row]) })) }
})

test('Rivian bounds default transport body reads and propagates in-flight cancellation', async () => {
  await assert.rejects(run({ timeoutMs: 20, fetchImpl: async url => ({ status: 200, url, json: () => new Promise(() => {}) }) }), /timed out/i)
  const controller = new AbortController()
  await assert.rejects(run({ signal: controller.signal, fetchJson: () => {
    queueMicrotask(() => controller.abort(Error('cancel active Rivian')))
    return new Promise(() => {})
  } }), /cancel active Rivian/)
})

test('Rivian rejects default transport status failures and redirects', async () => {
  for (const change of [{ status: 403 }, { url: 'https://example.test/jobs' }]) {
    await assert.rejects(run({ fetchImpl: async url => ({ status: 200, url, json: async () => response([]), ...change }) }), /HTTP failure|redirect/i)
  }
})

test('Rivian must verify its live first-party handoff and company filter even for native zero', async () => {
  for (const change of [
    page => ({ ...page, status: 403 }),
    page => ({ ...page, url: 'https://example.test/work' }),
    page => ({ ...page, html: page.html.replaceAll('https://careers.rivian.com/careers-home/jobs', 'https://example.test/jobs') }),
    page => ({ ...page, html: page.html.replaceAll('"searchOverride":{"tags2":"Rivian Automotive"}', '"searchOverride":{"tags2":"Other company"}') }),
    page => ({ ...page, html: page.html.replaceAll('"searchOverride":{"tags2":"Rivian Automotive"}', '"searchOverride":{"tags2":"Rivian Automotive","location":"United States"}') }),
  ]) await assert.rejects(run({ fetchPage: async url => change(await fetchPage(url)), fetchJson: async () => response([]) }), /handoff|scope|identity|HTTP/i)
})

test('Rivian compressed captures preserve exact official responses and body hashes', () => {
  const root = new URL('../../scraper/rivian/fixtures/', import.meta.url)
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)))
  const hash = value => createHash('sha256').update(value).digest('hex')
  for (const entry of manifest.files) {
    const gzip = readFileSync(new URL(entry.file, root))
    assert.equal(hash(gzip), entry.compressedSha256)
    const bytes = gunzipSync(gzip)
    assert.equal(hash(bytes), entry.captureSha256)
    const decoded = JSON.parse(bytes)
    for (const response of entry.responses) {
      const capture = response.responseIndex == null ? decoded : decoded[response.responseIndex]
      assert.equal(capture.status, 200)
      assert.equal(hash(capture.body), response.bodySha256)
    }
  }
})

test('Rivian rejects published primary geography contradicting native country and postal metadata', async () => {
  for (const field of ['full_location', 'short_location', 'location_name']) {
    for (const value of ['Austin, Texas, United States', 'Fremont, California', 'Bengaluru, India, United States', 'Bengaluru, United States, India']) {
      const row = indiaRow(); row.data[field] = value
      await assert.rejects(run({ fetchJson: async () => response([row]) }), /contradict|geography/i)
    }
    const foreign = nativeRow(); foreign.data[field] = 'Bengaluru, Karnataka, India'
    await assert.rejects(run({ fetchJson: async () => response([foreign]) }), /contradict|geography/i)
  }
})

test('Rivian preserves missing active JD as partial without accepting hidden or inert content', async () => {
  for (const description of ['<div hidden>Build autonomous vehicle systems.</div>', '<div inert>Build autonomous vehicles.</div>', '<template>Build autonomous vehicles.</template>',
    '<div style="content-visibility:hidden">Build safe vehicles.</div>', '<noscript>Build vehicles.</noscript>', 'Job description attached']) {
    const row = indiaRow(); row.data.description = description
    const jobs = await run({ fetchJson: async () => response([row]) })
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].jobDescription, null)
    assert.equal(jobs[0].sourceDescription, null)
    assert.equal(jobs[0].sourceListingComplete, false)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  }
  const active = indiaRow(); active.data.description = '<div hidden>Old text.</div><p>Build autonomous vehicle systems.</p>'
  const jobs = await run({ fetchJson: async () => response([active]) })
  assert.equal(jobs[0].jobDescription, active.data.description)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})
