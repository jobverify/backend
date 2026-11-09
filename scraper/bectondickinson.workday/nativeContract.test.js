import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import assert from 'node:assert/strict'
import test from 'node:test'
import { run } from './script.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
const ORIGIN = 'https://jobs.bd.com', HOME = ORIGIN + '/en', GLOBAL = HOME + '/search-jobs'
const BOARD = HOME + '/location/india-jobs/159/1269750/2'
const CORPORATE = 'https://news.bd.com/social-media-community-guidelines'
const now = () => '2026-10-23T09:00:00.000Z'
const load = () => JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261023.json.gz', import.meta.url))))
function mock({ synthetic = 0, edge = false, mutate = packet => packet } = {}) {
  const fixture = load(), calls = [], original = fixture.requests.find(p => p.url === BOARD)
  const html = Buffer.from(original.rawBodyBase64, 'base64').toString('utf8'), dom = document(html)
  const section = dom.nodes(n => n.tag === 'div' && n.attrs.id === 'search-results-list')[0]
  const list = dom.nodes(n => n.tag === 'ul' && n.attrs.class?.includes('search-results-list__list'), section)[0]
  let rows = list.children.filter(n => typeof n !== 'string' && n.tag === 'li')
    .filter(n => ['91624291024', '102277849312', '101895999152'].some(id => dom.inner(n).includes('data-job-id="' + id + '"')))
    .map(n => dom.outer(n))
  if (edge) {
    const pack = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-edgecases-20261023.json.gz', import.meta.url))))
    fixture.requests.push(...pack.requests)
    rows = pack.requests.filter(p => p.url.startsWith(BOARD)).flatMap(p => {
      const d = document(Buffer.from(p.rawBodyBase64, 'base64').toString('utf8'))
      const list = d.nodes(n => n.tag === 'ul' && n.attrs.id === 'search-results-jobs')[0]
      return list.children.filter(n => typeof n !== 'string' && n.tag === 'li'
        && pack.failedIDs.some(id => d.inner(n).includes('data-job-id="' + id + '"'))).map(n => d.outer(n))
    })
  }
  if (synthetic) {
    const base = rows.find(html => html.includes('101895999152'))
    rows = Array.from({ length: synthetic }, (_, i) => base.split('101895999152').join(String(90000000000 + i)))
  }
  const renderListing = page => {
    let listing = html.slice(0, list.openEnd) + rows.slice((page - 1) * 15, page * 15).join('\n') + html.slice(list.closeStart)
    listing = listing.replace('data-total-results="54"', 'data-total-results="' + rows.length + '"')
      .replace('data-total-job-results="54"', 'data-total-job-results="' + rows.length + '"')
      .replace('data-total-pages="4"', 'data-total-pages="' + Math.max(1, Math.ceil(rows.length / 15)) + '"')
      .replace('data-current-page="1"', 'data-current-page="' + page + '"')
    listing = listing.replace(/<a\b[^>]*class="next"[^>]*>[\s\S]*?<\/a>/g,
      page * 15 < rows.length ? '<a class="next" href="' + new URL(BOARD).pathname + '/' + (page + 1) + '">Next Page</a>' : '')
    return listing
  }
  return { calls, async transport(url, request) {
    calls.push({ url, method: request.method })
    assert.equal(request.method, 'GET')
    const listing = url === BOARD || url.startsWith(BOARD + '/')
    const packet = fixture.requests.find(p => p.url === (listing ? BOARD : url))
      || synthetic && url.includes('/en/job/') && fixture.requests.find(p => p.name === 'BD-native-role-101895999152')
    assert.ok(packet, url)
    let body = listing ? renderListing(url === BOARD ? 1 : Number(url.split('/').at(-1)))
      : Buffer.from(packet.rawBodyBase64, 'base64').toString('utf8')
    if (synthetic && !listing && url.includes('/en/job/')) {
      const id = url.split('/').at(-1), index = Number(id) - 90000000000
      body = body.split('101895999152').join(id).split('R-556802').join('R-' + (900000 + index))
    }
    return mutate({ url, status: 200, headers: { 'content-type': 'text/html' },
      body: Buffer.from(body), bodyComplete: true }, calls)
  } }
}
test('BD sentinel becomes full first-party India role extraction with original dates and evidence', async () => {
  const jobs = await run({ transport: mock().transport, now })
  assert.equal(jobs.length, 3)
  const job = jobs.find(j => j.jobId === '101895999152')
  assert.equal(job.company, 'Becton Dickinson'); assert.equal(job.requisitionId, 'R-556802')
  assert.equal(job.postingDate, '2026-10-13'); assert.equal(job.country, 'India'); assert.equal(job.city, 'Bengaluru')
  assert.ok(job.sourceDescription.includes('Primary Work Location'))
  assert.ok(job.sourceDescription.length > 4000)
  assert.equal(job.nativeCollectionEvidence.failures.length, 0)
  assert.equal(job.applicationVisited, false); assert.equal(job.lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 3)
  assert.equal(analyzePublishableJobs(jobs, { now: new Date(now()) }).eligibleJobs.length, 3)
})

test('native location conflicts retain exact evidence and publish India without invented city or region', async () => {
  const jobs = await run({ transport: mock().transport, now })
  const guwahati = jobs.find(j => j.jobId === '91624291024'), surat = jobs.find(j => j.jobId === '102277849312')
  assert.equal(guwahati.nativeCountryAddresses[0].raw.addressLocality, 'Guwahati')
  assert.equal(guwahati.nativePrimaryWorkLocation, 'IND Kolkata - Awfis Space Solutions')
  assert.equal(surat.nativeCountryAddresses[0].raw.addressRegion, 'Andhra Pradesh')
  for (const job of [guwahati, surat]) {
    assert.equal(job.city, null); assert.equal(job.state, null); assert.equal(job.location, 'India')
    assert.equal(job.nativeLocationDiscrepancy, true)
    assert.ok(job.nativeGeographicProjection.includes('country-only'))
  }
})

test('31 synthetic roles traverse all three native 15-row pages and a closing check', async () => {
  const m = mock({ synthetic: 31 }), jobs = await run({ transport: m.transport, now })
  assert.equal(jobs.length, 31); assert.equal(new Set(jobs.map(j => j.jobId)).size, 31)
  assert.equal(jobs[0].nativeCollectionEvidence.pagesFetched, 3)
  assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches, true)
  assert.deepEqual(m.calls.filter(c => c.url.startsWith(BOARD)).map(c => c.url), [BOARD, BOARD + '/2', BOARD + '/3', BOARD])
})

test('partial upstream pagination retains verified first-page jobs and unresolved inventory evidence', async () => {
  const m = mock({ synthetic: 31, mutate: p => p.url === BOARD + '/2' ? { ...p, status: 503 } : p })
  const jobs = await run({ transport: m.transport, now })
  assert.equal(jobs.length, 15)
  assert.equal(jobs[0].nativeCollectionEvidence.listingPaginationComplete, false)
  assert.equal(jobs[0].nativeCollectionEvidence.failures.length, 1)
  assert.equal(jobs[0].nativeCollectionEvidence.unknownRawFailures.length, 1)
  assert.ok(jobs.every(j => !j.lifecycleCleanupAllowed))
})

test('missing descriptions, conflicting identity/country, future dates and HTTP errors preserve other roles', async () => {
  for (const kind of ['content', 'id', 'employer', 'country', 'url', 'future', 'application', 'HTTP']) {
    const m = mock({ mutate: p => !p.url.includes('/101895999152') ? p : kind === 'HTTP' ? { ...p, status: 503 }
      : { ...p, body: Buffer.from(p.body.toString('utf8')
        .split(kind === 'id' ? '"value":"R-556802"' : kind === 'employer' ? '"name":"Becton Dickinson & Company"'
          : kind === 'country' ? '"addressCountry":"India"' : kind === 'url' ? '"url":"' + p.url + '"'
          : kind === 'future' ? '"datePosted":"2026-10-13"' : kind === 'application' ? 'https://bdx.wd1.myworkdayjobs.com/'
          : 'class="ats-description"')
        .join(kind === 'id' ? '"value":"R-999999"' : kind === 'employer' ? '"name":"Other Employer"'
          : kind === 'country' ? '"addressCountry":"United States"' : kind === 'url' ? '"url":"https://other.example/role"'
          : kind === 'future' ? '"datePosted":"2099-01-01"' : kind === 'application' ? 'https://other.example/'
          : 'class="missing-description"')) } })
    const jobs = await run({ transport: m.transport, now })
    assert.equal(jobs.length, 2, kind)
    assert.equal(jobs[0].nativeCollectionEvidence.failures.length, kind === 'employer' ? 0 : 1, kind)
    assert.equal(jobs[0].nativeCollectionEvidence.unknownRawFailures.length, kind === 'employer' ? 0 : 1, kind)
    if (kind === 'employer') assert.equal(jobs[0].nativeCollectionEvidence.exclusions.length, 1)
  }
})

test('upstream/identity handoff failures never establish a verified zero', async () => {
  for (const target of [CORPORATE, HOME, GLOBAL, BOARD]) {
    const m = mock({ mutate: p => p.url === target ? { ...p, status: 503 } : p })
    await assert.rejects(run({ transport: m.transport, now }), error => {
      assert.equal(error.nativeEvidence.verifiedZeroInventory, false)
      assert.equal(error.nativeEvidence.cleanupAllowed, false)
      return true
    })
  }
})

test('scoped zero retains explicit count without cleanup permission', async () => {
  const m = mock({ mutate: p => p.url !== BOARD ? p : { ...p, body: Buffer.from(p.body.toString('utf8')
    .replace('data-total-results="3"', 'data-total-results="0"').replace('data-total-job-results="3"', 'data-total-job-results="0"')
    .replace(/(<ul\b[^>]*id="search-results-jobs"[^>]*>)[\s\S]*?(<\/ul>)/, '$1$2')) } })
  const jobs = await run({ transport: m.transport, now })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(jobs[Symbol.for('jobverify.native-html-evidence')].verifiedZeroInventory, false)
})

test('public reader rejects applications, account actions and unlisted details', async () => {
  const { createSourceConfig } = await import('./parser.js'), config = createSourceConfig({ now })
  for (const url of [ORIGIN + '/en/apply', HOME + '/login', GLOBAL + '?token=secret',
    'https://bdx.wd1.myworkdayjobs.com/EXTERNAL_CAREER_SITE_INDIA',
    'https://jobs.bd.com/en/job/guwahati/area-sales-manager/159/91624291024', BOARD + '/1',
  ]) assert.throws(() => config.validateURL(url))
})

test('default native transport uses anonymous GETs and never fetches application links', async () => {
  const m = mock(), jobs = await run({ now, fetchImpl: async (url, request) => {
    assert.equal(request.method, 'GET'); assert.equal(request.credentials, 'omit'); assert.equal(request.redirect, 'manual')
    assert.ok(!url.includes('myworkdayjobs.com'))
    const p = await m.transport(url, request)
    return { url, status: p.status, headers: new Headers(p.headers),
      body: new ReadableStream({ start(c) { c.enqueue(p.body); c.close() } }) }
  } })
  assert.equal(jobs.length, 3)
})

test('both native page layouts and explicit mixed-country locations preserve all eight real India candidates', async () => {
  const jobs = await run({ transport: mock({ edge: true }).transport, now })
  assert.equal(jobs.length, 8)
  assert.equal(jobs[0].nativeCollectionEvidence.failures.length, 0)
  const mixed = jobs.find(j => j.jobId === '90537282656')
  assert.deepEqual(mixed.nativeCountryAddresses.map(a => a.country), ['India', 'Poland'])
  assert.equal(mixed.country, 'India'); assert.equal(mixed.location, 'India'); assert.equal(mixed.city, null)
  const standard = jobs.find(j => j.jobId === '101853626448')
  assert.deepEqual(standard.nativeCountryAddresses.map(a => a.country), ['India', 'Singapore'])
  assert.ok(standard.sourceDescription.includes('Main responsibilities will include:'))
  assert.ok(jobs.every(j => !j.lifecycleCleanupAllowed && !j.applicationVisited))
})
