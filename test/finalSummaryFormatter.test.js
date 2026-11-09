import assert from 'node:assert/strict'
import test from 'node:test'

import { formatFinalSummaryTable } from '../scraper-support/finalSummaryFormatter.js'

test('summary exposes recovered nested retries and rate limits separately from source retries', () => {
  const output = formatFinalSummaryTable({
    recovered: { success: true, jobs: 2, durationMs: 100,
      retry: { attemptsUsed: 1, retries: 0, retryDelayMs: 0 },
      retryPressure: { nestedScopes: 2, nestedAttempts: 3, nestedRetries: 1,
        nestedFailedAttempts: 1, nestedRetryDelayMs: 1500, httpStatusCounts: { 429: 1 },
        sourceAdmission: { groups: ['workday:wd1'], admittedAttempts: 1, queuedAttempts: 1, queueWaitMs: 2000 } } },
  })
  assert.match(output, /Nested retry attempts\s+\| 1/)
  assert.match(output, /Nested retry backoff\s+\| 1\.5s/)
  assert.match(output, /Shared HTTP 429 responses\s+\| 1/)
  assert.match(output, /Sources retried\s+\| 0/)
  assert.match(output, /Workday queued sources\s+\| 1/)
  assert.match(output, /Workday source queue time\s+\| 2\.0s/)
})

test('console separates successful tasks from complete extraction and prioritizes skipped sources', () => {
  const completedAt = new Date(Date.now() - 1000).toISOString()
  const inventoryEvidence = { status: 'complete-inventory', firstParty: true, listingComplete: true,
    surface: 'https://example.invalid/careers', pagesFetched: 1, verifiedAt: completedAt }
  const output = formatFinalSummaryTable({
    complete: { success: true, jobs: 1, inventoryEvidence, completedAt },
    partial: { success: true, partial: true, jobs: 1, inventoryEvidence, completedAt, detailHealth: { complete: false } },
    skipped: { success: true, skipped: true, jobs: 0 },
    blocked: { success: false, softFailure: true, failureKind: 'coverage_gap', zeroJobEvidence: 'blocked-zero', jobs: 0 },
    legacy: { success: true, jobs: 1 },
  })
  assert.match(output, /Tasks succeeded\s+\| 3/)
  assert.match(output, /Skipped\s+\| 1/)
  assert.match(output, /Task success rate\s+\| 60\.0%/)
  assert.match(output, /Complete extractions\s+\| 1/)
  assert.match(output, /Incomplete extractions\s+\| 4/)
  assert.match(output, /Partial successful tasks\s+\| 2/)
  assert.match(output, /Complete-extraction rate\s+\| 20\.0%/)
  assert.doesNotMatch(output, /Successful-source rate/)
  assert.match(output, /partial\s+\| 0\.0s\s+\| Partial/)
})

test('formatFinalSummaryTable renders bounded operational analytics tables', () => {
  const output = formatFinalSummaryTable({
    alpha: {
      success: true,
      jobs: 100,
      eligibleJobs: 60,
      filteredNonIndia: 25,
      filteredOld: 10,
      filteredClosed: 2,
      filteredInvalidUrl: 1,
      inserted: 0,
      updated: 0,
      durationMs: 1_000,
    },
    beta: {
      success: true,
      jobs: 0,
      inserted: 0,
      updated: 0,
      durationMs: 10_000,
    },
    gamma: {
      success: false,
      softFailure: true,
      jobs: 0,
      inserted: 0,
      updated: 0,
      durationMs: 5_000,
      error: '[gamma] timed out after 300000ms',
    },
    delta: {
      success: false,
      softFailure: false,
      jobs: 0,
      inserted: 0,
      updated: 0,
      durationMs: 20_000,
      error: 'HTTP 503 for https://example.test/jobs',
    },
    epsilon: {
      success: false,
      softFailure: true,
      jobs: 0,
      inserted: 0,
      updated: 0,
      durationMs: 3_000,
      error: 'certificate has expired',
    },
    zeta: {
      success: true,
      jobs: 20,
      eligibleJobs: 10,
      filteredNonIndia: 1,
      filteredOld: 4,
      filteredClosed: 1,
      filteredInvalidUrl: 1,
      inserted: 4,
      updated: 2,
      durationMs: 4_000,
    },
  })

  assert.match(output, /^[\x0A\x0D\x20-\x7E]+$/)
  assert.match(output, /Start time\s+\| unavailable/)
  assert.match(output, /RUN HEALTH/)
  assert.match(output, /Task success rate\s+\| 50\.0%/)
  assert.match(output, /Zero India-job results\s+\| 1/)
  assert.match(output, /JOB YIELD/)
  assert.match(output, /Top-5 source share\s+\| 100\.0%/)
  assert.match(output, /PUBLISHABLE FILTERS/)
  assert.match(output, /Publishable jobs\s+\| 70/)
  assert.match(output, /Rejected outside India\s+\| 26/)
  assert.doesNotMatch(output, /Rejected older than retention/)
  assert.match(output, /Rejected past closing date\s+\| 3/)
  assert.match(output, /Rejected invalid URL\s+\| 2/)
  assert.match(output, /PERFORMANCE/)
  assert.match(output, /P95 source runtime\s+\| 20\.0s/)
  assert.match(output, /Timed-out sources\s+\| 1/)
  assert.match(output, /TOP JOB YIELDS/)
  assert.match(output, /alpha\s+\| 100\s+\| 83\.3%/)
  assert.match(output, /TOP SLOWEST SOURCES/)
  assert.match(output, /delta\s+\| 20\.0s\s+\| Warn\s+\| 0/)
  assert.match(output, /Source warnings\s+\| 1/)
  assert.match(output, /FAILURE GROUPS/)
  assert.match(output, /HTTP 5xx\s+\| 1\s+\| delta/)
  assert.match(output, /TLS\/certificate\s+\| 1\s+\| epsilon/)
})

test('formatFinalSummaryTable highlights the largest source job-count changes', () => {
  const output = formatFinalSummaryTable({
    alpha: { success: true, jobs: 30, durationMs: 100 },
    beta: { success: true, jobs: 2, durationMs: 100 },
  }, {
    previousRun: {
      sources: {
        alpha: { jobsFound: 5 },
        beta: { jobsFound: 40 },
      },
    },
  })

  assert.match(output, /SOURCE-CHANGE ANOMALIES/)
  assert.match(output, /alpha\s+\| 5\s+\| 30\s+\| \+25/)
  assert.match(output, /beta\s+\| 40\s+\| 2\s+\| -38/)
})

test('formatFinalSummaryTable separates verified empty pages from unverified zero results', () => {
  const output = formatFinalSummaryTable({
    verified: { success: true, jobs: 0, zeroJobEvidence: 'verified-empty', durationMs: 100 },
    fetched: { success: true, jobs: 0, zeroJobEvidence: 'fetched-zero', durationMs: 100 },
    blocked: { success: true, jobs: 0, zeroJobEvidence: 'blocked-zero', durationMs: 100 },
    placeholder: { success: true, jobs: 0, zeroJobEvidence: 'unverified-zero', durationMs: 100 },
  })

  assert.match(output, /Zero India-job results\s+\| 4/)
  assert.match(output, /Verified empty career surfaces\s+\| 1/)
  assert.match(output, /Fetched zero India-job results\s+\| 1/)
  assert.match(output, /Blocked or failed zero results\s+\| 1/)
  assert.match(output, /Unverified zero results\s+\| 1/)
})

test('summary separates coverage gaps from successful inventory runs', () => {
  const output = formatFinalSummaryTable({
    jobs: { success: true, jobs: 2, durationMs: 10 },
    empty: { success: true, jobs: 0, zeroJobEvidence: 'verified-empty', durationMs: 10 },
    outsideIndia: { success: true, jobs: 0, zeroJobEvidence: 'fetched-zero', durationMs: 10 },
    unknown: { success: true, jobs: 0, zeroJobEvidence: 'unverified-zero', durationMs: 10 },
    directory: { success: true, jobs: 0, zeroJobEvidence: 'blocked-zero', durationMs: 10 },
    placeholder: {
      success: false,
      softFailure: true,
      failureKind: 'coverage_gap',
      zeroJobEvidence: 'coverage-gap',
      jobs: 0,
      durationMs: 10,
    },
  })

  assert.match(output, /Tasks succeeded\s+\| 3/)
  assert.match(output, /Coverage gaps\s+\| 3/)
  assert.match(output, /Zero India-job results\s+\| 5/)
  assert.match(output, /Verified empty career surfaces\s+\| 1/)
  assert.match(output, /Fetched zero India-job results\s+\| 1/)
  assert.match(output, /Blocked or failed zero results\s+\| 1/)
  assert.match(output, /Unverified zero results\s+\| 1/)
  assert.match(output, /Coverage-gap zero results\s+\| 1/)
  assert.doesNotMatch(output, /Other\s+\| 1\s+\| placeholder/)
})

test('formatFinalSummaryTable totals missing required job fields', () => {
  const output = formatFinalSummaryTable({
    alpha: {
      success: true,
      jobs: 4,
      durationMs: 100,
      dataQuality: { missingTitle: 1, missingLocation: 2, missingApplyUrl: 3 },
    },
  })

  assert.match(output, /DATA QUALITY/)
  assert.match(output, /Missing title\s+\| 1/)
  assert.match(output, /Missing location\s+\| 2/)
  assert.match(output, /Missing application URL\s+\| 3/)
})

test('formatFinalSummaryTable reports wall-clock run timing and operational rates', () => {
  const output = formatFinalSummaryTable({
    alpha: {
      success: true,
      jobs: 8,
      durationMs: 49_805_800,
      dataQuality: { missingLocation: 2 },
    },
    beta: { success: false, softFailure: true, jobs: 0, durationMs: 1_000 },
  }, {
    runTiming: {
      startedAt: new Date('2026-08-18T01:30:00.000Z'),
      completedAt: new Date('2026-08-18T03:07:36.700Z'),
    },
  })

  assert.match(output, /RUN TIMING/)
  assert.match(output, /Start time\s+\| 2026-08-18 07:00:00 IST/)
  assert.match(output, /End time\s+\| 2026-08-18 08:37:36 IST/)
  assert.match(output, /Total time taken\s+\| 1h 37m 36\.7s/)
  assert.match(output, /Cumulative worker time\s+\| 13h 50m 6\.8s/)
  assert.match(output, /Task success rate\s+\| 50\.0%/)
  assert.match(output, /Job-yield rate\s+\| 50\.0%/)
  assert.match(output, /Missing-location rate\s+\| 25\.0%/)
})
