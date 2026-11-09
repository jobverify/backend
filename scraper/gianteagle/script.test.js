import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSearchResultsPageUrl, buildJobDetailUrl, run } from './script.js'

const listingUrl = 'https://jobs.gianteagle.com/in/hi/search-results'
const jobs = Array.from({ length: 9 }, (_, index) => ({
  reqId: String(390195 + index), jobId: String(390195 + index), jobSeqNo: 'GIEAUS' + (390195 + index) + 'EXTERNALHIIN',
  title: index < 7 ? 'Engineer ' + index : 'Pharmacy Intern ' + index,
  country: index < 7 ? 'India' : 'United States of America',
  cityStateCountry: index < 7 ? 'Karnataka, India' : 'Cleveland, Ohio, United States of America',
  location: index < 7 ? 'India Corporate Office' : 'US Supermarket',
  applyUrl: 'https://gianteagle.wd503.myworkdayjobs.com/GEBExternalcareers/job/India-Corporate-Office/Engineer_' + (390195 + index) + '/apply',
}))
const payload = items => ({status: 200, totalHits: 9, hits: items.length, data: {jobs: items, aggregations: [{field: 'state', value: {'Karnataka': 7, Ohio: 2}}]}})
const bootstrap = '<script>var phApp = phApp || ' + JSON.stringify({widgetApiEndpoint: 'https://jobs.gianteagle.com/widgets',country: 'in',locale: 'hi_IN',deviceType: 'desktop',pageName: 'search-results'}) + '; phApp.ddo = ' + JSON.stringify({eagerLoadRefineSearch: payload(jobs)}) + ';</script>'

test('Giant Eagle uses its official India listing and detail routes', () => {
  assert.equal(buildSearchResultsPageUrl(), listingUrl)
  assert.equal(buildSearchResultsPageUrl(10), listingUrl + '?from=10')
  assert.match(buildJobDetailUrl(jobs[0]), /^https:\/\/jobs.gianteagle.com\/in\/hi\/job\//)
})

test('Giant Eagle covers all nine locale listings before retaining the seven India roles', async () => {
  let calls = 0
  const result = await run({detailEnrichmentBudgetMs: 0,
    fetchText: async url => {assert.equal(url, listingUrl);return bootstrap},
    fetchJson: async (url, options) => {
      calls++; assert.equal(url, 'https://jobs.gianteagle.com/widgets')
      const body = JSON.parse(options.body)
      assert.equal(body.lang, 'hi_IN');assert.equal(body.country, 'in');assert.equal(body.from, 0)
      assert.equal(body.selected_fields, undefined)
      return {refineSearch: payload(jobs)}
    },
  })
  assert.equal(calls, 1)
  assert.equal(result.length, 7)
  assert.equal(new Set(result.map(job => job.jobId)).size, 7)
  assert.ok(result.every(job => job.country === 'India' && job.source === 'gianteagle'))
  assert.ok(result.every(job => job.sourceListingComplete !== false))
})

test('Giant Eagle still rejects a missing raw role even after all seven India positives were seen', async () => {
  await assert.rejects(run({detailEnrichmentBudgetMs: 0,fetchText: async () => bootstrap,
    fetchJson: async (_url, options) => ({refineSearch: payload(JSON.parse(options.body).from ? [] : jobs.slice(0, 8))}),
  }), /PHENOM_INCOMPLETE_SNAPSHOT.*8 unique records of 9/)
})
