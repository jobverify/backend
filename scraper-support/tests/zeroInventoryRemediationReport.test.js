import assert from 'node:assert/strict'
import test from 'node:test'

import { buildZeroInventoryRemediationReport } from '../../scripts/reportZeroInventoryRemediation.js'

test('remediation report partitions and prioritizes every successful zero-India source', () => {
  const runState = {
    runId: 'fixture-run',
    completed: {
      unknown: { result: { success: true, jobs: 0, filteredNonIndia: 2 } },
      nonzero: { result: { success: true, jobs: 3, filteredNonIndia: 0 } },
      discovery: { result: { success: true, jobs: 0, filteredNonIndia: 0 } },
      sentinel: {
        result: {
          success: false,
          softFailure: true,
          failureKind: 'coverage_gap',
          jobs: 0,
          filteredNonIndia: 0,
        },
      },
      failed: { result: { success: false, jobs: 0, filteredNonIndia: 0 } },
    },
  }
  const coverageRows = [
    { row: '8', source: 'unknown', companyName: 'Unknown Ltd' },
    { row: '20', source: 'sentinel', companyName: 'Sentinel Ltd' },
  ]
  const providers = [
    {
      source: 'unknown',
      adapter: 'script',
      atsPlatform: 'custom',
      zeroResultPolicy: 'evidence-required',
      verifiedOn: null,
    },
    {
      source: 'discovery',
      companyName: 'Discovery Ltd',
      adapter: 'script',
      atsPlatform: 'third-party-search',
      zeroResultPolicy: 'discovery-only',
      verifiedOn: '2026-09-01',
    },
    {
      source: 'sentinel',
      adapter: 'script',
      atsPlatform: 'workbook-exact-name-sentinel',
      zeroResultPolicy: 'coverage-gap',
      verifiedOn: '2026-08-08',
    },
  ]

  const report = buildZeroInventoryRemediationReport({
    runState,
    coverageRows,
    providers,
  })

  assert.deepEqual(report.rows.map(({ source }) => source), [
    'sentinel',
    'discovery',
    'unknown',
  ])
  assert.deepEqual(report.summary, {
    zeroIndia: 3,
    rawZero: 2,
    rawNonIndiaOnly: 1,
    rawNonIndiaRecords: 2,
    coverageGap: 1,
    discoveryOnly: 1,
    evidenceRequired: 1,
  })
  assert.equal(report.rows.find(({ source }) => source === 'unknown').rawRecords, 2)
  assert.equal(report.rows.find(({ source }) => source === 'sentinel').workbookRank, 20)
  assert.match(report.rows[0].priorityReason, /coverage/i)
})

test('remediation report includes completed coverage gaps but excludes unrelated failures', () => {
  const report = buildZeroInventoryRemediationReport({
    runState: {
      completed: {
        coverage: {
          result: {
            success: false,
            softFailure: true,
            failureKind: 'coverage_gap',
            jobs: 0,
          },
        },
        upstream: {
          result: {
            success: false,
            softFailure: true,
            failureKind: 'network_or_timeout',
            jobs: 0,
          },
        },
      },
    },
    providers: [
      { source: 'coverage', zeroResultPolicy: 'coverage-gap' },
      { source: 'upstream', zeroResultPolicy: 'evidence-required' },
    ],
  })

  assert.deepEqual(report.rows.map(({ source }) => source), ['coverage'])
  assert.equal(report.summary.coverageGap, 1)
})

test('remediation report preserves historical directory policy after providers are removed', () => {
  const report = buildZeroInventoryRemediationReport({
    runState: {
      completed: {
        'acv-auctions.himalayas.app': {
          result: { success: true, jobs: 0, filteredNonIndia: 0 },
        },
        'coupang.wellfoundDirectory': {
          result: { success: true, jobs: 0, filteredNonIndia: 0 },
        },
      },
    },
    providers: [],
  })

  assert.equal(report.summary.discoveryOnly, 2)
  assert.deepEqual(
    report.rows.map(({ zeroResultPolicy }) => zeroResultPolicy),
    ['discovery-only', 'discovery-only'],
  )
})
