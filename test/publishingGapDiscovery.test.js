import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPublishingGapReport, publishingGapCsv } from '../scripts/publishingGapReport.js'

const now = new Date('2026-10-20T00:00:00Z')
const at = '2026-10-19T23:00:00Z'
const catalog = [{ source: 'acme', companyName: 'Acme', adapter: 'publicAts', atsPlatform: 'greenhouse', boardToken: 'acme' },
  { source: 'acmeindia', companyName: 'Acme India', adapter: 'script' }]
const runtime = { databaseAvailable: true, generatedAt: at, inventory: [{ source: 'acme', savedJobs: 3, visibleJobs: 3, visibleCompanies: ['Acme'] }], publicCompanyNames: ['Acme'] }

test('discovered duplicate boards remain aliases requiring reconciliation', () => {
  const report = buildPublishingGapReport({ catalog, runtime, now, discovery: [{ source: 'acmeindia', completedAt: at,
    outcome: 'ready-for-validation', eligibleJobs: 3, candidate: { atsPlatform: 'greenhouse', boardToken: 'acme' } }] })
  assert.equal(report.rows[1].publicationOutcome, 'not-published')
  assert.equal(report.rows[1].runtimeOutcome, 'not-observed')
  assert.equal(report.backlog[0].reason, 'reconcile-shared-published-ats-board')
  assert.deepEqual(report.rows[1].discoveredAtsBoard.sharedPublishedSources, ['acme'])
  assert.equal(report.summary.distinctVisibleCompanies, 1)
})

test('a newer failed extraction audit cannot inherit older positive discovery counts', () => {
  const report = buildPublishingGapReport({ catalog, runtime, now,
    discovery: [{ source: 'acmeindia', completedAt: at, outcome: 'ready-for-validation', eligibleJobs: 5 }],
    extractionAudits: [{ source: 'acmeindia', completedAt: '2026-10-19T23:30:00Z', outcome: 'extraction-failed', eligibleJobs: null }] })
  assert.equal(report.backlog[0].reason, 'extraction-failed')
  assert.equal(report.backlog[0].observedEligibleJobs, null)
  assert.notEqual(report.backlog[0].priority, 0)
})

test('stale discovery remains evidence context without supplying current opening counts', () => {
  const report = buildPublishingGapReport({ catalog, runtime, now, discovery: [{ source: 'acmeindia', completedAt: '2026-10-01T00:00:00Z', outcome: 'ready-for-validation', eligibleJobs: 5 }] })
  assert.equal(report.rows[1].discoveryFresh, false)
  assert.equal(report.rows[1].discoveredEligibleJobs, null)
  assert.equal(report.summary.completeSuccessfulChecks, 0)
  assert.match(publishingGapCsv(report.rows), /discoveryOutcome/)
})

const auditCounts = {
  rawJobs: 12, extractedJobs: 10, indiaJobs: 8, eligibleJobs: 6,
  filterCounts: { nonIndia: 2, old: 0, closed: 1, invalidUrl: 0, nonJob: 0, emptyDescription: 1 },
}
const positiveAudit = {
  source: 'acmeindia', completedAt: at, outcome: 'positive-extraction-incomplete-evidence', ...auditCounts,
}
const auditMetricFields = ['extractionAuditRawJobs', 'extractionAuditExtractedJobs', 'extractionAuditIndiaJobs',
  'extractionAuditEligibleJobs', 'extractionAuditRejectionCounts']

test('isolated audit diagnostics remain separate from unknown production counts', () => {
  const report = buildPublishingGapReport({
    catalog, now, runtime: { databaseAvailable: false }, extractionAudits: [positiveAudit],
  })
  const row = report.rows[1]
  assert.equal(row.extractionAuditRawJobs, 12)
  assert.equal(row.extractionAuditExtractedJobs, 10)
  assert.equal(row.extractionAuditIndiaJobs, 8)
  assert.equal(row.extractionAuditEligibleJobs, 6)
  assert.deepEqual(row.extractionAuditRejectionCounts, auditCounts.filterCounts)
  for (const field of ['rawJobs', 'indiaJobs', 'eligibleJobs', 'savedJobs', 'visibleJobs']) assert.equal(row[field], null, field)
  assert.equal(row.runtimeOutcome, 'not-observed')
  assert.equal(row.publicationOutcome, 'unknown')
  assert.equal(report.summary.completeSuccessfulChecks, 0)
  assert.equal(report.summary.sourcesWithVisibleJobs, null)
  assert.equal(report.summary.distinctVisibleCompanies, null)
  assert.equal(report.summary.runtimeReconciliationComplete, false)
})

test('the latest failed audit retains no older audit counts regardless of input ordering', () => {
  const failed = {
    source: 'acmeindia', completedAt: '2026-10-19T23:30:00Z', outcome: 'extraction-failed',
    rawJobs: null, indiaJobs: null, eligibleJobs: null, failureCode: 'FETCH_FAILED',
  }
  for (const extractionAudits of [[positiveAudit, failed], [failed, positiveAudit]]) {
    const report = buildPublishingGapReport({ catalog, runtime, now, extractionAudits })
    const row = report.rows[1]
    assert.equal(row.extractionAuditOutcome, 'extraction-failed')
    assert.equal(row.extractionAuditAt, '2026-10-19T23:30:00.000Z')
    for (const field of auditMetricFields) assert.equal(row[field], null, field)
    assert.equal(report.backlog[0].observedEligibleJobs, null)
    assert.equal(report.backlog[0].reason, 'extraction-failed')
  }
})

test('absent and stale audit diagnostics stay unknown, and malformed counts never become zeros', () => {
  for (const extractionAudits of [[], [{ ...positiveAudit, completedAt: '2026-10-01T00:00:00Z' }]]) {
    const row = buildPublishingGapReport({ catalog, runtime, now, extractionAudits }).rows[1]
    for (const field of auditMetricFields) assert.equal(row[field], null, field)
  }
  const row = buildPublishingGapReport({ catalog, runtime, now, extractionAudits: [{
    ...positiveAudit, rawJobs: '12', extractedJobs: -1, indiaJobs: 0.5,
    filterCounts: { nonIndia: '2', old: -1, closed: 0, invalidUrl: null, nonJob: 0.5, emptyDescription: 1 },
  }] }).rows[1]
  assert.equal(row.extractionAuditRawJobs, null)
  assert.equal(row.extractionAuditExtractedJobs, null)
  assert.equal(row.extractionAuditIndiaJobs, null)
  assert.deepEqual(row.extractionAuditRejectionCounts,
    { nonIndia: null, old: null, closed: 0, invalidUrl: null, nonJob: null, emptyDescription: 1 })
})

test('CSV preserves audit counts and rejection JSON while unknown production counts remain blank', () => {
  const report = buildPublishingGapReport({ catalog: [catalog[1]], now, extractionAudits: [positiveAudit] })
  const [header, line] = publishingGapCsv(report.rows).trimEnd().split('\n')
  // Parse the one-line fixture's quoted JSON cells independently of the writer.
  const values = [...line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g)]
    .map(match => (match[1] ?? match[2]).replaceAll('""', '"'))
  const row = Object.fromEntries(header.split(',').map((field, index) => [field, values[index]]))
  assert.equal(row.extractionAuditRawJobs, '12')
  assert.equal(row.extractionAuditExtractedJobs, '10')
  assert.equal(row.extractionAuditIndiaJobs, '8')
  assert.equal(row.extractionAuditEligibleJobs, '6')
  assert.deepEqual(JSON.parse(row.extractionAuditRejectionCounts), auditCounts.filterCounts)
  for (const field of ['rawJobs', 'indiaJobs', 'savedJobs', 'visibleJobs']) assert.equal(row[field], '', field)
})

test('backlog ranks shared compatibility before counts and source ID within each existing priority', () => {
  const candidates = [
    { source: 'custom-ten', adapter: 'script', atsPlatform: 'custom', count: 10 },
    { source: 'shared-z-five', adapter: 'publicAts', count: 5 },
    { source: 'shared-a-five', adapter: 'workday', count: 5 },
    { source: 'shared-seven', adapter: 'apiPortal', count: 7 },
    { source: 'script-four', adapter: 'script', atsPlatform: 'lever', count: 4 },
    { source: 'discovered-six', adapter: 'script', atsPlatform: 'custom', count: 6 },
    { source: 'shared-awaiting', adapter: 'script', atsPlatform: 'greenhouse', count: null },
  ]
  const report = buildPublishingGapReport({
    catalog: candidates, now,
    classifyImplementation: provider => ({ type: provider.source === 'shared-awaiting' ? 'sentinel' : 'shared-adapter' }),
    discovery: [{ source: 'discovered-six', completedAt: at, candidate: { atsPlatform: 'ashby', boardToken: 'example' } }],
    extractionAudits: candidates.filter(row => row.count != null).map(row => ({
      source: row.source, completedAt: at, outcome: 'complete-positive-extraction', eligibleJobs: row.count,
    })),
  })
  assert.deepEqual(report.backlog.map(row => row.source), [
    'shared-seven', 'discovered-six', 'shared-a-five', 'shared-z-five', 'script-four', 'custom-ten', 'shared-awaiting',
  ])
  assert.deepEqual(report.backlog.map(row => row.priority), [0, 0, 0, 0, 0, 0, 1])
  for (const row of report.backlog) assert.equal(row.sharedAdapterCompatible, row.source !== 'custom-ten')
  for (const row of report.rows) {
    assert.equal(row.sharedAdapterCompatible, row.source !== 'custom-ten')
    assert.equal(row.runtimeOutcome, 'not-observed')
    assert.equal(row.visibleJobs, null)
  }
  assert.equal(report.summary.completeSuccessfulChecks, 0)
  assert.equal(report.summary.sourcesWithVisibleJobs, null)
})

test('compatibility recognizes supported shared adapters, script platforms and discovered ATS candidates', () => {
  for (const atsPlatform of ['greenhouse', 'ashby', 'lever', 'workday', 'workable', 'workable-native-api', 'eightfold']) {
    const report = buildPublishingGapReport({
      catalog: [
        { source: 'script', adapter: 'script', atsPlatform },
        { source: 'discovery', adapter: 'script', atsPlatform: 'custom' },
        { source: 'unsupported', adapter: 'script', atsPlatform: 'custom' },
      ], now, classifyImplementation: () => ({ type: 'script' }),
      discovery: [{ source: 'discovery', candidate: { atsPlatform } }],
    })
    assert.equal(report.rows.find(row => row.source === 'script').sharedAdapterCompatible, true)
    assert.equal(report.rows.find(row => row.source === 'discovery').sharedAdapterCompatible, true)
    assert.equal(report.rows.find(row => row.source === 'unsupported').sharedAdapterCompatible, false)
    assert.equal(report.rows.find(row => row.source === 'script').adapter, 'script')
    assert.equal(report.rows.find(row => row.source === 'script').atsPlatform, atsPlatform)
  }
})
