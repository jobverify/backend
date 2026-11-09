import assert from 'node:assert/strict'
import test from 'node:test'

const jobsPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Harness: Open Positions &amp; Job Opportunities</title>
  </head>
  <body>
    <main>
      <h1>We’re Hiring!</h1>
      <p>Thinking about pursing a career opportunity at Harness?</p>
      <button>View More Positions</button>
    </main>
    <script src="https://cms.harness.io/js/greenhouse.js"></script>
  </body>
</html>
`

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Harness — Join the AI-Native DevOps Team</title>
  </head>
  <body>
    <main>
      <h1>Careers at Harness</h1>
      <p>Life at Harness</p>
      <a href="https://boards.greenhouse.io/harnessinc">See open positions</a>
    </main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 5137484007,
      title: 'Director of Quality Engineering & Automation',
      company_name: 'Harness ',
      absolute_url: 'https://www.harness.io/company/jobs/apply?gh_jid=5137484007&gh_jid=5137484007',
      location: { name: 'Bengaluru, Karnataka, India' },
      offices: [{ location: 'Bengaluru, Karnataka, India' }],
      departments: [{ name: 'Software Development' }],
      updated_at: '2026-07-06T03:24:29-04:00',
      first_published: '2026-07-05T03:24:29-04:00',
      requisition_id: 'R5137484007',
      content: '<p>Lead quality engineering automation across the Harness platform.</p>',
      metadata: [
        {
          name: 'Employment Type',
          value: 'Full-time',
        },
      ],
    },
    {
      id: 5121055007,
      title: 'Engineering Manager - CI',
      company_name: 'Harness ',
      absolute_url: 'https://www.harness.io/company/jobs/apply?gh_jid=5121055007',
      location: { name: 'San Francisco, California, United States' },
      offices: [{ location: 'San Francisco, California, United States' }],
      departments: [{ name: 'Software Development' }],
      updated_at: '2026-07-06T03:24:29-04:00',
      first_published: '2026-07-05T03:24:29-04:00',
      requisition_id: 'R5121055007',
      content: '<p>Lead continuous integration engineering in San Francisco.</p>',
      metadata: [
        {
          name: 'Employment Type',
          value: 'Full-time',
        },
      ],
    },
  ],
}

const loadHarnessModule = async () => {
  try {
    return await import('../../scraper/harness/script.js')
  } catch {
    assert.fail('Expected Harness scraper module at ../../scraper/harness/script.js')
  }
}

test('Harness helpers stay pinned to the verified first-party pages and Greenhouse contract from July 16, 2026', async () => {
  const harness = await loadHarnessModule()

  assert.equal(harness.SOURCE, 'harness')
  assert.equal(harness.COMPANY, 'Harness')
  assert.equal(harness.OFFICIAL_BRAND_NAME, 'Harness')
  assert.equal(harness.JOBS_URL, 'https://www.harness.io/company/jobs')
  assert.equal(harness.CAREERS_URL, 'https://www.harness.io/company/careers')
  assert.equal(harness.GREENHOUSE_BOARD_URL, 'https://boards.greenhouse.io/harnessinc')
  assert.equal(
    harness.GREENHOUSE_JOBS_API_URL,
    'https://boards-api.greenhouse.io/v1/boards/harnessinc/jobs',
  )
  assert.equal(harness.VERIFIED_ON, '2026-07-16')
  assert.match(harness.VERIFIED_SURFACE_SUMMARY, /31 India roles/i)
  assert.equal(harness.hasOfficialJobsPageSignal(jobsPageHtml), true)
  assert.equal(harness.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(harness.extractGreenhouseBoardUrl(careersPageHtml), harness.GREENHOUSE_BOARD_URL)
  assert.equal(
    harness.normalizeHarnessApplyUrl(
      'https://www.harness.io/company/jobs/apply?gh_jid=5137484007&gh_jid=5137484007',
      5137484007,
    ),
    'https://www.harness.io/company/jobs/apply?gh_jid=5137484007',
  )
})

test('Harness extracts only India jobs from the live Greenhouse payload contract and preserves first-party apply URLs', async () => {
  const harness = await loadHarnessModule()
  const jobs = harness.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
    scrapedAt: '2026-07-16T18:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Director of Quality Engineering & Automation',
      company: 'Harness',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bangalore',
      country: 'India',
      link: 'https://www.harness.io/company/jobs/apply?gh_jid=5137484007',
      applyUrl: 'https://www.harness.io/company/jobs/apply?gh_jid=5137484007',
      sourceUrl: 'https://www.harness.io/company/jobs/apply?gh_jid=5137484007',
      source: 'harness',
      jobId: 5137484007,
      requisitionId: 'R5137484007',
      department: 'Software Development',
      employmentType: 'Full-time',
      experienceRequired: null,
      jobDescription: 'Lead quality engineering automation across the Harness platform.',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-06T03:24:29-04:00',
      closingDate: null,
      remoteStatus: 'On-site',
      scrapedAt: '2026-07-16T18:00:00.000Z',
    },
  ])
})

test('Harness run validates the official pages and Greenhouse payload before returning India jobs', async () => {
  const harness = await loadHarnessModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await harness.createHarnessScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === harness.JOBS_URL) return jobsPageHtml
      if (url === harness.CAREERS_URL) return careersPageHtml
      throw new Error(`Unexpected Harness text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === harness.buildGreenhouseJobsApiUrl()) return greenhousePayload
      throw new Error(`Unexpected Harness JSON URL: ${url}`)
    },
    now: () => '2026-07-16T18:00:00.000Z',
  })

  assert.deepEqual(requestedTextUrls, [
    harness.JOBS_URL,
    harness.CAREERS_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [harness.buildGreenhouseJobsApiUrl()])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Director of Quality Engineering & Automation')
  assert.equal(jobs[0].link, 'https://www.harness.io/company/jobs/apply?gh_jid=5137484007')
  assert.equal(jobs[0].companyCareerPage, 'https://www.harness.io/company/jobs')
  assert.equal(jobs[0].companyDomain, 'harness.io')
  assert.equal(jobs[0].atsPlatform, 'greenhouse')
})

test('Harness fails closed when the first-party pages or Greenhouse payload drift materially', async () => {
  const harness = await loadHarnessModule()

  await assert.rejects(
    harness.createHarnessScraper().run({
      fetchText: async (url) => {
        if (url === harness.JOBS_URL) return '<html><body><h1>Different jobs page</h1></body></html>'
        throw new Error(`Unexpected Harness text URL: ${url}`)
      },
    }),
    /verified Harness jobs page/i,
  )

  await assert.rejects(
    harness.createHarnessScraper().run({
      fetchText: async (url) => {
        if (url === harness.JOBS_URL) return jobsPageHtml
        if (url === harness.CAREERS_URL) return '<html><body><h1>Careers</h1></body></html>'
        throw new Error(`Unexpected Harness text URL: ${url}`)
      },
    }),
    /official careers page no longer exposes the verified Greenhouse board/i,
  )

  await assert.rejects(
    harness.createHarnessScraper().run({
      fetchText: async (url) => {
        if (url === harness.JOBS_URL) return jobsPageHtml
        if (url === harness.CAREERS_URL) return careersPageHtml
        throw new Error(`Unexpected Harness text URL: ${url}`)
      },
      fetchJson: async () => ({ jobs: [{ title: 'Broken' }] }),
    }),
    /Greenhouse jobs API response no longer matches/i,
  )
})


test('Harness validates its current internal jobs link and the linked Greenhouse script', async () => {
  const harness = await loadHarnessModule()
  const currentCareers = '<title>Careers at Harness ? Join the AI-Native DevOps Team</title><p>Life at Harness</p><a href="/company/jobs">View Open Positions</a>'
  const requested = []
  const fetchText = async (url) => {
    requested.push(url)
    if (url === harness.JOBS_URL) return jobsPageHtml
    if (url === harness.CAREERS_URL) return currentCareers
    if (url === 'https://cms.harness.io/js/greenhouse.js') return 'const endpoint="https://boards-api.greenhouse.io/v1/boards/harnessinc/jobs?content=true";'
    throw new Error('Unexpected URL: ' + url)
  }
  const jobs = await harness.run({ fetchText, fetchJson: async () => greenhousePayload })
  assert.equal(jobs.length, 1)
  assert.ok(requested.includes('https://cms.harness.io/js/greenhouse.js'))
  await assert.rejects(harness.run({ fetchText: async (url) => url.endsWith('/greenhouse.js')
    ? 'const endpoint="https://unrelated.example/jobs"' : fetchText(url), fetchJson: async () => greenhousePayload }), /Greenhouse/)
})
