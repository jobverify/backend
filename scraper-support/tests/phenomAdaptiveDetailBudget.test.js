import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { createPhenomScraper } from '../phenom/engine.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const exercise = async (t, {
  count = 96, detailDelayMs = 750, listingDelayMs = 0, hangDetails = false,
  environmentBudget, factoryOptions = {}, ...runOptions
} = {}) => {
  const previous = process.env.PHENOM_DETAIL_ENRICHMENT_BUDGET_MS
  if (environmentBudget === undefined) delete process.env.PHENOM_DETAIL_ENRICHMENT_BUDGET_MS
  else process.env.PHENOM_DETAIL_ENRICHMENT_BUDGET_MS = String(environmentBudget)
  t.after(() => {
    if (previous === undefined) delete process.env.PHENOM_DETAIL_ENRICHMENT_BUDGET_MS
    else process.env.PHENOM_DETAIL_ENRICHMENT_BUDGET_MS = previous
  })
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-10-24T00:00:00Z') })
  const startedAt = Date.now()
  const roles = Array.from({ length: count }, (_, index) => ({
    reqId: 'R' + index, jobId: 'R' + index, jobSeqNo: 'native-' + index,
    title: 'Engineer ' + index, country: 'India', cityStateCountry: 'Pune, India',
    descriptionTeaser: 'A listing teaser is not the full employer description.',
  }))
  const listingHtml = '<script>phApp.ddo = ' + JSON.stringify({ eagerLoadRefineSearch: {
    status: 200, totalHits: count, hits: count, data: {
      jobs: roles, aggregations: [{ field: 'country', value: { India: count } }],
    },
  } }) + '</script>'
  const requests = []
  let active = 0, maxActive = 0
  const waitForResponse = (ms, signal) => new Promise((resolve, reject) => {
    let timer
    const onAbort = () => { clearTimeout(timer); reject(signal.reason) }
    signal.addEventListener('abort', onAbort, { once: true })
    if (ms !== null) timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
  })
  const scraper = createPhenomScraper({
    companyName: 'Phenom budget fixture', source: 'phenom-budget',
    baseUrl: 'https://careers.example.com',
    scraperDir: fileURLToPath(new URL('.', import.meta.url)), ...factoryOptions,
  })
  let completion
  const pending = scraper.run({
    ...runOptions,
    fetchText: async (url, { signal }) => {
      if (new URL(url).pathname.endsWith('/search-results')) {
        if (listingDelayMs) await waitForResponse(listingDelayMs, signal)
        return listingHtml
      }
      const role = roles.find(role => new URL(url).pathname.split('/job/')[1]?.split('/')[0] === role.jobId)
      assert.ok(role, 'Fetch details only for a currently enumerated native role')
      requests.push(url)
      active += 1
      maxActive = Math.max(maxActive, active)
      try {
        await waitForResponse(hangDetails ? null : detailDelayMs, signal)
        return '<link rel="canonical" href="' + url + '"><script>phApp.ddo = '
          + JSON.stringify({ jobDetail: { status: 200, data: { job: {
            ...role, ml_country: 'India', standardisedCountry: 'India',
            ml_Description: '<p>Build and maintain reliable native production services for this employer.</p>',
          } } } }) + '</script>'
      } finally {
        active -= 1
      }
    },
  }).then(jobs => { completion = { jobs } }, error => { completion = { error } })
  for (let step = 0; !completion && step < 2000; step += 1) {
    await setImmediate()
    t.mock.timers.tick(250)
  }
  assert.ok(completion, 'Optional detail work must settle within a finite budget')
  await pending
  assert.equal(active, 0, 'Completion and cancellation must leave no active detail requests')
  if (completion.error) throw completion.error
  return { jobs: completion.jobs, requests, maxActive, elapsedMs: Date.now() - startedAt }
}

test('implicit Phenom budget completes a medium serial native-detail workload without changing source concurrency', async t => {
  const { jobs, requests, maxActive, elapsedMs } = await exercise(t)
  assert.equal(jobs.length, 96)
  assert.equal(jobs.filter(job => job.sourceDetailComplete === true).length, 96)
  assert.equal(requests.length, 96)
  assert.equal(maxActive, 1)
  assert.ok(elapsedMs > 30000 && elapsedMs < 120000)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('implicit Phenom budget accounts for the pending workload across source-configured workers', async t => {
  const { jobs, requests, maxActive } = await exercise(t, {
    count: 192, detailDelayMs: 1000, factoryOptions: { defaultDetailConcurrency: 4 },
  })
  assert.equal(jobs.length, 192)
  assert.equal(jobs.filter(job => job.sourceDetailComplete === true).length, 192)
  assert.equal(requests.length, 192)
  assert.equal(maxActive, 4)
})

test('a smaller parallel Phenom workload does not receive the maximum implicit detail allowance', async t => {
  const { jobs, maxActive, elapsedMs } = await exercise(t, {
    count: 80, hangDetails: true, factoryOptions: { defaultDetailConcurrency: 4 },
  })
  assert.equal(jobs.length, 80)
  assert.equal(maxActive, 4)
  assert.ok(jobs.every(job => job.sourceDetailFailureKind === 'budget-exhausted'))
  assert.ok(elapsedMs > 30000 && elapsedMs < 60000)
})

test('a source-specific zero Phenom detail budget remains exact', async t => {
  const { jobs, requests } = await exercise(t, { factoryOptions: { defaultDetailEnrichmentBudgetMs: 0 } })
  assert.equal(requests.length, 0)
  assert.ok(jobs.every(job => job.sourceDetailComplete === false && job.sourceDetailFailureKind === 'budget-exhausted'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('a source-specific Phenom detail budget above the implicit cap is not shortened', async t => {
  const { jobs, elapsedMs } = await exercise(t, {
    count: 180, factoryOptions: { defaultDetailEnrichmentBudgetMs: 150000 },
  })
  assert.ok(jobs.every(job => job.sourceDetailComplete === true))
  assert.ok(elapsedMs > 120000 && elapsedMs < 150000)
})

test('an environment zero Phenom budget overrides a source-specific positive allowance', async t => {
  const { jobs, requests } = await exercise(t, {
    environmentBudget: 0, factoryOptions: { defaultDetailEnrichmentBudgetMs: 150000 },
  })
  assert.equal(requests.length, 0)
  assert.ok(jobs.every(job => job.sourceDetailFailureKind === 'budget-exhausted'))
})

test('an explicit Phenom option budget overrides the environment and is not extended', async t => {
  const { jobs, elapsedMs } = await exercise(t, {
    environmentBudget: 0, detailEnrichmentBudgetMs: 10000,
  })
  assert.ok(jobs.some(job => job.sourceDetailComplete === true))
  assert.ok(jobs.some(job => job.sourceDetailComplete === false && job.sourceDetailFailureKind === 'budget-exhausted'))
  assert.ok(elapsedMs >= 10000 && elapsedMs < 11000)
})

test('Quest-scale serial Phenom inventories retain truthful detail diagnostics at the finite implicit cap', async t => {
  const { jobs, elapsedMs } = await exercise(t, { count: 1132 })
  assert.equal(jobs.length, 1132)
  assert.ok(jobs.some(job => job.sourceDetailComplete === true))
  assert.ok(jobs.some(job => job.sourceDetailComplete === false && job.sourceDetailFailureKind === 'budget-exhausted'))
  assert.ok(elapsedMs >= 120000 && elapsedMs < 121000)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 1132)
})

test('worst-case implicit listing and hung detail phases finish within the generic 300-second source deadline', async t => {
  const { jobs, maxActive, elapsedMs } = await exercise(t, {
    count: 400, listingDelayMs: 119000, hangDetails: true,
  })
  assert.equal(jobs.length, 400)
  assert.equal(maxActive, 1)
  assert.ok(jobs.every(job => job.sourceDetailFailureKind === 'budget-exhausted'))
  assert.ok(elapsedMs >= 239000 && elapsedMs < 241000)
  assert.ok(elapsedMs < 300000)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('caller cancellation promptly stops an implicitly extended Phenom detail phase', async t => {
  const controller = new AbortController()
  const reason = new Error('caller source deadline')
  const pending = exercise(t, { signal: controller.signal })
  const startedAt = Date.now()
  setTimeout(() => controller.abort(reason), 40000)
  await assert.rejects(pending, error => error === reason)
  assert.ok(Date.now() - startedAt < 41000, 'Caller cancellation must not wait for the optional phase cap')
})
