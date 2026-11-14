import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { inspectCareers, readRole } from './native20261111.js'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/reveal-order-20261114.json.gz', import.meta.url))))
const CAREERS = 'https://rupeek.com/about/careers'
const opening = fixture.responses[0].body
const closing = fixture.responses[16].body
const provider = getScraperCatalog().find(row => row.source === 'rupeek')
const sha = value => createHash('sha256').update(value).digest('hex')
const flatten = node => [node, ...node.children.filter(child => typeof child !== 'string').flatMap(flatten)]
const programs = html => flatten(readNativeDocument(html).nodes(node => node.tag === 'root')[0]).filter(node => node.tag === 'script' && !node.attrs.src && !/^self\.__next_f\.push\(/.test(node.raw || '')).map(node => node.raw)
const swap = (html, a, b) => html.replace(a, 'REVIEW_PROGRAM_A_SENTINEL').replace(b, a).replace('REVIEW_PROGRAM_A_SENTINEL', b)
const response = (packet, body = packet.body) => {
  const value = new Response(body, { status: packet.status, headers: packet.headers })
  Object.defineProperty(value, 'url', { value: packet.finalUrl || packet.url })
  return value
}
function replay(edit = (_url, body) => body, { capturedOpening = false } = {}) {
  const requests = [], counts = new Map()
  const fetchImpl = async (input, init = {}) => {
    const url = String(input), count = (counts.get(url) || 0) + 1
    counts.set(url, count); init.signal?.throwIfAborted(); requests.push(url)
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit')
    // The default controlled replay uses the current closing corporate packet
    // in both phases. The original actual pair has a changed relative date and
    // must continue to fail the full original-record closing comparison.
    const packet = url === CAREERS ? fixture.responses[capturedOpening && count === 1 ? 0 : 16] : fixture.responses.find(row => row.url === url)
    assert.ok(packet, 'Undeclared public read ' + url)
    // Detail packets were captured once. Reusing them is an explicit controlled
    // closing check; final live source evidence must acquire its own closing.
    return response(packet, edit(url, packet.body, count))
  }
  return { fetchImpl, requests }
}

test.beforeEach(t => t.mock.method(globalThis, 'fetch', async () => { throw Error('Unexpected real network in Rupeek regression') }))

test('actual Rupeek closing keeps the exact reviewed independent program placement and raw date change', () => {
  for (const row of fixture.responses) { assert.equal(sha(row.body), row.sha256); assert.equal(Buffer.byteLength(row.body), row.bytes) }
  const before = programs(opening), after = programs(closing)
  assert.equal(before.length, 5)
  assert.deepEqual(after.map(sha), [before[0], before[1], before[2], before[4], before[3]].map(sha))
  assert.equal(before[3], '(self.__next_f=self.__next_f||[]).push([0])')
  assert.equal(before[4], '$RC("B:1","S:1")')
  const beforeRows = inspectCareers(opening), afterRows = inspectCareers(closing)
  assert.equal(afterRows.length, 15)
  assert.deepEqual(beforeRows.map(row => row.jobId), afterRows.map(row => row.jobId))
  assert.equal(beforeRows[3].jobId, '4489205334')
  assert.equal(beforeRows[3].postingDate, '1 day ago'); assert.equal(afterRows[3].postingDate, '2 days ago')
  assert.notDeepEqual(beforeRows, afterRows)
})

test('registered Rupeek collector accepts the actual closing order while retaining complete and held role boundaries', async () => {
  const transport = replay(), jobs = await createCatalogScraper(provider).run({ fetchImpl: transport.fetchImpl, now: () => fixture.capturedAt })
  assert.equal(jobs.length, 15)
  assert.equal(jobs.filter(job => job.sourceDetailComplete).length, 5)
  assert.ok(jobs.filter(job => !job.sourceDetailComplete).every(job => job.jobDescription === null && job.skipPublicExperienceEnrichment === true))
  assert.equal(transport.requests.length, 32)
  assert.equal(transport.requests.filter(url => url === CAREERS).length, 2)
  const audit = jobs[0].sourceNativeReadEvidence
  assert.equal(audit.observedCorporateRoleCards, 15); assert.equal(audit.ownCriteriaQualified, 5)
  assert.equal(audit.closingCorporateMatches, true); assert.equal(audit.closingOwnRolesMatch, true)
  assert.equal(audit.nativeVacancyTotal, null); assert.equal(audit.sourceScopeComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true); assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const [name, edit] of [
  ['unknown reveal body', html => html.replace('$RC("B:1","S:1")', '$RC("B:1","S:1");window.otherJobs=true')],
  ['different reveal identity', html => html.replace('$RC("B:1","S:1")', '$RC("B:1","another-source")')],
  ['duplicate reveal occurrence', html => html.replace('</body>', '<script>$RC("B:1","S:1")</script></body>')],
  ['missing Flight initialization', html => html.replace('<script>(self.__next_f=self.__next_f||[]).push([0])</script>', '')],
  ['reveal before its definition', html => { const rows = programs(html); return swap(html, rows[2], rows[3]) }],
  ['bootstrap in a different unreviewed order', html => { const rows = programs(html); return swap(html, rows[0], rows[1]) }],
  ['changed external client', html => html.replace('/_next/static/chunks/0kax51l-3kxb9.js', '/_next/static/chunks/unreviewed.js')],
]) test('actual current Rupeek closing rejects ' + name, () => {
  const changed = edit(closing); assert.notEqual(changed, closing)
  assert.throws(() => inspectCareers(changed), /program|script|reveal/)
})

test('actual changed closing role is not hidden by accepting the second executable order', async () => {
  const transport = replay((url, body, count) => url === CAREERS && count === 2 ? body.replaceAll('Back Office Executive', 'Different Office Executive') : body)
  await assert.rejects(createCatalogScraper(provider).run({ fetchImpl: transport.fetchImpl }), /closing corporate role cards changed/)
  assert.equal(transport.requests.length, 17)
})

test('the complete actual pair retains the observed relative-date closing failure', async () => {
  const transport = replay(undefined, { capturedOpening: true })
  await assert.rejects(createCatalogScraper(provider).run({ fetchImpl: transport.fetchImpl }), /closing corporate role cards changed/)
  assert.equal(transport.requests.length, 17)
})

test('actual native country conflict remains a held observation with no complete India promotion', async () => {
  const row = inspectCareers(opening)[0], packet = fixture.responses.find(value => value.url === row.sourceUrl)
  const changed = packet.body.replaceAll('Bengaluru, Karnataka, India', 'Toronto, Canada')
  assert.throws(() => readRole(changed, row), /location|country|workplace/)
  const transport = replay((url, body) => url === row.sourceUrl ? changed : body)
  const jobs = await createCatalogScraper(provider).run({ fetchImpl: transport.fetchImpl })
  const held = jobs.find(job => job.jobId === row.jobId)
  assert.equal(held.country, null); assert.equal(held.sourceCountryScopeUnresolved, true)
  assert.equal(held.sourceDetailComplete, false); assert.equal(held.jobDescription, null)
  assert.equal(jobs[0].sourceNativeReadEvidence.observedCorporateRoleCards, 15)
  assert.equal(jobs[0].sourceNativeReadEvidence.ownCriteriaQualified, 4)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('current Rupeek order qualification preserves opaque cancellation before work and at closing', async () => {
  const first = new AbortController(), reason = { caller: 'stop-before-public-read' }
  first.abort(reason); let calls = 0
  await assert.rejects(createCatalogScraper(provider).run({ signal: first.signal, fetchImpl: async () => { calls++; throw Error('Unexpected request') } }), error => error === reason)
  assert.equal(calls, 0)
  const controller = new AbortController(), closingReason = { caller: 'stop-before-closing' }, transport = replay((url, body, count) => { if (url === CAREERS && count === 2) controller.abort(closingReason); return body })
  await assert.rejects(createCatalogScraper(provider).run({ signal: controller.signal, fetchImpl: transport.fetchImpl }), error => error === closingReason)
  assert.equal(transport.requests.length, 17)
})
