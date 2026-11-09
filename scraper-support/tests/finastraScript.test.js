import assert from 'node:assert/strict'
import test from 'node:test'

const loadFinastraModule = async () => {
  try {
    return await import('../../scraper/finastra.workday/script.js')
  } catch (error) {
    assert.fail(`Expected Finastra scraper module at ../../scraper/finastra.workday/script.js: ${error.message}`)
  }
}

const discoveryPayload = {
  total: 151,
  jobPostings: [],
  facets: [
    {
      facetParameter: 'locationMainGroup',
      values: [
        {
          facetParameter: 'locations',
          descriptor: 'Location',
          values: [
            { descriptor: 'Atlanta', id: 'atlanta-id', count: 31 },
            { descriptor: 'Bengaluru', id: 'bengaluru-id', count: 22 },
            { descriptor: 'Pune', id: 'pune-id', count: 17 },
            { descriptor: 'Virtual - India', id: 'virtual-india-id', count: 1 },
            { descriptor: 'London', id: 'london-id', count: 14 },
          ],
        },
      ],
    },
  ],
}

const indiaJobsPageOne = {
  total: 3,
  jobPostings: [
    {
      title: 'Security Analyst',
      externalPath: '/job/Bengaluru/Security-Analyst_REQ0526_0037213-1',
      locationsText: 'Bengaluru',
      postedOn: 'Posted Today',
      bulletFields: ['REQ0526_0037213'],
    },
    {
      title: 'Senior Reporting/UX Developer',
      externalPath: '/job/Bengaluru/Report-UX-Developer--Power-BI-_REQ0526_0037350',
      locationsText: '2 Locations',
      postedOn: 'Posted 8 Days Ago',
      bulletFields: ['REQ0526_0037350'],
    },
  ],
}

const indiaJobsPageTwo = {
  total: 3,
  jobPostings: [
    {
      title: 'Senior QA Engineer',
      externalPath: '/job/Pune/Senior-QA-Engineer_REQ0326_0036569',
      locationsText: 'Pune',
      postedOn: 'Posted 6 Days Ago',
      bulletFields: ['REQ0326_0036569'],
    },
  ],
}

const detailPageHtmlByUrl = {
  'https://finastra.wd3.myworkdayjobs.com/FINC/job/Bengaluru/Security-Analyst_REQ0526_0037213-1': `
    <html>
      <body>
        <section data-automation-id="jobPostingDescription">
          <div>
            <p>What will you contribute?</p>
            <p>Should have more than 1 years of Software Development and lifecycle experience with a strong focus on security operations and automation.</p>
          </div>
        </section>
      </body>
    </html>
  `,
  'https://finastra.wd3.myworkdayjobs.com/FINC/job/Bengaluru/Report-UX-Developer--Power-BI-_REQ0526_0037350': `
    <html>
      <body>
        <section data-automation-id="jobPostingDescription">
          <div>
            <p>Build reporting workflows and user experiences for enterprise analytics programs.</p>
          </div>
        </section>
      </body>
    </html>
  `,
  'https://finastra.wd3.myworkdayjobs.com/FINC/job/Pune/Senior-QA-Engineer_REQ0326_0036569': `
    <html>
      <body>
        <section data-automation-id="jobPostingDescription">
          <div>
            <p>Required Experience: 5-8 years of proven experience in designing automation strategies for banking products.</p>
          </div>
        </section>
      </body>
    </html>
  `,
}

test('extractIndiaLocationFacetIds keeps the official India location ids from Finastra Workday facets', async () => {
  const finastra = await loadFinastraModule()

  assert.deepEqual(
    finastra.extractIndiaLocationFacetIds(discoveryPayload),
    ['bengaluru-id', 'pune-id', 'virtual-india-id'],
  )
})

test('run queries the official Finastra Workday jobs API for India listings and maps the shared job contract', async () => {
  const finastra = await loadFinastraModule()

  const requests = []
  const jobs = await finastra.createFinastraScraper({ pageSize: 2 }).run({
    fetchJson: async (url, options = {}) => {
      requests.push({ url, options })

      assert.equal(url, finastra.JOBS_API_URL)

      const body = JSON.parse(options.body)
      if (requests.length === 1) {
        assert.deepEqual(body, {
          appliedFacets: {},
          limit: 2,
          offset: 0,
          searchText: '',
        })
        return discoveryPayload
      }

      assert.deepEqual(body.appliedFacets, {
        locations: ['bengaluru-id', 'pune-id', 'virtual-india-id'],
      })

      if (body.offset === 0) {
        return indiaJobsPageOne
      }

      if (body.offset === 2) {
        return indiaJobsPageTwo
      }

      throw new Error(`Unexpected request body: ${options.body}`)
    },
    fetchPage: async (url) => ({
      status: 200,
      url,
      html: detailPageHtmlByUrl[url],
    }),
  })

  assert.equal(requests.length, 3)

  const { scrapedAt: firstScrapedAt, ...firstJob } = jobs[0]
  assert.ok(Date.parse(firstScrapedAt))
  assert.deepEqual(firstJob, {
    title: 'Security Analyst',
    company: 'Finastra',
    department: null,
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'REQ0526_0037213',
    requisitionId: 'REQ0526_0037213',
    sourceUrl: 'https://finastra.wd3.myworkdayjobs.com/FINC/job/Bengaluru/Security-Analyst_REQ0526_0037213-1',
    applyUrl: 'https://finastra.wd3.myworkdayjobs.com/FINC/job/Bengaluru/Security-Analyst_REQ0526_0037213-1',
    employmentType: null,
    experienceRequired: '1+ years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: 'Posted Today',
    closingDate: null,
    jobDescription: 'What will you contribute?\nShould have more than 1 years of Software Development and lifecycle experience with a strong focus on security operations and automation.',
    source: 'finastra',
    link: 'https://finastra.wd3.myworkdayjobs.com/FINC/job/Bengaluru/Security-Analyst_REQ0526_0037213-1',
  })

  assert.equal(jobs[1].location, 'Bengaluru, India')
  assert.equal(jobs[1].city, 'Bengaluru')
  assert.equal(jobs[1].jobId, 'REQ0526_0037350')
  assert.match(jobs[1].jobDescription || '', /enterprise analytics programs/i)
  assert.equal(jobs[2].location, 'Pune, India')
  assert.equal(jobs[2].city, 'Pune')
  assert.equal(jobs[2].jobId, 'REQ0326_0036569')
  assert.equal(jobs[2].experienceRequired, '5-8 years')
})


test('Finastra treats Workday maintenance HTML returned with HTTP 200 as an upstream outage', async (t) => {
  const {createFinastraScraper} = await import('../../scraper/finastra.workday/script.js')
  const {classifyScraperError} = await import('../utils/failureClassification.js')
  t.mock.method(globalThis, 'fetch', async () => new Response('<title>Workday is currently unavailable.</title>', {status: 200}))
  await assert.rejects(createFinastraScraper().run(), error => {
    assert.deepEqual(classifyScraperError(error), {softFailure: true, upstreamOutage: true, failureKind: 'network_or_timeout'})
    return true
  })
})
