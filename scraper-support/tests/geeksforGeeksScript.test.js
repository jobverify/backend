import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T12:30:00.000Z'

const jobsPagePayload = {
  props: {
    pageProps: {
      activeJobData: {
        count: 3,
        next: 'https://practiceapi.geeksforgeeks.org/api/vr/jobs/?page=2&status=active',
        previous: null,
        results: [
          {
            job_id: '696e254f91a25b9d23a9b93f',
            organization: {
              name: 'GeeksforGeeks',
              website: 'https://www.geeksforgeeks.org/',
            },
            slug: 'geeksforgeeks-academic-operations',
            location: [
              'Pune (Maharashtra)',
              'Noida (Uttar Pradesh)',
            ],
            salary: '20K per month',
            experience: '0.5 Years',
            last_apply_date: '2026-07-31T00:00:00',
            description:
              '<p>GeeksforGeeks is looking for enthusiastic interns.</p><ul><li>Conduct doubt sessions.</li><li>Coordinate with mentors.</li></ul>',
            job_type: 'Technology & Engineering',
            designation: {
              text: 'Teaching Assistant Intern',
            },
            employment_type: 'Internship',
            location_type: 'Onsite',
            skills: ['MongoDB', 'React.js'],
          },
          {
            job_id: 'outside-company-role',
            organization: {
              name: 'Other Company',
              website: 'https://example.com/',
            },
            slug: 'other-company-job',
            location: ['Bengaluru (Karnataka)'],
            salary: 'As per industry standard',
            experience: '2 Years',
            last_apply_date: '2026-07-25T00:00:00',
            description: '<p>Ignore this listing.</p>',
            job_type: 'Technology & Engineering',
            designation: {
              text: 'Ignored Role',
            },
            employment_type: 'Full Time',
            location_type: 'Onsite',
            skills: ['Node.js'],
          },
        ],
      },
    },
  },
}

const jobsPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>GfG Get Hired</title>
    <link rel="canonical" href="https://www.geeksforgeeks.org/jobs/">
  </head>
  <body>
    <h1>Job Portal by GfG</h1>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(jobsPagePayload)}</script>
  </body>
</html>
`

const pageTwoPayload = {
  count: 3,
  next: null,
  previous: 'https://practiceapi.geeksforgeeks.org/api/vr/jobs/?status=active',
  results: [
    {
      job_id: '6970ba6084183920447a6bee',
      organization: {
        name: 'GeeksforGeeks',
        website: 'https://www.geeksforgeeks.org/',
      },
      slug: 'geeksforgeeks-mentor-0704',
      location: [],
      salary: 'As per industry standard',
      experience: '1 - 2 Years',
      last_apply_date: '2026-07-31T00:00:00',
      description:
        '<p>Guide learners remotely.</p><ul><li>Support architecture students.</li></ul>',
      job_type: 'Technology & Engineering',
      designation: {
        text: 'Mentor',
      },
      employment_type: 'Freelancer',
      location_type: 'Remote',
      skills: ['Architectural Design', 'Data Modeling'],
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/geeksforgeeks/script.js')
  } catch {
    assert.fail('Expected GeeksforGeeks scraper module at ../../scraper/geeksforgeeks/script.js')
  }
}

test('GeeksforGeeks helpers keep the first-party jobs payload and normalization contract explicit', async () => {
  const geeksForGeeks = await loadModule()

  assert.equal(geeksForGeeks.SOURCE, 'geeksforgeeks')
  assert.equal(geeksForGeeks.COMPANY, 'GeeksforGeeks')
  assert.equal(geeksForGeeks.HOMEPAGE_URL, 'https://www.geeksforgeeks.org/about/')
  assert.equal(geeksForGeeks.JOBS_PAGE_URL, 'https://www.geeksforgeeks.org/jobs/')
  assert.equal(
    geeksForGeeks.JOBS_API_URL,
    'https://practiceapi.geeksforgeeks.org/api/vr/jobs/?status=active',
  )
  assert.equal(geeksForGeeks.COMPANY_DOMAIN, 'geeksforgeeks.org')
  assert.equal(geeksForGeeks.COUNTRY_FILTER, 'India')
  assert.equal(geeksForGeeks.VERIFIED_ON, '2026-07-16')
  assert.match(geeksForGeeks.VERIFIED_SURFACE_SUMMARY, /7 active GeeksforGeeks jobs/i)
  assert.equal(geeksForGeeks.hasJobsPageSignal(jobsPageHtml), true)
  assert.deepEqual(geeksForGeeks.extractSeedJobPage(jobsPageHtml), {
    count: 3,
    next: 'https://practiceapi.geeksforgeeks.org/api/vr/jobs/?page=2&status=active',
    previous: null,
    results: jobsPagePayload.props.pageProps.activeJobData.results,
  })
  assert.deepEqual(
    geeksForGeeks.normalizeJob(jobsPagePayload.props.pageProps.activeJobData.results[0]),
    {
      title: 'Teaching Assistant Intern',
      company: 'GeeksforGeeks',
      department: 'Technology & Engineering',
      location: 'Pune, Maharashtra, India / Noida, Uttar Pradesh, India',
      city: 'Pune',
      jobId: '696e254f91a25b9d23a9b93f',
      requisitionId: '696e254f91a25b9d23a9b93f',
      sourceUrl: 'https://www.geeksforgeeks.org/jobs/geeksforgeeks-academic-operations',
      applyUrl: 'https://www.geeksforgeeks.org/jobs/geeksforgeeks-academic-operations',
      employmentType: 'Internship',
      experienceRequired: '0.5 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['MongoDB', 'React.js'],
      postingDate: null,
      closingDate: '2026-07-31',
      jobDescription:
        'GeeksforGeeks is looking for enthusiastic interns. Conduct doubt sessions. Coordinate with mentors.',
      companyCareerPage: 'https://www.geeksforgeeks.org/jobs/',
      companyDomain: 'geeksforgeeks.org',
      atsPlatform: 'official-company-careers-api',
    },
  )
})

test('GeeksforGeeks run validates the jobs page, follows next-link pagination, and filters to company-owned roles', async () => {
  const geeksForGeeks = await loadModule()
  const requestedUrls = []

  const jobs = await geeksForGeeks.createGeeksforGeeksScraper({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === geeksForGeeks.JOBS_PAGE_URL) return jobsPageHtml
      throw new Error(`Unexpected GeeksforGeeks text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === 'https://practiceapi.geeksforgeeks.org/api/vr/jobs/?page=2&status=active') {
        return pageTwoPayload
      }
      throw new Error(`Unexpected GeeksforGeeks JSON URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  }).run()

  assert.deepEqual(requestedUrls, [
    geeksForGeeks.JOBS_PAGE_URL,
    'https://practiceapi.geeksforgeeks.org/api/vr/jobs/?page=2&status=active',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [job.jobId, job.title, job.location]),
    [
      [
        '696e254f91a25b9d23a9b93f',
        'Teaching Assistant Intern',
        'Pune, Maharashtra, India / Noida, Uttar Pradesh, India',
      ],
      ['6970ba6084183920447a6bee', 'Mentor', 'Remote'],
    ],
  )
  assert.equal(jobs[0].source, 'geeksforgeeks')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[1].employmentType, 'Freelancer')
  assert.deepEqual(jobs[1].requiredSkills, ['Architectural Design', 'Data Modeling'])
})

test('GeeksforGeeks fails closed when the jobs page payload contract drifts', async () => {
  const geeksForGeeks = await loadModule()

  await assert.rejects(
    geeksForGeeks.createGeeksforGeeksScraper({
      fetchText: async () => '<html><body><h1>Jobs</h1></body></html>',
      fetchJson: async () => pageTwoPayload,
    }).run(),
    /jobs page no longer matches/i,
  )
})
