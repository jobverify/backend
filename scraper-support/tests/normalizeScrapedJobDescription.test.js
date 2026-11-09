import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

test('normalizeScrapedJob keeps source paragraph breaks while cleaning inline whitespace', () => {
  const normalized = normalizeScrapedJob({
    title: 'Verification Engineer',
    company: 'Renesas Electronics',
    country: 'India',
    sourceUrl: 'https://jobs.renesas.com/job/verification-engineer',
    jobDescription: 'First source paragraph.\n\n  Second   source paragraph.\n- First requirement\n- Second requirement',
    scrapedAt: '2026-09-13T10:30:00.000Z',
  }, { source: 'renesas' })

  assert.equal(normalized.jobDescription, [
    'First source paragraph.',
    '',
    'Second source paragraph.',
    '- First requirement',
    '- Second requirement',
  ].join('\n'))
})
