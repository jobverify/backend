import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { runWorkdayScraper as runWorkdayScraperImpl, fetchWorkdayJobsApiPage as fetchWorkdayJobsApiPageImpl } from '../myworkday/engine.js'

// Parser/deadline fixtures isolate pacing, which has its own integration tests.
const requestScheduler = { acquire: async () => () => {}, recordRateLimit: () => {} }
const fetchWorkdayJobsApiPage = (options) => fetchWorkdayJobsApiPageImpl({ requestScheduler, ...options })
const runWorkdayScraper = (options) => runWorkdayScraperImpl({ requestScheduler, ...options })

const scraperDir = fileURLToPath(new URL('../myworkday', import.meta.url))
const options = {
  company: 'Workday budget fixture',
  baseUrl: 'https://budget-fixture.wd3.myworkdayjobs.com/External',
  source: 'workday-budget-fixture',
  scraperDir,
  retryBaseDelayMs: 0,
}
const posting = (index, location = 'Bangalore, India') => ({
  title: `Engineer ${index}`,
  externalPath: `/job/Location/Engineer_R${index}`,
  locationsText: location,
})
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', ...headers },
})

test('Workday fetches the complete listing before spending time enriching details', async (t) => {
  let listed = 0
  let firstDetailListingCount
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (init.method === 'POST') {
      const { offset } = JSON.parse(init.body)
      const jobs = Array.from({ length: Math.min(20, 41 - offset) }, (_, i) => posting(offset + i + 1))
      listed += jobs.length
      return json({ total: 41, jobPostings: jobs })
    }
    if (String(url).includes('/job/')) firstDetailListingCount ??= listed
    return new Response('<html>Workday</html>')
  })

  const jobs = await runWorkdayScraper(options)
  assert.equal(jobs.length, 41)
  assert.equal(firstDetailListingCount, 41)
})

test('Workday does not truncate complete API listings at the inherited ten-page DOM cap', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, init = {}) => {
    if (init.method !== 'POST') return new Response('<html>Workday</html>')
    const { offset } = JSON.parse(init.body)
    return json({
      total: 221,
      jobPostings: Array.from({ length: Math.min(20, 221 - offset) }, (_, i) => posting(offset + i + 1)),
    })
  })

  const jobs = await runWorkdayScraper(options)
  assert.equal(jobs.length, 221)
  assert.equal(jobs.at(-1).title, 'Engineer 221')
})

test('Workday ends optional detail enrichment at its budget and retains all safe India listings', async (t) => {
  let detailRequests = 0
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (init.method === 'POST') return json({ total: 6, jobPostings: Array.from({ length: 6 }, (_, i) => posting(i + 1)) })
    if (!String(url).includes('/job/')) return new Response('<html>Workday</html>')
    detailRequests += 1
    return new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
    })
  })
  const startedAt = Date.now()
  const jobs = await runWorkdayScraper({ ...options, detailEnrichmentBudgetMs: 20, requestTimeoutMs: 300 })
  assert.equal(jobs.length, 6)
  assert.ok(Date.now() - startedAt < 250, 'optional detail work must finish before its request timeout')
  assert.ok(detailRequests <= 4)
  assert.equal(jobs.at(-1).title, 'Engineer 6')
})

test('Workday refuses a snapshot if the detail budget leaves grouped India locations unresolved', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (init.method === 'POST') return json({ total: 2, jobPostings: [posting(1), posting(2, '2 Locations')] })
    // A valid native JSON response with only one of two promised locations
    // exercises geography. HTML at this endpoint is a separate contract error.
    if (String(url).includes('/wday/cxs/')) return json({ jobPostingInfo: {
      location: 'Bangalore, India', additionalLocations: [],
    } })
    return new Response('<html>Workday</html>')
  })

  await assert.rejects(
    runWorkdayScraper({ ...options, detailEnrichmentBudgetMs: 0 }),
    (error) => error.name === 'WorkdayIncompleteScopeError' && error.abortRetries === true,
  )
})

test('Workday preserves Retry-After when a JSON 429 only supplies an error code', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json({ errorCode: 'HTTP_429' }, 429, { 'retry-after': '0' }))
  const startedAt = Date.now()
  await assert.rejects(fetchWorkdayJobsApiPage({
    jobsApiUrl: 'https://retry-fixture.wd3.myworkdayjobs.com/wday/cxs/fixture/External/jobs',
    appliedFacets: {},
    offset: 0,
    retryBaseDelayMs: 0,
  }), (error) => error.jobsApiHttpStatus === 429 && error.retryDelayMs === 0)
  assert.ok(Date.now() - startedAt < 1000)
})

test('Workday continues a short API page when the server still reports more results', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, init = {}) => {
    if (init.method !== 'POST') return new Response('<html>Workday</html>')
    const { offset } = JSON.parse(init.body)
    return json({ total: 3, jobPostings: [posting(offset + 1)] })
  })
  const jobs = await runWorkdayScraper(options)
  assert.equal(jobs.length, 3)
})

test('Workday fails closed when an explicit API page cap would leave listings incomplete', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, init = {}) => init.method === 'POST'
    ? json({ total: 21, jobPostings: Array.from({ length: 20 }, (_, i) => posting(i + 1)) })
    : new Response('<html>Workday</html>'))
  await assert.rejects(runWorkdayScraper({
    ...options,
    scraperDir: fileURLToPath(new URL('./fixtures/workday-api-page-cap', import.meta.url)),
  }), (error) => error.name === 'WorkdayIncompleteListingError' && error.abortRetries === true)
})

test('Workday rejects a failed later listing page before publishing or enriching earlier pages', async (t) => {
  let detailRequests = 0
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (String(url).includes('/job/')) detailRequests += 1
    if (init.method !== 'POST') return new Response('<html>Workday</html>')
    const { offset } = JSON.parse(init.body)
    return offset === 0
      ? json({ total: 21, jobPostings: Array.from({ length: 20 }, (_, i) => posting(i + 1)) })
      : json({ errorCode: 'HTTP_429', httpStatus: 429 }, 429, { 'retry-after': '0' })
  })
  await assert.rejects(runWorkdayScraper(options), (error) => error.jobsApiHttpStatus === 429)
  assert.equal(detailRequests, 0)
})

test('Workday propagates caller cancellation during the optional detail phase', async (t) => {
  const controller = new AbortController()
  const reason = new Error('caller cancelled details')
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (init.method === 'POST') return json({ total: 1, jobPostings: [posting(1)] })
    if (String(url).includes('/job/')) {
      controller.abort(reason)
      throw reason
    }
    return new Response('<html>Workday</html>')
  })
  await assert.rejects(runWorkdayScraper({ ...options, signal: controller.signal }), (error) => error === reason)
})

test('Workday retains earlier totals when a later empty page resets total to zero', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, init = {}) => {
    if (init.method !== 'POST') return new Response('<html>Workday</html>')
    const { offset } = JSON.parse(init.body)
    return offset === 0
      ? json({ total: 21, jobPostings: Array.from({ length: 20 }, (_, i) => posting(i + 1)) })
      : json({ total: 0, jobPostings: [] })
  })
  await assert.rejects(runWorkdayScraper(options), (error) => error.name === 'WorkdayIncompleteListingError')
})

test('Workday stops at a remembered exact total when later pages reset total to zero', async (t) => {
  const offsets = []
  t.mock.method(globalThis, 'fetch', async (_url, init = {}) => {
    if (init.method !== 'POST') return new Response('<html>Workday</html>')
    const { offset } = JSON.parse(init.body)
    offsets.push(offset)
    const start = offset === 0 ? 1 : 21
    return json({
      total: offset === 0 ? 40 : 0,
      jobPostings: Array.from({ length: 20 }, (_, index) => posting(start + index)),
    })
  })
  const jobs = await runWorkdayScraper({ ...options, detailEnrichmentBudgetMs: 0 })
  assert.equal(jobs.length, 40)
  assert.deepEqual(offsets, [0, 20])
})

test('Workday fails closed when the selected country facet proves the API total is capped', async (t) => {
  let listingRequests = 0
  t.mock.method(globalThis, 'fetch', async (_url, init = {}) => {
    if (init.method !== 'POST') return new Response('<html>Workday</html>')
    listingRequests += 1
    return json({
      total: 2000,
      jobPostings: Array.from({ length: 20 }, (_, index) => posting(index + 1)),
      facets: [{
        facetParameter: 'locationMainGroup',
        values: [{
          descriptor: 'Location',
          facets: [{
            facetParameter: 'locationCountry',
            values: [{
              descriptor: 'India',
              id: 'c4f78be1a8f14da0ab49ce1162348a5e',
              count: 38594,
            }],
          }],
        }],
      }],
    })
  })
  await assert.rejects(
    runWorkdayScraper({ ...options, detailEnrichmentBudgetMs: 0 }),
    (error) => {
      assert.equal(error.name, 'WorkdayIncompleteListingError')
      assert.match(error.message, /country facet reports 38594 jobs but the API total is 2000/i)
      assert.equal(error.softFailure, true)
      assert.equal(error.upstreamOutage, false)
      assert.equal(error.failureKind, 'upstream_inventory_unavailable')
      assert.equal(error.abortRetries, true)
      return true
    },
  )
  assert.equal(listingRequests, 1)
})

test('Workday rejects repeated API pages instead of accepting a complete raw offset', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, init = {}) => init.method === 'POST'
    ? json({ total: 40, jobPostings: Array.from({ length: 20 }, (_, i) => posting(i + 1)) })
    : new Response('<html>Workday</html>'))
  await assert.rejects(runWorkdayScraper(options), (error) => error.name === 'WorkdayIncompleteListingError')
})

test('Workday rejects overlapping final pages that do not contain the reported unique vacancies', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, init = {}) => {
    if (init.method !== 'POST') return new Response('<html>Workday</html>')
    const { offset } = JSON.parse(init.body)
    return json({ total: 40, jobPostings: Array.from({ length: 20 }, (_, i) => posting(i + (offset ? 2 : 1))) })
  })
  await assert.rejects(runWorkdayScraper(options), (error) => error.name === 'WorkdayIncompleteListingError')
})

test('Workday resolves grouped location scope before spending the detail budget on safe summaries', async (t) => {
  const details = []
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (init.method === 'POST') return json({ total: 2, jobPostings: [posting(1), posting(2, '2 Locations')] })
    if (!String(url).includes('/job/')) return new Response('<html>Workday</html>')
    details.push(String(url))
    if (String(url).includes('/wday/cxs/')) return json({ jobPostingInfo: { location: 'Bangalore, India', additionalLocations: ['London, United Kingdom'] } })
    if (String(url).endsWith('_R2')) return new Response('<dl><dt>locations</dt><dd>Bangalore, India</dd><dd>London, United Kingdom</dd></dl>')
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }))
  })
  const jobs = await runWorkdayScraper({
    ...options, detailEnrichmentBudgetMs: 30, requestTimeoutMs: 300,
    scraperDir: fileURLToPath(new URL('./fixtures/workday-detail-fallback-single-concurrency', import.meta.url)),
  })
  assert.equal(jobs.length, 2)
  assert.match(details[0], /_R2$/)
})

test('Workday keeps India secondary locations from CXS scope data when HTML shows only foreign primary locations', async (t) => {
  const paths = [
    '/job/GBR-London-5-Canada-Square/Architect_R0121536-1',
    '/job/Seoul-Seoul-Korea/Quality-Leader_R72909-2',
    '/job/London/Foreign-Only_R3',
  ]
  const scopeInfo = [
    { location: 'GBR-London-5 Canada Square', additionalLocations: ['IND-Bangalore-A, RMZ Infinity', 'Nottingham, United Kingdom'] },
    { location: 'Seoul, Seoul, Korea', additionalLocations: ['Gurgaon, Haryana, India'] },
    { location: 'London, United Kingdom', additionalLocations: ['New York, United States'] },
  ]
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (init.method === 'POST') return json({ total: 3, jobPostings: paths.map((externalPath, index) => ({
      ...posting(index + 1, index === 0 ? '3 Locations' : '2 Locations'), externalPath,
    })) })
    if (String(url).includes('/wday/cxs/')) {
      const index = paths.findIndex(path => String(url).endsWith(path))
      return json({ jobPostingInfo: scopeInfo[index] })
    }
    return new Response('<html>HTML with a foreign primary location only</html>')
  })
  const jobs = await runWorkdayScraper({ ...options, detailEnrichmentBudgetMs: 0 })
  assert.equal(jobs.length, 2)
  assert.ok(jobs[0].locations.includes('IND-Bangalore-A, RMZ Infinity'))
  assert.ok(jobs[1].locations.includes('Gurgaon, Haryana, India'))
  assert.equal(jobs[0].location, 'IND-Bangalore-A, RMZ Infinity')
  assert.equal(jobs[1].location, 'Gurgaon, Haryana, India')
  assert.equal(jobs[0].city, 'Bangalore')
  assert.equal(jobs[1].city, 'Gurgaon')
})

test('Workday rejects incomplete CXS location data for a grouped listing', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (init.method === 'POST') return json({ total: 1, jobPostings: [posting(1, '3 Locations')] })
    if (String(url).includes('/wday/cxs/')) return json({ jobPostingInfo: { location: 'London, United Kingdom' } })
    return new Response('<html>Workday</html>')
  })
  await assert.rejects(runWorkdayScraper({ ...options, detailEnrichmentBudgetMs: 0 }),
    (error) => error.name === 'WorkdayIncompleteScopeError')
})


test('Workday refuses unrecognized CXS location labels rather than treating them as confirmed foreign scope', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (init.method === 'POST') return json({ total: 1, jobPostings: [posting(1, '2 Locations')] })
    if (String(url).includes('/wday/cxs/')) return json({ jobPostingInfo: {
      location: 'Headquarters', additionalLocations: ['Regional Office'],
    } })
    return new Response('<html>Workday</html>')
  })
  await assert.rejects(runWorkdayScraper({ ...options, detailEnrichmentBudgetMs: 0 }),
    (error) => error.name === 'WorkdayIncompleteScopeError')
})

test('Workday uses structured CXS country evidence for labels without a country name', async (t) => {
  const paths = [
    '/job/Home-Office-India/India-Role_R1',
    '/job/Hazlet/US-Role_R2',
    '/job/Tokyo/Japan-Role_R3',
    '/job/Valbonne/France-Role_R4',
  ]
  const scopeInfo = [
    { location: 'Home Office', country: { descriptor: 'India' },
      jobRequisitionLocation: { country: { descriptor: 'India', alpha2Code: 'IN' } } },
    { location: 'Hazlet', country: { descriptor: 'United States of America' },
      jobRequisitionLocation: { country: { descriptor: 'United States of America', alpha2Code: 'US' } } },
    { location: 'Tokyo - 7 F S-Gate Akasaka Sanno', country: { descriptor: 'Japan' },
      jobRequisitionLocation: { country: { descriptor: 'Japan', alpha2Code: 'JP' } } },
    { location: 'VALBONNE (Sophia)', country: { descriptor: 'France' },
      jobRequisitionLocation: { country: { descriptor: 'France', alpha2Code: 'FR' } } },
  ]
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (init.method === 'POST') return json({ total: paths.length, jobPostings: paths.map((externalPath, index) => ({
      ...posting(index + 1, index === 0 ? 'Home Office' : externalPath.split('/')[2]), externalPath,
    })) })
    if (String(url).includes('/wday/cxs/')) {
      const index = paths.findIndex(path => String(url).endsWith(path))
      return json({ jobPostingInfo: scopeInfo[index] })
    }
    return new Response('<html>Workday</html>')
  })
  const jobs = await runWorkdayScraper({ ...options, detailEnrichmentBudgetMs: 0 })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Home Office, India')
})

test('Workday counts duplicate raw CXS locations while deduplicating stored locations', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (init.method === 'POST') return json({ total: 1, jobPostings: [posting(1, '2 Locations')] })
    if (String(url).includes('/wday/cxs/')) return json({ jobPostingInfo: {
      location: 'Hyderabad - DTI Waverock SEZ',
      additionalLocations: ['Hyderabad - DTI Waverock SEZ'],
      country: { descriptor: 'India' },
      jobRequisitionLocation: { country: { descriptor: 'India', alpha2Code: 'IN' } },
    } })
    return new Response('<html>Workday</html>')
  })
  const jobs = await runWorkdayScraper({ ...options, detailEnrichmentBudgetMs: 0 })
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0].locations, ['Hyderabad - DTI Waverock SEZ'])
})

test('Workday retries required CXS scope rate limits using Retry-After before optional enrichment', async (t) => {
  let scopeRequests = 0
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (init.method === 'POST') return json({ total: 1, jobPostings: [posting(1, '2 Locations')] })
    if (String(url).includes('/wday/cxs/')) {
      scopeRequests += 1
      if (scopeRequests === 1) return json({ errorCode: 'HTTP_429' }, 429, { 'retry-after': '0' })
      return json({ jobPostingInfo: { location: 'London, United Kingdom', additionalLocations: ['Gurgaon, India'] } })
    }
    return new Response('<html>Workday</html>')
  })
  const startedAt = Date.now()
  const jobs = await runWorkdayScraper({ ...options, detailEnrichmentBudgetMs: 0 })
  assert.equal(jobs.length, 1)
  assert.equal(scopeRequests, 2)
  assert.ok(Date.now() - startedAt < 1000)
})

test('Workday propagates source cancellation during required CXS scope verification', async (t) => {
  const controller = new AbortController()
  const reason = new Error('source deadline')
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (init.method === 'POST') return json({ total: 1, jobPostings: [posting(1, '2 Locations')] })
    if (String(url).includes('/wday/cxs/')) return new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
      controller.abort(reason)
    })
    return new Response('<html>Workday</html>')
  })
  await assert.rejects(runWorkdayScraper({ ...options, signal: controller.signal, detailEnrichmentBudgetMs: 0 }),
    (error) => error === reason)
})


test('Workday excludes grouped US-only roles with a Workday USA Offices location', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (init.method === 'POST') return json({
      total: 2, jobPostings: [posting(1), posting(2, '3 Locations')],
    })
    if (String(url).includes('/wday/cxs/')) return json({ jobPostingInfo: {
      location: 'USA, IL, Chicago',
      additionalLocations: ['USA, WY, Remote', 'Workday USA Offices'],
      country: { descriptor: 'United States of America' },
      jobRequisitionLocation: { country: { alpha2Code: 'US' } },
    } })
    return new Response('<html>Workday</html>')
  })
  const jobs = await runWorkdayScraper({ ...options, detailEnrichmentBudgetMs: 0 })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Engineer 1')
  assert.equal(jobs[0].location, 'Bangalore, India')
})
