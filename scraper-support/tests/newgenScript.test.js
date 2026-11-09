import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  JOBS_PORTAL_URL,
  extractJobs,
  run,
} from '../../scraper/newgen/script.js'

const listingHtml = `
  <div class="job-card">
    <h3 class="job-title">Senior Software Engineer</h3>
    <div class="job-location">Noida, Uttar Pradesh</div>
    <span class="job-date">Posted Date: 07/09/2026</span>
    <div class="job-description">
      <p>Build and maintain enterprise software.</p>
      <p>Work with product and engineering teams.</p>
    </div>
    <a href="https://omnirecruit.newgen.co.in/CandidateRegistration/CandidateRegistration.aspx?JobExternalUsers=NG-1001">Apply Now</a>
  </div>
  <div class="job-card">
    <h3 class="job-title">QA Automation Analyst</h3>
    <div class="job-location">Bengaluru, Karnataka</div>
    <span class="job-date">Posted On: 2026-07-08</span>
    <div class="job-description">Own test automation for Newgen products.</div>
    <button onclick="apply('NG-1002')">Apply</button>
  </div>
`

test('Newgen scraper pins the verified official careers page and OmniRecruit portal', () => {
  assert.equal(CAREERS_URL, 'https://newgensoft.com/in/company/careers/')
  assert.equal(JOBS_PORTAL_URL, 'https://omnirecruit.newgen.co.in/IShareReferral/CareerPortal.aspx')
})

test('extractJobs parses inline OmniRecruit job cards', () => {
  assert.deepEqual(extractJobs(listingHtml), [
    {
      title: 'Senior Software Engineer',
      company: 'Newgen Software',
      location: 'Noida, Uttar Pradesh',
      city: 'Noida',
      jobId: 'NG-1001',
      requisitionId: 'NG-1001',
      sourceUrl: JOBS_PORTAL_URL,
      applyUrl: 'https://omnirecruit.newgen.co.in/CandidateRegistration/CandidateRegistration.aspx?JobExternalUsers=NG-1001',
      postingDate: '2026-09-07',
      closingDate: null,
      jobDescription: 'Build and maintain enterprise software. Work with product and engineering teams.',
    },
    {
      title: 'QA Automation Analyst',
      company: 'Newgen Software',
      location: 'Bengaluru, Karnataka',
      city: 'Bengaluru',
      jobId: 'NG-1002',
      requisitionId: 'NG-1002',
      sourceUrl: JOBS_PORTAL_URL,
      applyUrl: 'https://omnirecruit.newgen.co.in/CandidateRegistration/CandidateRegistration.aspx?JobExternalUsers=NG-1002',
      postingDate: '2026-07-08',
      closingDate: null,
      jobDescription: 'Own test automation for Newgen products.',
    },
  ])
})

test('run fetches the pinned portal and returns runner metadata', async () => {
  const jobs = await run({ fetchImpl: async (url) => {
    assert.equal(url, JOBS_PORTAL_URL)
    return { ok: true, text: async () => listingHtml }
  } })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'newgen')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
