import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { getScraperCatalog } from '../../scraper-support/providers/index.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'

const folder = new URL('./fixtures/current-20261113/', import.meta.url)
const receipts = JSON.parse(readFileSync(new URL('receipts.json', folder)))
const bodies = new Map(receipts.map(row => [row.requestedUrl,
  gunzipSync(readFileSync(new URL(row.file, folder))).toString('utf8')]))
const HOME = 'https://www.any.do/', BOARD = 'https://any-do.breezy.hr/'
const load = async () => (await import('./currentEmpty20261113.js')).runAnyDoCurrentEmpty
const transport = (transform = (value => value)) => {
  const reads = new Map()
  return async (url, init) => {
    assert.equal(init.method, 'GET')
    const row = receipts.find(value => value.requestedUrl === url)
    assert.ok(row, 'Every request must be declared by the current native publisher')
    const count = (reads.get(url) || 0) + 1
    reads.set(url, count)
    const body = transform(bodies.get(url), url, count)
    const response = new Response(body, { status: row.status, headers: row.headers })
    Object.defineProperty(response, 'url', { value: row.url })
    return response
  }
}

test('actual current corporate handoff and twice-reviewed native template prove configured-board empty only', async () => {
  const run = await load(), jobs = await run({ fetchImpl: transport() })
  assert.equal(jobs.length, 0)
  const assessment = assessSoftFailureAcquisition(getScraperCatalog().find(row => row.source === 'anydo'), jobs)
  assert.equal(assessment.runnerOutcome.success, true)
  assert.equal(assessment.zeroJobEvidence, 'verified-empty')
  assert.deepEqual(assessment.cleanupOptions, { replaceExisting: false })
  assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete, false)
  assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal, null)
  assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal, null)
  assert.equal(jobs.nativeCollectionEvidence.closingStable, true)
  assert.equal(jobs.nativeCollectionEvidence.retainedResponses.length, 48)
})

for (const [name, mutation] of [
  ['visible vacancy appears', html => html.replace('<div class="no-positions-container">', '<a href="/p/new-role">New role</a><div class="no-positions-container">')],
  ['hidden vacancy appears', html => html.replace('<div class="no-positions-container">', '<a hidden href="/p/new-role">New role</a><div class="no-positions-container">')],
  ['empty marker is hidden', html => html.replace('<h2 class="polygot">%LABEL_NO_POSITIONS%', '<h2 hidden class="polygot">%LABEL_NO_POSITIONS%')],
  ['empty marker is offscreen', html => html.replace('<h2 class="polygot">%LABEL_NO_POSITIONS%', '<h2 style="position:fixed;left:-10000px" class="polygot">%LABEL_NO_POSITIONS%')],
  ['filtered query scope appears', html => html.replace('<div class="positions-container">', '<select class="countries"><option selected>India</option></select><div class="positions-container">')],
  ['unreviewed continuation appears', html => html.replace('<div class="positions-container">', '<a href="/?page=2">Next</a><div class="positions-container">')],
  ['native renderer is inactive', html => html.replace('src="https://assets-cdn.breezy.hr/breezy-portal/javascripts/v3/index.js', 'type="application/json" src="https://assets-cdn.breezy.hr/breezy-portal/javascripts/v3/index.js')],
  ['native translation declares another language', html => html.replace('id="translateScript"', 'id="translateScript" data-lang="unknown"')],
  ['empty statement changes', html => html.replace('%LABEL_NO_POSITIONS%', 'Please check later')],
]) test('rejects current native drift: ' + name, async () => {
  const run = await load()
  await assert.rejects(run({ fetchImpl: transport((body, url) => url === BOARD ? mutation(body) : body) }), /native|reviewed|inventory|template/i)
})

test('rejects changed native asset bytes', async () => {
  const run = await load()
  await assert.rejects(run({ fetchImpl: transport((body, url) => url.includes('/v3/index.js') ? body + '\nthrow Error("changed")' : body) }), /asset|reviewed/i)
})

test('rejects changed closing corporate handoff', async () => {
  const run = await load()
  await assert.rejects(run({ fetchImpl: transport((body, url, count) => url === HOME && count === 2
    ? body.replaceAll(BOARD, 'https://different.breezy.hr/') : body) }), /handoff|employer/i)
})

test('rejects changed closing native board', async () => {
  const run = await load()
  await assert.rejects(run({ fetchImpl: transport((body, url, count) => url === BOARD && count === 2
    ? body.replace('%LABEL_NO_POSITIONS%', 'New openings') : body) }), /native|inventory|template/i)
})

test('preserves caller cancellation even with an uncooperative transport', async () => {
  const run = await load(), controller = new AbortController(), reason = new Error('caller cancelled')
  const operation = run({ signal: controller.signal, fetchImpl: () => new Promise(() => {}) })
  controller.abort(reason)
  await assert.rejects(operation, error => error === reason)
})

test('caps cannot qualify an authoritative empty board', async () => {
  const run = await load()
  await assert.rejects(run({ maxJobs: 1, fetchImpl: transport() }), /cap|limit/i)
})

test('native response size is bounded while streaming and releases an oversized reader', async () => {
  const run = await load()
  let cancelled = false
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(2000001)) },
    cancel() { cancelled = true },
  })
  const response = new Response(stream, { status: 200, headers: { 'content-type': 'text/html' } })
  Object.defineProperty(response, 'url', { value: HOME })
  response.arrayBuffer = () => { throw new Error('An unbounded arrayBuffer read is not allowed') }
  await assert.rejects(run({ fetchImpl: async () => response }), /byte budget/i)
  assert.equal(cancelled, true)
})

test('an offscreen corporate handoff cannot qualify an authoritative board zero', async () => {
  const run = await load()
  await assert.rejects(run({ fetchImpl: transport((body, url) => url === HOME
    ? body.replace('href="https://any-do.breezy.hr/"', 'style="position:fixed;left:-9999px" href="https://any-do.breezy.hr/"') : body) }), /handoff|corporate|style/i)
})

test('stylesheet-hidden corporate handoff ancestry cannot qualify a board zero', async () => {
  const run = await load()
  await assert.rejects(run({ fetchImpl: transport((body, url) => url === HOME
    ? body.replace('</head>', '<style>.hidden-hiring{position:fixed;left:-9999px}</style></head>')
      .replace('href="https://any-do.breezy.hr/"', 'class="hidden-hiring" href="https://any-do.breezy.hr/"') : body) }), /handoff|corporate|style/i)
})

test('caller abort remains bounded when an audit observer never settles', async () => {
  const run = await load(), controller = new AbortController(), reason = new Error('cancelled during audit')
  const operation = run({ signal: controller.signal, fetchImpl: transport(),
    onAudit: () => { controller.abort(reason); return new Promise(() => {}) } })
  const result = await Promise.race([operation.then(() => 'unexpected success', error => error),
    new Promise(resolve => setTimeout(() => resolve('audit observer escaped cancellation'), 2000))])
  assert.equal(result, reason)
})
