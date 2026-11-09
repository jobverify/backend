import assert from 'node:assert/strict'
import test from 'node:test'

const loadGeAerospaceModule = async () => {
  try {
    return await import('../../scraper/geaerospace/script.js')
  } catch {
    assert.fail('Expected GE Aerospace scraper module at ../../scraper/geaerospace/script.js')
  }
}

const searchResultsHtml = `
  <script>
    phApp.ddo = {
      "eagerLoadRefineSearch": {
        "data": {
          "jobs": [
            {
              "reqId": "R5030001",
              "jobId": "R5030001",
              "title": "Lead Engineer",
              "cityStateCountry": "Bengaluru, Karnataka, India",
              "country": "India",
              "category": "Engineering / Technology",
              "type": ["Full-time"],
              "descriptionTeaser": "Build the future of flight.",
              "postedDate": "2026-07-01"
            },
            {
              "reqId": "R5030002",
              "jobId": "R5030002",
              "title": "Manufacturing Engineer",
              "cityStateCountry": "Evendale, Ohio, United States of America",
              "country": "United States of America",
              "category": "Manufacturing & Logistics"
            }
          ],
          "aggregations": [{ "field": "country", "value": { "India": 1 } }]
        },
        "totalHits": 2,
        "hits": 2
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
            "reqId": "R5030001",
            "jobId": "R5030001",
            "title": "Lead Engineer",
            "location": "Bengaluru, Karnataka, India",
            "city": "Bengaluru",
            "ml_country": "India",
            "category": "Engineering / Technology",
            "employmentType": "Full-time",
            "ml_Description": "Design aircraft systems.",
            "postedDate": "2026-07-01"
          }
        }
      }
    }
  </script>
`

test('GE Aerospace uses its official Phenom job-results route', async () => {
  const { buildSearchResultsPageUrl } = await loadGeAerospaceModule()

  assert.equal(
    buildSearchResultsPageUrl(),
    'https://careers.geaerospace.com/global/en/search-results',
  )
  assert.equal(
    buildSearchResultsPageUrl(20),
    'https://careers.geaerospace.com/global/en/search-results?from=20',
  )
})

test('run returns only India GE Aerospace jobs with shared runner fields', async () => {
  const { buildSearchResultsPageUrl, run } = await loadGeAerospaceModule()
  const requestedUrls = []

  const jobs = await run({
    maxPages: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === buildSearchResultsPageUrl()) return searchResultsHtml
      if (url === 'https://careers.geaerospace.com/global/en/job/R5030001/Lead-Engineer') {
        return detailHtml
      }
      throw new Error(`Unexpected GE Aerospace fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    buildSearchResultsPageUrl(),
    'https://careers.geaerospace.com/global/en/job/R5030001/Lead-Engineer',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'GE Aerospace')
  assert.equal(jobs[0].source, 'geaerospace')
  assert.equal(jobs[0].jobId, 'R5030001')
  assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
})
