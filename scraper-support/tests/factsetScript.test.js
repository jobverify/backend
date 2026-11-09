import assert from 'node:assert/strict'
import test from 'node:test'

const loadFactSetModule = async () => {
  try {
    return await import('../../scraper/factset.workday/script.js')
  } catch {
    assert.fail('Expected FactSet scraper module at ../../scraper/scraper/factset.workday/script.js')
  }
}

const samplePayload = {
  total: 3,
  jobPostings: [
    {
      title: 'Associate Product Specialist',
      externalPath: '/job/Hyderabad-IND/Associate-Product-Specialist_R32632',
      timeType: 'Full time',
      locationsText: 'Hyderabad, IND',
      postedOn: 'Posted Today',
      bulletFields: ['R32632'],
    },
    {
      title: 'AI Developer Enablement Engineer',
      externalPath: '/job/India-Hyderabad-DVS-SEZ-1--Orion-B4-FL-78911-Hyderabad---Divyasree-3/AI-Developer-Enablement-Engineer_R32477',
      timeType: 'Full time',
      locationsText: '7 Locations',
      postedOn: 'Posted 2 Days Ago',
      bulletFields: ['R32477'],
    },
    {
      title: 'Client Solutions Associate Paris',
      externalPath: '/job/Paris-FRA/Client-Solutions-Associate-Paris_R32469',
      timeType: 'Full time',
      locationsText: 'Paris, FRA',
      postedOn: 'Posted Yesterday',
      bulletFields: ['R32469'],
    },
  ],
}

const indiaDetailHtml = `
  <html>
    <body>
      <section data-automation-id="jobPostingDescription">
        <div>Help investment professionals deliver better client outcomes.</div>
      </section>
      <dl>
        <dt>Locations</dt>
        <dd>Hyderabad, IND</dd>
      </dl>
      <dl>
        <dt>Department</dt>
        <dd>Client Solutions Group</dd>
      </dl>
      <dl>
        <dt>Job Requisition ID</dt>
        <dd>R32632</dd>
      </dl>
    </body>
  </html>
`

const groupedIndiaDetailHtml = `
  <html>
    <body>
      <section data-automation-id="jobPostingDescription">
        <div>Build internal AI tooling for research and analytics workflows.</div>
      </section>
      <dl>
        <dt>Locations</dt>
        <dd>Mumbai, IND</dd>
        <dd>London, GBR</dd>
      </dl>
      <dl>
        <dt>Department</dt>
        <dd>Technology Group</dd>
      </dl>
      <dl>
        <dt>Job Requisition ID</dt>
        <dd>R32477</dd>
      </dl>
    </body>
  </html>
`

test('run uses the official FactSet careers Workday API and keeps only India jobs', async () => {
  const {
    BASE_URL,
    CAREER_PAGE_URL,
    JOBS_API_URL,
    buildJobsRequestBody,
    createFactSetScraper,
  } = await loadFactSetModule()

  assert.equal(CAREER_PAGE_URL, 'https://www.factset.com/careers')
  assert.equal(BASE_URL, 'https://factset.wd108.myworkdayjobs.com/FactSetCareers')
  assert.equal(
    JOBS_API_URL,
    'https://factset.wd108.myworkdayjobs.com/wday/cxs/factset/FactSetCareers/jobs',
  )

  const requestedBodies = []
  const requestedDetailUrls = []

  const jobs = await createFactSetScraper({
    maxPages: 1,
  }).run({
    fetchJson: async (url, body) => {
      assert.equal(url, JOBS_API_URL)
      requestedBodies.push(JSON.parse(body))
      return samplePayload
    },
    fetchText: async (url) => {
      requestedDetailUrls.push(url)

      if (url.endsWith('/Associate-Product-Specialist_R32632')) {
        return indiaDetailHtml
      }

      if (url.endsWith('/AI-Developer-Enablement-Engineer_R32477')) {
        return groupedIndiaDetailHtml
      }

      throw new Error(`Unexpected detail URL: ${url}`)
    },
  })

  assert.deepEqual(requestedBodies, [JSON.parse(buildJobsRequestBody({ offset: 0 }))])
  assert.deepEqual(requestedDetailUrls, [
    'https://factset.wd108.myworkdayjobs.com/FactSetCareers/job/Hyderabad-IND/Associate-Product-Specialist_R32632',
    'https://factset.wd108.myworkdayjobs.com/FactSetCareers/job/India-Hyderabad-DVS-SEZ-1--Orion-B4-FL-78911-Hyderabad---Divyasree-3/AI-Developer-Enablement-Engineer_R32477',
  ])

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map((job) => ({
    title: job.title,
    location: job.location,
    city: job.city,
    jobId: job.jobId,
    requisitionId: job.requisitionId,
    link: job.link,
    department: job.department,
    source: job.source,
  })), [
    {
      title: 'Associate Product Specialist',
      location: 'Hyderabad, IND',
      city: 'Hyderabad',
      jobId: 'R32632',
      requisitionId: 'R32632',
      link: 'https://factset.wd108.myworkdayjobs.com/FactSetCareers/job/Hyderabad-IND/Associate-Product-Specialist_R32632',
      department: 'Client Solutions Group',
      source: 'factset',
    },
    {
      title: 'AI Developer Enablement Engineer',
      location: 'Mumbai, IND',
      city: 'Mumbai',
      jobId: 'R32477',
      requisitionId: 'R32477',
      link: 'https://factset.wd108.myworkdayjobs.com/FactSetCareers/job/India-Hyderabad-DVS-SEZ-1--Orion-B4-FL-78911-Hyderabad---Divyasree-3/AI-Developer-Enablement-Engineer_R32477',
      department: 'Technology Group',
      source: 'factset',
    },
  ])
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.ok(jobs.every((job) => job.jobDescription))
})
