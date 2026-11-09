import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  createDassaultSystemsScraper,
  extractIndiaJobs,
} from './script.js'

const jobsHtml = `
  <article data-job-id="548513">
    <a href="/en/careers/jobs/javascript-web-developer-548513">JavaScript Web Developer</a>
    <span>RESEARCH &amp; DEVELOPMENT</span>
    <span>India, MH, Pune</span>
    <span>Regular</span>
  </article>
  <article data-job-id="548514">
    <a href="/en/careers/jobs/software-engineer-cpp-548514">Software Engineer-C++</a>
    <span>RESEARCH &amp; DEVELOPMENT</span>
    <span>India, MH, Pune</span>
    <span>Regular</span>
  </article>
  <article data-job-id="548515">
    <a href="/en/careers/jobs/project-manager-548515">Project Manager</a>
    <span>SERVICES</span>
    <span>United States, NY, New York</span>
    <span>Regular</span>
  </article>
`

test('extracts only India openings from official Dassault Systemes job cards', () => {
  assert.deepEqual(extractIndiaJobs(jobsHtml), [
    {
      jobId: '548513',
      requisitionId: '548513',
      title: 'JavaScript Web Developer',
      company: 'Dassault Systemes',
      department: 'RESEARCH & DEVELOPMENT',
      location: 'India, MH, Pune',
      city: 'Pune',
      country: 'India',
      sourceUrl: 'https://www.3ds.com/en/careers/jobs/javascript-web-developer-548513',
      applyUrl: 'https://www.3ds.com/en/careers/jobs/javascript-web-developer-548513',
      employmentType: 'Regular',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official Dassault Systemes India opening listed on the public careers page.',
      remoteStatus: null,
    },
    {
      jobId: '548514',
      requisitionId: '548514',
      title: 'Software Engineer-C++',
      company: 'Dassault Systemes',
      department: 'RESEARCH & DEVELOPMENT',
      location: 'India, MH, Pune',
      city: 'Pune',
      country: 'India',
      sourceUrl: 'https://www.3ds.com/en/careers/jobs/software-engineer-cpp-548514',
      applyUrl: 'https://www.3ds.com/en/careers/jobs/software-engineer-cpp-548514',
      employmentType: 'Regular',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official Dassault Systemes India opening listed on the public careers page.',
      remoteStatus: null,
    },
  ])
})

test('rejects a response that is not the official careers job search page', async () => {
  const scraper = createDassaultSystemsScraper()

  await assert.rejects(
    scraper.run({ fetchText: async () => '<html><body>Access denied</body></html>' }),
    /official Dassault Systemes careers job search page/i,
  )
})

test('run fetches the official public careers page and decorates India openings', async () => {
  const requests = []
  const scraper = createDassaultSystemsScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)
      return jobsHtml
    },
  })

  assert.deepEqual(requests, [CAREER_PAGE_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'dassaultsystems')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
