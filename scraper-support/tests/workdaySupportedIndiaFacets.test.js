import assert from 'node:assert/strict'
import test from 'node:test'
import { buildScrapers } from '../providers/index.js'

const indiaCountryId = 'c4f78be1a8f14da0ab49ce1162348a5e'
const cases = [
  ['altera', { locations: ['7a5690ab19831000af4c51ba7c190000', '7a5690ab19831000af4bec9f639a0000'] }],
  ['broadridge', { Location_Country: [indiaCountryId] }],
  ['cadence', { Location_Country: [indiaCountryId] }],
  ['elsevier', { Country___Territory: [indiaCountryId] }],
]

for (const [source, expectedFacets] of cases) {
  test(`${source} requests its declared India facet without narrowing roles by keyword`, async (t) => {
    const requests = []
    t.mock.method(globalThis, 'fetch', async (_url, options = {}) => {
      if (options.method !== 'POST') return new Response('<html>Workday</html>')
      const request = JSON.parse(options.body)
      requests.push(request)
      const scoped = JSON.stringify(request.appliedFacets) === JSON.stringify(expectedFacets)
        && request.searchText === ''
      // A text query can match only one of the valid India vacancies. The exact
      // declared geography filter must recover the role lacking that keyword.
      const jobPostings = (scoped ? ['Engineer', 'Analyst'] : ['Engineer']).map((title, index) => ({
        title,
        externalPath: `/job/Bangalore/${title}_R${index + 1}`,
        locationsText: 'Bangalore, India',
      }))
      return new Response(JSON.stringify({ total: jobPostings.length, jobPostings }), {
        headers: { 'content-type': 'application/json' },
      })
    })

    const scraper = buildScrapers().find((item) => item.name === source)
    const jobs = await scraper.run()
    assert.deepEqual(jobs.map((job) => job.title), ['Engineer', 'Analyst'])
    assert.equal(requests.length, 1)
    assert.deepEqual(requests[0].appliedFacets, expectedFacets)
    assert.equal(requests[0].searchText, '')
  })
}
