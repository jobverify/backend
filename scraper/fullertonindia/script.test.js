import assert from 'node:assert/strict'
import test from 'node:test'
import {worklineFixture,worklinePDF} from '../../test/helpers/worklineGoalFixture.js'

import {
  CAREERS_URL,
  JOBS_API_URL,
  JOBS_BOARD_ENTRY_URL,
  REDIRECTED_HOMEPAGE_URL,
  createFullertonIndiaScraper,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
  hasOfficialJobsBoardSignal,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title data-next-head="">SMFG India Credit: Leading Financial Company for Loans</title>
    </head>
    <body>
      <p>SMFG India Credit</p>
      <a href="/careers.aspx">Careers</a>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title data-next-head="">SMFG India Credit Careers - Current Job Openings &amp; Employee Testimonials</title>
    </head>
    <body>
      <p>Careers - SMFG India Credit</p>
      <p>Explore Jobs</p>
      <p>Upload Your Profile</p>
      <a href="https://app52.workline.hr/Candidate/GeneralOpening.aspx">Jobs</a>
    </body>
  </html>
`

const jobsBoardHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>SMFG - Workline - Possibilities Infinite</title>
    </head>
    <body>
      <p>Begin your search for greater opportunities</p>
      <p>Search Jobs</p>
      <p>Post Resume</p>
      <script src="GeneralOpenings.js"></script>
    </body>
  </html>
`

const payload = {
  d: {
    obj1: JSON.stringify([
      worklineFixture.record,
    ]),
    obj2: '[]',
  },
}

test('Fullerton India accepts the current direct SMFG homepage and ampersand-encoded careers title', async () => {
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hasOfficialJobsBoardSignal(jobsBoardHtml), true)

  const jobs = await createFullertonIndiaScraper({ now: () => '2026-08-02T05:30:00.000Z' }).run({
    fetchPage: async (url) => {
      if (url === REDIRECTED_HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === CAREERS_URL) return { status: 200, url, html: careersHtml }
      if (url === JOBS_BOARD_ENTRY_URL) {
        return { status: 200, url: 'https://app52.workline.hr/Cportal/GeneralOpening.aspx', html: jobsBoardHtml }
      }
      if(url===worklineFixture.page.url)return worklineFixture.page
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url) => {
      if (url === JOBS_API_URL) return payload
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchPDF:async()=>worklinePDF,
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, worklineFixture.record.Position_Name)
  assert.ok(jobs[0].jobDescription.length>7000)
})
