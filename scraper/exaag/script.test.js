import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  createExaAgScraper,
  extractIndiaJobs,
  hasOfficialExaAgJobsPageShape,
} from './script.js'

const careersHtml = `
  <html>
    <head>
      <title>Jobs Archive - EXA AG</title>
    </head>
    <body>
      <main>
        <h2>Join EXA AG</h2>
        <h2>Open Positions</h2>

        <h3>Heidelberg</h3>
        <p>Germany</p>
        <article>
          <h4>SAP FI/CO Senior Consultant (m/f/d)</h4>
          <ul>
            <li>January 2026,</li>
            <li>fulltime,</li>
            <li>hybrid</li>
          </ul>
          <a href="https://exa-ag.com/career/jobs/sap-fi-co-senior-consultant/">Details</a>
        </article>

        <h3>Bangalore</h3>
        <p>India</p>
        <article>
          <h4>SAP Datasphere Consultant</h4>
          <ul>
            <li>June 2026,</li>
            <li>fulltime,</li>
            <li>hybrid</li>
          </ul>
          <a href="https://exa-ag.com/career/jobs/sap-datasphere-consultant/">Details</a>
        </article>
        <article>
          <h4>Project Manager Data Transformation</h4>
          <ul>
            <li>April 2026,</li>
            <li>Fulltime,</li>
            <li>Hybrid</li>
          </ul>
          <a href="https://exa-ag.com/career/jobs/project-manager-data-transformation/">Details</a>
        </article>
        <article>
          <h4>Webmaster &amp; Content Specialist (SEO Focus)</h4>
          <ul>
            <li>full time/ part time ,</li>
            <li>Hybrid</li>
          </ul>
          <a href="https://exa-ag.com/career/jobs/https-exa-ag-com-career-jobs-webmaster/">Details</a>
        </article>

        <h3>West Chester</h3>
        <p>USA</p>
      </main>
    </body>
  </html>
`

test('validates the official EXA AG jobs archive shape', () => {
  assert.equal(CAREER_PAGE_URL, 'https://exa-ag.com/career/jobs/')
  assert.equal(hasOfficialExaAgJobsPageShape(careersHtml), true)
  assert.equal(hasOfficialExaAgJobsPageShape('<html><title>Jobs</title></html>'), false)
})

test('extractIndiaJobs returns only Bangalore jobs from the official EXA AG archive', () => {
  assert.deepEqual(extractIndiaJobs(careersHtml), [
    {
      title: 'SAP Datasphere Consultant',
      company: 'EXA AG',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'sap-datasphere-consultant',
      requisitionId: 'sap-datasphere-consultant',
      sourceUrl: 'https://exa-ag.com/career/jobs/sap-datasphere-consultant/',
      applyUrl: 'https://exa-ag.com/career/jobs/sap-datasphere-consultant/',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'Hybrid',
    },
    {
      title: 'Project Manager Data Transformation',
      company: 'EXA AG',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'project-manager-data-transformation',
      requisitionId: 'project-manager-data-transformation',
      sourceUrl: 'https://exa-ag.com/career/jobs/project-manager-data-transformation/',
      applyUrl: 'https://exa-ag.com/career/jobs/project-manager-data-transformation/',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'Hybrid',
    },
    {
      title: 'Webmaster & Content Specialist (SEO Focus)',
      company: 'EXA AG',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'https-exa-ag-com-career-jobs-webmaster',
      requisitionId: 'https-exa-ag-com-career-jobs-webmaster',
      sourceUrl: 'https://exa-ag.com/career/jobs/https-exa-ag-com-career-jobs-webmaster/',
      applyUrl: 'https://exa-ag.com/career/jobs/https-exa-ag-com-career-jobs-webmaster/',
      employmentType: 'Full-time / Part-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'Hybrid',
    },
  ])
})

const currentCareersHtml = `
  <html>
    <head>
      <title>Jobs Archive - EXA AG</title>
    </head>
    <body>
      <main>
        <h2>Join EXA AG</h2>
        <h2>Open Positions</h2>

        <h3>Heidelberg<br><span>Germany</span></h3>
        <article>
          <span>SAP FI/CO Senior Consultant (m/f/d)</span>
          <ul>
            <li>July 2026,</li>
            <li>fulltime,</li>
            <li>hybrid</li>
          </ul>
          <a href="https://exa-ag.com/career/jobs/sap-fi-co-senior-consultant/">Details</a>
        </article>

        <h3>Bangalore<br><span>India</span></h3>
        <article>
          <span>SAP ABAP/RAP/BTP Consultant (m/f/d)</span>
          <ul>
            <li>July 2026,</li>
            <li>fulltime,</li>
            <li>hybrid</li>
          </ul>
          <a href="https://exa-ag.com/career/jobs/sap-abap-technical-consultant/">Details</a>
        </article>
        <article>
          <span>Finance Solution Architect (m/f/d)</span>
          <ul>
            <li>July 2026,</li>
            <li>fulltime,</li>
            <li>hybrid</li>
          </ul>
          <a href="https://exa-ag.com/career/jobs/finance-solution-architect/">Details</a>
        </article>

        <h3>Remote<br><span>Americas</span></h3>
        <p>Contact EXA Experts</p>
      </main>
    </body>
  </html>
`

test('extractIndiaJobs accepts the current EXA AG Bangalore heading and stops before the Remote Americas section', () => {
  assert.equal(hasOfficialExaAgJobsPageShape(currentCareersHtml), true)
  assert.deepEqual(extractIndiaJobs(currentCareersHtml), [
    {
      title: 'SAP ABAP/RAP/BTP Consultant (m/f/d)',
      company: 'EXA AG',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'sap-abap-technical-consultant',
      requisitionId: 'sap-abap-technical-consultant',
      sourceUrl: 'https://exa-ag.com/career/jobs/sap-abap-technical-consultant/',
      applyUrl: 'https://exa-ag.com/career/jobs/sap-abap-technical-consultant/',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'Hybrid',
    },
    {
      title: 'Finance Solution Architect (m/f/d)',
      company: 'EXA AG',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'finance-solution-architect',
      requisitionId: 'finance-solution-architect',
      sourceUrl: 'https://exa-ag.com/career/jobs/finance-solution-architect/',
      applyUrl: 'https://exa-ag.com/career/jobs/finance-solution-architect/',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'Hybrid',
    },
  ])
})

test('run validates the official EXA AG archive before returning jobs', async () => {
  const requests = []
  const jobs = await createExaAgScraper().run({
    fetchText: async (url) => {
      requests.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requests, [CAREER_PAGE_URL])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'exaag')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('run returns no jobs when the verified EXA AG jobs archive is temporarily unavailable', async () => {
  const jobs = await createExaAgScraper().run({
    fetchText: async () => {
      throw new Error(`HTTP 500 for ${CAREER_PAGE_URL}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('fails closed when the EXA AG jobs archive no longer matches the verified public shape', async () => {
  await assert.rejects(
    createExaAgScraper().run({
      fetchText: async () => '<html><body><h1>Unavailable</h1></body></html>',
    }),
    /EXA AG jobs archive shape/i,
  )
})
