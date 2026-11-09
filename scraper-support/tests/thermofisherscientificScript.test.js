import assert from 'node:assert/strict'
import test from 'node:test'

const loadThermoFisherScientificModule = async () => {
  try {
    return await import('../../scraper/thermofisherscientific/script.js')
  } catch {
    assert.fail('Expected Thermo Fisher Scientific scraper module at ../../scraper/thermofisherscientific/script.js')
  }
}

const searchResultsHtml = `
  <script>
    phApp.ddo = {
      "eagerLoadRefineSearch": {
        "totalHits": 2,
        "hits": 2,
        "data": {
          "jobs": [
            {
              "reqId": "TF-INDIA-1",
              "jobId": "TF-INDIA-1",
              "title": "Software Engineer",
              "cityStateCountry": "Remote, India",
              "country": "India",
              "type": "Full time"
            },
            {
              "reqId": "TF-US-1",
              "jobId": "TF-US-1",
              "title": "Software Engineer",
              "cityStateCountry": "Waltham, Massachusetts, United States of America",
              "country": "United States of America",
              "type": "Full time"
            }
          ],
          "aggregations": [{ "field": "country", "value": { "India": 1 } }]
        }
      }
    }
  </script>
`

const detailHtml = `
  <script>
    phApp.ddo = {
      "jobDetail": {
        "data": {
          "job": {
            "reqId": "TF-INDIA-1",
            "jobId": "TF-INDIA-1",
            "title": "Software Engineer",
            "location": "Remote, India",
            "ml_country": "India",
            "employmentType": "Full time"
          }
        }
      }
    }
  </script>
`

test('Thermo Fisher Scientific uses the official Phenom route and bounded India-only runner', async () => {
  const thermoFisherScientific = await loadThermoFisherScientificModule()
  const requestedUrls = []

  const jobs = await thermoFisherScientific.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === thermoFisherScientific.buildSearchResultsPageUrl()) return searchResultsHtml
      if (url === 'https://jobs.thermofisher.com/global/en/job/TF-INDIA-1/Software-Engineer') return detailHtml
      throw new Error(`Unexpected Thermo Fisher Scientific fixture URL: ${url}`)
    },
  })

  assert.equal(
    thermoFisherScientific.buildSearchResultsPageUrl(),
    'https://jobs.thermofisher.com/global/en/search-results',
  )
  assert.deepEqual(requestedUrls, [
    'https://jobs.thermofisher.com/global/en/search-results',
    'https://jobs.thermofisher.com/global/en/job/TF-INDIA-1/Software-Engineer',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Thermo Fisher Scientific')
  assert.equal(jobs[0].source, 'thermofisherscientific')
  assert.equal(jobs[0].location, 'Remote, India')
})

test('Thermo Fisher Scientific honors an explicit maximum of 100 jobs', async () => {
  const thermoFisherScientific = await loadThermoFisherScientificModule()
  const detailRequests = []
  const indiaListings = Array.from({ length: 101 }, (_, index) => ({
    reqId: `TF-INDIA-${index + 1}`,
    jobId: `TF-INDIA-${index + 1}`,
    title: `Software Engineer ${index + 1}`,
    cityStateCountry: 'Remote, India',
    country: 'India',
  }))
  const boundedSearchResultsHtml = `<script>phApp.ddo = ${JSON.stringify({
    eagerLoadRefineSearch: {
      totalHits: 101,
      hits: 101,
      data: {
        jobs: indiaListings,
        aggregations: [{ field: 'country', value: { India: 101 } }],
      },
    },
  })}</script>`

  const jobs = await thermoFisherScientific.run({
    maxJobs: 100,
    fetchText: async (url) => {
      if (url === thermoFisherScientific.buildSearchResultsPageUrl()) {
        return boundedSearchResultsHtml
      }
      detailRequests.push(url)
      return detailHtml
    },
  })

  assert.equal(jobs.length, 100)
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
  assert.equal(detailRequests.length, 100)
  assert.match(detailRequests.at(-1), /TF-INDIA-100/)
})
