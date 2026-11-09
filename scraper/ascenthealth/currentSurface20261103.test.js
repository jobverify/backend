import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createAscentHealthScraper, HOMEPAGE_URL, CAREERS_PAGE_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
const read = async name => gunzipSync(await fs.readFile(new URL('./test-data/current-20261103/' + name + '.html.gz', import.meta.url))).toString('utf8')
async function setup(change = () => {}) {
  const pages = new Map([[HOMEPAGE_URL, await read('homepage')], [CAREERS_PAGE_URL, await read('careers')]])
  const calls = [], reports = []
  const fetchPage = async (url, options) => {
    calls.push(url)
    assert.ok(pages.has(url), 'Only current declared corporate and careers pages should be requested')
    const value = { status: 200, url, html: pages.get(url) }
    const changed = await change(value, { calls, options })
    return changed || value
  }
  const run = options => createAscentHealthScraper().run({ fetchPage, onAudit: report => reports.push(report), ...options })
  return { pages, calls, reports, run }
}
test('Ascent records its actual recruiting entry without inventing empty vacancy inventory or requiring guessed routes', async () => {
  const f = await setup(), jobs = await f.run()
  assert.equal(jobs.length, 0)
  assert.deepEqual(f.calls, [HOMEPAGE_URL, CAREERS_PAGE_URL, HOMEPAGE_URL, CAREERS_PAGE_URL])
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.firstParty, true); assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.reportedTotal, null); assert.equal(inventory.indiaFacetCount, null)
  const observation = readSourceObservationEvidence(jobs, 'ascenthealth')
  assert.equal(observation.observedRecordCount, 1); assert.equal(observation.observedVacancyCount, 0)
  assert.equal(observation.companyGlobalTotal, null)
  assert.equal(f.reports[0].observations[0].email, 'careers@ascent-group.com')
  assert.ok(f.reports[0].publicPages.every(row => !Object.hasOwn(row, 'html') && row.sha256))
})
test('Ascent source cancellation preserves the caller reason and bounds an ignoring transport', async () => {
  const controller = new AbortController(), reason = new SyntaxError('caller stopped Ascent')
  const f = await setup((_value, { options }) => { assert.equal(options.signal, controller.signal); controller.abort(reason); return new Promise(() => {}) })
  await assert.rejects(f.run({ signal: controller.signal, collectionBudgetMs: 100 }), error => error === reason)
})
test('Ascent access denial stays source-local and does not report a native zero', async () => {
  const f = await setup(value => ({ ...value, status: 403 }))
  await assert.rejects(f.run(), error => error.status === 403 && error.failureKind === 'blocked_or_access_denied'
    && error.abortPipeline !== true && error.persistenceBlocked !== true && error.nativeJobTotal == null)
  assert.equal(f.calls.length, 1)
})
test('Ascent observer cancellation cannot hold a completed source open', async () => {
  const f = await setup(), controller = new AbortController(), reason = new Error('stop observer')
  await assert.rejects(f.run({ signal: controller.signal, onAudit: async () => { controller.abort(reason); return new Promise(() => {}) } }), error => error === reason)
})
test('Ascent new real public vacancy links are retained for a collector rather than qualified as empty', async () => {
  const f = await setup(value => value.url === CAREERS_PAGE_URL ? { ...value, html: value.html.replace('</body>', '<article class="job-card"><a href="/careers/native-role/">Revenue Analyst</a></article></body>') } : value)
  await assert.rejects(f.run(), /native job collector|vacancy/i)
  assert.ok(f.reports[0].possibleVacancyMarkup.some(row => row.url?.includes('/careers/native-role/')))
})
test('Ascent an ignoring reader and an ignoring observer are bounded without a caller signal', async () => {
  const pending = await setup(() => new Promise(() => {}))
  await assert.rejects(pending.run({ collectionBudgetMs: 20 }), error => error.name === 'TimeoutError')
  const observer = await setup()
  await assert.rejects(observer.run({ collectionBudgetMs: 60, onAudit: () => new Promise(() => {}) }), error => error.name === 'TimeoutError')
})
test('Ascent a changed recruiting entry is retained as changed evidence rather than an empty inventory', async () => {
  const f = await setup((value, { calls }) => calls.length === 4
    ? { ...value, html: value.html.replaceAll('careers@ascent-group.com', 'new-recruiting@ascent-group.com') } : value)
  await assert.rejects(f.run(), /closing public hiring entry model changed/i)
  assert.equal(f.reports[0].closingMatches, false)
  assert.equal(f.reports[0].inventoryEvidence.reportedTotal, null)
})
test('Ascent the default HTTP reader applies the same byte bound as injected readers', async t => {
  const f = await setup(), calls = []
  const mocked = t.mock.method(globalThis, 'fetch', async input => {
    const url = String(input); calls.push(url)
    const body = f.pages.get(url) + '<!--' + '.'.repeat(2_100_000) + '-->'
    const response = new Response(body, { headers: { 'content-type': 'text/html' } })
    Object.defineProperty(response, 'url', { value: url })
    return response
  })
  try {
    await assert.rejects(createAscentHealthScraper().run(), /exceeds source bound/)
    assert.equal(calls.length, 1)
  } finally { mocked.mock.restore() }
})
