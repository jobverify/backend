import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers in data analytics and AI | Sigmoid</title>
  </head>
  <body>
    <main>
      <h1>Travel the upward curve towards a great data analytics career</h1>
      <a href="/careers/current-openings/">Explore open roles</a>
    </main>
  </body>
</html>
`

const currentOpeningsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Openings in Data, AI &amp; Analytics Careers | Sigmoid</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://job-boards.greenhouse.io/sigmoid/jobs/5481479002" target="_blank">Apply Now</a>
      <script>
        fetch("https://boards-api.greenhouse.io/v1/boards/sigmoid/jobs?content=true")
          .then(function(res) { return res.json(); });
      </script>
    </main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 8456380002,
      title: 'Assistant Manager - Business Insight & Analytics',
      absolute_url: 'https://job-boards.greenhouse.io/sigmoid/jobs/8456380002',
      updated_at: '2026-06-30T05:23:35-04:00',
      first_published: '2026-03-10T01:36:50-04:00',
      requisition_id: 'AMBi',
      company_name: 'Sigmoid',
      location: {
        name: 'Bengaluru, Karnataka, India',
      },
      metadata: [
        {
          name: 'Employment Type',
          value: 'Full-time',
        },
        {
          name: 'Department Category',
          value: 'Business Consulting',
        },
        {
          name: 'Min Work Experience',
          value: '5.0',
        },
        {
          name: 'Max Work Experience',
          value: '8.0',
        },
      ],
      departments: [
        {
          name: 'Business Consulting and Solutions',
        },
      ],
      content: '<p>Business Insights and Analytics role.</p>',
    },
    {
      id: 8581495002,
      title: 'Associate Director - Corporate Finance / FP&A',
      absolute_url: 'https://job-boards.greenhouse.io/sigmoid/jobs/8581495002',
      updated_at: '2026-06-30T05:26:14-04:00',
      first_published: '2026-06-08T01:21:56-04:00',
      requisition_id: 'ADC',
      company_name: 'Sigmoid',
      location: {
        name: 'Bengaluru, Karnataka, India',
      },
      metadata: [
        {
          name: 'Employment Type',
          value: 'Full-time',
        },
        {
          name: 'Department Category',
          value: 'Business Consulting',
        },
        {
          name: 'Min Work Experience',
          value: '9.0',
        },
        {
          name: 'Max Work Experience',
          value: '11.0',
        },
      ],
      departments: [
        {
          name: 'Business Consulting and Solutions',
        },
      ],
      content: '<p>Corporate finance and FP&A consulting role.</p>',
    },
    {
      id: 9000000001,
      title: 'Director - Global Partnerships',
      absolute_url: 'https://job-boards.greenhouse.io/sigmoid/jobs/9000000001',
      updated_at: '2026-06-01T00:00:00-04:00',
      first_published: '2026-05-20T00:00:00-04:00',
      requisition_id: 'GLOBAL1',
      company_name: 'Sigmoid',
      location: {
        name: 'New York, New York, United States',
      },
      metadata: [
        {
          name: 'Employment Type',
          value: 'Full-time',
        },
      ],
      departments: [
        {
          name: 'Business Consulting and Solutions',
        },
      ],
      content: '<p>Non-India role.</p>',
    },
  ],
}

const greenhousePayloadWithoutIndia = {
  jobs: [
    {
      id: 9000000001,
      title: 'Director - Global Partnerships',
      absolute_url: 'https://job-boards.greenhouse.io/sigmoid/jobs/9000000001',
      updated_at: '2026-06-01T00:00:00-04:00',
      first_published: '2026-05-20T00:00:00-04:00',
      requisition_id: 'GLOBAL1',
      company_name: 'Sigmoid',
      location: {
        name: 'New York, New York, United States',
      },
      metadata: [
        {
          name: 'Employment Type',
          value: 'Full-time',
        },
      ],
      departments: [
        {
          name: 'Business Consulting and Solutions',
        },
      ],
      content: '<p>Non-India role.</p>',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/sigmoid/script.js')
  } catch {
    assert.fail('Expected Sigmoid scraper module at ../../scraper/sigmoid/script.js')
  }
}

test('Sigmoid pins the verified first-party careers pages and Greenhouse API contract', async () => {
  const sigmoid = await loadModule()

  assert.equal(sigmoid.SOURCE, 'sigmoid')
  assert.equal(sigmoid.COMPANY, 'Sigmoid')
  assert.equal(sigmoid.VERIFIED_ON, '2026-07-19')
  assert.equal(sigmoid.CAREERS_PAGE_URL, 'https://www.sigmoid.com/careers/')
  assert.equal(sigmoid.CURRENT_OPENINGS_URL, 'https://www.sigmoid.com/careers/current-openings/')
  assert.equal(sigmoid.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/sigmoid')
  assert.equal(
    sigmoid.GREENHOUSE_JOBS_API_URL,
    'https://boards-api.greenhouse.io/v1/boards/sigmoid/jobs?content=true',
  )
  assert.equal(sigmoid.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    sigmoid.extractCurrentOpeningsUrl(careersHtml),
    'https://www.sigmoid.com/careers/current-openings/',
  )
  assert.equal(sigmoid.hasOfficialCurrentOpeningsSignal(currentOpeningsHtml), true)
})

test('Sigmoid extracts only India jobs from the verified Greenhouse payload', async () => {
  const sigmoid = await loadModule()
  const jobs = sigmoid.extractIndiaJobsFromGreenhousePayload(greenhousePayload)

  assert.deepEqual(jobs, [
    {
      title: 'Assistant Manager - Business Insight & Analytics',
      company: 'Sigmoid',
      department: 'Business Consulting',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: '8456380002',
      requisitionId: 'AMBi',
      sourceUrl: 'https://job-boards.greenhouse.io/sigmoid/jobs/8456380002',
      applyUrl: 'https://job-boards.greenhouse.io/sigmoid/jobs/8456380002',
      employmentType: 'Full-time',
      experienceRequired: '5-8 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-03-10T01:36:50-04:00',
      closingDate: null,
      jobDescription: '<p>Business Insights and Analytics role.</p>',
      remoteStatus: 'On-site',
    },
    {
      title: 'Associate Director - Corporate Finance / FP&A',
      company: 'Sigmoid',
      department: 'Business Consulting',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: '8581495002',
      requisitionId: 'ADC',
      sourceUrl: 'https://job-boards.greenhouse.io/sigmoid/jobs/8581495002',
      applyUrl: 'https://job-boards.greenhouse.io/sigmoid/jobs/8581495002',
      employmentType: 'Full-time',
      experienceRequired: '9-11 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-08T01:21:56-04:00',
      closingDate: null,
      jobDescription: '<p>Corporate finance and FP&A consulting role.</p>',
      remoteStatus: 'On-site',
    },
  ])
})

test('Sigmoid run validates the first-party careers handoff and returns normalized India jobs from Greenhouse', async () => {
  const sigmoid = await loadModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await sigmoid.createSigmoidScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === sigmoid.CAREERS_PAGE_URL) return careersHtml
      if (url === sigmoid.CURRENT_OPENINGS_URL) return currentOpeningsHtml
      throw new Error(`Unexpected Sigmoid text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      return greenhousePayload
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedTexts, [
    sigmoid.CAREERS_PAGE_URL,
    sigmoid.CURRENT_OPENINGS_URL,
  ])
  assert.deepEqual(requestedJson, [
    sigmoid.GREENHOUSE_JOBS_API_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'sigmoid')
  assert.equal(jobs[0].link, 'https://job-boards.greenhouse.io/sigmoid/jobs/8456380002')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Sigmoid returns an honest empty slice when the verified board has no India roles', async () => {
  const sigmoid = await loadModule()

  const jobs = await sigmoid.createSigmoidScraper().run({
    fetchText: async (url) => {
      if (url === sigmoid.CAREERS_PAGE_URL) return careersHtml
      if (url === sigmoid.CURRENT_OPENINGS_URL) return currentOpeningsHtml
      throw new Error(`Unexpected Sigmoid text URL: ${url}`)
    },
    fetchJson: async () => greenhousePayloadWithoutIndia,
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(jobs, [])
})

test('Sigmoid fails closed when the official careers pages or Greenhouse payload drift', async () => {
  const sigmoid = await loadModule()

  await assert.rejects(
    sigmoid.createSigmoidScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchJson: async () => greenhousePayload,
    }),
    /verified official sigmoid careers page/i,
  )

  await assert.rejects(
    sigmoid.createSigmoidScraper().run({
      fetchText: async (url) => {
        if (url === sigmoid.CAREERS_PAGE_URL) return careersHtml
        return '<html><body>No greenhouse handoff</body></html>'
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified sigmoid current openings page/i,
  )

  await assert.rejects(
    sigmoid.createSigmoidScraper().run({
      fetchText: async (url) => {
        if (url === sigmoid.CAREERS_PAGE_URL) return careersHtml
        return currentOpeningsHtml
      },
      fetchJson: async () => ({ postings: [] }),
    }),
    /verified sigmoid greenhouse payload/i,
  )
})
