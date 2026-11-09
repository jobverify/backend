import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_PAGE_URL,
  HOMEPAGE_URL,
  createEmeritusScraper,
  extractIndiaJobs,
  extractJobListData,
  hasOfficialHomepageSignal,
  hasOfficialJobsPageSignal,
} from './script.js'

const homepageHtml = `
  <html lang="en-US">
    <head>
      <title>Careers at Emeritus</title>
    </head>
    <body>
      <a href="https://careers.emeritus.org/jobs/">Current Openings</a>
    </body>
  </html>
`

const embeddedRecords = [
  {
    job_id: 'a6a4d29211c8c9',
    job_code: 'Job ID_732',
    group_company: 'Emeritus',
    department: 'Admissions_JV',
    location: ['Gurugram, Haryana, India (OL_75)'],
    location_city: ['Gurugram'],
    location_country: 'India',
    job_title: 'Admission Manager_ Victoria University Delhi NCR.',
    post_on_careers_page: 1,
    employee_type: 'Permanent',
    job_created_timestamp: '07-07-2026 21:58:17',
    experience_to: '15',
    experience_from: '5',
    is_remote: 0,
  },
  {
    job_id: 'a6a4b41c5b86bb',
    job_code: 'Job ID_729',
    group_company: 'Emeritus',
    department: 'Revenue | Revenue',
    location: ['Bangalore, Karnataka, India (OL_10)'],
    location_city: ['Bangalore'],
    location_country: 'India',
    job_title: 'Program Manager - Strategy & Growth',
    post_on_careers_page: 1,
    employee_type: 'Permanent',
    job_created_timestamp: '06-07-2026 11:18:53',
    experience_to: '8',
    experience_from: '4',
    is_remote: 0,
  },
  {
    job_id: 'a6a42c3213049b',
    job_code: 'Job ID_721',
    group_company: 'Emeritus',
    department: 'Learning | Design',
    location: ['Boston, Massachusetts, United States (OL_4)'],
    location_city: ['Boston'],
    location_country: 'United States',
    job_title: 'Instructional Designer',
    post_on_careers_page: 1,
    employee_type: 'Permanent',
    job_created_timestamp: '30-06-2026 00:40:25',
    experience_to: '10',
    experience_from: '3',
    is_remote: 1,
  },
]

const jobsPageHtml = `
  <html lang="en-US">
    <head>
      <title>Current Openings - Emeritus Careers</title>
    </head>
    <body>
      <script>
        var jobListData = ${JSON.stringify(embeddedRecords)};
      </script>
      <p>"location_country":"India"</p>
    </body>
  </html>
`

test('Emeritus constants stay pinned to the verified official careers surfaces', () => {
  assert.equal(HOMEPAGE_URL, 'https://careers.emeritus.org/')
  assert.equal(CAREERS_PAGE_URL, 'https://careers.emeritus.org/jobs/')
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialJobsPageSignal(jobsPageHtml), true)
})

test('extractJobListData reads the embedded Emeritus jobs payload and keeps only public India openings', () => {
  assert.deepEqual(extractJobListData(jobsPageHtml), embeddedRecords)
  assert.deepEqual(extractIndiaJobs(embeddedRecords), [
    {
      title: 'Admission Manager_ Victoria University Delhi NCR.',
      company: 'Emeritus',
      department: 'Admissions_JV',
      location: 'Gurugram, Haryana, India',
      city: 'Gurugram',
      country: 'India',
      jobId: 'a6a4d29211c8c9',
      requisitionId: 'Job ID_732',
      sourceUrl: 'https://careers.emeritus.org/jobs/',
      applyUrl: 'https://careers.emeritus.org/jobs/',
      employmentType: 'Full-time',
      experienceRequired: '5-15 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-07',
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Program Manager - Strategy & Growth',
      company: 'Emeritus',
      department: 'Revenue | Revenue',
      location: 'Bangalore, Karnataka, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'a6a4b41c5b86bb',
      requisitionId: 'Job ID_729',
      sourceUrl: 'https://careers.emeritus.org/jobs/',
      applyUrl: 'https://careers.emeritus.org/jobs/',
      employmentType: 'Full-time',
      experienceRequired: '4-8 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-06',
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])
})

test('run verifies the official Emeritus surfaces before reading embedded India openings', async () => {
  const requestedUrls = []
  const jobs = await createEmeritusScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREERS_PAGE_URL) return jobsPageHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-08T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_PAGE_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'emeritus')
  assert.equal(jobs[0].scrapedAt, '2026-07-08T00:00:00.000Z')
})

test('run fails closed when the verified Emeritus jobs page signal disappears', async () => {
  await assert.rejects(
    createEmeritusScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        return '<html><body>No embedded listings</body></html>'
      },
    }),
    /embedded listings surface/i,
  )
})
