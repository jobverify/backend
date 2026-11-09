import assert from 'node:assert/strict'
import test from 'node:test'
import { buildScraperAttemptDiagnostics, resolveZeroJobOutcome, isAuthoritativeEmptyScrape } from '../runner.js'
import { attachInventoryEvidence } from '../utils/inventoryEvidence.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

test('runner diagnostics retain raw inventory evidence and every mutually exclusive rejection count', () => {
  const evidence = { status: 'complete-inventory', firstParty: true, listingComplete: true, pagesFetched: 1, surface: 'https://example.com/careers', verifiedAt: new Date().toISOString() }
  const role = { title: 'Software engineer', location: 'Bangalore, India', city: 'Bangalore', country: 'India', applyUrl: 'https://example.com/jobs/1', description: 'Build reliable systems.' }
  const jobs = attachInventoryEvidence([
    role,
    { ...role, location: 'London, United Kingdom', city: 'London', country: 'United Kingdom' },
    { ...role, description: '' },
    { ...role, applyUrl: 'invalid' },
    { ...role, closingDate: '2000-01-01' },
    { ...role, title: 'Current openings at Acme', jobId: 'acme-current-openings' },
  ], evidence)
  const metrics = buildScraperAttemptDiagnostics(jobs)
  assert.equal(metrics.rawRecords, 6)
  assert.equal(metrics.jobs, 5)
  assert.equal(metrics.eligibleJobs, 2)
  assert.deepEqual([metrics.filteredNonIndia, metrics.filteredClosed, metrics.filteredInvalidUrl, metrics.filteredEmptyDescription, metrics.filteredNonJob], [1, 1, 1, 0, 1])
  assert.equal(metrics.inventoryEvidence.surface, evidence.surface)
  assert.deepEqual(metrics.detailHealth, { complete: false, inspectedJobs: 5,
    incompleteJobs: 1, missingDescriptions: 1, failureKinds: { 'missing-content': 1 } })
})

test('runner detail diagnostics inspect India roles before eligibility filtering and retain explicit detail failures', () => {
  const role = { title: 'Engineer', location: 'Bengaluru, India', country: 'India',
    applyUrl: 'https://example.com/job/1', description: 'Build customer software.' }
  const jobs = attachInventoryEvidence([
    role,
    { ...role, sourceDetailComplete: false, sourceDetailFailureKind: 'detail-budget-exhausted' },
    { ...role, country: 'United Kingdom', location: 'London, United Kingdom', description: '' },
  ], { status: 'complete-inventory', firstParty: true, listingComplete: true,
    pagesFetched: 1, surface: 'https://example.com/jobs', verifiedAt: new Date().toISOString() })
  const diagnostics = buildScraperAttemptDiagnostics(jobs)
  assert.deepEqual(diagnostics.detailHealth, { complete: false, inspectedJobs: 2,
    incompleteJobs: 1, missingDescriptions: 0, failureKinds: { 'detail-budget-exhausted': 1 } })
  assert.equal(diagnostics.inventoryEvidence.listingComplete, true)
  assert.equal(diagnostics.eligibleJobs, 2)
})

test('runner diagnostics keep native raw totals separate from a projected India subset', () => {
  const role = { title: 'Engineer', location: 'Bengaluru, India', country: 'India',
    applyUrl: 'https://example.com/job/1', description: 'Build customer software.' }
  const jobs = attachInventoryEvidence([role], { status: 'coverage-gap', firstParty: true, listingComplete: false,
    pagesFetched: 34, surface: 'https://example.com/api/jobs', reportedTotal: 336 })
  const diagnostics = buildScraperAttemptDiagnostics(jobs)
  assert.equal(diagnostics.rawRecords, 336)
  assert.equal(diagnostics.jobs, 1)
  assert.equal(diagnostics.eligibleJobs, 1)
  assert.equal(diagnostics.inventoryEvidence.listingComplete, false)
})

test('runner uses same-source observed native rows when the upstream total is unavailable', () => {
  const jobs = [{ title: 'Engineer', location: 'Bengaluru, India', country: 'India',
    applyUrl: 'https://example.com/job/1', description: 'Build customer software.',
    nativeCollectionEvidence: { source: 'fixture', observedListingCount: 20 } }]
  assert.equal(buildScraperAttemptDiagnostics(jobs, undefined, { source: 'fixture' }).rawRecords, 20)
  assert.equal(buildScraperAttemptDiagnostics(jobs, undefined, { source: 'other' }).rawRecords, 1)
  assert.equal(buildScraperAttemptDiagnostics(jobs).rawRecords, 1)
})

test('name coverage explicitly describes registration and keeps legacy counts', () => {
  const report = generateCompanyCoverageReport({ csvText: 'company_name\nAcme\nMissing', catalog: [{ source: 'acme', companyName: 'Acme' }], aliasMap: {} })
  assert.equal(report.coverageLabel, 'Catalog registration coverage')
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 1)
})

test('stale fetched zero inventory cannot authorize a live empty lifecycle', () => {
  const jobs = attachInventoryEvidence([], { status: 'verified-empty', firstParty: true, listingComplete: true,
    surface: 'https://example.com/careers', pagesFetched: 1, reportedTotal: 0, verifiedAt: '2000-01-01T00:00:00Z' })
  assert.equal(resolveZeroJobOutcome({ provider: {} }, jobs, []), 'unverified-zero')
  assert.equal(isAuthoritativeEmptyScrape({ provider: {} }, jobs), false)
})
