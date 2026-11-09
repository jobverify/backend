import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_PAGE_URL,
  COMPANY,
  SOURCE,
  extractYatraJobPortalRecords,
  extractYatraJobs,
  hasVerifiedYatraJobPortalSignal,
  run,
} from '../../scraper/yatra/script.js'

const FIXED_SCRAPED_AT = '2026-07-25T00:00:00.000Z'

test('Yatra validates the official enumerable job portal shell', () => {
  assert.equal(CAREERS_PAGE_URL, 'https://www.yatra.com/career/job-portal')
  assert.equal(COMPANY, 'Yatra')
  assert.equal(SOURCE, 'yatra')
  assert.equal(hasVerifiedYatraJobPortalSignal('Job Openings If you are looking for a exciting role in Yatra jobs@yatra.com'), true)
  assert.equal(hasVerifiedYatraJobPortalSignal('Yatra Job Portal Job Openings Search Job'), true)
  assert.equal(hasVerifiedYatraJobPortalSignal('Unexpected careers page'), false)
})

test('Yatra extracts job records from the official job-portal HTML blocks', () => {
  const records = extractYatraJobPortalRecords(`
    <div class="job-category" id="Technology - Gurugram" data-category="Technology - Gurugram">
      <div class="job-content">
        <div class="partition-block">
          <span class="title hover">Backend Engineer</span>
          <span class="location">Gurugram - Delhi NCR</span>
        </div>
        <span class="apply">
          <a class="js_apply" href="#" data-title="Backend Engineer" data-jobid="15">Apply</a>
        </span>
      </div>
      <div class="YT_Hide YT_JD">
        <p class="heading">Description</p>
        <p>Build APIs.</p>
      </div>
    </div>
  `)

  assert.deepEqual(records.map((record) => ({
    title: record.title,
    location: record.location,
    jobId: record.jobId,
    sourceUrl: record.sourceUrl,
  })), [
    {
      title: 'Backend Engineer',
      location: 'Gurugram - Delhi NCR',
      jobId: '15',
      sourceUrl: CAREERS_PAGE_URL,
    },
  ])
})

test('Yatra extracts unique India openings and rejects non-India records', () => {
  const jobs = extractYatraJobs([
    { jobId: '1', title: 'Backend Engineer', location: 'Gurugram - Delhi NCR', sourceUrl: 'https://www.yatra.com/career/job-portal#1' },
    { jobId: '1', title: 'Duplicate', location: 'Gurugram - Delhi NCR' },
    { jobId: '2', title: 'Engineer', location: 'London, United Kingdom' },
  ], () => FIXED_SCRAPED_AT)

  assert.deepEqual(jobs.map(({ title, company, country, source, scrapedAt }) => ({ title, company, country, source, scrapedAt })), [
    { title: 'Backend Engineer', company: 'Yatra', country: 'India', source: 'yatra', scrapedAt: FIXED_SCRAPED_AT },
  ])
})

test('Yatra run fails closed when the official page has no recognizable India openings', async () => {
  await assert.rejects(
    run({ renderPage: async () => [{ title: 'London role', location: 'London, United Kingdom' }] }),
    /no recognizable India job listings/i,
  )
})
