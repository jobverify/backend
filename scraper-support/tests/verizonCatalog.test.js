import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Verizon on the official careers page backed by Workday', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'verizon')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Verizon')
  assert.equal(provider.companyCareerPage, 'https://mycareer.verizon.com/jobs/')
  assert.equal(provider.companyDomain, 'mycareer.verizon.com')
  assert.equal(provider.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.match(provider.baseUrl, /verizon\.wd12\.myworkdayjobs\.com\/verizon-careers/i)
})

test('buildScrapers exposes a runnable Verizon Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'verizon')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /verizon.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'verizon')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})

test('Verizon sends all official India location facets instead of the ignored country filter', async (t) => {
  const indiaLocationIds = [
    '4466d54cbeba1000c057b4c460500000',
    '4466d54cbeba1000c05cff9bdacc0000',
    '4466d54cbeba1000c066b6f377040000',
  ]
  const listingRequests = []
  t.mock.method(globalThis, 'fetch', async (_url, options = {}) => {
    if (options.method !== 'POST') return new Response('<html>Workday</html>')
    const request = JSON.parse(options.body)
    listingRequests.push(request)
    // Verizon ignores locationCountry. Only its declared location IDs narrow
    // the board; a partial India result must not appear to validate that filter.
    const correctlyScoped = indiaLocationIds.every((id) => request.appliedFacets.locations?.includes(id))
    const cities = correctlyScoped ? ['Bangalore', 'Chennai', 'Hyderabad'] : ['Bangalore']
    return new Response(JSON.stringify({
      total: cities.length,
      jobPostings: cities.map((city, index) => ({
        title: `Engineer ${city}`,
        externalPath: `/job/${city}-India/Engineer_R${index + 1}`,
        locationsText: `${city}, India`,
      })),
    }), { headers: { 'content-type': 'application/json' } })
  })

  const scraper = buildScrapers().find((item) => item.name === 'verizon')
  const jobs = await scraper.run()
  assert.equal(jobs.length, 3)
  assert.equal(listingRequests.length, 1)
  assert.deepEqual(listingRequests[0].appliedFacets, { locations: indiaLocationIds })
  assert.deepEqual(jobs.map((job) => job.title), ['Engineer Bangalore', 'Engineer Chennai', 'Engineer Hyderabad'])
})
