import assert from 'node:assert/strict'
import test from 'node:test'
import { explainPublishingGap } from '../scripts/publishingGapExplanation.js'
const now = new Date('2026-10-20T20:00:00Z')
const base = { publicationOutcome: 'not-published', visibleJobs: 0, savedJobs: 0,
  implementationType: 'script', extractionAuditFresh: false, attemptFresh: false }
const explain = row => explainPublishingGap({ ...base, ...row }, { now })

test('public inventory, administrative status and implementation remain distinct explanations', () => {
  assert.equal(explain({ publicationOutcome: 'unknown', implementationType: 'sentinel' }), 'public-inventory-unavailable')
  assert.equal(explain({ visibleJobs: 1, implementationType: 'sentinel', isActive: false }), 'published')
  assert.equal(explain({ isActive: false, extractionAuditEligibleJobs: 20 }), 'administrator-disabled')
  assert.equal(explain({ implementationType: 'sentinel' }), 'placeholder-not-implemented')
  assert.equal(explain({ implementationType: 'static-empty' }), 'static-empty-implementation')
})

test('latest failed, incomplete and stale checks cannot become verified zero explanations', () => {
  assert.equal(explain({ extractionAuditFresh: true, extractionAuditOutcome: 'extraction-failed' }), 'latest-isolated-check-failed')
  assert.equal(explain({ extractionAuditFresh: true, extractionAuditOutcome: 'unverified-zero', extractionAuditIndiaJobs: 0 }), 'empty-extraction-without-complete-inventory-proof')
  assert.equal(explain({ extractionAuditFresh: false, extractionAuditOutcome: 'complete-no-eligible-jobs', extractionAuditIndiaJobs: 0 }), 'fresh-extraction-evidence-unavailable')
  assert.equal(explain({ extractionAuditFresh: true, extractionAuditEligibleJobs: 0,
    extractionAuditDetailHealth: { missingDescriptions: 4 } }), 'native-descriptions-missing')
  assert.equal(explain({ extractionAuditFresh: true, extractionAuditEligibleJobs: 12 }), 'observed-eligible-roles-await-publication-reconciliation')
  assert.equal(explain({ savedJobs: 7 }), 'saved-jobs-not-public-rule-inspection-required')
})

test('no India roles requires complete fresh first-party surface evidence', () => {
  const row = { extractionAuditFresh: true, extractionAuditOutcome: 'complete-no-eligible-jobs', extractionAuditIndiaJobs: 0,
    extractionAuditEvidence: { inventoryEvidence: { status: 'complete-inventory', firstParty: true, listingComplete: true,
      surface: 'https://example.com/jobs', pagesFetched: 1, verifiedAt: '2026-10-20T19:00:00Z', reportedTotal: 17, indiaFacetCount: 0 } } }
  assert.equal(explain(row), 'no-india-roles-on-checked-surface')
  row.extractionAuditEvidence.inventoryEvidence.listingComplete = false
  assert.equal(explain(row), 'isolated-extraction-incomplete-or-unverified')
})
