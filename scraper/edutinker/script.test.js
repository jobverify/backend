import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  createEdutinkerScraper,
  extractJobDetail,
  extractListings,
  hasOfficialCareersSignal,
} from './script.js'

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers - eduTinker</title>
    </head>
    <body>
      <h1>Open Positions</h1>
      <a href="https://edutinker.com/jobs/python-developer/">Python Developer (3-6 years experience)</a>
      <span>Development</span>
      <span>Full Time</span>
      <span>Remote Job</span>
      <a href="/jobs/react-developer/">React Developer (3-5 years experience)</a>
      <footer>Technodemics Smart Solutions Private Limited</footer>
    </body>
  </html>
`

const detailHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <h2>React Developer (3-5 years experience)</h2>
      <div>Job Category: <a>Development</a></div>
      <div>Job Type: <a>Full Time</a></div>
      <div>Job Location: <a>Remote Job</a></div>
      <section>
        <h3>Job Brief</h3>
        <p>Build modern frontend experiences for school operations.</p>
        <ul>
          <li>Create reusable React components.</li>
          <li>Collaborate with product and design teams.</li>
        </ul>
      </section>
      <section>
        <h3>Apply for this position</h3>
        <label>Full Name</label>
        <label>Email</label>
        <label>Upload CV/Resume</label>
      </section>
    </body>
  </html>
`

test('hasOfficialCareersSignal validates the verified Edutinker public careers surface', () => {
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
})

test('extractListings reads first-party Edutinker job links from the careers page', () => {
  const listings = extractListings(careersHtml)

  assert.deepEqual(listings, [
    {
      title: 'Python Developer (3-6 years experience)',
      company: 'Edutinker',
      jobId: 'python-developer',
      requisitionId: 'python-developer',
      sourceUrl: 'https://edutinker.com/jobs/python-developer/',
      applyUrl: 'https://edutinker.com/jobs/python-developer/',
    },
    {
      title: 'React Developer (3-5 years experience)',
      company: 'Edutinker',
      jobId: 'react-developer',
      requisitionId: 'react-developer',
      sourceUrl: 'https://edutinker.com/jobs/react-developer/',
      applyUrl: 'https://edutinker.com/jobs/react-developer/',
    },
  ])
})

test('extractJobDetail maps Edutinker detail-page metadata and same-page apply flow', () => {
  const detail = extractJobDetail(detailHtml, {
    title: 'React Developer (3-5 years experience)',
    jobId: 'react-developer',
    requisitionId: 'react-developer',
    sourceUrl: 'https://edutinker.com/jobs/react-developer/',
  })

  assert.equal(detail.title, 'React Developer (3-5 years experience)')
  assert.equal(detail.department, 'Development')
  assert.equal(detail.location, 'Remote Job')
  assert.equal(detail.city, 'Remote')
  assert.equal(detail.country, 'India')
  assert.equal(detail.employmentType, 'Full Time')
  assert.equal(detail.experienceRequired, '3-5 years experience')
  assert.equal(detail.applyUrl, 'https://edutinker.com/jobs/react-developer/')
  assert.equal(detail.remoteStatus, 'Remote')
  assert.match(detail.jobDescription, /Job Brief/i)
  assert.match(detail.jobDescription, /Create reusable React components/i)
})

test('run fetches the Edutinker careers page and enriches jobs from official detail pages', async () => {
  const requestedUrls = []

  const jobs = await createEdutinkerScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return careersHtml
      if (url === 'https://edutinker.com/jobs/python-developer/') return detailHtml.replace(/React Developer/g, 'Python Developer').replace(/3-5/g, '3-6')
      if (url === 'https://edutinker.com/jobs/react-developer/') return detailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREERS_URL,
    'https://edutinker.com/jobs/python-developer/',
    'https://edutinker.com/jobs/react-developer/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'edutinker')
  assert.equal(jobs[0].link, jobs[0].sourceUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('run fails closed when the Edutinker careers surface changes', async () => {
  await assert.rejects(
    createEdutinkerScraper().run({
      fetchText: async () => '<html><body>No public job links here</body></html>',
    }),
    /verified official public jobs surface/i,
  )
})
