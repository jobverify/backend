import assert from 'node:assert/strict'
import test from 'node:test'

import {
  APPLY_NOW_URL,
  CAREERS_URL,
  createLenDenClubScraper,
  extractApplyNowUrl,
  extractKekaJobs,
  hasOfficialCareersSignal,
  hasApplyNowPageSignal,
  KEKA_ACTIVE_JOBS_API_URL,
  KEKA_PORTAL_INFO_URL,
} from '../../scraper/lendenclub/script.js'

const careersHtml = `
  <html>
    <body>
      <h1>Join us, let's change the way India does lending and borrowing!</h1>
      <h2>We invite you to join us in this mission!</h2>
      <h3>Why join LenDenClub?</h3>
      <p>Work Hard, Party Harder</p>
      <a href="https://www.lendenclub.com/careers/apply-now/">View Open Positions</a>
    </body>
  </html>
`

const applyNowHtml = `
  <html>
    <body>
      <h1>Apply for a job</h1>
      <script>
        const khConfig = {
          domain: 'https://lendenclub.keka.com/careers/',
          targetContainer: '#khembedjobs',
        };
      </script>
      <script src="https://lendenclub.keka.com/careers/api/embedjobs/js/4158ab28-dc94-4e09-86d0-c93f72ca0b71"></script>
      <div id="khembedjobs"></div>
    </body>
  </html>
`

const currentCareersHtml = `
  <html><head><title>LenDenClub</title></head><body>
    <h1>Join A Moment, Advance Your Career</h1>
    <p>We're Hiring</p>
    <a href="https://lendenclub.keka.com/careers/">View Open Roles</a>
    <a href="https://lendenclub.keka.com/careers/">View Job Roles</a>
  </body></html>
`

const jobsPayload = [
  {
    id: 134840,
    title: 'Associate (A1)',
    description: '<div>Motion Graphic Designer</div>',
    departmentName: 'Brand Communications & PR',
    excerpt: 'Role summary',
    jobLocations: [
      {
        name: 'Mumbai Corporate Office',
        city: 'Mumbai',
        state: 'MH',
        countryCode: 'IN',
        countryName: 'India',
      },
    ],
    jobType: 2,
    experience: '3-5 Years',
    publishedOn: '2026-07-18T05:29:37.94Z',
    skillNames: ['Digital literacy', 'Brand Management'],
  },
  {
    id: 999999,
    title: 'Remote US Role',
    description: 'Ignore me',
    departmentName: 'Marketing',
    excerpt: 'Ignore me',
    jobLocations: [
      {
        name: 'Remote',
        city: 'New York',
        state: 'NY',
        countryCode: 'US',
        countryName: 'United States',
      },
    ],
    jobType: 2,
    experience: '4-6 Years',
    publishedOn: '2026-07-20T00:00:00.000Z',
    skillNames: [],
  },
]

test('LenDenClub detects its first-party careers shell and apply-now handoff', () => {
  assert.equal(hasOfficialCareersSignal(currentCareersHtml), true)
  assert.equal(extractApplyNowUrl(careersHtml), APPLY_NOW_URL)
  assert.equal(hasApplyNowPageSignal(applyNowHtml), true)
})

test('LenDenClub Keka extraction keeps only India jobs and normalizes output', () => {
  assert.deepEqual(extractKekaJobs(jobsPayload, { now: () => '2026-07-25T00:00:00.000Z' }), [
    {
      title: 'Associate (A1)',
      company: 'LenDenClub',
      department: 'Brand Communications & PR',
      location: 'Mumbai Corporate Office, India',
      city: 'Mumbai',
      country: 'India',
      jobId: '134840',
      requisitionId: '134840',
      sourceUrl: 'https://lendenclub.keka.com/careers/jobdetails/134840',
      applyUrl: 'https://lendenclub.keka.com/careers/jobdetails/134840',
      employmentType: null,
      experienceRequired: '3-5 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Digital literacy', 'Brand Management'],
      postingDate: '2026-07-18T05:29:37.94Z',
      closingDate: null,
      jobDescription: 'Motion Graphic Designer',
      source: 'lendenclub',
      link: 'https://lendenclub.keka.com/careers/jobdetails/134840',
      scrapedAt: '2026-07-25T00:00:00.000Z',
    },
  ])
})

test('LenDenClub run validates the first-party shell and consumes the official Keka active-jobs API', async () => {
  const requested = []

  const jobs = await createLenDenClubScraper().run({
    fetchText: async (url) => {
      requested.push(url)
      if (url === CAREERS_URL) return currentCareersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url) => {
      requested.push(url)
      if (url === KEKA_PORTAL_INFO_URL) return { name: 'LenDenClub', shortName: 'LenDenClub', careersPortalDomain: 'lendenclub.keka.com', companyWebsite: 'https://www.lendenclub.com/' }
      assert.equal(url, KEKA_ACTIVE_JOBS_API_URL)
      return jobsPayload
    },
    now: () => '2026-07-25T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    'https://careers.lendenclub.com/',
    'https://lendenclub.keka.com/careers/api/organization/default/careerportalinfo',
    'https://lendenclub.keka.com/careers/api/jobs/default/active',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'LenDenClub')
})

test('LenDenClub rejects a mismatched Keka tenant', async () => {
  await assert.rejects(createLenDenClubScraper().run({
    fetchText: async () => currentCareersHtml,
    fetchJson: async () => ({ name: 'Other Company', shortName: 'Other Company', careersPortalDomain: 'lendenclub.keka.com' }),
  }), /exact company identity/i)
})
