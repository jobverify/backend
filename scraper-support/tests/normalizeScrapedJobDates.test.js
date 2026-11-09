import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

test('normalizeScrapedJob copies the resolved posting date into postedAt for dry-run consumers', () => {
  const normalized = normalizeScrapedJob({
    title: 'Operations Analyst',
    company: 'Example Co',
    location: 'Bengaluru',
    postingDate: '2026-07-14',
  }, {
    source: 'exampleco',
    companyName: 'Example Co',
  })

  assert.equal(normalized.postingDate?.toISOString(), '2026-07-14T00:00:00.000Z')
  assert.equal(normalized.postedAt?.toISOString(), '2026-07-14T00:00:00.000Z')
})

test('normalizeScrapedJob falls back postedAt to the scrape timestamp when the source omits a posting date', () => {
  const normalized = normalizeScrapedJob({
    title: 'Operations Analyst',
    company: 'Example Co',
    location: 'Bengaluru',
    scrapedAt: '2026-07-31T15:37:59.915Z',
  }, {
    source: 'exampleco',
    companyName: 'Example Co',
  })

  assert.equal(normalized.postingDate?.toISOString(), '2026-07-31T15:37:59.915Z')
  assert.equal(normalized.postedAt?.toISOString(), '2026-07-31T15:37:59.915Z')
})
