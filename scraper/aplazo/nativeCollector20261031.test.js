import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'
import { run } from './script.js'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const { packets } = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-careers-20261031.json.gz', import.meta.url))))
for (const p of packets) assert.equal(createHash('sha256').update(p.body).digest('hex'), p.sha256)
const [careers, api] = packets, original = JSON.parse(api.body)
const collect = async ({ html = careers.body, payload = structuredClone(original), page = {}, signal } = {}) => {
  const calls = []
  const jobs = await run({ signal,
    fetchPage: async (url, options) => { calls.push(url); assert.equal(url, careers.url); if (signal) assert.equal(options.signal, signal); return { status: careers.status, url: careers.finalUrl, html, ...page } },
    fetchJson: async (url, options) => { calls.push(url); assert.equal(url, api.url); if (signal) assert.equal(options.signal, signal); return payload },
  })
  return { jobs, calls }
}
// This mutation is a controlled future-India contract case, not a real India role.
const controlledIndiaPayload = () => {
  const payload = structuredClone(original)
  payload.jobs[0].location = 'Bengaluru, India'
  payload.jobs[0].address = { postalAddress: { addressCountry: 'India', addressLocality: 'Bengaluru' } }
  return payload
}
test('effective and local catalog metadata select the real native script with unresolved company scope and null verified counts', async () => {
  const effective = getScraperCatalog().find(p => p.source === 'aplazo')
  const local = (await import('./catalog.js')).default
  for (const provider of [effective, local]) {
    assert.equal(provider.atsPlatform, 'ashby'); assert.equal(provider.companyName, 'Aplazo'); assert.equal(provider.companyDomain, 'aplazo.mx')
    assert.equal(provider.companyCareerPage, careers.url); assert.equal(provider.sourceScopeComplete, false)
    assert.equal(provider.paginationStrategy, 'validated-native-single-response-and-independent-closing')
    assert.equal(provider.verifiedPublicJobCount, null); assert.equal(provider.verifiedIndiaJobCount, null)
    assert.match(provider.modulePath.replaceAll('\\', '/'), /\/aplazo\/script\.js$/)
  }
})
test('registered default transport reads current native employer and all nine explicit Mexico roles without calling them company-empty', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(String(url)); const packet = packets.find(p => p.url === String(url)); assert.ok(packet, 'No unadvertised URL')
    assert.ok(options.signal instanceof AbortSignal)
      const response = new Response(packet.body, { status: packet.status, headers: { 'Content-Type': packet.url === api.url ? 'application/json' : 'text/html' } }); Object.defineProperty(response, 'url', { value: packet.finalUrl }); return response
  })
  // Repeated packets form an offline protocol closing; keep their old clock.
  const jobs = await createCatalogScraper(getScraperCatalog().find(p => p.source === 'aplazo')).run({ now: () => api.capturedAt })
  assert.deepEqual(calls, [careers.url, api.url, api.url, careers.url]); assert.equal(jobs.length, 0)
  const observations = readSourceObservationEvidence(jobs, 'aplazo')
  assert.equal(observations.observedVacancyCount, 9); assert.equal(observations.observedRecordCount, 9)
  assert.equal(observations.sourceScopeComplete, false); assert.equal(observations.companyGlobalTotal, null); assert.equal(observations.companyIndiaTotal, null)
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.listingComplete, true); assert.equal(inventory.reportedTotal, null); assert.equal(inventory.indiaFacetCount, 0)
  assert.equal(inventory.status, 'complete-inventory'); assert.equal(inventory.verifiedAt, api.capturedAt)
})
test('controlled explicit native India role keeps the original full native description, ID, dates and application URLs', async () => {
  const payload = controlledIndiaPayload(), { jobs, calls } = await collect({ payload })
  assert.equal(calls.length, 4); assert.equal(jobs.length, 1)
  const job = jobs[0], native = payload.jobs[0]
  assert.equal(job.jobId, native.id); assert.equal(job.title, native.title); assert.equal(job.country, 'India')
  assert.equal(job.sourceDescription, native.descriptionHtml); assert.equal(job.jobDescription, native.descriptionHtml)
  assert.equal(job.applyUrl, native.applyUrl); assert.equal(job.sourceUrl, native.jobUrl)
  assert.equal(job.postingDate, native.publishedAt); assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.sourceScopeComplete, true); assert.equal(job.sourceListingComplete, true); assert.equal(job.lifecycleCleanupAllowed, true)
})
for (const [label, alter] of [
  ['hidden employer body', html => html.replace(/<body\b/i, '<body hidden')],
  ['hidden native board link', html => html.replaceAll('href="https://jobs.ashbyhq.com/aplazo"', 'hidden href="https://jobs.ashbyhq.com/aplazo"')],
  ['changed board case', html => html.replaceAll('https://jobs.ashbyhq.com/aplazo', 'https://jobs.ashbyhq.com/Aplazo')],
  ['foreign native board', html => html.replaceAll('https://jobs.ashbyhq.com/aplazo', 'https://jobs.ashbyhq.com/other-company')],
  ['foreign canonical employer', html => html.replace(/(<link[^>]+rel="canonical"[^>]+href=")https:\/\/www\.aplazocareers\.mx/gi, '$1https://foreign.invalid')],
]) test('native employer handoff rejects ' + label, async () => {
  const html = alter(careers.body); assert.notEqual(html, careers.body)
  await assert.rejects(collect({ html }))
})
for (const page of [{ status: 403 }, { url: 'https://foreign.invalid/' }]) test('native employer unavailable or foreign final response cannot become empty success ' + JSON.stringify(page), async () => {
  await assert.rejects(collect({ page }))
})
for (const [label, alter] of [
  ['foreign application tenant', p => { p.jobs[0].applyUrl = p.jobs[0].applyUrl.replace('/aplazo/', '/other-company/') }],
  ['wrong native role ID in source URL', p => { p.jobs[0].jobUrl = 'https://jobs.ashbyhq.com/aplazo/unrelated-role' }],
  ['repeated native ID', p => { p.jobs.push(structuredClone(p.jobs[0])) }],
  ['native error envelope', p => { p.success = false }],
]) test('captured posting payload rejects ' + label, async () => {
  const payload = structuredClone(original); alter(payload); await assert.rejects(collect({ payload }))
})
test('unqualified generic remote cannot be converted to India by a source country filter', async () => {
  const payload = structuredClone(original); payload.jobs[0].location = 'Remote'; payload.jobs[0].address = {}
  const { jobs, calls } = await collect({ payload }); assert.equal(calls.length, 4); assert.equal(jobs.length, 0)
  assert.equal(readSourceObservationEvidence(jobs, 'aplazo').observedVacancyCount, 9)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
test('unlisted native records remain separate from currently advertised vacancy observations', async () => {
  const payload = structuredClone(original); payload.jobs[0].isListed = false
  const { jobs } = await collect({ payload }), observations = readSourceObservationEvidence(jobs, 'aplazo')
  assert.ok(observations)
  assert.equal(observations.recordKind, 'mixed'); assert.equal(observations.observedRecordCount, 9)
  assert.equal(observations.observedVacancyCount, 8); assert.equal(observations.companyGlobalTotal, null)
})
test('actual full native plain text remains available when native HTML is only a placeholder', async () => {
  const payload = controlledIndiaPayload(), native = payload.jobs[0]
  assert.ok(native.descriptionPlain.length > 1000)
  native.descriptionHtml = '<p>TBD</p>'
  const { jobs } = await collect({ payload })
  assert.equal(jobs.length, 1); assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceDescription, native.descriptionPlain); assert.equal(jobs[0].jobDescription, native.descriptionPlain)
  assert.equal(jobs[0].nativeDescriptionHTML, '<p>TBD</p>')
})
for (const plainIsFull of [true, false]) test('wildcard-hidden native HTML retains the role and ' + (plainIsFull ? 'its full native plain description' : 'its incomplete raw description'), async () => {
  const payload = controlledIndiaPayload(), native = payload.jobs[0]
  native.descriptionHtml = '<style>*{display:none!important}</style>' + native.descriptionHtml
  if (!plainIsFull) native.descriptionPlain = 'TBD'
  const { jobs } = await collect({ payload })
  assert.equal(jobs.length, 1); assert.equal(jobs[0].jobId, native.id)
  assert.equal(jobs[0].sourceDetailComplete, plainIsFull)
  assert.equal(jobs[0].sourceDescription, plainIsFull ? native.descriptionPlain : native.descriptionHtml)
  assert.equal(readSourceObservationEvidence(jobs, 'aplazo').observedVacancyCount, 9)
})
test('HTML and encoded markup placeholders in the native plain field cannot qualify a full description', async () => {
  for (const plain of ['<p>TBD</p>', '&lt;p&gt;TBD&lt;/p&gt;']) {
    const payload = controlledIndiaPayload(); payload.jobs[0].descriptionHtml = '<p>TBD</p>'; payload.jobs[0].descriptionPlain = plain
    const { jobs } = await collect({ payload })
    assert.equal(jobs.length, 1); assert.equal(jobs[0].sourceDetailComplete, false)
    assert.equal(jobs[0].sourceDetailFailureKind, 'missing-content')
  }
})
test('hidden-only and placeholder native descriptions retain exact raw bytes while remaining incomplete', async () => {
  for (const html of ['<div hidden>' + original.jobs[0].descriptionHtml + '</div>', '<p>TBD</p>']) {
    const payload = controlledIndiaPayload(); payload.jobs[0].descriptionHtml = html; payload.jobs[0].descriptionPlain = 'TBD'
    const { jobs } = await collect({ payload }); assert.equal(jobs.length, 1)
    assert.equal(jobs[0].sourceDescription, html); assert.equal(jobs[0].sourceDetailComplete, false)
    assert.equal(jobs[0].sourceDetailFailureKind, 'missing-content')
  }
})
test('caller cancellation before and during default HTTP preserves the exact frozen reason without subsequent reads', async t => {
  const controller = new AbortController(), reason = Object.freeze({ kind: 'controlled Aplazo caller cancellation' }), calls = []
  t.mock.method(globalThis, 'fetch', async url => { calls.push(String(url)); controller.abort(reason); throw new Error('replacement native abort') })
  await assert.rejects(run({ signal: controller.signal }), error => error === reason); assert.equal(calls.length, 1)
  await assert.rejects(run({ signal: controller.signal }), error => error === reason); assert.equal(calls.length, 1)
})
