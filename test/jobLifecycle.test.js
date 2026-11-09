import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_JOB_RETENTION_DAYS,
  buildJobPostedAtCutoff,
  buildPublishableJobPostedAtCutoff,
  normalizeLifecycleDate,
  resolveJobMissesBeforeExpiry,
  resolveJobPostedAt,
  resolveJobRetentionDays,
  startOfUtcDay,
} from '../src/utils/jobLifecycle.js'

test('publishable cutoff subtracts one calendar month and clamps to the last day of shorter months', () => {
  for (const [now, expected] of [
    ['2026-10-21T12:00:00Z', '2026-09-21T00:00:00.000Z'],
    ['2026-03-31T12:00:00Z', '2026-02-28T00:00:00.000Z'],
    ['2024-03-31T12:00:00Z', '2024-02-29T00:00:00.000Z'],
    ['2026-01-01T12:00:00Z', '2025-12-01T00:00:00.000Z'],
  ]) assert.equal(buildPublishableJobPostedAtCutoff(new Date(now)).toISOString(), expected)
})

test('resolveJobPostedAt prefers a valid postingDate and falls back from an invalid one', () => {
  const postedAt = '2026-07-20T00:00:00.000Z'

  assert.equal(
    resolveJobPostedAt({
      postingDate: '2026-07-22T00:00:00.000Z',
      postedAt,
    }).toISOString(),
    '2026-07-22T00:00:00.000Z',
  )
  assert.equal(
    resolveJobPostedAt({ postingDate: 'not-a-date', postedAt }).toISOString(),
    postedAt,
  )
})

test('resolveJobPostedAt uses the scrape date when the posting date is missing or NA', () => {
  const scrapedAt = '2026-07-26T09:30:00.000Z'

  assert.equal(
    resolveJobPostedAt({ postingDate: null, scrapedAt }).toISOString(),
    scrapedAt,
  )
  assert.equal(
    resolveJobPostedAt({ postingDate: 'NA', scrapedTimestamp: scrapedAt }).toISOString(),
    scrapedAt,
  )
})

test('job lifecycle configuration rejects unsafe or invalid values', () => {
  assert.equal(resolveJobRetentionDays('14'), 14)
  assert.equal(resolveJobRetentionDays('0'), DEFAULT_JOB_RETENTION_DAYS)
  assert.equal(resolveJobRetentionDays('invalid'), DEFAULT_JOB_RETENTION_DAYS)
  assert.equal(resolveJobMissesBeforeExpiry('3'), 3)
  assert.equal(resolveJobMissesBeforeExpiry('1'), 2)
  assert.equal(resolveJobMissesBeforeExpiry('invalid'), 2)
})

test('job lifecycle boundaries use UTC days and keep the exact cutoff day', () => {
  const now = new Date('2026-07-25T23:30:00.000Z')

  assert.equal(startOfUtcDay(now).toISOString(), '2026-07-25T00:00:00.000Z')
  assert.equal(
    buildJobPostedAtCutoff(now, 30).toISOString(),
    '2026-06-25T00:00:00.000Z',
  )
})

test('normalizeLifecycleDate interprets ten-digit Unix timestamps as seconds', () => {
  assert.equal(
    normalizeLifecycleDate(1782864000)?.toISOString(),
    '2026-07-01T00:00:00.000Z',
  )
})
