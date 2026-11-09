import assert from 'node:assert/strict'
import test from 'node:test'

const loadWalmartModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Walmart Careers</title>
  </head>
  <body>
    <main>
      <h1>Next move, yours.</h1>
      <p>Find the role that's a perfect fit</p>
      <p>Stores and Clubs</p>
      <p>Supply Chain &amp; Transportation</p>
      <p>Healthcare</p>
      <p>Technology</p>
      <p>Corporate</p>
      <a href="/us/en/results?searchQuery=All&amp;careerareas=Technology">Technology</a>
      <a href="/us/en/home/resources/location">Office Locations</a>
    </main>
  </body>
</html>
`

const technologyHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Technology</title>
  </head>
  <body>
    <main>
      <h1>Technology</h1>
      <p>See all open roles</p>
      <p>See all technology roles</p>
      <a href="/content/careers/us/en/results?searchQuery=All&amp;careerareas=Technology">All technology roles</a>
      <a href="/content/careers/us/en/results?searchQuery=Hoboken">Hoboken</a>
      <a href="/content/careers/us/en/results?searchQuery=Sunnyvale">Sunnyvale</a>
    </main>
  </body>
</html>
`

const corporateHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Corporate</title>
  </head>
  <body>
    <main>
      <h1>Corporate</h1>
      <p>See all open roles</p>
      <p>See all corporate roles</p>
      <a href="/content/careers/us/en/results?searchQuery=All&amp;careerareas=Corporate">All corporate roles</a>
      <a href="/content/careers/us/en/results?searchQuery=Finance and Accounting&amp;careerareas=Corporate">Finance and Accounting</a>
      <a href="/content/careers/us/en/results?searchQuery=Human Resources&amp;careerareas=Corporate">Human Resources</a>
    </main>
  </body>
</html>
`

const expectedPopulationFilter =
  "population IN ['WALMART_EXT_CAMPUS_US','WALMART_EXT_FIELD_US','SAMS_EXT_CAMPUS_US','SAMS_EXT_FIELD_US','VIZIO_CAMPUS_EXTERNAL','VIZIO_FIELD_EXTERNAL']"

const structuredSearchPayload = {
  query: 'Senior Solution Consultant',
  jobs: [{
    id: 'R-2569033-External',
    text: 'Job Posting Title: Solution Consultant III',
    metadata: {
      jobId: 'R-2569033',
      title: 'Solution Consultant III',
      primaryLocationCity: 'BENTONVILLE',
      primaryLocationCountry: 'US',
      brand: 'Walmart',
      areas: ['Corporate'],
      categories: ['Finance and Accounting'],
      employmentTypes: ['Full time'],
      population: 'WALMART_EXT_CAMPUS_US',
    },
    score: 0.88,
  }],
  totalJobs: 6652,
  jobFilters: expectedPopulationFilter,
  jobSearchSucceeded: true,
  jobErrorMessage: null,
}

const indiaKeywordNoLocatedHitsPayload = {
  query: 'India',
  jobs: [{
    id: 'R-2591343-External',
    text: 'Job Posting Title: Senior Manager, Communications',
    metadata: {
      jobId: 'R-2591343',
      title: 'Senior Manager, Communications',
      primaryLocationCity: 'BENTONVILLE',
      primaryLocationCountry: 'US',
      brand: 'Walmart',
      areas: ['Corporate'],
      categories: ['Communications'],
      employmentTypes: ['Full time'],
      population: 'WALMART_EXT_CAMPUS_US',
    },
    score: 0.92,
  }],
  totalJobs: 20,
  jobFilters: expectedPopulationFilter,
  jobSearchSucceeded: true,
  jobErrorMessage: null,
}

const indiaLocatedPayload = {
  query: 'India',
  jobs: [{
    id: 'R-2428432-External',
    text: '(IND) Senior Solution Consultant',
    metadata: {
      jobId: 'R-2428432',
      title: '(IND) Senior Solution Consultant',
      primaryLocationCity: 'BENGALURU',
      primaryLocationCountry: 'IN',
      brand: 'Walmart',
      areas: ['Corporate'],
      categories: ['Finance and Accounting'],
      employmentTypes: ['Full time'],
      population: 'WALMART_EXT_CAMPUS_US',
    },
    score: 0.99,
  }],
  totalJobs: 1,
  jobFilters: `primaryLocationCountry == 'IN' AND ${expectedPopulationFilter}`,
  jobSearchSucceeded: true,
  jobErrorMessage: null,
}

test('Walmart sentinel pins the verified first-party careers surface and rejects only actual India-located keyword hits', async () => {
  const walmart = await loadWalmartModule()

  assert.ok(walmart, 'Expected Walmart scraper module at ./script.js')
  assert.equal(walmart.SOURCE, 'walmart')
  assert.equal(walmart.COMPANY, 'Walmart')
  assert.equal(walmart.HOMEPAGE_URL, 'https://careers.walmart.com/us/en')
  assert.equal(walmart.TECHNOLOGY_URL, 'https://careers.walmart.com/us/en/home/careers-areas/technology')
  assert.equal(walmart.CORPORATE_URL, 'https://careers.walmart.com/us/en/home/careers-areas/corporate')
  assert.equal(walmart.CAREERS_RESULTS_URL, 'https://careers.walmart.com/us/en/results')
  assert.equal(
    walmart.SEARCH_API_URL,
    'https://careers.walmart.com/api/ai/search-ai/api/v1/combined/hybrid-search',
  )
  assert.equal(walmart.STRUCTURED_PROBE_QUERY, 'Senior Solution Consultant')
  assert.equal(walmart.INDIA_PROBE_QUERY, 'India')
  assert.equal(walmart.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(walmart.hasTechnologyPageSignal(technologyHtml), true)
  assert.equal(walmart.hasCorporatePageSignal(corporateHtml), true)
  assert.equal(walmart.hasStructuredSearchProbe(structuredSearchPayload), true)
  assert.equal(walmart.hasVerifiedIndiaQueryWithoutLocatedHits(indiaKeywordNoLocatedHitsPayload), true)
  assert.deepEqual(walmart.extractIndiaLocatedSearchHits(indiaKeywordNoLocatedHitsPayload), [])
  assert.equal(walmart.extractIndiaLocatedSearchHits(indiaLocatedPayload).length, 1)
})

test('run returns an empty list while Walmart keeps the verified no-India-located public keyword probe', async () => {
  const walmart = await loadWalmartModule()
  assert.ok(walmart, 'Expected Walmart scraper module at ./script.js')

  const requestedUrls = []
  const requestedQueries = []
  const jobs = await walmart.createWalmartScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === walmart.HOMEPAGE_URL) return homepageHtml
      if (url === walmart.TECHNOLOGY_URL) return technologyHtml
      if (url === walmart.CORPORATE_URL) return corporateHtml
      throw new Error(`Unexpected page URL: ${url}`)
    },
    searchJobs: async (query) => {
      requestedQueries.push(query)
      if (query === walmart.STRUCTURED_PROBE_QUERY) return structuredSearchPayload
      if (query === walmart.INDIA_PROBE_QUERY) return indiaKeywordNoLocatedHitsPayload
      throw new Error(`Unexpected search query: ${query}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    walmart.HOMEPAGE_URL,
    walmart.TECHNOLOGY_URL,
    walmart.CORPORATE_URL,
  ])
  assert.deepEqual(requestedQueries, [
    walmart.STRUCTURED_PROBE_QUERY,
    walmart.INDIA_PROBE_QUERY,
  ])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the verified Walmart surface drifts or starts exposing enumerable India jobs', async () => {
  const walmart = await loadWalmartModule()
  assert.ok(walmart, 'Expected Walmart scraper module at ./script.js')

  await assert.rejects(
    walmart.createWalmartScraper().run({
      fetchText: async (url) => {
        if (url === walmart.HOMEPAGE_URL) {
          return '<html><body><h1>Walmart</h1></body></html>'
        }
        throw new Error(`Unexpected page URL: ${url}`)
      },
      searchJobs: async () => structuredSearchPayload,
    }),
    /homepage no longer matches/i,
  )

  await assert.rejects(
    walmart.createWalmartScraper().run({
      fetchText: async (url) => {
        if (url === walmart.HOMEPAGE_URL) return homepageHtml
        if (url === walmart.TECHNOLOGY_URL) return '<html><body><h1>Technology</h1></body></html>'
        throw new Error(`Unexpected page URL: ${url}`)
      },
      searchJobs: async () => structuredSearchPayload,
    }),
    /technology careers page no longer matches/i,
  )

  await assert.rejects(
    walmart.createWalmartScraper().run({
      fetchText: async (url) => {
        if (url === walmart.HOMEPAGE_URL) return homepageHtml
        if (url === walmart.TECHNOLOGY_URL) return technologyHtml
        if (url === walmart.CORPORATE_URL) return corporateHtml
        throw new Error(`Unexpected page URL: ${url}`)
      },
      searchJobs: async (query) => (
        query === walmart.STRUCTURED_PROBE_QUERY
          ? { ...structuredSearchPayload, jobs: [] }
          : indiaZeroPayload
      ),
    }),
    /live search contract no longer matches/i,
  )

  await assert.rejects(
    walmart.createWalmartScraper().run({
      fetchText: async (url) => {
        if (url === walmart.HOMEPAGE_URL) return homepageHtml
        if (url === walmart.TECHNOLOGY_URL) return technologyHtml
        if (url === walmart.CORPORATE_URL) return corporateHtml
        throw new Error(`Unexpected page URL: ${url}`)
      },
      searchJobs: async (query) => (
        query === walmart.STRUCTURED_PROBE_QUERY
          ? structuredSearchPayload
          : indiaLocatedPayload
      ),
    }),
    /public India keyword probe now returns India-located jobs/i,
  )
})


test('Walmart accepts current Next title attributes while preserving every branded careers handoff', async () => {
  const walmart = await loadWalmartModule(), { readFile } = await import('node:fs/promises')
  const guards = [walmart.hasOfficialHomepageSignal, walmart.hasTechnologyPageSignal, walmart.hasCorporatePageSignal]
  for (const [index, guard] of guards.entries()) {
    const html = await readFile(new URL('./fixtures/current-20261009-' + index + '.html', import.meta.url), 'utf8')
    assert.equal(guard(html), true)
    assert.equal(guard(html.replace(/<title[^>]*>[^<]*<\/title>/, '<title data-next-head="">Other employer</title>')), false)
  }
})
