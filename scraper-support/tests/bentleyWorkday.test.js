import assert from 'node:assert/strict'
import test from 'node:test'

import { createBentleySystemsScraper, WORKDAY_BOARD_URL, WORKDAY_JOBS_API_URL } from '../../scraper/bentleysystems/script.js'

const host = '<html><head><title></title></head><body><script src="https://bentleysystems.wd5.myworkdayjobs.com/bentley/assets/app.js"></script></body></html>'
const careers = '<html><head><title>Careers | Bentley Systems | Infrastructure Engineering Software Company</title></head><body><h1>A career at Bentley</h1><a href="https://bentleysystems.wd5.myworkdayjobs.com/bentley">Search jobs</a></body></html>'
const facets = [{ facetParameter: 'locationMainGroup', values: [{ facetParameter: 'locations', values: [
  { descriptor: 'Mumbai, Maharashtra, India', id: 'mumbai-id', count: 1 },
  { descriptor: 'Dublin, Ireland', id: 'dublin-id', count: 1 },
] }] }]
const path = '/job/Mumbai-Maharashtra-India/Technical-Account-Manager_RC125'
const listing = { title: 'Technical Account Manager', externalPath: path, locationsText: 'Mumbai, Maharashtra, India', bulletFields: ['RC125'] }

test('Bentley follows its current official Workday handoff and extracts India jobs', async () => {
  assert.equal(WORKDAY_BOARD_URL, 'https://bentleysystems.wd5.myworkdayjobs.com/bentley')
  assert.equal(WORKDAY_JOBS_API_URL, 'https://bentleysystems.wd5.myworkdayjobs.com/wday/cxs/bentleysystems/bentley/jobs')
  const requests = []
  const jobs = await createBentleySystemsScraper().run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === 'https://jobs.bentley.com/?locale=en_US') return host
      if (url === 'https://www.bentley.com/company/careers/') return careers
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url, options) => {
      requests.push({ url, body: options?.body })
      if (url === WORKDAY_JOBS_API_URL) {
        return options.body.appliedFacets.locations
          ? { total: 1, jobPostings: [listing] }
          : { total: 2, jobPostings: [listing], facets }
      }
      if (url.endsWith(path)) return { jobPostingInfo: {
        id: 'wd-id', title: listing.title, location: listing.locationsText,
        externalUrl: `${WORKDAY_BOARD_URL}${path}`, jobReqId: 'RC125',
        startDate: '2026-10-01', jobDescription: '<p>Partner with Bentley clients.</p>',
      } }
      throw new Error(`Unexpected API URL: ${url}`)
    },
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, listing.title)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].city, 'Mumbai')
  assert.equal(jobs[0].applyUrl, `${WORKDAY_BOARD_URL}${path}`)
  assert.equal(jobs[0].jobDescription, 'Partner with Bentley clients.')
  assert.deepEqual(requests[3].body.appliedFacets, { locations: ['mumbai-id'] })
})

test('Bentley rejects a Workday detail URL outside its verified board', async () => {
  await assert.rejects(createBentleySystemsScraper().run({
    fetchText: async (url) => url === 'https://jobs.bentley.com/?locale=en_US' ? host : careers,
    fetchJson: async (url, options) => url === WORKDAY_JOBS_API_URL
      ? options.body.appliedFacets.locations ? { total: 1, jobPostings: [listing] } : { total: 2, jobPostings: [listing], facets }
      : { jobPostingInfo: { title: listing.title, location: listing.locationsText, externalUrl: 'https://example.com/job/RC125' } },
  }), /Bentley Workday detail/i)
})


test('Bentley uses the verified official Workday handoff when the retired jobs host returns HTTP 404', async () => {
  const jobs = await createBentleySystemsScraper().run({
    fetchText: async (url) => {
      if (url === 'https://jobs.bentley.com/?locale=en_US') throw new Error('HTTP 404 for ' + url)
      if (url === 'https://www.bentley.com/company/careers/') return careers
      throw new Error('Unexpected URL: ' + url)
    },
    fetchJson: async (url, options) => {
      assert.equal(url, WORKDAY_JOBS_API_URL)
      return options.body.appliedFacets.locations ? {total: 0, jobPostings: []} : {total: 0, jobPostings: [], facets}
    },
  })
  assert.deepEqual(jobs, [])
})

test('Bentley rejects a retired jobs host fallback without the verified official handoff', async () => {
  await assert.rejects(createBentleySystemsScraper().run({
    fetchText: async (url) => {
      if (url === 'https://jobs.bentley.com/?locale=en_US') throw new Error('HTTP 404 for ' + url)
      return '<html><title>Careers</title><a href="https://example.com/jobs">Jobs</a></html>'
    },
    fetchJson: async () => assert.fail('Unverified handoff must not query the API'),
  }), /official careers page no longer links/i)
})

test('Bentley classifies HTTP 200 Workday maintenance HTML as an upstream outage', async (t) => {
  const { classifyScraperError } = await import('../utils/failureClassification.js')
  t.mock.method(globalThis, 'fetch', async () => new Response('<title>Workday is currently unavailable.</title>', {status: 200}))
  await assert.rejects(createBentleySystemsScraper().run({fetchText: async (url) => url === 'https://jobs.bentley.com/?locale=en_US' ? host : careers}), (error) => {
    assert.deepEqual(classifyScraperError(error), {softFailure: true, upstreamOutage: true, failureKind: 'network_or_timeout'})
    return true
  })
})
