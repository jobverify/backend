import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  createWinmanSoftwareScraper,
  extractJobs,
  hasOfficialCareersSignal,
} from './script.js'

const currentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers for Experience Candidates &#8211; Winman Software</title>
  </head>
  <body>
    <table id="experienced_table">
      <tr>
        <th>Designation and Job profile</th>
        <th>Years of experience (minimum)</th>
      </tr>
      <tr>
        <td>
          <h5>Senior Accountant</h5>
          Overseeing the finalisation of accounts.
        </td>
        <td>CA Articleship completed</td>
      </tr>
      <tr>
        <td>
          <h5>Electrical Maintenance Supervisor</h5>
          Supervising maintenance of electrical systems.
        </td>
        <td>2 years</td>
      </tr>
    </table>
    <a href="https://winman.in/jobs/resumedetail.aspx">Apply now</a>
  </body>
</html>
`

test('Winman recognizes the current experienced-candidates careers page contract', () => {
  assert.equal(hasOfficialCareersSignal(currentCareersHtml), true)
})

test('Winman extracts the current public openings table', () => {
  const jobs = extractJobs(currentCareersHtml)
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => job.title),
    ['Senior Accountant', 'Electrical Maintenance Supervisor'],
  )
})

test('Winman returns jobs from the verified first-party careers table', async () => {
  const requestedUrls = []

  const jobs = await createWinmanSoftwareScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return currentCareersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'Winman Software')
  assert.equal(jobs[0].applyUrl, 'https://winman.in/jobs/resumedetail.aspx')
})
