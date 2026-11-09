import assert from 'node:assert/strict'
import test from 'node:test'
import { createClarisightsScraper, run } from '../../scraper/clarisights/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const careersHtml = `
  <html><head><title>Clarisights Careers</title>
    <link rel="canonical" href="https://clarisights.com/careers">
  </head><body><h1>Careers at Clarisights</h1>
    <iframe srcdoc="&lt;script src=&quot;https://scripts.teamtailor-cdn.com/widgets/eu-pink/jobs.js&quot;&gt;&lt;/script&gt;&lt;div class=&quot;teamtailor-jobs-widget&quot; data-teamtailor-api-key=&quot;public-widget-key&quot;&gt;&lt;/div&gt;"></iframe>
  </body></html>
`
const job = (id, title, locationId) => ({
  id, type: 'jobs',
  attributes: { title, body: '<p>Build metrics infrastructure.</p>', 'human-status': 'published', status: 'open', internal: false, 'remote-status': 'hybrid', 'start-date': null, 'end-date': null },
  links: {
    'careersite-job-url': `https://clarisights.teamtailor.com/jobs/${id}-role`,
    'careersite-job-apply-url': `https://clarisights.teamtailor.com/jobs/${id}-role/applications/new`,
  },
  relationships: { department: { data: { type: 'departments', id: 'engineering' } }, locations: { data: [{ type: 'locations', id: locationId }] } },
})
const included = [
  { id: 'engineering', type: 'departments', attributes: { name: 'Engineering' } },
  { id: 'india', type: 'locations', attributes: { name: null, city: 'Bengaluru', country: 'India' } },
  { id: 'uk', type: 'locations', attributes: { name: null, city: 'London', country: 'United Kingdom' } },
]
const firstPage = {
  data: [job('101', 'Backend Engineer', 'india'), job('102', 'Account Executive', 'uk')], included,
  meta: { 'record-count': 3, 'page-count': 2 },
  links: { next: 'https://api.teamtailor.com/v1/jobs?page%5Bnumber%5D=2' },
}
const secondPage = { data: [job('103', 'Data Engineer', 'india')], included, meta: { 'record-count': 3, 'page-count': 2 }, links: {} }
const fetchCareers = async url => {
  if (url === 'https://clarisights.com/careers') return careersHtml
  throw new Error(`HTTP 404 for ${url}`)
}
const now = () => '2026-10-08T18:00:00.000Z'

test('Clarisights follows its current official Teamtailor widget through every page and maps only India roles', async () => {
  const jobs = await createClarisightsScraper({ now }).run({
    fetchText: fetchCareers,
    fetchJson: async value => {
      const url = new URL(value)
      assert.equal(url.origin + url.pathname, 'https://api.teamtailor.com/v1/jobs')
      assert.equal(url.searchParams.get('api_key'), 'public-widget-key')
      assert.equal(url.searchParams.get('api_version'), '20161108')
      assert.equal(url.searchParams.get('filter[feed]'), 'public')
      assert.equal(url.searchParams.get('include'), 'department,locations')
      return url.searchParams.get('page[number]') === '2' ? secondPage : firstPage
    },
  })
  assert.deepEqual(jobs.map(item => item.jobId), ['101', '103'])
  assert.deepEqual(jobs[0], {
    title: 'Backend Engineer', company: 'Clarisights', department: 'Engineering',
    location: 'Bengaluru, India', city: 'Bengaluru', state: null, country: 'India',
    jobId: '101', requisitionId: '101',
    sourceUrl: 'https://clarisights.teamtailor.com/jobs/101-role',
    applyUrl: 'https://clarisights.teamtailor.com/jobs/101-role/applications/new',
    employmentType: null, experienceRequired: null, minimumQualification: null,
    preferredQualification: null, requiredSkills: [], postingDate: null, closingDate: null,
    jobDescription: 'Build metrics infrastructure.', remoteStatus: 'Hybrid',
    source: 'clarisights', link: 'https://clarisights.teamtailor.com/jobs/101-role/applications/new', scrapedAt: '2026-10-08T18:00:00.000Z',
  })
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 3)
  assert.equal(evidence.pagesFetched, 2)
})

for (const { name, payload, error } of [
  { name: 'a truncated inventory', payload: { ...firstPage, links: {} }, error: /incomplete Teamtailor inventory/ },
  { name: 'a missing advertised total', payload: { ...firstPage, meta: {} }, error: /malformed Teamtailor inventory/ },
  { name: 'unresolved location metadata', payload: { ...secondPage, included: [], meta: { 'record-count': 1, 'page-count': 1 } }, error: /location metadata/ },
  { name: 'a foreign pagination host', payload: { ...firstPage, links: { next: 'https://other.example/v1/jobs' } }, error: /untrusted Teamtailor pagination/ },
  { name: 'a foreign job-board link', payload: { ...secondPage, data: [{ ...secondPage.data[0], links: { 'careersite-job-url': 'https://other.teamtailor.com/jobs/103-role', 'careersite-job-apply-url': 'https://other.teamtailor.com/jobs/103-role/applications/new' } }], meta: { 'record-count': 1, 'page-count': 1 } }, error: /verified Clarisights Teamtailor board/ },
]) {
  test(`Clarisights rejects ${name} instead of returning an incomplete inventory`, async () => {
    await assert.rejects(run({ fetchText: fetchCareers, fetchJson: async () => payload }), error)
  })
}

test('Clarisights rejects the stale Ashby handoff after the official careers page migration', async () => {
  await assert.rejects(run({
    fetchText: async () => '<title>Clarisights Careers</title><script src="https://jobs.ashbyhq.com/clarisights/embed"></script>',
    fetchJson: async () => { throw new Error('Stale Ashby must not be requested') },
  }), /verified Teamtailor widget/)
})

test('Clarisights preserves a verified empty public inventory with explicit zero totals', async () => {
  const jobs = await run({ fetchText: fetchCareers, fetchJson: async () => ({ data: [], included: [], meta: { 'record-count': 0, 'page-count': 0 }, links: {} }) })
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('Clarisights default HTTP request uses the Teamtailor JSON API media type and an explicit first page', async t => {
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url: new URL(url), accept: options.headers.Accept })
    return new Response(JSON.stringify({ ...secondPage, meta: { 'record-count': 1, 'page-count': 1 } }), { headers: { 'Content-Type': 'application/vnd.api+json' } })
  })
  const jobs = await run({ fetchText: fetchCareers })
  assert.equal(jobs.length, 1)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].accept, 'application/vnd.api+json')
  assert.equal(requests[0].url.searchParams.get('page[number]'), '1')
})
