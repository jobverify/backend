import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  SOURCE,
  createDyninnoIndiaScraper,
  extractIndiaJobs,
  hasOfficialCareersSignal,
} from './script.js'

const legacyOfficeHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>India Office</title>
  </head>
  <body>
    <h1>India Office</h1>
    <h2>Jobs in India</h2>
    <div>Trevolution</div>
  </body>
</html>
`

const currentOfficeHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>India - DYNINNO</title>
  </head>
  <body>
    <h1>India Office</h1>
    <h2>Jobs in India</h2>
    <div class="joblistbox">
      <div class="joblist location-job-item" onClick="window.location.href='https://dyninno.com/en/job/independent-travel-manager-remote/'">
        <div class="jobdetail">
          <div class="jobtitle">Remote Freelance Travel Consultant | Dreamport</div>
          <div class="joblocation">India (Global)</div>
        </div>
        <div class="jobtype">Trevolution</div>
      </div>
      <div class="joblist location-job-item" onClick="window.location.href='https://dyninno.com/en/job/travel-sales-consultant/'">
        <div class="jobdetail">
          <div class="jobtitle">TRAVEL SALES CONSULTANT</div>
          <div class="joblocation">India (Gurugram)</div>
        </div>
        <div class="jobtype">Trevolution</div>
      </div>
    </div>
  </body>
</html>
`

test('Dyninno India office contract accepts both the legacy and current title surfaces', () => {
  assert.equal(SOURCE, 'dyninnoindia')
  assert.equal(COMPANY, 'Dyninno India')
  assert.equal(CAREERS_URL, 'https://dyninno.com/en/offices/india/')
  assert.equal(hasOfficialCareersSignal(legacyOfficeHtml), true)
  assert.equal(hasOfficialCareersSignal(currentOfficeHtml), true)
})

test('Dyninno India parser extracts only the verified India office roles', () => {
  const jobs = extractIndiaJobs(currentOfficeHtml)

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Remote Freelance Travel Consultant | Dreamport')
  assert.equal(jobs[0].remoteStatus, 'Remote')
  assert.equal(jobs[1].title, 'TRAVEL SALES CONSULTANT')
  assert.equal(jobs[1].city, 'Gurugram')
})

test('Dyninno India scraper returns normalized jobs from the current office page', async () => {
  const jobs = await createDyninnoIndiaScraper().run({
    now: () => '2026-08-02T00:00:00.000Z',
    fetchText: async () => currentOfficeHtml,
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'dyninnoindia')
  assert.equal(jobs[0].companyCareerPage, CAREERS_URL)
  assert.equal(jobs[1].companyCareerPage, CAREERS_URL)
})
