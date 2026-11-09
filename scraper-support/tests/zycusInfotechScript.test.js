import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
  <html>
    <head><title>Zycus Careers | Join the Leader in Procurement Software</title></head>
    <body>
      <h1>Careers</h1>
      <p>Select your location for suitable openings</p>
      <a href="https://zycus.talismatic.com/jobs">SEARCH ALL JOBS</a>
    </body>
  </html>
`

const jobsPayload = {
  jobs: [
    {
      id: 'abc123',
      jobCode: 'JJBYABYUCM',
      jobTitle: 'Director - Technical Account Management (APAC)',
      description: '<p>Lead strategic accounts.</p>',
      location: 'Mumbai, Pune & Bangalore',
      employmentType: 'Full Time',
      department: 'Global Delivery',
      experience: '10-15 Years',
      dateCreated: '2026-07-13T21:21:30.317+05:30',
      jobUrl: 'https://zycus.talismatic.com/jobs/abc123',
    },
    {
      id: 'def456',
      jobCode: 'JRL72LMA',
      jobTitle: 'Implementation Consultant - Source-to-Pay (S2P)',
      description: '<p>Germany role.</p>',
      location: 'Germany',
      employmentType: 'Full Time',
      department: 'Global Delivery',
      experience: '5-15 Years',
      dateCreated: '2026-07-13T21:39:09.862+05:30',
      jobUrl: 'https://zycus.talismatic.com/jobs/def456',
    },
  ],
}

test('Zycus Infotech recognizes the verified careers handoff and filters Talismatic jobs to India locations', async () => {
  const zycus = await import('../../scraper/zycusinfotech/script.js')

  assert.equal(zycus.hasOfficialZycusCareersSignals(officialCareersHtml), true)
  assert.deepEqual(zycus.buildJobsRequestBody(), {
    company: 'zycus',
    page_size: 200,
    status: 'OPEN',
  })
  assert.deepEqual(zycus.extractJobs(jobsPayload), [
    {
      title: 'Director - Technical Account Management (APAC)',
      company: 'Zycus Infotech',
      department: 'Global Delivery',
      location: 'Mumbai, Pune & Bangalore',
      city: 'Mumbai, Pune & Bangalore',
      country: 'India',
      jobId: 'abc123',
      requisitionId: 'JJBYABYUCM',
      sourceUrl: 'https://zycus.talismatic.com/jobs/abc123',
      applyUrl: 'https://zycus.talismatic.com/jobs/abc123',
      employmentType: 'Full Time',
      experienceRequired: '10-15 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-13',
      closingDate: null,
      jobDescription: 'Lead strategic accounts.',
    },
  ])
})

test('Zycus Infotech scraper uses the Talismatic APIs and returns India jobs only', async () => {
  const zycus = await import('../../scraper/zycusinfotech/script.js')
  const requested = []

  const jobs = await zycus.createZycusInfotechScraper({
    now: () => '2026-07-18T00:00:00.000Z',
  }).run({
    fetchText: async () => officialCareersHtml,
    fetchJson: async (url, options = {}) => {
      requested.push({ url, options })
      return url === zycus.COMPANY_CONFIG_URL ? { zycus: { slug: 'zycus' } } : jobsPayload
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'zycusinfotech')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(requested[1].url, zycus.JOBS_API_URL)
})
