import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import nodeTest from 'node:test'
import { gunzipSync } from 'node:zlib'

import { runWorkdayScraper } from '../myworkday/engine.js'
import { runVerifiedWorkdayBoardUnion } from '../shared/workdayBoardUnion.js'
import { resolveZeroJobOutcome } from '../runner.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { decorateJobsWithProviderMetadata } from '../providers/index.js'

const test = (name, run) => nodeTest(name, { concurrency: false }, run)
const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL(
  './fixtures/workdayCountryInventoryProof/capture.json.gz', import.meta.url,
))))
const capturedResponse = name => {
  const receipt = capture.responses[name]
  assert.ok(receipt, `Missing captured response ${name}`)
  const body = Buffer.from(receipt.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(body).digest('hex'), receipt.sha256)
  return { ...receipt, body }
}
const capturedJson = name => JSON.parse(capturedResponse(name).body)
const sources = {
  csg: {
    company: 'CSG', boardUrl: 'https://csgi.wd5.myworkdayjobs.com/CSGCareers',
    detailUrlBase: 'https://csgi.wd5.myworkdayjobs.com/en-US/CSGCareers',
    corporateUrl: 'https://www.csgi.com/careers',
  },
  temenos: {
    company: 'Temenos', boardUrl: 'https://temenos.wd103.myworkdayjobs.com/en-US/Temenoscareers',
    detailUrlBase: 'https://temenos.wd103.myworkdayjobs.com/en-US/Temenoscareers',
    corporateUrl: 'https://www.temenos.com/about-us/careers/',
  },
}
const asResponse = ({ url, body, status = 200, contentType = 'application/json' }) => {
  const response = new Response(body, { status, headers: { 'content-type': contentType } })
  Object.defineProperty(response, 'url', { value: url })
  return response
}

// Exercise the real engine and zero-outcome consumer; only external HTTP is replaced.
// Each run reads a real local config, so no shared companies metadata is mocked.
const exercise = async (t, { source = 'csg', change = () => {}, options = {}, configOverrides = {}, boardUnion = null } = {}) => {
  const spec = sources[source]
  const initialReceipt = capturedResponse(`${source}-initial`)
  const state = {
    initial: capturedJson(`${source}-initial`),
    closing: capturedJson(`${source}-closing`),
    closingResponse: {},
    corporate: capturedResponse(`${source}-corporate`),
    details: new Map(),
  }
  for (const name of Object.keys(capture.responses)) {
    if (!name.startsWith(source + '-') || !/^(?:csg-\d+|temenos-JR\d+)$/.test(name)) continue
    const receipt = capturedResponse(name)
    state.details.set(receipt.url, JSON.parse(receipt.body))
  }
  change(state)
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workday-country-proof-'))
  t.after(() => {
    const target = fs.realpathSync(directory)
    assert.equal(path.dirname(target), fs.realpathSync(os.tmpdir()))
    assert.ok(path.basename(target).startsWith('workday-country-proof-'))
    fs.rmSync(target, { recursive: true })
  })
  fs.writeFileSync(path.join(directory, 'config.json'), JSON.stringify({
    listingStrategy: 'jobs-api', jobsApiUrl: initialReceipt.url,
    detailUrlBase: spec.detailUrlBase, locationCountry: null, searchText: '',
    // Proof mode must inspect unresolved offices even if an old city filter remains.
    locationPattern: 'india|bengaluru|bangalore|hyderabad|pune|mumbai|gurgaon|gurugram|noida|chennai',
    inventoryScope: 'complete-board-country-proof', officialCareersUrl: spec.corporateUrl,
    ...configOverrides,
  }))
  const calls = []
  let listingCalls = 0
  const fetchMock = t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input)
    const method = init.method || 'GET'
    calls.push({ url, method, ...(init.body ? { body: JSON.parse(init.body) } : {}) })
    if (url === spec.corporateUrl && method === 'GET') return asResponse(state.corporate)
    if (url === initialReceipt.url && method === 'POST') {
      const request = JSON.parse(init.body)
      assert.deepEqual(request.appliedFacets, {}, 'A complete-board proof cannot implicitly select India')
      assert.equal(request.searchText, '', 'Keyword absence is not a country inventory')
      assert.equal(request.offset, 0)
      assert.equal(request.limit, 20)
      listingCalls++
      assert.ok(listingCalls <= (boardUnion ? 3 : 2), 'Only captured initial, closing and optional union recheck snapshots are expected')
      return asResponse({ url, body: JSON.stringify(listingCalls === 1 ? state.initial : state.closing),
        ...(listingCalls === 2 ? state.closingResponse : {}),
      })
    }
    if (method === 'GET' && state.details.has(url)) {
      return asResponse({ url, body: JSON.stringify(state.details.get(url)) })
    }
    if (source === 'temenos' && url === capturedResponse('temenos-JR2335-html').url) {
      return asResponse(capturedResponse('temenos-JR2335-html'))
    }
    if (method === 'GET' && (url === spec.boardUrl || url === spec.detailUrlBase)) {
      return asResponse({ url, contentType: 'text/html', body: '<html><body>Workday careers</body></html>' })
    }
    throw new Error(`Unexpected HTTP request; live network is forbidden: ${method} ${url}`)
  })
  let jobs, error
  try {
    const runOptions = {
      company: spec.company, source, baseUrl: spec.boardUrl, scraperDir: directory,
      requestTimeoutMs: 1000, retryBaseDelayMs: 0,
      requestScheduler: { acquire: async () => () => {}, recordRateLimit: () => {} },
      ...options,
    }
    jobs = boardUnion ? await runVerifiedWorkdayBoardUnion({ source, company: spec.company,
      boards: [{ tenant: 'csgi', site: 'CSGCareers', baseUrl: spec.boardUrl, scraperDir: directory }],
      employerPattern: /^BR10 - Intec Brazil$/, completeSourceScope: false, ...boardUnion }, runOptions)
      : await runWorkdayScraper(runOptions)
  } catch (failure) {
    error = failure
  } finally {
    fetchMock.mock.restore()
  }
  return { jobs, error, calls, evidence: readInventoryEvidence(jobs) }
}

const assertNoCertifiedZero = result => {
  assert.ok(result.error || result.evidence?.status === 'unverified',
    'An incomplete proof must fail or carry explicitly unverified evidence')
  assert.notEqual(result.evidence?.status, 'complete-inventory')
  assert.notEqual(result.evidence?.status, 'verified-empty')
  assert.notEqual(resolveZeroJobOutcome({ provider: {} }, result.jobs || [], []), 'fetched-zero')
}

test('CSG requires a fresh corporate binding and unchanged complete inventory before fetched-zero', async t => {
  const result = await exercise(t)
  assert.ifError(result.error)
  assert.equal(result.calls.filter(call => call.url === sources.csg.corporateUrl).length, 1,
    'This invocation must fetch the current corporate careers handoff')
  assert.deepEqual(result.jobs, [])
  assert.equal(result.evidence?.status, 'complete-inventory')
  assert.equal(result.evidence?.surface, 'https://csgi.wd5.myworkdayjobs.com/wday/cxs/csgi/CSGCareers/jobs')
  assert.equal(result.evidence?.reportedTotal, 15)
  assert.equal(result.evidence?.indiaFacetCount, 0)
  assert.equal(result.evidence?.listingComplete, true)
  assert.equal(result.calls.filter(call => call.method === 'POST').length, 2,
    'The closing snapshot must reconcile the complete board')
  assert.equal(resolveZeroJobOutcome({ provider: {} }, result.jobs, []), 'fetched-zero')
  for (const change of [
    state => { state.closing.total = 16 },
    state => { state.closing.jobPostings.pop() },
    state => { state.closing.jobPostings[0].externalPath = '/job/Other/Unseen-Role_R999' },
  ]) assertNoCertifiedZero(await exercise(t, { change }))
})

test('CSG cannot replace current active corporate evidence with a static flag or earlier binding', async t => {
  const earlier = await exercise(t)
  assert.ifError(earlier.error)
  for (const change of [
    state => { state.corporate.body = '<html><a href="https://csgi.wd5.myworkdayjobs.com/RetiredCareers">Jobs</a></html>' },
    state => { state.corporate.body = '<html><script>window.board="https://csgi.wd5.myworkdayjobs.com/CSGCareers"</script></html>' },
    state => { state.corporate.body = '<html><a aria-disabled="true" href="https://csgi.wd5.myworkdayjobs.com/CSGCareers">Jobs</a></html>' },
    state => { state.corporate.url = 'https://unrelated.example/careers' },
    state => { state.corporate.status = 503 },
    state => { state.corporate.contentType = 'application/json' },
  ]) {
    // Challenge the old flag explicitly; it must not authorize this invocation.
    const result = await exercise(t, { change, options: { boardIdentityVerified: true } })
    assertNoCertifiedZero(result)
    assert.ok(result.calls.some(call => call.url === sources.csg.corporateUrl),
      'Every invocation must obtain its own current corporate response')
  }
})

test('CSG resolves an unfamiliar native India office instead of dropping it with a city regex', async t => {
  const result = await exercise(t, { change: state => {
    const posting = {
      title: 'Software Engineer at Campus 42', externalPath: '/job/Campus_42/Software-Engineer_R90001',
      locationsText: 'Campus_42', postedOn: 'Posted Today', bulletFields: ['R90001'],
    }
    for (const inventory of [state.initial, state.closing]) {
      inventory.total = 16
      inventory.jobPostings.push(structuredClone(posting))
    }
    const detail = structuredClone(state.details.values().next().value)
    Object.assign(detail.jobPostingInfo, {
      title: posting.title, jobReqId: 'R90001', jobPostingId: 'Software-Engineer_R90001',
      externalUrl: 'https://csgi.wd5.myworkdayjobs.com/CSGCareers' + posting.externalPath,
      location: 'Campus_42', additionalLocations: [],
      country: { descriptor: 'India', id: 'c4f78be1a8f14da0ab49ce1162348a5e' },
      jobRequisitionLocation: { descriptor: 'Campus_42',
        country: { descriptor: 'India', id: 'c4f78be1a8f14da0ab49ce1162348a5e', alpha2Code: 'IN' } },
      jobDescription: '<p>Develop reliable software and maintain production services for this India office.</p>',
    })
    state.details.set('https://csgi.wd5.myworkdayjobs.com/wday/cxs/csgi/CSGCareers' + posting.externalPath, detail)
  } })
  assert.ifError(result.error)
  assert.equal(result.jobs?.length, 1)
  assert.equal(result.jobs[0].title, 'Software Engineer at Campus 42')
  assert.equal(result.jobs[0].requisitionId, 'R90001')
  assert.equal(result.jobs[0].location, 'Campus_42, India')
  assert.match(result.jobs[0].sourceDescription, /maintain production services/)
  assert.equal(result.evidence?.reportedTotal, 16)
  assert.equal(result.evidence?.indiaFacetCount, 1)
  assert.equal(resolveZeroJobOutcome({ provider: {} }, result.jobs, result.jobs), null)
})

test('CSG country exclusion requires native requisition title and board identity in proof mode', async t => {
  for (const mutate of [
    info => { delete info.jobReqId },
    info => { delete info.title },
    info => { delete info.jobPostingSiteId },
    info => { info.jobReqId = 'R999' },
    info => { info.title = 'Unrelated role' },
    info => { info.jobPostingSiteId = 'AnotherSite' },
    info => { info.externalUrl = 'https://another.wd5.myworkdayjobs.com/CSGCareers/job/Other/Other_32265' },
  ]) {
    const result = await exercise(t, { change: state => {
      mutate(state.details.get('https://csgi.wd5.myworkdayjobs.com/wday/cxs/csgi/CSGCareers/job/Brazil-Remote/Software-Development-Engineer_32265').jobPostingInfo)
    } })
    assertNoCertifiedZero(result)
  }
})

test('Temenos cannot exclude an untyped secondary location using Cairo-only native SEO geography', async t => {
  const html = capturedResponse('temenos-JR2335-html').body.toString('utf8')
  const seo = JSON.parse(html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i)[1])
  assert.equal(seo.identifier.value, 'JR2335')
  assert.equal(seo.jobLocation.address.addressLocality, 'Cairo')
  assert.equal(seo.jobLocation.address.addressCountry, 'Egypt')
  const result = await exercise(t, { source: 'temenos' })
  assert.equal(result.error?.name, 'WorkdayIncompleteScopeError')
  assert.match(result.error.cause?.message || '', /Johannesburg|do not establish India or foreign scope/)
  assertNoCertifiedZero(result)
  assert.equal(result.calls.filter(call => call.url === sources.temenos.corporateUrl).length, 1,
    'The incomplete result must still check the current corporate board binding')
})

for (const [label, response] of [
  ['redirected off-board', { url: 'https://unrelated.example/jobs' }],
  ['served as plain text', { contentType: 'text/plain' }],
]) test(`CSG cannot certify a closing complete snapshot ${label}`, async t => {
  const result = await exercise(t, { change: state => { state.closingResponse = response } })
  assert.equal(result.calls.filter(call => call.method === 'POST').length, 2)
  assertNoCertifiedZero(result)
})

for (const empty of [false, true]) test(`CSG requires ${empty ? 'nonempty' : 'present'} native country identities for a grouped role`, async t => {
  const result = await exercise(t, { change: state => {
    const info = state.details.get('https://csgi.wd5.myworkdayjobs.com/wday/cxs/csgi/CSGCareers/job/Brazil-Remote/Software-Development-Engineer_32265').jobPostingInfo
    if (empty) {
      info.country = {}
      info.jobRequisitionLocation.country = { id: 'opaque-country-id-without-a-name-or-code' }
    } else {
      delete info.country
      delete info.jobRequisitionLocation.country
    }
  } })
  assertNoCertifiedZero(result)
})

// Mutate the captured native receipt without changing its title, requisition,
// posting site, or canonical URL. Only the public office/country fields change.
const addProofIndiaOffice = (state, { listingLocation = 'Campus_42', country = true } = {}) => {
  const posting = {
    title: 'Software Engineer at Campus 42', externalPath: '/job/Campus_42/Software-Engineer_R90001',
    locationsText: listingLocation, postedOn: 'Posted Today', bulletFields: ['R90001'],
  }
  for (const inventory of [state.initial, state.closing]) {
    inventory.total++
    inventory.jobPostings.push(structuredClone(posting))
  }
  const detail = structuredClone(state.details.values().next().value)
  Object.assign(detail.jobPostingInfo, {
    title: posting.title, jobReqId: 'R90001', jobPostingId: 'Software-Engineer_R90001',
    externalUrl: 'https://csgi.wd5.myworkdayjobs.com/CSGCareers' + posting.externalPath,
    location: 'Campus_42', additionalLocations: [],
    country: { descriptor: 'India', id: 'c4f78be1a8f14da0ab49ce1162348a5e' },
    jobRequisitionLocation: { descriptor: 'Campus_42',
      country: { descriptor: 'India', id: 'c4f78be1a8f14da0ab49ce1162348a5e', alpha2Code: 'IN' } },
    jobDescription: '<p>Develop reliable software and maintain production services for this India office.</p>',
  })
  if (!country) {
    delete detail.jobPostingInfo.country
    delete detail.jobPostingInfo.jobRequisitionLocation.country
  }
  state.details.set('https://csgi.wd5.myworkdayjobs.com/wday/cxs/csgi/CSGCareers' + posting.externalPath, detail)
}

test('CSG cannot invent a country for an opaque native office without country evidence', async t => {
  const result = await exercise(t, { change: state => addProofIndiaOffice(state, { country: false }) })
  assert.equal(result.error?.name, 'WorkdayIncompleteScopeError')
  assertNoCertifiedZero(result)
})

test('native India country fields remain authoritative for an office with an Indian state suffix', async t => {
  const result = await exercise(t, { change: state => {
    addProofIndiaOffice(state, { listingLocation: 'Powai, Mumbai, MH' })
    const info = [...state.details.values()].find(detail => detail.jobPostingInfo.jobReqId === 'R90001').jobPostingInfo
    info.location = 'Powai, Mumbai, MH'
    info.jobRequisitionLocation.descriptor = info.location
  } })
  assert.ifError(result.error)
  assert.deepEqual(result.jobs.map(job => job.requisitionId), ['R90001'])
  assert.equal(result.jobs[0].location, 'Powai, Mumbai, MH')
})

for (const location of ['Lafayette, IN', 'Bengaluru, India']) {
  test('native US country fields ' + (location.endsWith('IN') ? 'resolve an Indiana state suffix' : 'still reject an explicit India country conflict'), async t => {
    const result = await exercise(t, { change: state => {
      const info = state.details.get('https://csgi.wd5.myworkdayjobs.com/wday/cxs/csgi/CSGCareers/job/Brazil-Remote/Software-Development-Engineer_32265').jobPostingInfo
      const country = { descriptor: 'United States of America', id: 'bc33aa3152ec42d4995f4791a106ed09', alpha2Code: 'US' }
      Object.assign(info, { location, additionalLocations: ['Indianapolis, United States of America'], country,
        jobRequisitionLocation: { descriptor: location, country } })
    } })
    if (location.endsWith('IN')) {
      assert.ifError(result.error)
      assert.deepEqual(result.jobs, [])
      assert.equal(result.evidence.listingComplete, true)
      assert.equal(result.evidence.indiaFacetCount, 0)
    } else {
      assert.ok(result.error)
      assertNoCertifiedZero(result)
    }
  })
}

for (const nested of [null, { descriptor: 'Campus_42' }]) {
  test('a board union accepts a proven native India primary office without a redundant nested country: ' + (nested ? 'office only' : 'absent office'), async t => {
    const result = await exercise(t, { boardUnion: {}, change: state => {
      addProofIndiaOffice(state)
      const info = [...state.details.values()].find(detail => detail.jobPostingInfo.jobReqId === 'R90001').jobPostingInfo
      info.location = 'Mumbai, India'
      info.jobRequisitionLocation = nested
    } })
    assert.ifError(result.error)
    assert.deepEqual(result.jobs.map(job => job.jobId), ['R90001'])
    assert.equal(result.jobs[0].country, 'India')
    assert.equal(result.jobs[0].sourceListingComplete, false)
    assert.equal(result.jobs[0].lifecycleCleanupAllowed, false)
  })
}

test('a typed native requisition country proves a foreign office when its redundant top-level country is absent', async t => {
  const result = await exercise(t, { change: state => {
    const info = state.details.get('https://csgi.wd5.myworkdayjobs.com/wday/cxs/csgi/CSGCareers/job/Brazil-Remote/Software-Development-Engineer_32265').jobPostingInfo
    assert.equal(info.jobRequisitionLocation.country.alpha2Code, 'BR')
    delete info.country
  } })
  assert.ifError(result.error)
  assert.deepEqual(result.jobs, [])
  assert.equal(result.evidence?.reportedTotal, 15)
  assert.equal(result.evidence?.listingComplete, true)
})

test('an invalid present native country cannot be ignored in favor of a valid requisition country', async t => {
  const result = await exercise(t, { change: state => {
    const info = state.details.get('https://csgi.wd5.myworkdayjobs.com/wday/cxs/csgi/CSGCareers/job/Brazil-Remote/Software-Development-Engineer_32265').jobPostingInfo
    info.country = { id: 'unknown-country-without-label' }
  } })
  assertNoCertifiedZero(result)
})

for (const [label, additionalLocations] of [['array', ['Another opaque public campus']], ['empty array', []], ['null', null], ['absent', undefined]])
test('a lone nested country cannot be borrowed from an unlisted office with ' + label + ' additional locations', async t => {
  const result = await exercise(t, { change: state => {
    const info = state.details.get('https://csgi.wd5.myworkdayjobs.com/wday/cxs/csgi/CSGCareers/job/Brazil-Remote/Software-Development-Engineer_32265').jobPostingInfo
    delete info.country
    info.location = 'Opaque public campus'
    info.additionalLocations = additionalLocations
    for (const inventory of [state.initial, state.closing]) {
      inventory.jobPostings.find(row => row.externalPath.endsWith('_32265')).locationsText = 'Opaque public campus'
    }
    info.jobRequisitionLocation = { descriptor: 'Unlisted requisition office',
      country: { descriptor: 'India', id: 'c4f78be1a8f14da0ab49ce1162348a5e', alpha2Code: 'IN' } }
  } })
  assert.ok(result.error, 'An unlisted office must not supply a country for a different public location')
  assertNoCertifiedZero(result)
})

test('opt-in partial country proof retains verified India roles and records unresolved foreign-role secondary offices', async t => {
  const result = await exercise(t, { configOverrides: { retainProvenIndiaOnUnresolvedLocations: true }, change: state => {
    addProofIndiaOffice(state)
    state.details.get('https://csgi.wd5.myworkdayjobs.com/wday/cxs/csgi/CSGCareers/job/Brazil-Remote/Software-Development-Engineer_32265')
      .jobPostingInfo.additionalLocations.push('Unresolved secondary campus')
  } })
  assert.ifError(result.error)
  assert.deepEqual(result.jobs.map(job => job.requisitionId), ['R90001'])
  assert.equal(result.evidence?.status, 'coverage-gap')
  assert.equal(result.evidence?.listingComplete, false)
  assert.equal(result.evidence?.reportedTotal, 16)
  assert.equal(result.evidence?.indiaFacetCount, null)
  assert.equal(result.jobs[0].sourceListingComplete, false)
  assert.equal(result.jobs[0].lifecycleCleanupAllowed, false)
  const audit = result.jobs[Symbol.for('jobverify.workday.country-inventory-proof')]
  assert.equal(audit.initial.count, 16)
  assert.equal(audit.initial.sha256, audit.closing.sha256)
  assert.equal(audit.unresolvedRoles.length, 1)
  assert.equal(audit.unresolvedRoles[0].requisitionId, '32265')
  assert.ok(audit.unresolvedRoles[0].locations.includes('Unresolved secondary campus'))
  assert.notEqual(resolveZeroJobOutcome({ provider: {} }, result.jobs, []), 'fetched-zero')
})

test('partial country proof cannot certify empty inventory while secondary offices remain unresolved', async t => {
  const result = await exercise(t, { configOverrides: { retainProvenIndiaOnUnresolvedLocations: true }, change: state => {
    state.details.get('https://csgi.wd5.myworkdayjobs.com/wday/cxs/csgi/CSGCareers/job/Brazil-Remote/Software-Development-Engineer_32265')
      .jobPostingInfo.additionalLocations.push('Unresolved secondary campus')
  } })
  assert.ifError(result.error)
  assert.deepEqual(result.jobs, [])
  assert.equal(result.evidence?.status, 'coverage-gap')
  assert.equal(result.evidence?.listingComplete, false)
  assert.notEqual(resolveZeroJobOutcome({ provider: {} }, result.jobs, []), 'fetched-zero')
})

for (const missing of ['all native geography', 'primary office', 'native countries']) {
  test('opt-in partial proof retains proven India roles while recording missing ' + missing, async t => {
    const result = await exercise(t, { configOverrides: { retainProvenIndiaOnUnresolvedLocations: true }, change: state => {
      addProofIndiaOffice(state)
      const info = state.details.get('https://csgi.wd5.myworkdayjobs.com/wday/cxs/csgi/CSGCareers/job/Brazil-Remote/Software-Development-Engineer_32265').jobPostingInfo
      if (missing !== 'native countries') Object.assign(info, { location: '', additionalLocations: null, jobRequisitionLocation: null })
      if (missing !== 'primary office') { info.country = null; info.jobRequisitionLocation = null }
    } })
    assert.ifError(result.error)
    assert.deepEqual(result.jobs.map(job => job.requisitionId), ['R90001'])
    assert.equal(result.evidence.status, 'coverage-gap')
    assert.equal(result.evidence.listingComplete, false)
    assert.equal(result.jobs[0].lifecycleCleanupAllowed, false)
    const audit = result.jobs[Symbol.for('jobverify.workday.country-inventory-proof')]
    assert.equal(audit.initial.count, 16)
    assert.equal(audit.initial.sha256, audit.closing.sha256)
    assert.deepEqual(audit.unresolvedRoles.map(role => role.requisitionId), ['32265'])
    assert.ok(audit.unresolvedRoles[0].reason)
  })
}

for (const [label, mutate] of [
  ['strict missing geography', info => Object.assign(info, { location: '', additionalLocations: null, country: null, jobRequisitionLocation: null })],
  ['invalid supplied country despite missing geography', info => Object.assign(info, { location: '', additionalLocations: null,
    country: { descriptor: 'India', alpha2Code: 'US' }, jobRequisitionLocation: null })],
  ['malformed secondary locations', info => { info.additionalLocations = { office: 'Unknown' } }],
  ['unbound requisition despite missing geography', info => Object.assign(info, { jobReqId: 'UNRELATED', location: '',
    additionalLocations: null, country: null, jobRequisitionLocation: null })],
]) test('missing-geography handling still rejects ' + label, async t => {
  const result = await exercise(t, { configOverrides: { retainProvenIndiaOnUnresolvedLocations: label !== 'strict missing geography' }, change: state => {
    addProofIndiaOffice(state)
    mutate(state.details.get('https://csgi.wd5.myworkdayjobs.com/wday/cxs/csgi/CSGCareers/job/Brazil-Remote/Software-Development-Engineer_32265').jobPostingInfo)
  } })
  assert.ok(result.error)
  assertNoCertifiedZero(result)
})

for (const [label, mutate] of [
  ['conflicting country', state => {
    state.details.get('https://csgi.wd5.myworkdayjobs.com/wday/cxs/csgi/CSGCareers/job/Brazil-Remote/Software-Development-Engineer_32265')
      .jobPostingInfo.country.descriptor = 'India'
  }],
  ['changed closing inventory', state => { state.closing.jobPostings[0].title = 'Changed role' }],
]) test('partial country proof still rejects ' + label, async t => {
  const result = await exercise(t, { configOverrides: { retainProvenIndiaOnUnresolvedLocations: true }, change: state => {
    addProofIndiaOffice(state)
    mutate(state)
  } })
  assert.ok(result.error)
  assertNoCertifiedZero(result)
})

test('an explicitly partial board union retains proven India jobs and unresolved-country receipts', async t => {
  const result = await exercise(t, { boardUnion: { allowUnresolvedCountryScope: true },
    configOverrides: { retainProvenIndiaOnUnresolvedLocations: true }, change: state => {
      addProofIndiaOffice(state)
      state.details.get('https://csgi.wd5.myworkdayjobs.com/wday/cxs/csgi/CSGCareers/job/Brazil-Remote/Software-Development-Engineer_32265')
        .jobPostingInfo.additionalLocations.push('Unresolved secondary campus')
    } })
  assert.ifError(result.error)
  assert.deepEqual(result.jobs.map(job => job.jobId), ['R90001'])
  assert.equal(result.jobs[0].sourceBoardInventories[0].countryScopeComplete, false)
  assert.equal(result.jobs[0].sourceBoardInventories[0].unresolvedCountryRoles[0].requisitionId, '32265')
  assert.equal(result.jobs[0].sourceBoardInventories[0].reportedTotal, 16)
  assert.equal(result.jobs[0].sourceListingComplete, false)
  assert.equal(result.evidence?.listingComplete, false)
})

test('a board union independently rechecks the live detail after its closing inventory', async t => {
  const result = await exercise(t, { boardUnion: {}, change: addProofIndiaOffice })
  assert.ifError(result.error)
  assert.deepEqual(result.jobs.map(job => job.jobId), ['R90001'])
  const detailUrl = result.jobs[0].link.replace('/CSGCareers/job/', '/wday/cxs/csgi/CSGCareers/job/')
  assert.equal(result.calls.filter(call => call.url === detailUrl).length, 2,
    'The closing detail read is independent of the earlier country proof')
  assert.equal(result.calls.filter(call => call.method === 'POST').length, 3,
    'Initial, full closing reconciliation and union first-page recheck remain required')
})

test('a board union never reuses an earlier invocation detail when the current role identity changes', async t => {
  const earlier = await exercise(t, { boardUnion: {}, change: addProofIndiaOffice })
  assert.ifError(earlier.error)
  const current = await exercise(t, { boardUnion: {}, change: state => {
    addProofIndiaOffice(state)
    const detail = [...state.details.values()].find(payload => payload.jobPostingInfo.jobReqId === 'R90001')
    detail.jobPostingInfo.externalUrl = detail.jobPostingInfo.externalUrl.replace('_R90001', '_R90002')
  } })
  assert.ok(current.error)
  assert.equal(current.error.failureKind, 'incomplete_location_scope')
  assert.ok(current.calls.some(call => call.url.includes('/job/') && call.url.includes('_R90001')))
  assertNoCertifiedZero(current)
})

test('each board union invocation reads the current native description for an unchanged role identity', async t => {
  const earlier = await exercise(t, { boardUnion: {}, change: addProofIndiaOffice })
  assert.ifError(earlier.error)
  const description = '<p>Updated native engineering responsibilities for this current invocation, with the same public requisition and board.</p>'
  const current = await exercise(t, { boardUnion: {}, change: state => {
    addProofIndiaOffice(state)
    const detail = [...state.details.values()].find(payload => payload.jobPostingInfo.jobReqId === 'R90001')
    detail.jobPostingInfo.jobDescription = description
  } })
  assert.ifError(current.error)
  assert.equal(current.jobs[0].sourceDescription, description)
  assert.notEqual(current.jobs[0].sourceDescription, earlier.jobs[0].sourceDescription)
  assert.equal(current.calls.filter(call => call.url.includes('/wday/cxs/') && call.url.includes('/job/') && call.url.includes('_R90001')).length, 2)
})

test('the closing detail pass does not bypass complete closing inventory reconciliation', async t => {
  const result = await exercise(t, { boardUnion: {}, change: state => {
    addProofIndiaOffice(state)
    state.closing.jobPostings[0].title += ' changed'
  } })
  assert.ok(result.error)
  assert.equal(result.error.name, 'WorkdayIncompleteListingError')
  assertNoCertifiedZero(result)
})

test('an empty partial board union preserves unresolved-country diagnostics through the registered adapter decorator', async t => {
  const result = await exercise(t, { boardUnion: { allowUnresolvedCountryScope: true },
    configOverrides: { retainProvenIndiaOnUnresolvedLocations: true }, change: state => {
      state.details.get('https://csgi.wd5.myworkdayjobs.com/wday/cxs/csgi/CSGCareers/job/Brazil-Remote/Software-Development-Engineer_32265')
        .jobPostingInfo.additionalLocations.push('Unresolved secondary campus')
    } })
  assert.ifError(result.error)
  assert.deepEqual(result.jobs, [])
  const decorated = decorateJobsWithProviderMetadata(result.jobs, { source: 'csg', companyName: 'CSG' })
  const audit = decorated[Symbol.for('jobverify.workday.country-inventory-proof')]
  assert.ok(audit?.boards?.length, 'An empty result must retain its board inventory independently of jobs')
  assert.equal(audit.boards.length, 1)
  assert.equal(audit.boards[0].reportedTotal, 15)
  assert.equal(audit.boards[0].countryScopeComplete, false)
  assert.equal(audit.boards[0].unresolvedCountryRoles[0].requisitionId, '32265')
  assert.ok(audit.boards[0].unresolvedCountryRoles[0].locations.includes('Unresolved secondary campus'))
  assert.equal(readInventoryEvidence(decorated).listingComplete, false)
})

test('a partial board union cannot opt into complete company inventory while countries are unresolved', async t => {
  const result = await exercise(t, { boardUnion: { allowUnresolvedCountryScope: true, completeSourceScope: true },
    configOverrides: { retainProvenIndiaOnUnresolvedLocations: true }, change: state => {
      addProofIndiaOffice(state)
      state.details.get('https://csgi.wd5.myworkdayjobs.com/wday/cxs/csgi/CSGCareers/job/Brazil-Remote/Software-Development-Engineer_32265')
        .jobPostingInfo.additionalLocations.push('Unresolved secondary campus')
    } })
  assert.ok(result.error)
  assertNoCertifiedZero(result)
})

test('CSG resolves conflicting explicit listing country codes through native India details', async t => {
  const result = await exercise(t, { change: state => addProofIndiaOffice(state, { listingLocation: 'US.Campus42, IN' }) })
  assert.ifError(result.error)
  assert.equal(result.jobs?.length, 1)
  assert.equal(result.jobs[0].requisitionId, 'R90001')
  assert.equal(result.jobs[0].location, 'Campus_42, India')
  assert.equal(result.evidence?.indiaFacetCount, 1)
  assert.equal(resolveZeroJobOutcome({ provider: {} }, result.jobs, result.jobs), null)
})

const corporateAnchor = '<a href="https://csgi.wd5.myworkdayjobs.com/CSGCareers">Jobs</a>'
for (const [label, markup] of [
  ['unmatched descendant hiding rule', '<style>.unused div{display:none}</style><div>' + corporateAnchor + '</div>'],
  ['unmatched conditional HTML ancestor', '<style>html.w-mod-js:not(.ready) :is([data-hidden], .menu, .drawer){opacity:0}</style>' + corporateAnchor],
  ['partially transparent visible link', '<div style="opacity:0.5">' + corporateAnchor + '</div>'],
]) test('current Workday corporate binding accepts ' + label, async t => {
  const result = await exercise(t, { change: state => { state.corporate.body = '<html><body>' + markup + '</body></html>' } })
  assert.ifError(result.error)
  assert.equal(result.evidence?.listingComplete, true)
  assert.equal(result.evidence?.reportedTotal, 15)
})

for (const [label, markup] of [
  ['matching conditional target', '<style>.jobs:not(.disabled){display:none}</style><a class="jobs" href="https://csgi.wd5.myworkdayjobs.com/CSGCareers">Jobs</a>'],
  ['matching attribute target', '<style>[data-private]{display:none}</style><a data-private href="https://csgi.wd5.myworkdayjobs.com/CSGCareers">Jobs</a>'],
]) test('current Workday corporate binding rejects ' + label, async t => {
  const result = await exercise(t, { change: state => { state.corporate.body = '<html><body>' + markup + '</body></html>' } })
  assertNoCertifiedZero(result)
})

for (const [label, markup] of [
  ['xmp raw text', '<xmp>' + corporateAnchor + '</xmp>'],
  ['iframe fallback', '<iframe>' + corporateAnchor + '</iframe>'],
  ['object fallback', '<object>' + corporateAnchor + '</object>'],
  ['noembed fallback', '<noembed>' + corporateAnchor + '</noembed>'],
  ['plaintext raw text', '<plaintext>' + corporateAnchor],
  ['comment-obscured hidden style', '<div style="display:/**/none">' + corporateAnchor + '</div>'],
]) test(`CSG corporate ${label} anchors cannot bind the current Workday board`, async t => {
  const result = await exercise(t, { change: state => {
    state.corporate.body = '<html><body>' + markup + '</body></html>'
  } })
  assertNoCertifiedZero(result)
})
