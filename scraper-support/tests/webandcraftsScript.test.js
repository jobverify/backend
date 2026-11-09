import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'webandcrafts',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')
const readJsonFixture = (name) => JSON.parse(readFixture(name))

const homepageHtml = readFixture('homepage.html')
const careersHtml = readFixture('careers.html')
const jobsIndexHtml = readFixture('job-openings.html')
const digitalMarketingPayload = readJsonFixture('digital-marketing.json')
const softwareEngineeringPayload = readJsonFixture('software-engineering.json')

const buildFlightChunkHtml = (payload) => `
  <html>
    <head>
      <title>Infopark Jobs &amp; Vacancies For Freshers &amp; Experienced At WAC</title>
      <link rel="canonical" href="https://webandcrafts.com/careers/job-openings">
    </head>
    <body>
      <h1>Job Openings</h1>
      <script>self.__next_f.push([1,${JSON.stringify(JSON.stringify(payload))}])</script>
    </body>
  </html>
`

const embeddedJobsIndexHtml = buildFlightChunkHtml({
  jobOpenings: [
    {
      id: 10,
      category_name: 'Business Development',
      total_openings: 7,
      is_active: true,
      job_post: [
        {
          id: 78,
          title: 'Senior Account Executive (Outbound)',
          slug: 'senior-account-executive-outbound',
          formatted_experience_range: '5 - 8 years',
          is_active: true,
        },
      ],
    },
    {
      id: 11,
      category_name: 'Software Engineering',
      total_openings: 5,
      is_active: true,
      job_post: [
        {
          id: 64,
          title: 'Software Engineer - React',
          slug: 'software-engineer-react',
          formatted_experience_range: '4+ years',
          is_active: true,
        },
      ],
    },
  ],
})

const loadWebandcraftsModule = async () => {
  try {
    return await import('../../scraper/webandcrafts/script.js')
  } catch {
    assert.fail('Expected Webandcrafts scraper module at ../../scraper/webandcrafts/script.js')
  }
}

test('Webandcrafts sentinels recognize the verified homepage, careers page, and jobs index', async () => {
  const webandcrafts = await loadWebandcraftsModule()

  assert.equal(webandcrafts.SOURCE, 'webandcrafts')
  assert.equal(webandcrafts.COMPANY, 'Webandcrafts')
  assert.equal(webandcrafts.HOMEPAGE_URL, 'https://webandcrafts.com/')
  assert.equal(webandcrafts.CAREERS_URL, 'https://webandcrafts.com/careers')
  assert.equal(webandcrafts.JOBS_INDEX_URL, 'https://webandcrafts.com/careers/job-openings')
  assert.equal(
    webandcrafts.JOBS_API_URL,
    'https://forms.webandcrafts.com/api/careers/career-job-listing',
  )
  assert.equal(webandcrafts.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(webandcrafts.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(webandcrafts.hasOfficialJobsIndexSignal(jobsIndexHtml), true)
})

test('Webandcrafts extracts the verified first-party job categories from the jobs index', async () => {
  const webandcrafts = await loadWebandcraftsModule()

  assert.deepEqual(
    webandcrafts.extractJobCategories(jobsIndexHtml),
    [
      {
        id: 6,
        categoryName: 'Digital Marketing',
        totalOpenings: 3,
      },
      {
        id: 11,
        categoryName: 'Software Engineering',
        totalOpenings: 2,
      },
    ],
  )
})

test('Webandcrafts accepts Monday, August 17, 2026 department payloads when total_openings reflects listing count instead of summed seats', async () => {
  const webandcrafts = await loadWebandcraftsModule()

  const category = {
    id: 10,
    categoryName: 'Business Development',
    totalOpenings: 3,
  }
  const payload = {
    status: true,
    results: {
      total_records: 3,
      data: [
        {
          id: 501,
          is_active: true,
          title: 'Sales Development Representative (Outbound)',
          slug: 'sales-development-representative-outbound',
          requisition_id: 'WAC-BD-SDR-0501',
          number_of_openings: 2,
          location: null,
          job_type: 'On-site',
          formatted_experience_range: '2 - 4 years',
          requirements: '<p>Prospecting experience.</p>',
          technology: [],
          created_at: '2026-08-17',
          about: '<p>Own outbound prospecting.</p>',
          responsibilities: '<ul><li>Build pipeline</li></ul>',
          join_team_content: '<p>Join us.</p>',
          department_id: { name: 'Business Development' },
          wac_pro_job_dept: { id: 10, category_name: 'Business Development' },
        },
        {
          id: 502,
          is_active: true,
          title: 'Sales Development Representative (Inbound+Outbound)',
          slug: 'sales-development-representative-inbound-outbound',
          requisition_id: 'WAC-BD-SDR-0502',
          number_of_openings: 3,
          location: null,
          job_type: 'On-site',
          formatted_experience_range: '2 - 5 years',
          requirements: '<p>Pipeline hygiene.</p>',
          technology: [],
          created_at: '2026-08-17',
          about: '<p>Balance inbound and outbound demand.</p>',
          responsibilities: '<ul><li>Qualify leads</li></ul>',
          join_team_content: '<p>Grow revenue.</p>',
          department_id: { name: 'Business Development' },
          wac_pro_job_dept: { id: 10, category_name: 'Business Development' },
        },
        {
          id: 503,
          is_active: true,
          title: 'Senior Account Executive (Outbound)',
          slug: 'senior-account-executive-outbound',
          requisition_id: 'WAC-BD-AE-0503',
          number_of_openings: 2,
          location: null,
          job_type: 'On-site',
          formatted_experience_range: '5 - 8 years',
          requirements: '<p>Enterprise closing experience.</p>',
          technology: [],
          created_at: '2026-08-17',
          about: '<p>Own complex outbound opportunities.</p>',
          responsibilities: '<ul><li>Close deals</li></ul>',
          join_team_content: '<p>Scale with WAC.</p>',
          department_id: { name: 'Business Development' },
          wac_pro_job_dept: { id: 10, category_name: 'Business Development' },
        },
      ],
    },
  }

  const jobs = webandcrafts.extractDepartmentJobs(payload, category)

  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.department, job.location, job.country]),
    [
      ['Sales Development Representative (Outbound)', 'Business Development', null, null],
      ['Sales Development Representative (Inbound+Outbound)', 'Business Development', null, null],
      ['Senior Account Executive (Outbound)', 'Business Development', null, null],
    ],
  )
})

test('Webandcrafts maps the first-party department API payloads into distinct public job postings', async () => {
  const webandcrafts = await loadWebandcraftsModule()
  const [digitalMarketingCategory, softwareEngineeringCategory] = webandcrafts.extractJobCategories(jobsIndexHtml)

  const digitalMarketingJobs = webandcrafts.extractDepartmentJobs(
    digitalMarketingPayload,
    digitalMarketingCategory,
  )
  const softwareEngineeringJobs = webandcrafts.extractDepartmentJobs(
    softwareEngineeringPayload,
    softwareEngineeringCategory,
  )

  assert.equal(digitalMarketingJobs.length, 2)
  assert.equal(softwareEngineeringJobs.length, 2)

  const socialMediaAnalyst = digitalMarketingJobs.find((job) => job.title === 'Social Media Analyst')
  const reactEngineer = softwareEngineeringJobs.find((job) => job.title === 'Software Engineer - React')

  assert.deepEqual(
    (({
      title,
      department,
      location,
      city,
      country,
      jobId,
      requisitionId,
      sourceUrl,
      applyUrl,
      experienceRequired,
      remoteStatus,
      requiredSkills,
    }) => ({
      title,
      department,
      location,
      city,
      country,
      jobId,
      requisitionId,
      sourceUrl,
      applyUrl,
      experienceRequired,
      remoteStatus,
      requiredSkills,
    }))(socialMediaAnalyst),
    {
      title: 'Social Media Analyst',
      department: 'Digital Marketing',
      location: null,
      city: null,
      country: null,
      jobId: 'WAC-DM-SOC-2424',
      requisitionId: 'WAC-DM-SOC-2424',
      sourceUrl: 'https://webandcrafts.com/careers/job-openings/social-media-analyst?job_id=42&dept=6',
      applyUrl: 'https://webandcrafts.com/careers/job-openings/social-media-analyst?job_id=42&dept=6',
      experienceRequired: '2 - 5 years',
      remoteStatus: 'On-site',
      requiredSkills: [],
    },
  )

  assert.equal(reactEngineer.department, 'Software Engineering')
  assert.equal(reactEngineer.location, null)
  assert.equal(reactEngineer.city, null)
  assert.equal(reactEngineer.requisitionId, 'WAC-RACT-SOF-0645')
  assert.equal(
    reactEngineer.sourceUrl,
    'https://webandcrafts.com/careers/job-openings/software-engineer-react?job_id=64&dept=11',
  )
  assert.equal(reactEngineer.remoteStatus, 'On-site')
  assert.equal(reactEngineer.minimumQualification.includes('4+ years of experience in ReactJS.'), true)
  assert.equal(reactEngineer.jobDescription.includes('About:'), true)
  assert.equal(reactEngineer.jobDescription.includes('Responsibilities:'), true)
  assert.equal(reactEngineer.jobDescription.includes('Requirements:'), true)
})

test('Webandcrafts normalizes a first-party API opening into the shared scraper contract', async () => {
  const webandcrafts = await loadWebandcraftsModule()
  const opening = webandcrafts.extractDepartmentJobs(
    softwareEngineeringPayload,
    webandcrafts.extractJobCategories(jobsIndexHtml)[1],
  )[0]

  const normalized = normalizeScrapedJob(opening, {
    source: 'webandcrafts',
    companyName: 'Webandcrafts',
    companyCareerPage: 'https://webandcrafts.com/careers/job-openings',
    atsPlatform: 'webandcrafts-first-party-careers-api',
    countryFilter: 'India',
  })

  assert.equal(normalized.company, 'Webandcrafts')
  assert.equal(normalized.country, null)
  assert.equal(normalized.remoteStatus, 'On-site')
  assert.equal(normalized.jobType, 'Full-time Experienced')
})

test('Webandcrafts cannot promote an index-only fixture or fall back to the legacy forms API', async () => {
  const scraper = await loadWebandcraftsModule()
  let apiReads = 0
  const jobs = await scraper.run({requestIntervalMs:0,
    fetchText: async url => url === scraper.HOMEPAGE_URL ? homepageHtml : url === scraper.CAREERS_URL ? careersHtml : embeddedJobsIndexHtml,
    fetchJson: async () => { apiReads++; throw Error('Legacy API must not be read') },
  })
  assert.equal(jobs.length,0)
  assert.equal(apiReads,0)
  assert.equal(jobs[Symbol.for('jobverify.verified-recruitment-observations')].sourceScopeComplete,false)
})
