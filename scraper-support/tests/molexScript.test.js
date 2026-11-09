import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildSearchUrl,
  extractJobDetail,
  extractSearchResults,
  run,
} from '../../scraper/molex/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'molex',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('Molex stays on the official Koch Avature listing route', () => {
  assert.equal(
    buildSearchUrl(),
    'https://koch.avature.net/en_US/careers/SearchJobs?732=6322&tags=rm.kcm.web.kcm-004',
  )
})

test('Molex run emits only jobs whose Koch Avature detail page explicitly identifies India', async () => {
  const responses = new Map([
    [buildSearchUrl(), readFixture('search-results-page-1.html')],
    ['https://koch.avature.net/en_US/careers/JobDetail/Manufacturing-Engineer/12345', readFixture('job-detail-12345.html')],
    ['https://koch.avature.net/en_US/careers/JobDetail/Design-Engineer/67890', readFixture('job-detail-67890.html')],
  ])
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    const html = responses.get(String(url))
    assert.ok(html, `unexpected request: ${url}`)
    return { ok: true, text: async () => html }
  }

  try {
    const jobs = await run()

    assert.equal(jobs.length, 1)
    assert.deepEqual(jobs[0], {
      jobId: '12345',
      requisitionId: '12345',
      title: 'Manufacturing Engineer',
      company: 'Molex',
      department: 'Operations',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      link: 'https://koch.avature.net/en_US/careers/Login?jobId=12345',
      applyUrl: 'https://koch.avature.net/en_US/careers/Login?jobId=12345',
      sourceUrl: 'https://koch.avature.net/en_US/careers/JobDetail/Manufacturing-Engineer/12345',
      source: 'molex',
      employmentType: 'Regular',
      experienceRequired: null,
      jobDescription: 'Build reliable manufacturing processes.',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      scrapedAt: jobs[0].scrapedAt,
    })
    assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Molex detail extraction rejects non-Koch apply links', () => {
  const detail = extractJobDetail(readFixture('job-detail-67890.html'), {
    sourceUrl: 'https://koch.avature.net/en_US/careers/JobDetail/Design-Engineer/67890',
  })

  assert.equal(detail.applyUrl, null)
  assert.equal(detail.location, 'Lisle, Illinois, United States')
})

test('Molex search results keep only same-domain Avature JobDetail links', () => {
  const listings = extractSearchResults(`${readFixture('search-results-page-1.html')}
    <article class="article article--result"><h3><a href="https://example.com/en_US/careers/JobDetail/Outside/999">Outside</a></h3></article>`)

  assert.equal(listings.length, 2)
  assert.equal(listings[0].jobId, '12345')
})
