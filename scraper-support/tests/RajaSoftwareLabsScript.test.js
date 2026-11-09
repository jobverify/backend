import assert from 'node:assert/strict'
import test from 'node:test'

import {
  extractJobs,
  hasOfficialCareersSignal,
} from '../../scraper/rajasoftwarelabs/script.js'

const careersHtml = `
  <html>
    <body>
      <h1>Current Openings</h1>
      <p>We are always looking to hire good engineering talent.</p>
      <h2>To apply for a specific job</h2>
      <ul>
        <li><a href="/careers/jobs/software-engineer-android">Software Engineer - Android</a></li>
        <li><a href="/careers/jobs/software-engineer-ios">Software Engineer - iOS</a></li>
        <li><a href="/careers/jobs/software-engineer-web-frontend">Software Engineer - Web Frontend</a></li>
      </ul>
      <ul>
        <li><a href="/our-work/what-we-do">Our Work</a></li>
        <li><a href="/about-us/history">History</a></li>
      </ul>
      <p>If you feel you are a good fit, please email your resume to careers@rajasoftwarelabs.com.</p>
    </body>
  </html>
`

test('Raja Software Labs careers signal requires the live current openings section', () => {
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    hasOfficialCareersSignal('<html><body><h1>404</h1><p>careers@rajasoftwarelabs.com</p></body></html>'),
    false,
  )
})

test('extractJobs keeps only Raja Software Labs opening links from the application section', () => {
  const jobs = extractJobs(careersHtml, '2026-08-04T00:00:00.000Z')

  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Software Engineer - Android',
      'Software Engineer - iOS',
      'Software Engineer - Web Frontend',
    ],
  )
  assert.ok(jobs.every((job) => job.publicExperienceChecked === true))
  assert.ok(jobs.every((job) => /\/careers\/jobs\//.test(job.applyUrl)))
})
