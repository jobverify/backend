import assert from 'node:assert/strict'
import test from 'node:test'
import * as omega from '../../scraper/omegahealthcaremanagementservices/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../utils/sourceObservationEvidence.js'
import { buildScrapers } from '../providers/index.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from 'undici'

// Controlled mutations of the observed public Oracle shape catch pagination,
// country, identity and content bugs. These are not live binding evidence.
const host = 'https://fa-equm-saasfaprod1.fa.ocs.oraclecloud.com'
const siteUrl = site => `${host}/hcmUI/CandidateExperience/en/sites/${site}`
const corporate = url => `<html><head><title>${url.endsWith('/careers/') ? 'Join Our Team | Omega Healthcare Careers' : 'Careers | Omega Healthcare'}</title><link rel="canonical" href="${url}"></head><body>Omega Healthcare ${['CX_1001', 'CX_2001'].map(site => `<a href="${siteUrl(site)}">Careers</a>`).join('')}</body></html>`
const candidate = site => `<html><head><title>Omega ${site === 'CX_1001' ? 'US' : 'PH'} Career site</title><base href="/hcmUI/CandidateExperience/en/sites/${site}" data-apibaseurl="${host}:443" data-sitenumber="${site}"></head></html>`
const queryKeys = ['Keyword', 'CorrectedKeyword', 'SuggestedKeyword', 'Location', 'LocationId', 'Latitude', 'Longitude', 'SelectedTitlesFacet', 'SelectedCategoriesFacet', 'SelectedPostingDatesFacet', 'SelectedLocationsFacet', 'LastSelectedFacet', 'JobFamilyId', 'PostingStartDate', 'PostingEndDate', 'SelectedWorkLocationsFacet', 'RequisitionId', 'CandidateNumber', 'WorkLocationZipCode', 'WorkLocationCountryCode', 'SelectedFlexFieldsFacets', 'OrganizationId', 'SelectedOrganizationsFacet', 'UserTargetFacetName', 'UserTargetFacetInputTerm', 'HotJobFlag', 'WorkplaceType', 'SelectedWorkplaceTypesFacet', 'BotQRShortCode']
const row = (id, country = 'US', location = 'Denver, CO, United States') => ({ Id: String(id), Title: `Revenue Analyst ${id}`, PrimaryLocationCountry: country, PrimaryLocation: location, GeographyId: 100, OrganizationId: 200, LegalEmployerId: 300, PostedDate: '2026-11-03', PostingEndDate: null, ShortDescriptionStr: 'A short listing summary.', ExternalQualificationsStr: null, ExternalResponsibilitiesStr: null, secondaryLocations: [] })
const indiaRow = id => row(id, 'IN', 'Bengaluru, Karnataka, India')
const detail = record => ({ ...record, RequisitionId: 300000000000001, ExternalPostedStartDate: null, ExternalPostedEndDate: null, ApplyWhenNotPostedFlag: false, ExternalDescriptionStr: '<p>Design reliable revenue cycle software and maintain services for healthcare customers.</p>', ExternalResponsibilitiesStr: '<p>Review production changes, investigate faults, and collaborate with operations.</p>', ExternalQualificationsStr: '<p>Experience building and testing maintainable systems and communicating technical decisions.</p>', CorporateDescriptionStr: null, OrganizationDescriptionStr: null, skills: [], workLocation: [], otherWorkLocations: [], primaryLocationCoordinates: [] })
const envelope = (site, offset, records, total) => ({ items: [{ ...Object.fromEntries(queryKeys.map(key => [key, null])), SiteNumber: site, Offset: offset, Limit: 24, TotalJobsCount: total, Radius: 0, UseExactKeywordFlag: false, requisitionList: records }] })
const transport = (boards = { CX_1001: [indiaRow('10001')], CX_2001: [] }, changes = {}) => {
  const calls = [], passes = new Map()
  const fetchText = async (url, init) => {
    calls.push({ url, kind: 'text', signal: init?.signal })
    if (changes.text) return changes.text(url, init)
    if (url === omega.GLOBAL_CAREERS_URL || url === omega.INDIA_CAREERS_URL) return corporate(url)
    const site = /\/sites\/(CX_\d+)$/.exec(url)?.[1]
    assert.ok(site, `Unexpected document GET ${url}`)
    return candidate(site)
  }
  const fetchJson = async (url, init) => {
    calls.push({ url, kind: 'json', signal: init?.signal })
    const site = /siteNumber=(CX_\d+)/.exec(url)?.[1]
    assert.ok(site, `Missing bound native board ${url}`)
    const offsetText = /,offset=(\d+)/.exec(url)?.[1]
    if (offsetText != null) {
      assert.equal(url.includes(',location='), false)
      assert.match(url, /,limit=24,offset=/)
      const offset = Number(offsetText)
      if (offset === 0) passes.set(site, (passes.get(site) || 0) + 1)
      const payload = envelope(site, offset, boards[site].slice(offset, offset + 24), boards[site].length)
      return changes.list ? changes.list(payload, site, offset, passes.get(site)) : payload
    }
    const id = /Id=%22(\d+)%22/.exec(url)?.[1]
    assert.ok(id, `Unexpected detail URL ${url}`)
    const record = boards[site].find(value => value.Id === id)
    assert.ok(record, `Unlisted bound role ${site}/${id}`)
    const payload = { items: [detail(record)] }
    return changes.detail ? changes.detail(payload, site, id, init) : payload
  }
  return { calls, passes, fetchText, fetchJson }
}
const execute = (fixture, options = {}) => omega.run({ ...fixture, ...options, now: () => '2026-11-05T09:00:00.000Z' })

test('Omega uses unfiltered raw offsets and typed secondary India countries', () => {
  assert.match(omega.buildSearchUrl({ siteNumber: 'CX_2001', page: 2 }), /,limit=24,offset=48$/)
  const mixed = { ...row('10001'), secondaryLocations: [{ Name: 'Bengaluru', CountryCode: 'IN' }, { Name: 'Manila', CountryCode: 'PH' }] }
  const listings = omega.extractSearchResults({ items: [{ requisitionList: [mixed, row('10002', null, 'Bengaluru'), row('10003', 'US', 'New India')] }] }, { siteNumber: 'CX_2001' })
  assert.equal(listings.length, 1)
  assert.equal(listings[0].country, 'India')
  assert.equal(listings[0].location, 'Bengaluru')
  assert.deepEqual(listings[0].sourceNativeLocations.map(value => [value.kind, value.countryCode, value.country]), [['primary', 'US', 'United States'], ['secondary', 'IN', 'India'], ['secondary', 'PH', 'Philippines']])
})

test('Omega reads beyond foreign-only pages and closes both exact raw inventories', async () => {
  const fixture = transport({ CX_1001: Array.from({ length: 25 }, (_, index) => index === 24 ? indiaRow('10025') : row(10001 + index)), CX_2001: [row('20001', 'PH', 'Manila, Philippines')] })
  const jobs = await execute(fixture)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '10025')
  assert.deepEqual(fixture.calls.filter(value => value.url.includes(',offset=')).map(value => /siteNumber=(CX_\d+),limit=24,offset=(\d+)/.exec(value.url).slice(1)), [['CX_1001', '0'], ['CX_1001', '24'], ['CX_1001', '0'], ['CX_1001', '24'], ['CX_2001', '0'], ['CX_2001', '0']])
  const evidence = jobs[omega.OMEGA_INVENTORY_EVIDENCE]
  assert.equal(evidence.configuredBoardObservationCount, 26)
  assert.deepEqual(evidence.boards.CX_1001.opening.ids, Array.from({ length: 25 }, (_, index) => String(10001 + index)))
  assert.deepEqual(evidence.boards.CX_1001.closing.records, evidence.boards.CX_1001.opening.records)
  assert.equal(evidence.companyIndiaTotal, null)
  assert.equal(evidence.companyGlobalTotal, null)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('Omega preserves authored external sections and native public state without summary substitution', async () => {
  const jobs = await execute(transport())
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceDescription, 'Design reliable revenue cycle software and maintain services for healthcare customers. Review production changes, investigate faults, and collaborate with operations. Experience building and testing maintainable systems and communicating technical decisions.')
  assert.equal(jobs[0].sourceExternalSections.ExternalResponsibilitiesStr, '<p>Review production changes, investigate faults, and collaborate with operations.</p>')
  assert.equal(jobs[0].sourceNativePublicState.applyWhenNotPostedFlag, false)
  assert.equal(jobs[0].nativeRequisitionId, 300000000000001)
  assert.equal(jobs[0].scrapedAt, '2026-11-05T09:00:00.000Z')
})

test('Omega records denied corporate binding and preserves configured-board observations through registered mapping', async () => {
  const fixture = transport({ CX_1001: [row('10001')], CX_2001: [row('20001', 'PH', 'Manila, Philippines')] }, { text: async url => {
    if (url.startsWith('https://www.omegahms.com/')) throw Object.assign(new Error('HTTP 403'), { status: 403 })
    return candidate(/\/sites\/(CX_\d+)$/.exec(url)[1])
  } })
  const jobs = await buildScrapers().find(value => value.name === omega.SOURCE).run(fixture)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.match(readInventoryEvidence(jobs).reason, /corporate-handoff-unverified/)
  assert.deepEqual(readSourceObservationEvidence(jobs, omega.SOURCE), { source: omega.SOURCE, recordKind: 'vacancy-rows', observedRecordCount: 2, observedVacancyCount: 2, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
})

test('Omega registered positive rows retain authored content and raw partial-scope evidence', async () => {
  const jobs = await buildScrapers().find(value => value.name === omega.SOURCE).run(transport())
  assert.equal(jobs[0].nativeCollectionEvidence.boards.CX_1001.opening.records[0].Id, '10001')
  assert.equal(jobs[0].sourceExternalSections.ExternalDescriptionStr, detail(indiaRow('10001')).ExternalDescriptionStr)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const [name, mutate, reason] of [
  ['missing external section', value => { delete value.ExternalQualificationsStr }, /missing-authored-sections/],
  ['stub description', value => { value.ExternalDescriptionStr = 'JD attached'; value.ExternalResponsibilitiesStr = null; value.ExternalQualificationsStr = null }, /missing-content/],
  ['expired posting', value => { value.ExternalPostedEndDate = '2026-11-04T00:00:00Z' }, /closed-native-posting/],
  ['nonposted apply permission', value => { value.ApplyWhenNotPostedFlag = true }, /public-state-unresolved/],
]) test(`Omega leaves ${name} explicitly partial`, async () => {
  const jobs = await execute(transport(undefined, { detail: payload => { mutate(payload.items[0]); return payload } }))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.match(jobs[0].sourceDetailFailureKind, reason)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

for (const [name, changes] of [
  ['wrong detail identity', { detail: payload => ({ items: [{ ...payload.items[0], Id: '99999' }] }) }],
  ['wrong detail site', { detail: payload => ({ items: [{ ...payload.items[0], SiteNumber: 'CX_9999' }] }) }],
  ['secondary relocation', { detail: payload => ({ items: [{ ...payload.items[0], secondaryLocations: [{ Name: 'Manila', CountryCode: 'PH' }] }] }) }],
  ['constrained query', { list: payload => { payload.items[0].Location = 'India'; return payload } }],
  ['wrong native site', { list: payload => { payload.items[0].SiteNumber = 'CX_9999'; return payload } }],
  ['changed closing record', { list: (payload, site, offset, pass) => { if (site === 'CX_1001' && pass === 2) payload.items[0].requisitionList = [indiaRow('99999')]; return payload } }],
]) test(`Omega rejects ${name} instead of asserting a matched inventory`, async () => {
  await assert.rejects(execute(transport(undefined, changes)), /contract|identity|site|worksite|query|inventory changed/i)
})

test('Omega retains unresolved country records and page-limit evidence without cleanup or a zero claim', async () => {
  const fixture = transport({ CX_1001: [indiaRow('10001'), row('10002', null, 'Bengaluru'), ...Array.from({ length: 23 }, (_, index) => row(10100 + index))], CX_2001: [] })
  const jobs = await execute(fixture, { maxPages: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[omega.OMEGA_INVENTORY_EVIDENCE].boards.CX_1001.opening.rawCount, 24)
  assert.deepEqual(jobs[omega.OMEGA_INVENTORY_EVIDENCE].boards.CX_1001.opening.unknownCountryIds, ['10002'])
  assert.equal(jobs[omega.OMEGA_INVENTORY_EVIDENCE].boards.CX_1001.closing, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[0].sourceDetailComplete, true)
})

test('Omega retains API diagnostics while leaving candidate stubs unverified', async () => {
  const jobs = await execute(transport(undefined, { text: async url => url.startsWith('https://www.omegahms.com/') ? corporate(url) : '<html><title>Site not available</title></html>' }))
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[omega.OMEGA_INVENTORY_EVIDENCE].boards.CX_1001.candidate.verified, false)
  assert.match(readInventoryEvidence(jobs).reason, /candidate-site-unverified/)
})

for (const reason of [false, 0, '', { opaque: true }]) test(`Omega preserves exact pre-transport caller abort (${typeof reason})`, async () => {
  const controller = new AbortController(); controller.abort(reason)
  let calls = 0
  await assert.rejects(omega.run({ signal: controller.signal, fetchText: async () => { calls++; return '' }, fetchJson: async () => { calls++; return {} } }), value => value === reason)
  assert.equal(calls, 0)
})

test('Omega races ignored cancellation and prevents late queued requests', async () => {
  const controller = new AbortController()
  let calls = 0
  const operation = omega.run({ signal: controller.signal, fetchText: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 40)); return corporate(omega.GLOBAL_CAREERS_URL) }, fetchJson: async () => { calls++; return envelope('CX_1001', 0, [], 0) } })
  setTimeout(() => controller.abort(false), 5)
  await assert.rejects(operation, value => value === false)
  await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal(calls, 1)
})

test('Omega bounds transport-ignored request and collection time', async () => {
  const slow = async () => { await new Promise(resolve => setTimeout(resolve, 40)); return '' }
  await assert.rejects(omega.run({ fetchText: slow, fetchJson: slow, requestTimeoutMs: 5, collectionBudgetMs: 15 }), /budget|timed out/i)
})

test('Omega enforces byte caps and cancels an ignored body read with the opaque caller reason', async () => {
  await assert.rejects(execute(transport(), { maxResponseBytes: 40 }), /byte/i)
  const controller = new AbortController()
  let pulls = 0, cancelled = false
  const operation = omega.run({ signal: controller.signal, fetchImpl: async () => ({ ok: true, status: 200, url: omega.GLOBAL_CAREERS_URL, headers: new Headers({ 'content-type': 'text/html' }), body: { getReader: () => ({ read: async () => { pulls++; await new Promise(resolve => setTimeout(resolve, 40)); return { done: false, value: new TextEncoder().encode('late body') } }, cancel: () => { cancelled = true }, releaseLock: () => {} }) } }) })
  setTimeout(() => controller.abort(0), 5)
  await assert.rejects(operation, value => value === 0)
  await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal(pulls, 1)
  assert.equal(cancelled, true)
})

test('Omega aborts a fatal detail cohort before queued peers read', async () => {
  const requested = []
  const fixture = transport({ CX_1001: [indiaRow('10001'), indiaRow('10002'), indiaRow('10003')], CX_2001: [] }, { detail: async (payload, site, id) => {
    requested.push(id)
    await new Promise(resolve => setTimeout(resolve, id === '10001' ? 5 : 40))
    if (id === '10001') payload.items[0].Id = '99999'
    return payload
  } })
  await assert.rejects(execute(fixture, { detailConcurrency: 2 }), /identity/i)
  await new Promise(resolve => setTimeout(resolve, 50))
  assert.deepEqual(requested, ['10001', '10002'])
})

const blockEventLoop = milliseconds => {
  const until = performance.now() + milliseconds
  while (performance.now() < until) { /* Deliberately starve the timer queue. */ }
}
const responseTransport = fixture => async (url, init) => {
  const json = url.includes('/hcmRestApi/')
  const value = await (json ? fixture.fetchJson(url, init) : fixture.fetchText(url, init))
  const response = new Response(json ? JSON.stringify(value) : value, { headers: { 'content-type': json ? 'application/json' : 'text/html' } })
  Object.defineProperty(response, 'url', { value: url })
  return response
}

for (const boundary of ['decoded reader', 'transport', 'body read']) test(`Omega rejects an elapsed request deadline after a timer-starving ${boundary}`, async () => {
  const fixture = transport()
  const options = { requestTimeoutMs: 25, collectionBudgetMs: 5000 }
  if (boundary === 'decoded reader') {
    options.fetchJson = fixture.fetchJson
    options.fetchText = async (url, init) => {
      if (url === omega.GLOBAL_CAREERS_URL) blockEventLoop(80)
      return fixture.fetchText(url, init)
    }
  } else {
    const normal = responseTransport(fixture)
    options.fetchImpl = async (url, init) => {
      if (url !== omega.GLOBAL_CAREERS_URL) return normal(url, init)
      if (boundary === 'transport') { blockEventLoop(80); return normal(url, init) }
      const bytes = new TextEncoder().encode(corporate(url))
      let complete = false
      return { ok: true, status: 200, url, headers: new Headers({ 'content-type': 'text/html' }), body: {
        getReader: () => ({ read: async () => {
          if (complete) return { done: true }
          complete = true; blockEventLoop(80); return { done: false, value: bytes }
        }, cancel: () => {}, releaseLock: () => {} }),
      } }
    }
  }
  const jobs = await omega.run(options)
  const firstCorporate = jobs[omega.OMEGA_INVENTORY_EVIDENCE].corporate[0]
  assert.equal(firstCorporate.verified, false, 'A late corporate response must not verify its handoff')
  assert.match(firstCorporate.error.message, /timed out/i)
})

test('Omega rejects an elapsed source budget even when the reader prevents its timer from running', async () => {
  const fixture = transport()
  const fetchText = async (url, init) => {
    if (url === omega.GLOBAL_CAREERS_URL) blockEventLoop(80)
    return fixture.fetchText(url, init)
  }
  await assert.rejects(omega.run({ ...fixture, fetchText, requestTimeoutMs: 1000, collectionBudgetMs: 25 }), error => error.failureKind === 'coverage_gap' && /budget/i.test(error.message))
})

test('Omega rejects a JSON parse that returns after its elapsed request deadline', async () => {
  const fixture = transport(), parse = JSON.parse
  let blocked = false
  JSON.parse = function (value, ...args) {
    if (!blocked && typeof value === 'string' && value.includes('"TotalJobsCount"')) { blocked = true; blockEventLoop(80) }
    return parse.call(this, value, ...args)
  }
  try {
    await assert.rejects(omega.run({ fetchImpl: responseTransport(fixture), requestTimeoutMs: 25, collectionBudgetMs: 5000 }), /timed out/i)
    assert.equal(blocked, true)
  } finally { JSON.parse = parse }
})

test('Omega rejects decoded JSON serialization that returns after its request deadline', async () => {
  let blocked = false
  const fixture = transport(undefined, { list: payload => {
    if (!blocked) Object.defineProperty(payload, 'toJSON', { value: () => {
      blocked = true; blockEventLoop(80); return { items: payload.items }
    } })
    return payload
  } })
  await assert.rejects(execute(fixture, { requestTimeoutMs: 25, collectionBudgetMs: 5000 }), /timed out/i)
  assert.equal(blocked, true)
})

test('Omega checks its source deadline again after final evidence construction', async () => {
  const fixture = transport({ CX_1001: [], CX_2001: [] })
  let closing = false, completionClockSeen = false, blocked = false
  const fetchJson = async (url, init) => {
    const payload = await fixture.fetchJson(url, init)
    if (url.includes('siteNumber=CX_2001,') && fixture.passes.get('CX_2001') === 2) closing = true
    return payload
  }
  const now = () => {
    if (closing && !completionClockSeen) completionClockSeen = true
    else if (closing && !blocked) { blocked = true; blockEventLoop(160) }
    return '2026-11-05T09:53:21.507Z'
  }
  await assert.rejects(omega.run({ ...fixture, fetchJson, now, requestTimeoutMs: 1000, collectionBudgetMs: 100 }), error => error.failureKind === 'coverage_gap' && /budget/i.test(error.message))
  assert.equal(blocked, true)
})

test('Omega rejects a nonstreaming response before invoking an unbounded text reader', async () => {
  let textReads = 0, requests = 0
  await assert.rejects(omega.run({ maxResponseBytes: 40, fetchImpl: async url => {
    requests++
    return { ok: true, status: 200, url, headers: new Headers({ 'content-type': 'text/html' }), text: async () => { textReads++; return 'x'.repeat(4096) } }
  } }), /stream|byte/i)
  assert.equal(textReads, 0)
  assert.equal(requests, 1, 'An unsupported body must stop the collection before another request')
})

for (const kind of ['text', 'json']) test(`Omega checks oversized decoded ${kind} bytes before allocating a Buffer copy`, async () => {
  const fixture = transport(), oversized = 'é'.repeat(4096)
  const serialized = `{"blob":"${oversized}"}`
  const from = Buffer.from
  let copies = 0, oversizedReads = 0
  Buffer.from = function (value, ...args) {
    if (value === oversized || value === serialized) copies++
    return from.call(this, value, ...args)
  }
  try {
    const options = { ...fixture, maxResponseBytes: 1024 }
    if (kind === 'text') options.fetchText = async () => { oversizedReads++; return oversized }
    else options.fetchJson = async () => { oversizedReads++; return { blob: oversized } }
    await assert.rejects(omega.run(options), /byte/i)
    assert.equal(copies, 0, 'Oversized decoded content must fail before Buffer.from copies it')
    assert.equal(oversizedReads, 1, 'A byte failure must stop subsequent source/cohort work')
  } finally { Buffer.from = from }
})

test('Omega default fetch rejects a redirect before another HTTP hop can exceed maxRequests', async () => {
  const dispatcher = getGlobalDispatcher(), mock = new MockAgent()
  mock.disableNetConnect()
  let admittedHops = 0, hiddenHops = 0
  mock.get('https://www.omegahms.com').intercept({ path: '/careers/', method: 'GET' }).reply(() => {
    admittedHops++
    return { statusCode: 302, data: 'Public redirect', responseOptions: { headers: {
      'content-type': 'text/html', location: 'https://unreviewed.invalid/redirect-target',
    } } }
  })
  mock.get('https://unreviewed.invalid').intercept({ path: '/redirect-target', method: 'GET' }).reply(() => {
    hiddenHops++
    return { statusCode: 200, data: corporate(omega.GLOBAL_CAREERS_URL), responseOptions: { headers: { 'content-type': 'text/html' } } }
  })
  setGlobalDispatcher(mock)
  try {
    await assert.rejects(omega.run({ maxRequests: 1 }), /request count budget/i)
    assert.equal(admittedHops, 1)
    assert.equal(hiddenHops, 0, 'A final-URL check is too late to bound automatic redirect hops')
  } finally { setGlobalDispatcher(dispatcher); await mock.close() }
})

test('Omega public GET explicitly omits ambient credentials at the transport boundary', async () => {
  const fixture = transport(), normal = responseTransport(fixture), policies = []
  await omega.run({ fetchImpl: async (url, init) => { policies.push(new Request(url, init).credentials); return normal(url, init) } })
  assert.deepEqual([...new Set(policies)], ['omit'])
})

for (const end of ['2026-11-05T09:00:00Z', '2026-11-05T09:53:21.507Z']) test(`Omega preserves exact native expiry ${end} and filters the expired role through actual publishing metrics`, () => {
  const clock = '2026-11-05T09:53:21.507Z'
  const record = { ...detail(indiaRow('10001')), ExternalPostedEndDate: end }
  const job = omega.extractJobDetail({ items: [record] }, { siteNumber: 'CX_1001' }, { now: () => clock })
  const analysis = analyzePublishableJobs([job], { now: new Date(clock) })
  assert.equal(job.closingDate, end)
  assert.equal(job.sourceClosingDateIsExact, true)
  assert.equal(job.sourceNativePublicState.state, 'closed')
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(analysis.eligibleJobs.length, 0)
  assert.equal(analysis.filterCounts.closed, 1)
})

test('Omega preserves all five public authored sections and excludes internal-only content', async () => {
  const fixture = transport(undefined, { detail: payload => ({ items: [{ ...payload.items[0],
    CorporateDescriptionStr: '<p>Company information published with this role remains available to candidates.</p>',
    OrganizationDescriptionStr: '<p>Public team scope and working expectations belong to the authored detail.</p>',
    InternalQualificationsStr: '<p>Internal-only qualification text.</p>',
  }] }) })
  const jobs = await execute(fixture)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceExternalSections.CorporateDescriptionStr, '<p>Company information published with this role remains available to candidates.</p>')
  assert.equal(jobs[0].sourceExternalSections.OrganizationDescriptionStr, '<p>Public team scope and working expectations belong to the authored detail.</p>')
  assert.match(jobs[0].sourceDescription, /Company information published with this role/)
  assert.match(jobs[0].sourceDescription, /Public team scope and working expectations/)
  assert.equal(jobs[0].sourceDescription.includes('Internal-only'), false)
  const corporateOnly = omega.extractJobDetail({ items: [{ ...detail(indiaRow('10002')),
    ExternalDescriptionStr: null, ExternalResponsibilitiesStr: null, ExternalQualificationsStr: null,
    CorporateDescriptionStr: '<p>Published company information is retained but does not supply role responsibilities.</p>',
  }] }, { siteNumber: 'CX_1001' })
  assert.equal(corporateOnly.sourceDetailComplete, false)
  assert.equal(corporateOnly.sourceDetailFailureKind, 'missing-content')
  assert.match(corporateOnly.sourceDescription, /Published company information/)
})
