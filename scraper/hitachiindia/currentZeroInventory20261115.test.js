import assert from 'node:assert/strict'
import test from 'node:test'
import { run } from './script.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'

const now = () => new Date().toISOString()
const state = () => ({ jobSearch: {
  params: { page_number: 1, filter: { brand: ['Hitachi India Pvt. Ltd'], country: ['India'] } },
  totalJob: 0, jobs: [], similarJobs: [], isLoading: false,
} })
const html = value => '<html><head><title>Hitachi Careers</title></head><body><script>window.__PRELOAD_STATE__ = '
  + JSON.stringify(value) + '; window.__BUILD__ = "current";</script></body></html>'
const capture = value => {
  const urls = []
  return { urls, options: { now, fetchText: async url => { urls.push(url); return html(value) } } }
}

test('a stable loaded native zero preserves exact brand and India evidence through runner assessment', async () => {
  const trial = capture(state())
  const jobs = await run(trial.options)
  assert.equal(jobs.length, 0)
  assert.equal(trial.urls.length, 2)
  assert.equal(trial.urls[0], trial.urls[1])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'verified-empty')
  assert.equal(evidence?.reportedTotal, 0)
  assert.equal(evidence?.indiaFacetCount, 0)
  assert.equal(evidence?.pagesFetched, 2)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete, false)
  assert.equal(jobs.nativeCollectionEvidence.snapshots.length, 2)
  assert.ok(jobs.nativeCollectionEvidence.snapshots.every(snapshot => snapshot.totalJob === 0 && snapshot.isLoading === false))
  const assessment = assessSoftFailureAcquisition({ source: 'hitachiindia', zeroResultPolicy: 'evidence-required' }, jobs)
  assert.equal(assessment.runnerOutcome.success, true)
  assert.deepEqual(assessment.cleanupOptions, { replaceExisting: false })
})

test('a zero that is loading, failed, or changes during confirmation cannot become verified empty', async () => {
  const loading = state(); loading.jobSearch.isLoading = true
  const failure = state(); failure.jobSearch.error = 'Search service unavailable'
  for (const value of [loading, failure]) {
    const trial = capture(value)
    await assert.rejects(run(trial.options), /current native zero/i)
  }
  let count = 0
  await assert.rejects(run({ now, fetchText: async () => {
    const value = state()
    if (count++) value.jobSearch.totalJob = 1
    return html(value)
  } }), /current native zero/i)
})

test('inert, duplicated or overwritten preload state never supplies native zero proof', async () => {
  const live = html(state())
  for (const value of [
    '<template>' + live + '</template>',
    live + live,
    live.replace('; window.__BUILD__', '; window.__PRELOAD_STATE__ = {}; window.__BUILD__'),
  ]) {
    await assert.rejects(run({ now, fetchText: async () => value }))
  }
})

test('a nonzero source result filtered out by legal entity cannot become a native zero', async () => {
  const value = state()
  value.jobSearch.totalJob = 1
  value.jobSearch.jobs = [{ requisitionID: 'R1', locations: [{ country: 'India' }],
    customFields: [{ cfKey: 'cf_legal_name', value: 'UNRELATED HITACHI EMPLOYER' }] }]
  const jobs = await run({ now, fetchText: async () => html(value) })
  assert.equal(jobs.length, 0)
  assert.notEqual(readInventoryEvidence(jobs)?.status, 'verified-empty')
})
