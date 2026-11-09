import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'

globalThis.fetch = () => { throw new Error('OFFLINE fetch tripwire: Degreed tests must inject transport') }
const { getScraperCatalog, createCatalogScraper } = await import('../../scraper-support/providers/index.js')
const { readInventoryEvidence } = await import('../../scraper-support/utils/inventoryEvidence.js')
const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261027.json.gz', import.meta.url))))
const CAREERS = 'https://degreed.com/experience/careers/'
const BOARD = 'https://job-boards.greenhouse.io/degreed'
const API = 'https://boards-api.greenhouse.io/v1/boards/degreed/jobs?content=true'
const provider = () => getScraperCatalog().find(row => row.source === 'degreed')
const remix = body => JSON.parse(body.match(/window\.__remixContext\s*=\s*(\{[^]*?\});\s*<\/script>/)[1])
const current = name => fixture.responses.find(row => row.name === name)
const html = data => `<html><script>window.__remixContext = ${JSON.stringify({ state: { loaderData: data } })};</script></html>`

// Explicit synthetic future positives, based on the exact current native field shapes.
function future(roles, { pages = 1 } = {}) {
  const originalBoard = remix(current('board-opening').body).state.loaderData
  const originalDetail = remix(current('detail-5968598004').body).state.loaderData
  const originalApi = JSON.parse(current('registered-api-original').body).jobs[0]
  const corporate = `<a href="${BOARD}">Current openings</a>` + roles.map(role => `<a href="${BOARD}/jobs/${role.id}">${role.title || 'Software Engineer'}</a>`).join('')
  const native = roles.map(role => ({ ...structuredClone(originalApi), id: role.id, title: role.title || 'Software Engineer', internal_job_id: Number(role.id) + 100, requisition_id: `REQ-${role.id}`, absolute_url: `${BOARD}/jobs/${role.id}`, first_published: '2026-10-26T11:22:33+05:30', updated_at: '2026-10-27T12:00:00+05:30', location: { name: 'Bengaluru, India' }, offices: [{ id: 1, name: 'Bengaluru, India', location: 'Bengaluru, India', child_ids: [], parent_id: null }], ...role }))
  const bodies = new Map([[CAREERS, corporate], [API, JSON.stringify({ jobs: native, meta: { total: native.length } })]])
  for (let page = 1; page <= pages; page++) {
    const rows = pages === 1 ? native : native.slice(page - 1, page)
    const data = structuredClone(originalBoard)
    data.root.urlToken = 'degreed'
    data['routes/$url_token'].jobPosts = { count: rows.length, page, total: native.length, total_pages: pages, data: rows.map(row => ({ id: row.id, title: row.title, internal_job_id: row.internal_job_id, requisition_id: row.requisition_id, location: row.location.name, absolute_url: row.absolute_url, published_at: row.first_published, updated_at: row.updated_at, department: row.departments[0] })) }
    data['routes/$url_token'].featuredPosts = { data: [] }
    bodies.set(page === 1 ? BOARD : `${BOARD}?page=${page}`, html(data))
  }
  for (const row of native) {
    const data = structuredClone(originalDetail)
    const d = data['routes/$url_token_.jobs_.$job_post_id']
    d.jobPostId = String(row.id)
    d.jobPost = { ...d.jobPost, title: row.title, hiring_plan_id: row.internal_job_id, job_post_location: row.location.name, public_url: row.absolute_url, published_at: row.first_published }
    bodies.set(row.absolute_url, html(data))
  }
  return { bodies, native }
}

async function replay(bodies, options = {}) {
  const calls = [], visits = new Map()
  let audit
  const fetchImpl = async (url, init = {}) => {
    assert.equal(init.method, 'GET', 'only anonymous GETs are allowed')
    assert.equal(init.body, undefined)
    assert.equal(init.headers?.Authorization, undefined)
    calls.push(url)
    visits.set(url, (visits.get(url) || 0) + 1)
    const body = typeof bodies === 'function' ? bodies(url, visits.get(url)) : bodies.get(url)
    assert.notEqual(body, undefined, `Unexpected offline request ${url}`)
    return body instanceof Response ? body : new Response(body, { status: 200 })
  }
  const jobs = await createCatalogScraper(provider()).run({ fetchImpl, onAudit: value => { audit = value }, ...options })
  return { jobs, calls, audit, evidence: readInventoryEvidence(jobs) }
}

test('Degreed registered extraction reconciles every actual corporate channel and native role before declaring zero India', async () => {
  assert.equal(provider().adapter, 'script')
  const bodies = new Map(fixture.responses.map(row => [row.requestedUrl, row.body]))
  const { jobs, calls, audit, evidence } = await replay(bodies)
  assert.equal(jobs.length, 0)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.reportedTotal, 1)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(audit.nativeJobs.length, 1)
  const job = audit.nativeJobs[0]
  assert.equal(job.country, 'United States')
  assert.equal(job.requisitionId, '2129')
  assert.equal(job.nativeInternalJobId, '5141477004')
  assert.equal(job.nativeFirstPublished, '2026-05-14T17:39:31-04:00')
  assert.equal(job.nativeUpdatedAt, '2026-10-26T19:40:33-04:00')
  assert.equal(job.nativeBoardUpdatedAt, '2026-10-26T19:40:48-04:00')
  assert.equal(job.postingDatePrecision, 'instant')
  assert.match(job.sourceDescription, /Key Skills/)
  assert.match(job.sourceDescription, /Global Data Privacy Notice/)
  assert.equal(job.applyUrl, `${BOARD}/jobs/5968598004`)
  for (const row of fixture.responses.filter(row => row.name.startsWith('corporate') || row.name === 'board-opening' || row.name === 'registered-api-original')) assert.equal(calls.filter(url => url === row.requestedUrl).length, 2)
  assert.equal(calls.filter(url => url.includes('/jobs/5968598004')).length, 1)
})

test('synthetic future India secondary location is retained with full criteria and original date, while global remote stays unknown', async () => {
  const { bodies } = future([{ id: 901, location: { name: 'US Based | Remote' }, offices: [{ id: 1, name: 'United States', location: 'United States', child_ids: [], parent_id: null }, { id: 2, name: 'Bengaluru, India', location: 'Bengaluru, India', child_ids: [], parent_id: null }] }, { id: 902, location: { name: 'Remote' }, offices: [] }])
  const { jobs, audit, evidence } = await replay(bodies)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].jobId, '901')
  assert.equal(jobs[0].postingDate, '2026-10-26T05:52:33.000Z')
  assert.equal(jobs[0].nativeUpdatedAt, '2026-10-27T12:00:00+05:30')
  assert.ok(jobs[0].sourceLocations.some(row => row.label === 'Bengaluru, India' && row.country === 'India'))
  assert.equal(audit.nativeJobs.find(row => row.jobId === '902').country, null)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.listingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('synthetic future pagination, every detail and closing inventories precede output caps', async () => {
  const { bodies } = future([{ id: 911 }, { id: 912 }], { pages: 2 })
  const { jobs, calls, audit, evidence } = await replay(bodies, { maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(audit.nativeJobs.length, 2)
  assert.equal(calls.filter(url => url === `${BOARD}?page=2`).length, 2)
  assert.ok(calls.includes(`${BOARD}/jobs/912`))
  assert.equal(evidence.reportedTotal, 2)
  assert.equal(evidence.indiaFacetCount, 2)
  assert.equal(evidence.listingComplete, false)
  assert.match(evidence.reason, /output-cap/)
})

test('synthetic future missing original date never borrows board publication, schema or update timestamps', async () => {
  const { bodies } = future([{ id: 921, first_published: null }])
  const d = remix(bodies.get(`${BOARD}/jobs/921`)).state.loaderData
  d['routes/$url_token_.jobs_.$job_post_id'].jobPost.published_at = '2026-10-27T12:00:00Z'
  bodies.set(`${BOARD}/jobs/921`, html(d))
  const { jobs } = await replay(bodies)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].postingDate, null)
  assert.equal(jobs[0].postingDatePrecision, 'unknown')
  assert.equal(jobs[0].nativeDetailPublishedAt, '2026-10-27T12:00:00Z')
})

test('synthetic future detail identity mismatch and missing role criteria preserve a gap', async () => {
  for (const mutate of [d => { d.jobPostId = 'foreign' }, d => { d.jobPost.content = '<p> </p>' }, d => { d.jobPost.company_name = 'Another employer' }]) {
    const { bodies } = future([{ id: 931 }])
    const data = remix(bodies.get(`${BOARD}/jobs/931`)).state.loaderData
    mutate(data['routes/$url_token_.jobs_.$job_post_id'])
    bodies.set(`${BOARD}/jobs/931`, html(data))
    const { jobs, evidence } = await replay(bodies)
    assert.equal(jobs.length, 0)
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.reportedTotal, null)
    assert.equal(evidence.indiaFacetCount, null)
  }
})

test('synthetic future changed closing board or secondary geography cannot establish absence', async () => {
  const { bodies } = future([{ id: 941 }])
  const { jobs, evidence } = await replay((url, visit) => {
    if (url === BOARD && visit === 2) {
      const d = remix(bodies.get(url)).state.loaderData
      d['routes/$url_token'].jobPosts.data[0].requisition_id = 'changed'
      return html(d)
    }
    return bodies.get(url)
  })
  assert.equal(jobs.length, 1)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(jobs[0].sourceScopeComplete, false)
})

test('first corporate denial or explicit bot gate stops all Degreed requests immediately', async () => {
  for (const response of [new Response('denied', { status: 401 }), new Response('denied', { status: 403 }), new Response('limited', { status: 429 }), new Response('Verify you are human', { status: 200 })]) {
    const { calls, jobs, evidence } = await replay(new Map([[CAREERS, response]]))
    assert.deepEqual(calls, [CAREERS])
    assert.equal(jobs.length, 0)
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.reportedTotal, null)
    assert.equal(evidence.indiaFacetCount, null)
  }
})

test('synthetic future truncated API, duplicate native identity and foreign application URL fail closed', async () => {
  for (const mutate of [p => { p.meta.total++ }, p => { p.jobs.push(p.jobs[0]); p.meta.total++ }, p => { p.jobs[0].absolute_url = 'https://job-boards.greenhouse.io/another/jobs/951' }]) {
    const { bodies } = future([{ id: 951 }])
    const p = JSON.parse(bodies.get(API)); mutate(p); bodies.set(API, JSON.stringify(p))
    const { jobs, evidence } = await replay(bodies)
    assert.equal(jobs.length, 0)
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.reportedTotal, null)
  }
})

test('synthetic future unresolved secondary location and office descendants prevent whole-employer counts', async () => {
  for (const row of [
    { id: 961, location: { name: 'India | Remote | Unspecified territory' } },
    { id: 961, offices: [{ id: 1, name: 'India', location: 'India', child_ids: [2], parent_id: null }] },
    { id: 961, secondaryLocations: ['Unspecified territory'] },
  ]) {
    const { bodies } = future([row])
    const { evidence } = await replay(bodies)
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.reportedTotal, null)
    assert.equal(evidence.indiaFacetCount, null)
  }
})

test('synthetic future dropped introduction or conclusion cannot silently shorten full native criteria', async () => {
  for (const field of ['introduction', 'conclusion']) {
    const { bodies } = future([{ id: 971 }])
    const data = remix(bodies.get(`${BOARD}/jobs/971`)).state.loaderData
    data['routes/$url_token_.jobs_.$job_post_id'].jobPost[field] = ''
    bodies.set(`${BOARD}/jobs/971`, html(data))
    const { jobs, evidence } = await replay(bodies)
    assert.equal(jobs.length, 0)
    assert.equal(evidence.listingComplete, false)
  }
})

test('synthetic future unsupported employer hiring handoff remains visible as incomplete scope', async () => {
  const { bodies } = future([{ id: 981 }])
  bodies.set(CAREERS, bodies.get(CAREERS) + '<a href="https://careers.example.org/roles">View open positions</a>')
  const { jobs, evidence } = await replay(bodies)
  assert.equal(jobs.length, 1)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.listingComplete, false)
})

test('synthetic future country codes require typed native country fields and unknown territory gets no HQ default', async () => {
  const { bodies } = future([
    { id: 991, location: { name: 'Remote' }, offices: [], metadata: [{ id: 1, name: 'Country', value_type: 'single_select', value: 'IN' }] },
    { id: 992, location: { name: 'IN' }, offices: [] },
    { id: 993, location: { name: 'Remote' }, offices: [], metadata: [{ id: 1, name: 'Country', value_type: 'single_select', value: 'ZZ' }] },
  ])
  const { jobs, audit, evidence } = await replay(bodies)
  assert.deepEqual(jobs.map(job => job.jobId), ['991'])
  assert.equal(audit.nativeJobs.find(job => job.jobId === '992').country, null)
  assert.equal(audit.nativeJobs.find(job => job.jobId === '993').country, null)
  assert.equal(evidence.indiaFacetCount, null)
})

test('synthetic explicit US Delhi worksite and ambiguous city-only location never become India roles', async () => {
  const { bodies } = future([
    { id: 1001, location: { name: 'Delhi, New York, United States' }, offices: [{ id: 1, name: 'Delhi, New York, United States', location: 'Delhi, New York, United States', child_ids: [], parent_id: null }] },
    { id: 1002, location: { name: 'Bengaluru' }, offices: [{ id: 2, name: 'Bengaluru', location: 'Bengaluru', child_ids: [], parent_id: null }] },
    { id: 1003, location: { name: 'Bengaluru, India, United States' }, offices: [{ id: 3, name: 'Bengaluru, India, United States', location: 'Bengaluru, India, United States', child_ids: [], parent_id: null }] },
  ])
  const { jobs, audit, evidence } = await replay(bodies)
  assert.equal(jobs.length, 0)
  assert.equal(audit.nativeJobs.find(job => job.jobId === '1001').country, 'United States')
  assert.deepEqual(audit.nativeJobs.find(job => job.jobId === '1001').nativeCountryCodes, ['US'])
  assert.equal(audit.nativeJobs.find(job => job.jobId === '1002').country, null)
  assert.equal(audit.nativeJobs.find(job => job.jobId === '1003').country, null)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
})

test('synthetic conflicting office name and country address do not become an alternate India worksite', async () => {
  for (const office of [
    { id: 1, name: 'India office', location: 'United States', child_ids: [], parent_id: null },
    { id: 1, name: 'United States office', location: 'India', child_ids: [], parent_id: null },
  ]) {
    const { bodies } = future([{ id: 1011, location: { name: 'Remote' }, offices: [office] }])
    const { jobs, evidence } = await replay(bodies)
    assert.equal(jobs.length, 0)
    assert.equal(evidence.reportedTotal, null)
    assert.equal(evidence.indiaFacetCount, null)
  }
})

test('synthetic day-only original date retains day precision and schema dates remain separate', async () => {
  const { bodies } = future([{ id: 1021, first_published: '2026-10-26' }])
  const url = `${BOARD}/jobs/1021`
  bodies.set(url, bodies.get(url).replace('</html>', `<script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', url, datePosted: '2026-10-27', hiringOrganization: { name: 'Degreed' } })}</script></html>`))
  const { jobs } = await replay(bodies)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].postingDate, '2026-10-26')
  assert.equal(jobs[0].postingDatePrecision, 'day')
  assert.equal(jobs[0].schemaDatePosted, '2026-10-27')
  assert.equal(jobs[0].nativeFirstPublished, '2026-10-26')
})

test('review regression: added office country on the actual retained US role cannot certify India absence', async () => {
  const bodies = new Map(fixture.responses.map(row => [row.requestedUrl, row.body]))
  const actualApi = current('registered-api-original')
  assert.equal(actualApi.sha256, 'db47d5e2fb927bca8d42c113cccb7e5a401ec4caa0dc00d4862d11ef63d69cee')
  const control = await replay(bodies)
  assert.equal(control.evidence.listingComplete, true)
  assert.equal(control.evidence.reportedTotal, 1)
  assert.equal(control.evidence.indiaFacetCount, 0)
  const payload = JSON.parse(actualApi.body)
  payload.jobs[0].offices[0].country = 'India'
  // The same mutated body is consumed for both opening and closing inventory;
  // all other exact retained response bodies and native fields remain intact.
  bodies.set(API, JSON.stringify(payload))
  const { jobs, audit, evidence, calls } = await replay(bodies)
  assert.equal(calls.filter(url => url === API).length, 2)
  assert.equal(jobs.length, 0, 'unsupported office.country must not invent an India candidate')
  assert.equal(audit.nativeJobs[0].country, 'United States')
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(audit.nativeJobs[0].sourceScopeComplete, false)
  assert.equal(audit.nativeJobs[0].lifecycleCleanupAllowed, false)
  assert.match(evidence.reason, /unhandled-native-office-geography/)
})

test('review controls: unsupported office geography stays unresolved while null additions preserve actual US output', async () => {
  for (const addition of [{ country: 'United States' }, { address: { addressCountry: 'India' } }, { geography: 'India' }, { region: 'APAC' }, { coordinates: [12.97, 77.59] }]) {
    const bodies = new Map(fixture.responses.map(row => [row.requestedUrl, row.body]))
    const payload = JSON.parse(bodies.get(API))
    Object.assign(payload.jobs[0].offices[0], addition)
    bodies.set(API, JSON.stringify(payload))
    const { jobs, evidence, audit } = await replay(bodies)
    assert.equal(jobs.length, 0)
    assert.equal(evidence.reportedTotal, null)
    assert.equal(evidence.indiaFacetCount, null)
    assert.equal(evidence.listingComplete, false)
    assert.equal(audit.nativeJobs[0].lifecycleCleanupAllowed, false)
  }
  const bodies = new Map(fixture.responses.map(row => [row.requestedUrl, row.body]))
  const original = await replay(bodies)
  const payload = JSON.parse(bodies.get(API))
  Object.assign(payload.jobs[0].offices[0], { country: null, address: null, geography: null })
  bodies.set(API, JSON.stringify(payload))
  const nullControl = await replay(bodies)
  assert.equal(nullControl.evidence.listingComplete, true)
  assert.equal(nullControl.evidence.reportedTotal, 1)
  assert.equal(nullControl.evidence.indiaFacetCount, 0)
  const withoutObservation = ({ scrapedAt, ...job }) => job
  assert.deepEqual(withoutObservation(nullControl.audit.nativeJobs[0]), withoutObservation(original.audit.nativeJobs[0]))
})

test('review positive: independently proven India criteria survive an unsupported office field with unknown source counts', async () => {
  const { bodies } = future([{ id: 1031 }])
  const payload = JSON.parse(bodies.get(API))
  payload.jobs[0].offices[0].address = { country: 'Unverified new country field' }
  bodies.set(API, JSON.stringify(payload))
  const { jobs, evidence } = await replay(bodies)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].jobId, '1031')
  assert.equal(jobs[0].postingDate, '2026-10-26T05:52:33.000Z')
  assert.match(jobs[0].sourceDescription, /Key Responsibilities/)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
})
