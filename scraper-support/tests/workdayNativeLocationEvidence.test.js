import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { runWorkdayScraper } from '../myworkday/engine.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const baseUrl = 'https://advantech.wd3.myworkdayjobs.com/en-US/External'
const apiPrefix = 'https://advantech.wd3.myworkdayjobs.com/wday/cxs/advantech/External'
const role = (id, location, country, code, additionalLocations = [], summary = location) => ({
  listing: { title: `Engineer ${id}`, externalPath: `/job/Office/Engineer_${id}`,
    locationsText: summary, postedOn: 'Posted Today', bulletFields: [id] },
  detail: { jobPostingInfo: {
    title: `Engineer ${id}`, jobReqId: id, location, additionalLocations,
    country: { descriptor: country },
    jobRequisitionLocation: { descriptor: location, country: { descriptor: country, alpha2Code: code } },
    jobDescription: `<p>Develop reliable industrial software for role ${id}.</p>`,
    timeType: 'Full time', posted: true, canApply: true,
  } },
})

const exercise = async (t, roles) => {
  const details = []
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (init.method === 'POST') {
      assert.equal(String(url), apiPrefix + '/jobs')
      const request = JSON.parse(init.body)
      assert.deepEqual(request.appliedFacets, {})
      assert.equal(request.searchText, '')
      return Response.json({ total: roles.length, jobPostings: roles.map(row => row.listing) })
    }
    if (!String(url).includes('/job/')) return new Response('<html>Advantech careers</html>')
    const row = roles.find(row => String(url) === apiPrefix + row.listing.externalPath)
    assert.ok(row, `Unexpected native detail or HTML fallback ${url}`)
    details.push(String(url))
    return Response.json(row.detail)
  })
  const jobs = await runWorkdayScraper({
    company: 'Advantech', source: 'advantech', baseUrl,
    scraperDir: fileURLToPath(new URL('../../scraper/advantech.workday', import.meta.url)),
    boardIdentityVerified: true, requestTimeoutMs: 1000, retryBaseDelayMs: 0,
    requestScheduler: { acquire: async () => () => {}, recordRateLimit: () => {} },
  })
  return { jobs, details }
}

test('Workday binds an additional requisition office country without poisoning the primary office', async t => {
  const mixed = role('R014324', 'Bangalore, India', 'India', 'IN', ['Kuala Lumpur, Malaysia'], '2 Locations')
  mixed.detail.jobPostingInfo.jobRequisitionLocation = {
    descriptor: 'Kuala Lumpur', country: { descriptor: 'Malaysia', alpha2Code: 'MY' },
  }
  const { jobs } = await exercise(t, [
    mixed,
    role('R014188', 'Hyderabad, India', 'India', 'IN', ['Bangalore, India'], '2 Locations'),
  ])
  assert.deepEqual(jobs.map(job => job.title), ['Engineer R014324', 'Engineer R014188'])
  assert.equal(jobs[0].location, 'Bangalore, India')
  assert.deepEqual(jobs[1].locations, ['Hyderabad, India', 'Bangalore, India'])
})

test('Workday retains a typed India requisition office listed as an opaque secondary location', async t => {
  const mixed = role('R1', 'Kuala Lumpur, Malaysia', 'Malaysia', 'MY', ['Campus_42'], '2 Locations')
  mixed.detail.jobPostingInfo.jobRequisitionLocation = {
    descriptor: 'Campus_42', country: { descriptor: 'India', alpha2Code: 'IN' },
  }
  const { jobs } = await exercise(t, [mixed])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Campus_42, India')
  assert.deepEqual(jobs[0].locations, ['Campus_42, India'])
})

test('Workday keeps country contradictions when the requisition office is unspecified or repeats the primary city', async t => {
  for (const [descriptor, additional] of [[undefined, 'OtherOffice'], ['Bangalore', 'Bangalore, USA']]) {
    const mixed = role('R1', 'Bangalore, India', 'India', 'IN', [additional], '2 Locations')
    mixed.detail.jobPostingInfo.jobRequisitionLocation = {
      descriptor, country: { descriptor: 'USA', alpha2Code: 'US' },
    }
    await assert.rejects(exercise(t, [mixed]), error => error.name === 'WorkdayIncompleteScopeError')
    t.mock.restoreAll()
  }
})

test('Workday does not conflate an unlisted internal requisition office with public posting locations', async t => {
  const mixed = role('R0120985', 'THA-Bangkok-One Bangkok', 'Thailand', 'TH', ['IND-Hyderabad-CapitaLand'], '2 Locations')
  mixed.detail.jobPostingInfo.jobRequisitionLocation = {
    descriptor: 'IND-BLR-Divyasree Technopolis', country: { descriptor: 'India', alpha2Code: 'IN' },
  }
  const foreign = role('R2', 'Tokyo, Japan', 'Japan', 'JP', ['Singapore, Singapore'], '2 Locations')
  foreign.detail.jobPostingInfo.jobRequisitionLocation = mixed.detail.jobPostingInfo.jobRequisitionLocation
  const { jobs } = await exercise(t, [mixed, foreign])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Engineer R0120985')
  assert.deepEqual(jobs[0].locations, ['IND-Hyderabad-CapitaLand'])
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
})

test('Workday resolves Advantech opaque secondary labels from current same-board primary countries before validating scope', async t => {
  const roles = [
    role('JR202610028', 'Taipei_Neihu', 'Taiwan', 'TW', ['Linkou'], '2 Locations'),
    role('JR202610024', 'Taipei_Neihu', 'Taiwan', 'TW', ['AKR_Seoul_A_Tower'], '2 Locations'),
    role('JR202606068', 'Linkou', 'Taiwan', 'TW'),
    role('JR202405056', 'AKR_Seoul_A_Tower', 'Korea, Republic of', 'KR'),
  ]
  const { jobs, details } = await exercise(t, roles)
  assert.equal(jobs.length, 0)
  assert.equal(details.length, 4)
  assert.equal(new Set(details).size, 4)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.reportedTotal, 4)
  assert.equal(evidence.indiaFacetCount, 0)
})

test('Workday retains an opaque India secondary location and reuses cached native descriptions', async t => {
  const { jobs, details } = await exercise(t, [
    role('R1', 'Taipei_Neihu', 'Taiwan', 'TW', ['  campus_42  '], '2 Locations'),
    role('R2', 'Campus_42', 'India', 'IN'),
  ])
  assert.deepEqual(jobs.map(job => job.title), ['Engineer R1', 'Engineer R2'])
  assert.ok(jobs.every(job => /campus_42, India/i.test(job.location)))
  assert.match(jobs[0].sourceDescription, /reliable industrial software for role R1/)
  assert.match(jobs[1].sourceDescription, /reliable industrial software for role R2/)
  assert.equal(details.length, 2, 'Scope and enrichment must reuse each successful native response')
  assert.equal(new Set(details).size, 2)
})

test('Workday keeps native foreign country authority when reusing a misleading India-labelled primary address', async t => {
  const { jobs } = await exercise(t, [
    role('R1', 'Bangalore, India', 'Taiwan', 'TW', ['Campus_42'], '2 Locations'),
    role('R2', 'Campus_42', 'India', 'IN'),
    role('R3', 'Bangalore, India', 'Taiwan', 'TW', ['Tokyo, Japan'], '2 Locations'),
  ])
  assert.deepEqual(jobs.map(job => job.title), ['Engineer R1', 'Engineer R2'])
  assert.equal(jobs[0].location, 'Campus_42, India')
  assert.deepEqual(jobs[0].locations, ['Campus_42, India'])
})

test('Workday cannot infer an unknown secondary country from the primary country', async t => {
  await assert.rejects(exercise(t, [
    role('R1', 'Taipei_Neihu', 'Taiwan', 'TW', ['UnresolvedCampus'], '2 Locations'),
  ]), error => error.name === 'WorkdayIncompleteScopeError')
})

test('Workday excludes known Australian city-only secondary locations without borrowing the primary country', async t => {
 const { jobs } = await exercise(t, [
  role('AU1', 'Sydney', 'Australia', 'AU', ['Launceston', 'Brisbane', 'Perth', 'Townsville', 'Adelaide', 'Melbourne'], '7 Locations'),
  role('IN1', 'Bengaluru, Karnataka', 'India', 'IN', ['Pune, Maharashtra'], '2 Locations'),
 ])
 assert.deepEqual(jobs.map(job => job.title), ['Engineer IN1'])
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
})

test('Workday rejects conflicting same-label countries, including two different foreign countries', async t => {
  for (const [country, code] of [['Japan', 'JP'], ['India', 'IN'], ['Taiwan', 'JP']]) {
    await assert.rejects(exercise(t, [
      role('R1', 'Taipei_Neihu', 'Taiwan', 'TW', ['SharedCampus'], '2 Locations'),
      role('R2', 'SharedCampus', 'Taiwan', 'TW'),
      role('R3', 'sharedcampus', country, code),
    ]), error => error.name === 'WorkdayIncompleteScopeError')
    t.mock.restoreAll()
  }
})

test('Workday cannot override contradictory native primary countries with a matching label from another role', async t => {
  for (const [country, code] of [['Taiwan', 'TW'], ['Japan', 'JP']]) {
    const contradictory = role('R2', 'SharedCampus', 'Taiwan', 'TW')
    contradictory.detail.jobPostingInfo.jobRequisitionLocation.country = { descriptor: country === 'Taiwan' ? 'India' : country, alpha2Code: country === 'Taiwan' ? 'IN' : code }
    await assert.rejects(exercise(t, [
      role('R1', 'Taipei_Neihu', 'Taiwan', 'TW', ['SharedCampus'], '2 Locations'),
      contradictory,
      role('R3', 'SharedCampus', 'Taiwan', 'TW'),
    ]), error => error.name === 'WorkdayIncompleteScopeError')
    t.mock.restoreAll()
  }
})

test('Workday does not carry label-country evidence from a previous run into a later incomplete snapshot', async t => {
  await exercise(t, [
    role('R1', 'Taipei_Neihu', 'Taiwan', 'TW', ['Linkou'], '2 Locations'),
    role('R2', 'Linkou', 'Taiwan', 'TW'),
  ])
  t.mock.restoreAll()
  await assert.rejects(exercise(t, [
    role('R1', 'Taipei_Neihu', 'Taiwan', 'TW', ['Linkou'], '2 Locations'),
  ]), error => error.name === 'WorkdayIncompleteScopeError')
})

test('Workday still rejects missing native locations despite other roles supplying country evidence', async t => {
  await assert.rejects(exercise(t, [
    role('R1', 'Taipei_Neihu', 'Taiwan', 'TW', ['Linkou'], '3 Locations'),
    role('R2', 'Linkou', 'Taiwan', 'TW'),
  ]), error => error.name === 'WorkdayIncompleteScopeError')
})

const nestedLocationRole = (id, descriptor, country, code, primary = '') => {
  const row = role(id, primary, country, code, [], 'Unknown')
  delete row.detail.jobPostingInfo.country
  delete row.detail.jobPostingInfo.additionalLocations
  row.detail.jobPostingInfo.jobRequisitionLocation.descriptor = descriptor
  return row
}

test('Workday uses explicit nested native primary locations for blank or missing Advantech location fields', async t => {
  const missing = nestedLocationRole('JR202603065', 'Others_Russia', 'Russian Federation', 'RU')
  delete missing.detail.jobPostingInfo.location
  const { jobs, details } = await exercise(t, [
    nestedLocationRole('JR202603066', 'Others_Russia', 'Russian Federation', 'RU'),
    missing,
    nestedLocationRole('JR202310419', 'Taipei_Neihu', 'Taiwan', 'TW', '  '),
    role('R4', 'OpaqueOffice', 'Taiwan', 'TW', ['Others_Russia'], '2 Locations'),
  ])
  assert.equal(jobs.length, 0)
  assert.equal(details.length, 4)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 4)
})

test('Workday retains nested native India locations in both required scope and ordinary structured enrichment', async t => {
  const scoped = nestedLocationRole('R1', 'Campus_42', 'India', 'IN')
  const enrichmentOnly = nestedLocationRole('R2', 'Campus_84', 'India', 'IN')
  enrichmentOnly.listing.locationsText = 'Bangalore, India'
  const { jobs, details } = await exercise(t, [scoped, enrichmentOnly])
  assert.deepEqual(jobs.map(job => job.location), ['Campus_42, India', 'Campus_84, India'])
  assert.match(jobs[0].sourceDescription, /industrial software for role R1/)
  assert.match(jobs[1].sourceDescription, /industrial software for role R2/)
  assert.equal(details.length, 2)
})

test('Workday never substitutes a nested descriptor for a nonblank valid primary location', async t => {
  const row = nestedLocationRole('R1', 'AlternateCampus', 'India', 'IN', 'PrimaryCampus')
  // The display-label assertion needs a country bound to this public primary
  // office; a different internal office cannot supply that proof.
  row.detail.jobPostingInfo.country = { descriptor: 'India', alpha2Code: 'IN' }
  const { jobs } = await exercise(t, [row])
  assert.equal(jobs[0].location, 'PrimaryCampus, India')
})

test('Workday still rejects invalid nested locations and malformed nonstring primary fields', async t => {
  for (const descriptor of [undefined, null, '', '  ', 'Unknown', 42, {}]) {
    await assert.rejects(exercise(t, [nestedLocationRole('R1', descriptor, 'India', 'IN')]),
      error => error.name === 'WorkdayIncompleteScopeError')
    t.mock.restoreAll()
  }
  for (const primary of [42, {}, [], 'Unknown']) {
    await assert.rejects(exercise(t, [nestedLocationRole('R1', 'Campus_42', 'India', 'IN', primary)]),
      error => error.name === 'WorkdayIncompleteScopeError')
    t.mock.restoreAll()
  }
  await assert.rejects(exercise(t, [nestedLocationRole('R1', 'UnresolvedCampus')]),
    error => error.name === 'WorkdayIncompleteScopeError')
})

test('Workday nested primary fallback preserves native country conflict rejection', async t => {
  for (const country of ['India', 'Taiwan']) {
    const row = nestedLocationRole('R1', 'Others_Russia', 'Russian Federation', 'RU')
    row.detail.jobPostingInfo.country = { descriptor: country }
    await assert.rejects(exercise(t, [row]), error => error.name === 'WorkdayIncompleteScopeError')
    t.mock.restoreAll()
  }
})
