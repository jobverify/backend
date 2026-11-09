import assert from 'node:assert/strict'
import test from 'node:test'

const loadInnovaSolutionsModule = async () => {
  try {
    return await import('../../scraper/innovasolutions/script.js')
  } catch {
    assert.fail('Expected Innova Solutions scraper module at ../../scraper/innovasolutions/script.js')
  }
}

const officialCareersHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <h1>Innovator</h1>
      <p>Welcome to Innova Solutions</p>
      <section>
        <h2>India Careers</h2>
        <a href="https://innovaindia.workllama.com/atsuser/">IT Solutions Careers</a>
      </section>
    </body>
  </html>
`

const portalHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Welcome to Innova Solutions India</title>
      <script>
        WorkLLama = {
          companyCode: 'INNVIND'
        };
      </script>
    </head>
    <body>
      <div id="app"></div>
    </body>
  </html>
`

const metadataPayload = {
  candidatePlacementTypes: [
    { value: '01', text: 'Direct Hire' },
    { value: '02', text: 'Contract' },
  ],
  sortingOptions: [
    { value: '01', text: 'Oldest Job First' },
  ],
}

const emptyJobsPayload = {
  sessionValid: null,
  errorCode: null,
  errorMessage: null,
  resultSize: null,
  resultPage: null,
  resultCount: null,
  publishedJobs: null,
}

const populatedJobsPayload = {
  ...emptyJobsPayload,
  publishedJobs: [
    {
      jobPostingId: 123,
      jobTitle: 'Senior Engineer',
    },
  ],
}

test('validates the verified Innova Solutions WorkLLama empty-feed flow and returns no jobs', async () => {
  const innova = await loadInnovaSolutionsModule()
  const fetchTextCalls = []
  const fetchJsonCalls = []

  const jobs = await innova.createInnovaSolutionsScraper().run({
    fetchText: async (url) => {
      fetchTextCalls.push(url)
      if (url === innova.CAREERS_PAGE_URL) return officialCareersHtml
      if (url === innova.PORTAL_URL) return portalHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      fetchJsonCalls.push({ url, options })
      if (url === innova.COMPANY_METADATA_URL) return metadataPayload
      if (url === innova.JOBS_API_URL) return emptyJobsPayload
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.equal(innova.COMPANY_CODE, 'INNVIND')
  assert.deepEqual(fetchTextCalls, [innova.CAREERS_PAGE_URL, innova.PORTAL_URL])
  assert.equal(fetchJsonCalls.length, 2)
  assert.equal(fetchJsonCalls[0].url, innova.COMPANY_METADATA_URL)
  assert.deepEqual(fetchJsonCalls[0].options, {})
  assert.equal(fetchJsonCalls[1].url, innova.JOBS_API_URL)
  assert.equal(fetchJsonCalls[1].options.method, 'POST')
  assert.equal(fetchJsonCalls[1].options.headers['Content-Type'], 'application/json')
  assert.equal(fetchJsonCalls[1].options.body, JSON.stringify(innova.DEFAULT_SEARCH_BODY))
  assert.deepEqual(jobs, [])
})

test('fails closed when the official Innova careers page signal changes', async () => {
  const innova = await loadInnovaSolutionsModule()

  await assert.rejects(
    innova.createInnovaSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === innova.CAREERS_PAGE_URL) return '<html><body>No careers handoff here</body></html>'
        return portalHtml
      },
      fetchJson: async () => metadataPayload,
    }),
    /official innova careers page/i,
  )
})

test('fails closed when the WorkLLama portal bootstrap no longer matches Innova', async () => {
  const innova = await loadInnovaSolutionsModule()

  await assert.rejects(
    innova.createInnovaSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === innova.CAREERS_PAGE_URL) return officialCareersHtml
        if (url === innova.PORTAL_URL) return '<html><head><title>Other Portal</title></head></html>'
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => metadataPayload,
    }),
    /official innova workllama portal/i,
  )
})

test('fails closed when the verified empty WorkLLama feed becomes populated', async () => {
  const innova = await loadInnovaSolutionsModule()

  await assert.rejects(
    innova.createInnovaSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === innova.CAREERS_PAGE_URL) return officialCareersHtml
        if (url === innova.PORTAL_URL) return portalHtml
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async (url, options = {}) => {
        if (url === innova.COMPANY_METADATA_URL) return metadataPayload
        if (url === innova.JOBS_API_URL) return populatedJobsPayload
        throw new Error(`Unexpected JSON URL: ${url} ${JSON.stringify(options)}`)
      },
    }),
    /public workllama feed now contains jobs/i,
  )
})
