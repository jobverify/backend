import assert from 'node:assert/strict'
import test from 'node:test'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const provider = source => getScraperCatalog().find(row => row.source === source)

test('1X enumerates its verified Ashby board and keeps foreign inventory distinct from an empty board', async () => {
  const jobs = await createCatalogScraper(provider('1x')).run({ fetchJson: async url => {
    assert.equal(url, 'https://api.ashbyhq.com/posting-api/job-board/1x')
    return { apiVersion: '1', jobs: [{ id: 'fixture-us', title: 'Software Engineer', location: 'Palo Alto, California, United States',
      jobUrl: 'https://jobs.ashbyhq.com/1x/fixture-us', applyUrl: 'https://jobs.ashbyhq.com/1x/fixture-us/application',
      descriptionPlain: 'Build reliable robotics software.', isListed: true }] }
  } })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 1)
})

test('Abridge verifies the current handoff to its case-sensitive board and returns fixture role content', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Abridge tests must use controlled transport'))
  const abridge = provider('abridge')
  const requests = []
  const jobs = await createCatalogScraper(abridge).run({
    fetchPage: async url => {
      requests.push(url)
      assert.equal(url, abridge.companyCareerPage)
      return { status: 200, url, html: '<a href="https://jobs.ashbyhq.com/Abridge">All open roles</a>' }
    },
    fetchJson: async url => {
      requests.push(url)
      assert.equal(url, 'https://api.ashbyhq.com/posting-api/job-board/Abridge')
      return { apiVersion: '1', jobs: [{ id: 'fixture-in', title: 'Software Engineer', location: 'Bengaluru, India',
        jobUrl: 'https://jobs.ashbyhq.com/Abridge/fixture-in', applyUrl: 'https://jobs.ashbyhq.com/Abridge/fixture-in/application',
        descriptionPlain: 'Build reliable healthcare software.', isListed: true }] }
    },
  })
  assert.deepEqual(requests, [abridge.companyCareerPage, 'https://api.ashbyhq.com/posting-api/job-board/Abridge'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'abridge')
  assert.match(jobs[0].jobDescription, /healthcare software/)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
})

test('verified Workday bindings execute the exact official sites with an explicit India facet', async t => {
  for (const [source, endpoint, facetParameter] of [
    ['3m', 'https://3m.wd1.myworkdayjobs.com/wday/cxs/3m/Search/jobs', 'Location_Country'],
    ['adventhealth', 'https://adventhealth.wd12.myworkdayjobs.com/wday/cxs/adventhealth/AH_External_Career_Site/jobs', 'locationCountry'],
  ]) {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    if (options.method !== 'POST') return new Response('<html>Workday careers</html>')
    calls += 1
    assert.equal(String(url), endpoint)
    const body = JSON.parse(options.body)
    assert.deepEqual(body.appliedFacets, { [facetParameter]: ['c4f78be1a8f14da0ab49ce1162348a5e'] })
    return new Response(JSON.stringify({ total: 0, jobPostings: [], facets: [{
      facetParameter, descriptor: source === '3m' ? 'Geography/Country' : 'Country',
      values: [{ descriptor: 'India', id: 'c4f78be1a8f14da0ab49ce1162348a5e', count: 0 }],
    }] }), { headers: { 'content-type': 'application/json' } })
  })
  const jobs = await createCatalogScraper(provider(source)).run()
  assert.equal(calls, 1)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.status, 'verified-empty')
  t.mock.restoreAll()
  }
})

test('Advantech enumerates its whole board without country facets or keywords and resolves foreign role locations before reporting zero India', async t => {
  const endpoint = 'https://advantech.wd3.myworkdayjobs.com/wday/cxs/advantech/External/jobs'
  const detailEndpoint = 'https://advantech.wd3.myworkdayjobs.com/wday/cxs/advantech/External/job/Taipei/Software-Engineer_R10001'
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    if (options.method !== 'POST' && new URL(url).pathname === '/en-US/External') {
      return new Response('<html><title>Advantech Careers</title></html>')
    }
    requests.push(String(url))
    if (options.method === 'POST') {
      assert.equal(String(url), endpoint)
      const body = JSON.parse(options.body)
      assert.deepEqual(body.appliedFacets, {})
      assert.equal(body.searchText, '')
      return new Response(JSON.stringify({ total: 1, facets: [], jobPostings: [{
        title: 'Software Engineer', externalPath: '/job/Taipei/Software-Engineer_R10001',
        locationsText: '2 Locations', postedOn: 'Posted Today', bulletFields: ['R10001'],
      }] }), { headers: { 'content-type': 'application/json' } })
    }
    assert.equal(String(url), detailEndpoint)
    return new Response(JSON.stringify({ jobPostingInfo: {
      title: 'Software Engineer', jobReqId: 'R10001',
      jobDescription: '<p>Develop industrial computing software and validate reliable device integrations.</p>',
      location: 'Taipei, Taiwan', additionalLocations: ['Tokyo, Japan'],
      country: { descriptor: 'Taiwan', alpha2Code: 'TW' },
      timeType: 'Full time', workerSubType: 'Regular', canApply: true,
    } }), { headers: { 'content-type': 'application/json' } })
  })
  const jobs = await createCatalogScraper(provider('advantech')).run()
  assert.equal(jobs.length, 0)
  assert.deepEqual(requests, [endpoint, detailEndpoint])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 1)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(jobs[Symbol.for('jobverify.workday.authoritative-empty')], undefined)
})
