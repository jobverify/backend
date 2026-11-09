import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BOARD_URL,
  CAREERS_URL,
  COMPANY,
  SOURCE,
  createWorkplaceOptionScraper,
  extractBoardJobs,
  hasOfficialCareersSignal,
  hasVerifiedBoardSignal,
} from './script.js'

const officialCareersHtml = `
  <html>
    <head>
      <title>--> <!-- --> <!-- &raquo; Blog Archive --> <!-- --> <!--</title>
      <title>Careers - Workplace Options</title>
      <link rel="canonical" href="https://www.workplaceoptions.com/careers/" />
    </head>
    <body>
      <h1>Careers at Workplace Options</h1>
      <p>Unlock your potential while helping people live healthier and more productive lives</p>
      <a href="https://workplaceoptions.applytojob.com/apply/">View all Jobs</a>
      <section>
        <h2>Areas of work</h2>
        <p>Information Technology</p>
      </section>
      <section>
        <h2>Global Offices</h2>
        <p>Bangalore</p>
      </section>
      <footer>Powered by care, connection, and community.</footer>
    </body>
  </html>
`

const boardHtml = `
  <html>
    <head><title>Workplace Options - Career Page</title></head>
    <body>
      <a href="#job_description">Skip To Job Description</a>
      <a href="https://www.workplaceoptions.com/">View Our Website</a>
      <p>Start your journey with us by browsing available jobs.</p>
      <h2>Current Openings</h2>
      <ul>
        <li>
          <h3><a href="/apply/ENG001/Senior-Software-Engineer">Senior Software Engineer</a></h3>
          <div>Bangalore, Karnataka, India</div>
          <div>IT</div>
        </li>
        <li>
          <h3><a href="/apply/ENG001/Senior-Software-Engineer">Senior Software Engineer</a></h3>
          <div>Bangalore, Karnataka, India</div>
          <div>IT</div>
        </li>
        <li>
          <h3><a href="/apply/ENG002/Automation-Engineer">Automation Engineer</a></h3>
          <div>Bangalore, Karnataka, India</div>
          <div>IT</div>
        </li>
        <li>
          <h3><a href="/apply/ENG003/Senior-Proposal-Specialist-US-shifts">Senior Proposal Specialist - US shifts</a></h3>
          <div>Bangalore, Karnataka, India</div>
          <div>Sales</div>
        </li>
        <li>
          <h3><a href="/apply/REMOTE01/Clinical-Counsellor">Clinical Counsellor</a></h3>
          <div>Remote</div>
          <div>Mental Health</div>
        </li>
        <li>
          <h3><a href="/apply/USONLY01/Benefits-Manager">Benefits Manager</a></h3>
          <div>Raleigh, NC</div>
          <div>Human Resources</div>
        </li>
      </ul>
      <footer><span>Powered by</span> <img alt="JazzHr" src="/img/v1.1/logos/jazzhr-logo.png" /></footer>
    </body>
  </html>
`

test('validates the verified Workplace Options careers page and official JazzHR board', () => {
  assert.equal(SOURCE, 'workplaceoption')
  assert.equal(COMPANY, 'Workplace Options')
  assert.equal(CAREERS_URL, 'https://www.workplaceoptions.com/careers/')
  assert.equal(BOARD_URL, 'https://workplaceoptions.applytojob.com/apply/')
  assert.equal(hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(hasOfficialCareersSignal('<html><body>Careers</body></html>'), false)
  assert.equal(hasVerifiedBoardSignal(boardHtml), true)
  assert.equal(hasVerifiedBoardSignal('<html><body>Jobs</body></html>'), false)
})

test('extractBoardJobs keeps unique India roles from the official JazzHR board only', () => {
  assert.deepEqual(extractBoardJobs(boardHtml), [
    {
      title: 'Senior Software Engineer',
      company: 'Workplace Options',
      department: 'IT',
      location: 'Bangalore, Karnataka, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'ENG001',
      requisitionId: 'ENG001',
      sourceUrl: 'https://workplaceoptions.applytojob.com/apply/ENG001/Senior-Software-Engineer',
      applyUrl: 'https://workplaceoptions.applytojob.com/apply/ENG001/Senior-Software-Engineer',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Automation Engineer',
      company: 'Workplace Options',
      department: 'IT',
      location: 'Bangalore, Karnataka, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'ENG002',
      requisitionId: 'ENG002',
      sourceUrl: 'https://workplaceoptions.applytojob.com/apply/ENG002/Automation-Engineer',
      applyUrl: 'https://workplaceoptions.applytojob.com/apply/ENG002/Automation-Engineer',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Senior Proposal Specialist - US shifts',
      company: 'Workplace Options',
      department: 'Sales',
      location: 'Bangalore, Karnataka, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'ENG003',
      requisitionId: 'ENG003',
      sourceUrl: 'https://workplaceoptions.applytojob.com/apply/ENG003/Senior-Proposal-Specialist-US-shifts',
      applyUrl: 'https://workplaceoptions.applytojob.com/apply/ENG003/Senior-Proposal-Specialist-US-shifts',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])
})

test('run validates both verified surfaces before decorating extracted India jobs', async () => {
  const requestedUrls = []
  const jobs = await createWorkplaceOptionScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return officialCareersHtml
      if (url === BOARD_URL) return boardHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL, BOARD_URL])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'workplaceoption')
  assert.equal(jobs[0].company, 'Workplace Options')
  assert.equal(jobs[0].companyCareerPage, CAREERS_URL)
  assert.equal(jobs[0].companyDomain, 'workplaceoptions.com')
  assert.equal(jobs[0].atsPlatform, 'official-careers-page-plus-jazzhr-board')
  assert.equal(
    jobs[0].link,
    'https://workplaceoptions.applytojob.com/apply/ENG001/Senior-Software-Engineer',
  )
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('run fails closed when the verified Workplace Options careers page drifts', async () => {
  await assert.rejects(
    createWorkplaceOptionScraper().run({
      fetchText: async (url) => (url === CAREERS_URL ? '<html><body>Careers</body></html>' : boardHtml),
    }),
    /verified Workplace Options careers page/i,
  )
})

test('run fails closed when the official JazzHR board drifts', async () => {
  await assert.rejects(
    createWorkplaceOptionScraper().run({
      fetchText: async (url) => (url === CAREERS_URL ? officialCareersHtml : '<html><body>Jobs</body></html>'),
    }),
    /verified Workplace Options JazzHR board/i,
  )
})
