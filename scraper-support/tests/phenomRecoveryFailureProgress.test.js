import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { setImmediate } from 'node:timers/promises'
import { createPhenomScraper } from '../phenom/engine.js'
import { createNativeDetailRecovery, runWithNativeDetailRecovery } from '../utils/nativeDetailRecovery.js'

const scraper = createPhenomScraper({
  source: 'phenom-recovery-progress', companyName: 'Phenom Recovery Progress',
  baseUrl: 'https://careers.example.com', searchPath: '/global/en/search-results',
  scraperDir: fileURLToPath(new URL('.', import.meta.url)),
})
const row = (id, title = 'Engineer ' + id) => ({
  jobId: id, reqId: id, jobSeqNo: 'NATIVE-' + id, title,
  country: 'India', cityStateCountry: 'Bengaluru, Karnataka, India',
})
const page = jobs => '<script>phApp.ddo = ' + JSON.stringify({
  eagerLoadRefineSearch: { status: 200, totalHits: jobs.length, hits: jobs.length,
    data: { jobs, aggregations: [{ field: 'country', value: { India: jobs.length } }] } },
}) + '</script>'
const detail = job => '<script>phApp.ddo = ' + JSON.stringify({
  jobDetail: { status: 200, data: { job: { ...job,
    ml_Description: '<p>Build and maintain customer software services in the native India team.</p>',
  } } },
}) + '</script>'

for (const failure of ['identity-mismatch', 'missing-content']) {
  test('a settled ' + failure + ' cannot consume the next recovery pass before an unvisited role', async () => {
    const rows = [row('1'), row('2')]
    const recovery = createNativeDetailRecovery()
    let firstRoleReads = 0
    const fetchText = async (url, { signal }) => {
      if (url.endsWith('/search-results')) return page(rows)
      if (url.includes('/job/2/')) return detail(rows[1])
      firstRoleReads++
      if (firstRoleReads > 1) {
        await new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        })
      }
      return failure === 'identity-mismatch' ? detail({ ...rows[0], reqId: 'unrelated-role' })
        : detail(rows[0]).replace('Build and maintain customer software services in the native India team.', '')
    }

    const first = await scraper.run({ fetchText, nativeDetailRecovery: recovery, maxJobs: 1 })
    assert.equal(first[0].sourceDetailFailureKind, failure)
    const continued = await scraper.run({ fetchText, nativeDetailRecovery: recovery, detailEnrichmentBudgetMs: 40 })
    assert.equal(continued[1].sourceDetailComplete, true, 'The continuation must reach the previously unvisited role')
    assert.equal(continued[0].sourceDetailFailureKind, failure)
    assert.equal(continued[0].sourceDetailComplete, false)
    assert.equal(firstRoleReads, 1, 'An unchanged failed detail is attempted once in this recovery session')
  })
}

test('a changed native listing identity is rechecked after an earlier identity mismatch', async () => {
  const recovery = createNativeDetailRecovery()
  let listing = row('1')
  let reads = 0
  const fetchText = async url => {
    if (url.endsWith('/search-results')) return page([listing])
    reads++
    return detail(reads === 1 ? { ...listing, reqId: 'unrelated-role' } : listing)
  }
  const first = await scraper.run({ fetchText, nativeDetailRecovery: recovery })
  assert.equal(first[0].sourceDetailComplete, false)
  listing = row('1', 'Updated Native Engineer')
  const changed = await scraper.run({ fetchText, nativeDetailRecovery: recovery })
  assert.equal(changed[0].sourceDetailComplete, true)
  assert.equal(changed[0].title, 'Updated Native Engineer')
  assert.equal(reads, 2)
})

test('a new recovery session fetches a previously mismatched native role again', async () => {
  const listing = row('1')
  let reads = 0
  const fetchText = async url => {
    if (url.endsWith('/search-results')) return page([listing])
    reads++
    return detail(reads === 1 ? { ...listing, reqId: 'unrelated-role' } : listing)
  }
  const first = await scraper.run({ fetchText, nativeDetailRecovery: createNativeDetailRecovery() })
  assert.equal(first[0].sourceDetailComplete, false)
  const next = await scraper.run({ fetchText, nativeDetailRecovery: createNativeDetailRecovery() })
  assert.equal(next[0].sourceDetailComplete, true)
  assert.equal(reads, 2)
})

test('an exhausted upstream detail does not abandon unvisited roles in the recovery lifecycle', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-10-29T00:00:00Z') })
  const rows = [row('1'), row('2'), row('3')]
  const reads = new Map()
  let outcome
  const operation = runWithNativeDetailRecovery(recovery => scraper.run({
    nativeDetailRecovery: recovery,
    detailEnrichmentBudgetMs: 100,
    fetchText: async (url, { signal }) => {
      if (url.endsWith('/search-results')) return page(rows)
      const id = url.match(/\/job\/([^/]+)/)[1]
      reads.set(id, (reads.get(id) || 0) + 1)
      if (id === '1') throw new Error('HTTP 503 after transport retries')
      if (id === '2' && reads.get(id) === 1) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 200)
          signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason) }, { once: true })
        })
      }
      return detail(rows.find(job => job.jobId === id))
    },
  })).then(value => { outcome = { value } }, error => { outcome = { error } })
  for (let step = 0; !outcome && step < 100; step++) {
    await setImmediate()
    t.mock.timers.tick(25)
  }
  await operation
  assert.ifError(outcome.error)
  assert.equal(outcome.value[0].sourceDetailFailureKind, 'upstream')
  assert.equal(outcome.value[0].sourceDetailComplete, false)
  assert.ok(outcome.value.slice(1).every(job => job.sourceDetailComplete === true))
  assert.equal(reads.get('1'), 1, 'A settled transport failure must not consume every continuation')
  assert.equal(reads.get('2'), 2)
  assert.equal(reads.get('3'), 1)
})
