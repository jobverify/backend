import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildGreenhouseJobsApiUrl,
  extractIndiaJobsFromGreenhousePayload,
  hasVerifiedCareersPageSignal,
  hasVerifiedGreenhouseBoardSignal,
  normalizeGreenhouseJobUrl,
} from './script.js'

test('Kaseya India builds the verified Greenhouse jobs API URL', () => {
  assert.equal(
    buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/kaseya/jobs?content=true',
  )
})

test('Kaseya India verifies the current first-party careers shell and Greenhouse board handoff', () => {
  const html = `<!DOCTYPE html>
  <html>
  <head>
    <title>Careers at Kaseya | Open Positions &amp; Job Opportunities</title>
    <link rel="canonical" href="https://www.kaseya.com/careers/jobs/" />
  </head>
  <body>
    <nav>
      <a href="/careers/life-at-kaseya/">Life at Kaseya</a>
    </nav>
    <main>
      <a href="/careers/jobs/id/6015830004/?gh_jid=6015830004">Staff Software Engineer</a>
      <a href="https://my.greenhouse.io/users/sign_in?job_board=kaseya&amp;source=job_alert_board">Create alert</a>
    </main>
  </body>
  </html>`

  assert.equal(hasVerifiedCareersPageSignal(html), true)
  assert.equal(hasVerifiedGreenhouseBoardSignal(html), true)
})

test('Kaseya India normalizes first-party Greenhouse job URLs', () => {
  assert.equal(
    normalizeGreenhouseJobUrl(
      'https://www.kaseya.com/careers/jobs/id/6015830004/?gh_jid=6015830004',
      6015830004,
    ),
    'https://www.kaseya.com/careers/jobs/id/6015830004/?gh_jid=6015830004',
  )

  assert.equal(
    normalizeGreenhouseJobUrl(
      'https://job-boards.greenhouse.io/kaseya/jobs/6015830004',
      6015830004,
    ),
    null,
  )
})

test('Kaseya India extracts only India jobs from the Greenhouse payload', () => {
  const jobs = extractIndiaJobsFromGreenhousePayload({
    jobs: [
      {
        id: 6015830004,
        title: 'Staff Software Engineer',
        absolute_url: 'https://www.kaseya.com/careers/jobs/id/6015830004/?gh_jid=6015830004',
        company_name: 'Kaseya Careers',
        location: { name: 'Pune, India' },
        departments: [{ name: 'R&D Engineering' }],
        offices: [{ name: 'India - Remote', location: null }],
        requisition_id: '2155',
        updated_at: '2026-08-03T14:44:15-04:00',
        content: '<p>Own backend services in Pune.</p>',
        metadata: null,
      },
      {
        id: 5783414004,
        title: 'Lead Software Engineer',
        absolute_url: 'https://www.kaseya.com/careers/jobs/id/5783414004/?gh_jid=5783414004',
        company_name: 'Kaseya Careers',
        location: { name: 'India - Remote' },
        departments: [{ name: 'RMM' }],
        offices: [{ name: 'India - Remote', location: null }],
        requisition_id: '260128-3',
        updated_at: '2026-07-27T15:20:38-04:00',
        content: '<p>Remote-first role for engineers in India.</p>',
        metadata: null,
      },
      {
        id: 5969615004,
        title: 'Account Executive',
        absolute_url: 'https://www.kaseya.com/careers/jobs/id/5969615004/?gh_jid=5969615004',
        company_name: 'Kaseya Careers',
        location: { name: 'Miami, FL' },
        departments: [{ name: 'Sales' }],
        offices: [{ name: 'Miami', location: 'Miami, FL' }],
        requisition_id: '260414-4',
        updated_at: '2026-07-17T14:26:48-04:00',
        content: '<p>US-only role.</p>',
        metadata: null,
      },
    ],
  }, {
    scrapedAt: '2026-08-04T18:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      sourceUrl: job.sourceUrl,
    })),
    [
      {
        title: 'Staff Software Engineer',
        location: 'Pune, India',
        city: 'Pune',
        sourceUrl: 'https://www.kaseya.com/careers/jobs/id/6015830004/?gh_jid=6015830004',
      },
      {
        title: 'Lead Software Engineer',
        location: 'Remote, India',
        city: 'Remote',
        sourceUrl: 'https://www.kaseya.com/careers/jobs/id/5783414004/?gh_jid=5783414004',
      },
    ],
  )
})
