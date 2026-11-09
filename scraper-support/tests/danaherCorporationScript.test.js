import assert from 'node:assert/strict'
import test from 'node:test'

test('Danaher Corporation scraper keeps only its India listings from the official India search route', async () => {
  const danaher = await import('../../scraper/danahercorporation/script.js')

  assert.equal(
    danaher.buildSearchResultsPageUrl(),
    'https://jobs.danaher.com/global/en/search-results?keywords=India',
  )

  const jobs = danaher.extractSearchResults({
    jobs: [
      {
        reqId: 'R-DANAHER-INDIA',
        jobId: 'R-DANAHER-INDIA',
        title: 'Corporate Strategy Manager',
        opco: 'Danaher Corporation',
        country: 'India',
        cityStateCountry: 'Bangalore, Karnataka, India',
      },
      {
        reqId: 'R-OTHER-INDIA',
        jobId: 'R-OTHER-INDIA',
        title: 'Software Engineer',
        opco: 'Cytiva',
        country: 'India',
        cityStateCountry: 'Bangalore, Karnataka, India',
      },
      {
        reqId: 'R-DANAHER-US',
        jobId: 'R-DANAHER-US',
        title: 'Corporate Strategy Manager',
        opco: 'Danaher Corporation',
        country: 'United States of America',
        cityStateCountry: 'Washington, District of Columbia, United States of America',
      },
    ],
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'R-DANAHER-INDIA')
  assert.equal(jobs[0].company, undefined)
  assert.equal(jobs[0].country, 'India')
  assert.match(jobs[0].sourceUrl, /R-DANAHER-INDIA/)
})
