import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPublishingGapReport } from '../scripts/publishingGapReport.js'
import { explainPublishingGap } from '../scripts/publishingGapExplanation.js'

// Values from the supplied run's complete 1X checkpoint: 97 native jobs,
// zero India roles. No isolated extraction audit is necessary for this proof.
const now = new Date('2026-11-13T21:04:47.062Z')
const attempt = {
  success: true, processingComplete: true, jobs: 0, eligibleJobs: 0, rawRecords: 97,
  completedAt: '2026-11-13T20:09:58.144Z',
  inventoryEvidence: {
    status: 'complete-inventory', surface: 'https://api.ashbyhq.com/posting-api/job-board/1x',
    firstParty: true, listingComplete: true, pagesFetched: 1, reportedTotal: 97,
    indiaFacetCount: 0, verifiedAt: '2026-11-13T20:09:58.143Z',
  },
  detailHealth: { complete: true, inspectedJobs: 0, incompleteJobs: 0, missingDescriptions: 0, failureKinds: {} },
}
const build = (result = attempt) => buildPublishingGapReport({
  catalog: [{ source: '1x', companyName: '1X', adapter: 'publicAts' }],
  runState: { mode: 'live', completed: { '1x': { result } } },
  runtime: { generatedAt: now.toISOString(), databaseAvailable: true, statuses: [], inventory: [], publicCompanyNames: [] },
  classifyImplementation: () => ({ type: 'shared-adapter', reason: 'adapter:publicAts' }), now,
})

test('a complete current foreign inventory explains no India roles instead of claiming missing extraction evidence', () => {
  const report = build(), row = report.rows[0]
  assert.equal(row.runtimeOutcome, 'no-india-jobs')
  assert.equal(row.completeSuccessfulCheck, true)
  assert.equal(row.gapExplanation, 'no-india-roles-on-checked-surface')
  assert.equal(report.backlog[0].discoveryRequired, false)
})

test('a no-India label without complete fresh inventory cannot establish company absence', () => {
  const row = build().rows[0]
  for (const patch of [
    { completeSuccessfulCheck: false },
    { attemptFresh: false },
    { indiaJobs: null },
    { indiaJobs: 1 },
    { inventoryEvidence: null },
    { inventoryEvidence: { ...row.inventoryEvidence, listingComplete: false } },
    { inventoryEvidence: { ...row.inventoryEvidence, verifiedAt: '2026-11-01T00:00:00Z' } },
  ]) {
    assert.equal(explainPublishingGap({ ...row, ...patch }, { now }), 'fresh-extraction-evidence-unavailable')
  }
})

test('a complete foreign inventory preserves public visibility and saved-job reconciliation priorities', () => {
  const row = build().rows[0]
  assert.equal(explainPublishingGap({ ...row, visibleJobs: 1 }, { now }), 'published')
  assert.equal(explainPublishingGap({ ...row, savedJobs: 3 }, { now }), 'saved-jobs-not-public-rule-inspection-required')
  assert.equal(explainPublishingGap({ ...row, publicationOutcome: 'unknown' }, { now }), 'public-inventory-unavailable')
})
