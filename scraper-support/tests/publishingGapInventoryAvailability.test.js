import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPublishingGapReport, publishingGapCsv } from '../../scripts/publishingGapReport.js'

const now = new Date('2026-10-21T16:00:00Z')
const provider = source => ({ source, companyName: source, adapter: 'workday' })
const runtime = overrides => ({ databaseAvailable: true, generatedAt: now.toISOString(), statuses: [],
  inventory: [], publicCompanyNames: [], ...overrides })
const reportFor = snapshot => buildPublishingGapReport({ catalog: [provider('a')], now, runtime: snapshot })
const unavailable = report => {
  assert.equal(report.rows[0].savedJobs, null)
  assert.equal(report.rows[0].visibleJobs, null)
  assert.equal(report.rows[0].publicationOutcome, 'unknown')
  assert.equal(report.rows[0].gapExplanation, 'public-inventory-unavailable')
  assert.equal(report.summary.sourcesWithVisibleJobs, null)
  assert.equal(report.summary.distinctVisibleCompaniesFromCatalog, null)
  assert.equal(report.summary.runtimeReconciliationComplete, false)
  assert.ok(report.limitations.some(value => /inventory.*unavailable|inventory.*malformed/i.test(value)))
  assert.ok(!publishingGapCsv(report.rows).includes(',not-published,'))
}

test('missing, null and malformed inventory never establish absent-source zeros', () => {
  for (const inventory of [undefined, null, {}, 'unavailable', false, [null], [5], [{}]]) {
    unavailable(reportFor(runtime({ inventory })))
  }
})

test('explicitly unknown or invalid source counters remain unknown even with reconciliation claimed complete', () => {
  for (const counter of [undefined, null, -1, 0.5, '0', false, Number.MAX_SAFE_INTEGER + 1]) {
    const report = reportFor(runtime({ runtimeReconciliationComplete: true,
      inventory: [{ source: 'a', savedJobs: counter, visibleJobs: counter, visibleCompanies: [] }] }))
    assert.equal(report.rows[0].savedJobs, null)
    assert.equal(report.rows[0].visibleJobs, null)
    assert.equal(report.rows[0].publicationOutcome, 'unknown')
    assert.equal(report.summary.sourcesWithVisibleJobs, null)
    assert.equal(report.summary.runtimeReconciliationComplete, false)
    assert.ok(report.limitations.some(value => /saved|visible/.test(value) && /unknown/.test(value)))
  }
})

test('known positive visibility remains published when saved count is unknown', () => {
  const report = reportFor(runtime({ publicCompanyNames: ['a'],
    inventory: [{ source: 'a', savedJobs: null, visibleJobs: 2, visibleCompanies: ['a'] }] }))
  assert.equal(report.rows[0].savedJobs, null)
  assert.equal(report.rows[0].visibleJobs, 2)
  assert.equal(report.rows[0].publicationOutcome, 'published')
  assert.equal(report.rows[0].gapExplanation, 'published')
  assert.equal(report.summary.sourcesWithVisibleJobs, 1)
  assert.equal(report.summary.distinctVisibleCompanies, 1)
  assert.equal(report.summary.runtimeReconciliationComplete, false)
  assert.deepEqual(report.backlog, [])
})

test('known saved count never establishes missing visibility or excludes the source from backlog', () => {
  const report = reportFor(runtime({ inventory: [{ source: 'a', savedJobs: 3, visibleJobs: null, visibleCompanies: [] }] }))
  assert.equal(report.rows[0].savedJobs, 3)
  assert.equal(report.rows[0].visibleJobs, null)
  assert.equal(report.rows[0].publicationOutcome, 'unknown')
  assert.equal(report.summary.sourcesWithVisibleJobs, null)
  assert.equal(report.backlog[0].gapExplanation, 'public-inventory-unavailable')
})

test('missing and malformed public company names do not become zero companies or invalidate independent counters', () => {
  for (const publicCompanyNames of [undefined, null, {}, 'a', [null], [5]]) {
    const report = reportFor(runtime({ publicCompanyNames,
      inventory: [{ source: 'a', savedJobs: 2, visibleJobs: 1, visibleCompanies: ['a'] }] }))
    assert.equal(report.rows[0].publicationOutcome, 'published')
    assert.equal(report.summary.sourcesWithVisibleJobs, 1)
    assert.equal(report.summary.distinctVisibleCompanies, null)
    assert.equal(report.summary.distinctVisibleCompaniesFromCatalog, 1)
    assert.equal(report.summary.runtimeReconciliationComplete, false)
    assert.ok(report.limitations.some(value => /company.*unknown|company.*unavailable/i.test(value)))
  }
})

test('invalid per-source company-name lists remain unknown without losing known visibility', () => {
  for (const visibleCompanies of [undefined, null, {}, 'a', [null]]) {
    const report = reportFor(runtime({ publicCompanyNames: ['a'],
      inventory: [{ source: 'a', savedJobs: 2, visibleJobs: 1, visibleCompanies }] }))
    assert.equal(report.rows[0].publicationOutcome, 'published')
    assert.equal(report.rows[0].visibleCompanies, null)
    assert.equal(report.summary.distinctVisibleCompaniesFromCatalog, null)
    assert.equal(report.summary.distinctVisibleCompanies, 1)
    assert.equal(report.summary.runtimeReconciliationComplete, false)
    assert.deepEqual(report.reconciliation.aliasPublications, [])
  }
})

test('valid inventory retains absent-source zero and independent empty company evidence', () => {
  const report = reportFor(runtime())
  assert.equal(report.rows[0].savedJobs, 0)
  assert.equal(report.rows[0].visibleJobs, 0)
  assert.equal(report.rows[0].publicationOutcome, 'not-published')
  assert.equal(report.summary.sourcesWithVisibleJobs, 0)
  assert.equal(report.summary.distinctVisibleCompanies, 0)
  assert.equal(report.summary.distinctVisibleCompaniesFromCatalog, 0)
  assert.equal(report.summary.runtimeReconciliationComplete, true)
})

const delegatedReport = overrides => buildPublishingGapReport({ now,
  catalog: [{ ...provider('wrapper'), inventoryDelegation: { verified: true, verifiedAt: now.toISOString(),
    sources: ['a'], preservesChildSourceAndCompany: true,
    evidence: { url: 'https://example.com/careers', artifact: 'native-proof.json', sha256: 'a'.repeat(64) } } }, provider('a')],
  extractionAudits: [{ source: 'wrapper', completedAt: now.toISOString(), eligibleJobs: 2, outcome: 'positive-extraction-incomplete-evidence' }],
  runtime: runtime(overrides),
})

test('delegation preserves missing child counters and cannot infer a published child from unknown visibility', () => {
  for (const inventory of [undefined, {}, [{ source: 'a', savedJobs: 2, visibleJobs: null, visibleCompanies: [] }]]) {
    const report = delegatedReport({ inventory })
    const row = report.rows.find(row => row.source === 'wrapper')
    assert.equal(row.inventoryDelegation.childInventories[0].visibleJobs, null)
    assert.equal(row.inventoryDelegation.fresh, false)
    assert.deepEqual(row.inventoryDelegation.publicChildSources, [])
    assert.notEqual(row.gapExplanation, 'delegated-inventory-published-under-other-sources')
    // No fresh positive delegation is established; child inventory stays unknown.
    assert.equal(report.summary.delegatingSourcesWithPublicChildInventory, 0)
  }
})

test('delegation can report a known positive child without certifying unknown saved inventory as reconciled', () => {
  const report = delegatedReport({ publicCompanyNames: ['a'],
    inventory: [{ source: 'a', savedJobs: null, visibleJobs: 2, visibleCompanies: ['a'] }] })
  const child = report.rows.find(row => row.source === 'a')
  assert.equal(child.publicationOutcome, 'published')
  assert.equal(report.summary.runtimeReconciliationComplete, false)
  assert.equal(report.rows.find(row => row.source === 'wrapper').inventoryDelegation.childInventories[0].savedJobs, null)
})
