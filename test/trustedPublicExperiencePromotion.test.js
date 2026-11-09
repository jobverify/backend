import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeScrapedJob } from '../scraper-support/utils/normalizeScrapedJob.js'

test('normalizeScrapedJob promotes trusted public experience checks for verified source surfaces', () => {
  const samples = [
    {
      input: {
        source: 'amrita',
        title: 'Post Doctoral Fellows @ Bengaluru',
        sourceUrl: 'https://www.amrita.edu/job/post-doctoral-fellows-bengaluru/',
        applyUrl: 'https://careers.amrita.edu/client/job-search?jid=abc123',
      },
    },
    {
      input: {
        source: 'nurturefarm',
        title: 'Zonal Commercial Lead',
        sourceUrl: 'https://nurture.skillate.com/',
        applyUrl: 'https://nurture.skillate.com/jobs/zonal-commercial-lead',
      },
    },
    {
      input: {
        source: 'innovaccer',
        title: 'Customer Engineering Manager',
        sourceUrl: 'https://apply.workable.com/j/DB9F82435B',
        applyUrl: 'https://apply.workable.com/j/DB9F82435B/apply',
      },
    },
  ]

  for (const { input } of samples) {
    const normalized = normalizeScrapedJob(input, { source: input.source })
    assert.equal(normalized.publicExperienceChecked, true, input.source)
  }
})

test('normalizeScrapedJob does not promote unrelated public urls automatically', () => {
  const normalized = normalizeScrapedJob({
    source: 'example',
    title: 'Example Role',
    sourceUrl: 'https://example.com/jobs/example-role',
    applyUrl: 'https://example.com/jobs/example-role/apply',
  }, { source: 'example' })

  assert.equal(normalized.publicExperienceChecked, false)
})
