import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import nodeTest from 'node:test'
import { gunzipSync } from 'node:zlib'
import { buildScrapers } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { resolveZeroJobOutcome } from '../../scraper-support/runner.js'

const test = (name, run) => nodeTest(name, { concurrency: false }, run)
const proofSymbol = Symbol.for('jobverify.workday.country-inventory-proof')
const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./native-captures/offline-protocol-20261101.json.gz', import.meta.url))))
const api = 'https://guardianlife.wd5.myworkdayjobs.com/wday/cxs/guardianlife/Guardian-Life-Careers/jobs'
const corporate = 'https://www.guardianlife.com/careers/corporate'
const id = 'R000110399'
const decode = packet => {
  const body = Buffer.from(packet.rawBodyBase64, 'base64')
  assert.equal(createHash('sha256').update(body).digest('hex'), packet.bodySHA256)
  return body.toString('utf8')
}
const initial = capture.packets.filter(p => p.url === api).slice(0, 6).flatMap(p => JSON.parse(decode(p)).jobPostings)
assert.equal(initial.length, 107)

// Only external HTTP is replaced. The registered adapter, local config, shared
// Workday engine, provider decoration and zero-outcome consumer are real.
// Reusing closing packets and synthetic positive roles is an offline protocol
// exercise; original capture clocks remain in the checked-in fixture.
const exercise = async (t, { change = () => {}, options = {} } = {}) => {
  const state = { postings: structuredClone(initial), native: new Map(), html: new Map(), corporate: new Map(), closing: null }
  for (const packet of capture.packets) {
    if (packet.url.includes('/wday/cxs/') && packet.method === 'GET') state.native.set(packet.url, JSON.parse(decode(packet)))
    else if (packet.method === 'GET') {
      const value = { ...packet, body: decode(packet) }
      if (packet.url.startsWith('https://www.guardianlife.com/')) state.corporate.set(packet.url, value)
      else state.html.set(packet.url, value)
    }
  }
  const nativeEntry = [...state.native].find(([url]) => url.includes(id))
  const publicEntry = [...state.html].find(([url]) => url.includes(id))
  state.role = nativeEntry[1]
  state.publicRole = publicEntry[1]
  state.publicUrl = publicEntry[0]
  state.nativeUrl = nativeEntry[0]
  change(state)
  let pass = 0
  const nativeReads = new Map()
  const calls = []
  const response = (url, body, status = 200, headers = { 'content-type': 'application/json' }) => {
    const result = new Response(body, { status, headers })
    Object.defineProperty(result, 'url', { value: url })
    return result
  }
  const mock = t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input), method = init.method || 'GET'
    init.signal?.throwIfAborted()
    calls.push({ url, method, ...(init.body ? { body: JSON.parse(init.body) } : {}) })
    if (url === api && method === 'POST') {
      const request = JSON.parse(init.body)
      // The pre-repair obsolete India employer facet returned this false empty.
      if (Object.keys(request.appliedFacets).length) return response(url, JSON.stringify({ total: 0, jobPostings: [], facets: [] }))
      assert.equal(request.searchText, '')
      assert.equal(request.limit, 20)
      if (!request.offset) pass++
      const rows = pass >= 3 && state.closing ? state.closing : state.postings
      const postings = rows.slice(request.offset, request.offset + 20)
      const payload = { total: request.offset ? 0 : rows.length, jobPostings: postings, facets: [] }
      state.changePage?.(payload, { pass, offset: request.offset })
      return response(url, JSON.stringify(payload))
    }
    if (method === 'GET' && state.native.has(url)) {
      nativeReads.set(url, (nativeReads.get(url) || 0) + 1)
      const payload = structuredClone(state.native.get(url))
      if (nativeReads.get(url) > 1 && url === state.nativeUrl) state.extraNativeChange?.(payload)
      return response(url, JSON.stringify(payload))
    }
    const packet = state.corporate.get(url) || state.html.get(url)
      || (/\?locationCountry=/.test(url) ? state.html.get(url.split('?')[0]) : null)
    if (method === 'GET' && packet) {
      state.beforeHTML?.(url)
      return response(url, packet.body, packet.status, packet.headers)
    }
    throw Error(`Live network is forbidden in offline protocol tests: ${method} ${url}`)
  })
  let jobs, error
  try {
    const scraper = buildScrapers().find(item => item.name === 'guardian')
    jobs = await scraper.run({ requestScheduler: { acquire: async () => () => {}, recordRateLimit() {} },
      retryBaseDelayMs: 0, requestTimeoutMs: 1000, ...options })
  } catch (failure) { error = failure }
  finally { mock.mock.restore() }
  return { jobs, error, evidence: readInventoryEvidence(jobs), calls, state }
}
const changeSchema = (state, transform) => {
  state.publicRole.body = state.publicRole.body.replace(/(<script\s+type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,
    (_all, open, json, close) => { const schema = JSON.parse(json); transform(schema); return open + JSON.stringify(schema) + close })
}
const positiveIndia = state => {
  const listing = structuredClone(state.postings.find(row => row.bulletFields[0] === 'R000110479'))
  const payload = structuredClone([...state.native].find(([url]) => url.includes('R000110479'))[1])
  listing.externalPath = '/job/India-Campus-42/Credentialing-Support-Associate-III_R999900001'
  listing.bulletFields = ['R999900001']
  listing.locationsText = 'India Campus 42'
  Object.assign(payload.jobPostingInfo, { location: 'India Campus 42', additionalLocations: [],
    id: 'synthetic-future-india-native-role', jobReqId: 'R999900001',
    jobPostingId: 'Credentialing-Support-Associate-III_R999900001',
    externalUrl: 'https://guardianlife.wd5.myworkdayjobs.com/Guardian-Life-Careers' + listing.externalPath,
    country: { descriptor: 'India', id: 'c4f78be1a8f14da0ab49ce1162348a5e', alpha2Code: 'IN' },
    jobRequisitionLocation: { descriptor: 'India Campus 42', country: { descriptor: 'India', alpha2Code: 'IN' } },
    startDate: '2026-10-28', endDate: '2026-12-20' })
  state.postings.push(listing)
  state.native.set(api.replace(/\/jobs$/, '') + listing.externalPath, payload)
  // Fixed digest of the captured role's complete 8,494-character source text
  // before the wrapper; HTML stays in the original capture. It is unchanged by
  // the synthetic geography/date fields above.
  state.expectedIndiaDescriptionHash = '20ab8f523604e4ea6288d76d215290529ca2b0471e4d3b27672ab46f2303fe00'
}
const assertIndiaContent = result => {
  const india = result.jobs.find(job => job.requisitionId === 'R999900001')
  assert.ok(india)
  assert.equal(createHash('sha256').update(india.sourceDescription).digest('hex'), result.state.expectedIndiaDescriptionHash)
  assert.equal(createHash('sha256').update(india.jobDescription).digest('hex'), result.state.expectedIndiaDescriptionHash)
  assert.equal(india.sourceDescription.length, 8494)
}
const assertPartial = result => {
  assert.ifError(result.error)
  assert.equal(result.evidence.status, 'coverage-gap')
  assert.equal(result.evidence.listingComplete, false)
  assert.notEqual(resolveZeroJobOutcome({ provider: {} }, result.jobs, []), 'fetched-zero')
  for (const job of result.jobs) {
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
}

test('Guardian registered current full-board proof resolves four native US remote applicant scopes without asserting a global empty', async t => {
  const result = await exercise(t)
  assert.ifError(result.error)
  assert.equal(result.evidence.status, 'complete-inventory', JSON.stringify(result.jobs[proofSymbol]?.guardian?.failures))
  assert.equal(result.evidence.reportedTotal, 107)
  assert.equal(result.evidence.indiaFacetCount, 0)
  assert.equal(result.evidence.listingComplete, true)
  assert.equal(result.jobs.length, 0)
  assert.equal(resolveZeroJobOutcome({ provider: {} }, result.jobs, []), 'fetched-zero')
  const proof = result.jobs[proofSymbol]
  assert.equal(proof.initial.sha256, '1c0fd01bdccb9f821a0a48ebb79cca5e0608bf6acf014522c2f01f6e1f09f3ec')
  assert.equal(proof.guardian.applicantScopeReceipts.length, 4)
  assert.equal(proof.guardian.physicalCountryProof.unresolvedRoles.length, 4)
  assert.equal(proof.guardian.physicalCountryProof.roles.find(row => row.requisitionId === id).countryScopes.length, 0)
  assert.equal(proof.guardian.finalClosing.sha256, proof.initial.sha256)
  assert.equal(proof.guardian.wholeCompanyScope, null)
  assert.equal(proof.guardian.cleanupAllowed, true)
  assert.ok(proof.guardian.retainedResponses.every(row => row.rawBodyBase64 && row.requestedAt && row.completedAt))
})

test('Guardian retains a synthetic future India role with its exact native full JD and lifecycle dates', async t => {
  const result = await exercise(t, { change: positiveIndia })
  assert.ifError(result.error)
  assert.equal(result.jobs.length, 1)
  assertIndiaContent(result)
  assert.equal(result.jobs[0].postedAt.toISOString(), '2026-10-28T00:00:00.000Z')
  assert.equal(result.jobs[0].closingDate.toISOString(), '2026-12-20T00:00:00.000Z')
  assert.deepEqual(result.jobs[0].sourceRawDates, { startDate: '2026-10-28', endDate: '2026-12-20' })
  assert.equal(result.jobs[0].sourceDateProvenance, 'workday-cxs-jobPostingInfo')
  assert.equal(result.evidence.indiaFacetCount, 1, JSON.stringify(result.jobs[proofSymbol]?.guardian?.failures))
  assert.equal(result.jobs[0].sourceScopeComplete, true)
  assert.equal(result.jobs[0].lifecycleCleanupAllowed, true)
})

test('Guardian cannot exclude ambiguous remote roles on missing or contradictory native identity, content, geography or current apply state', async t => {
  const changes = [
    s => changeSchema(s, p => { delete p.applicantLocationRequirements }),
    s => changeSchema(s, p => { p.applicantLocationRequirements.name = 'India' }),
    s => changeSchema(s, p => { p.applicantLocationRequirements.addressCountry = 'India' }),
    s => changeSchema(s, p => { p['@context'] = 'https://unrelated.example/schema' }),
    s => changeSchema(s, p => { p.jobLocationType = 'ON_SITE' }),
    s => changeSchema(s, p => { p.identifier.value = 'R999999999' }),
    s => changeSchema(s, p => { p.title = 'Different role' }),
    s => changeSchema(s, p => { p.description = p.description.replace('Guardian is seeking', 'Someone is seeking') }),
    s => changeSchema(s, p => { p.hiringOrganization.name = 'Foreign employer' }),
    s => changeSchema(s, p => { p.jobLocation.address.addressCountry = 'India' }),
    s => changeSchema(s, p => { p.datePosted = '2026-01-01' }),
    s => { s.publicRole.body = s.publicRole.body.replace('tenant: "guardianlife",', 'tenant: "foreign", /* tenant: "guardianlife", */') },
    s => { s.publicRole.body = s.publicRole.body.replaceAll('Guardian is seeking', 'Guardianis seeking') },
    s => { s.role.jobPostingInfo.canApply = false },
    s => { s.role.jobPostingInfo.posted = false },
    s => { s.role.jobPostingInfo.remoteType = 'Onsite' },
    s => { s.role.hiringOrganization.name = 'Foreign employer' },
    s => { s.extraNativeChange = payload => { payload.jobPostingInfo.additionalLocations.push('Campus, India') } },
  ]
  for (const change of changes) {
    const result = await exercise(t, { change: state => { positiveIndia(state); change(state) } })
    assertPartial(result)
    assert.equal(result.jobs.length, 1)
    assertIndiaContent(result)
    assert.deepEqual(result.jobs[0].sourceRawDates, { startDate: '2026-10-28', endDate: '2026-12-20' })
  }
})

test('Guardian final post-receipt closing truncation, identity changes, and advertised alternate ATS disable cleanup but retain positives', async t => {
  for (const change of [
    state => { state.changePage = (payload, { pass, offset }) => { if (pass === 3 && offset >= 100) payload.jobPostings = [] } },
    state => { state.changePage = (payload, { pass, offset }) => { if (pass === 3 && offset === 0) payload.hasMore = true } },
    state => { state.changePage = (payload, { pass, offset }) => { if (pass === 3 && offset === 0) payload.jobPostings[0].title = 'Changed inventory' } },
    state => { state.corporate.get(corporate).body += '<a href="https://jobs.lever.co/guardian">More corporate jobs</a>' },
    state => { state.corporate.get(corporate).body += '<iframe src="https://jobs.lever.co/guardian"></iframe>' },
    state => { state.corporate.get(corporate).body += '<a href="/employee-openings">Search jobs</a>' },
  ]) {
    const result = await exercise(t, { change: state => { positiveIndia(state); change(state) } })
    assertPartial(result)
    assert.equal(result.jobs.length, 1)
    assertIndiaContent(result)
  }
})

test('Guardian caller cancellation preserves its exact reason and does not proceed through another client', async t => {
  const controller = new AbortController(), reason = Error('Caller stopped Guardian')
  const result = await exercise(t, { change: state => {
    state.beforeHTML = url => { if (url.includes(id)) controller.abort(reason) }
  }, options: { signal: controller.signal } })
  assert.equal(result.error, reason)
  assert.equal(result.calls.filter(call => call.url === api && call.body.offset === 0).length, 2)
})

test('Guardian custom-host Open positions handoff disables completion while retaining the proven India role', async t => {
  const result = await exercise(t, { change: state => {
    positiveIndia(state)
    state.corporate.get(corporate).body += '<a href="https://careers.guardianlife.com/roles">Open positions</a>'
  } })
  assertPartial(result)
  assert.equal(result.jobs.length, 1)
  assertIndiaContent(result)
  assert.equal(result.jobs[proofSymbol].guardian.cleanupAllowed, false)
  assert.deepEqual(result.jobs[0].sourceRawDates, { startDate: '2026-10-28', endDate: '2026-12-20' })
})

test('Guardian visible srcdoc recruiting child document disables completion while retaining the proven India role', async t => {
  const result = await exercise(t, { change: state => {
    positiveIndia(state)
    state.corporate.get(corporate).body += '<iframe srcdoc="&lt;a href=&quot;https://jobs.lever.co/guardian&quot;&gt;Corporate job openings&lt;/a&gt;"></iframe>'
  } })
  assertPartial(result)
  assert.equal(result.jobs.length, 1)
  assertIndiaContent(result)
  assert.equal(result.jobs[proofSymbol].guardian.cleanupAllowed, false)
  assert.deepEqual(result.jobs[0].sourceRawDates, { startDate: '2026-10-28', endDate: '2026-12-20' })
})

test('Guardian equivalent visible recruiting forms, controls and child documents cannot bypass corporate scope', async t => {
  const cases = [
    ['custom-host form', '<form action="https://careers.guardianlife.com/roles"><button>Open positions</button></form>'],
    ['button form action override', '<form action="/careers/corporate"><button formaction="https://careers.guardianlife.com/roles">Open positions</button></form>'],
    ['data destination button', '<button data-href="https://careers.guardianlife.com/roles">Browse jobs</button>'],
    ['scripted recruiting button', '<button onclick="window.location.href=\'https://careers.guardianlife.com/roles\'">Open positions</button>'],
    ['role button', '<div role="button" data-url="https://careers.guardianlife.com/roles">Open positions</div>'],
    ['submit input', '<input type="submit" value="Open positions" formaction="https://careers.guardianlife.com/roles">'],
    ['unknown recruiting button', '<button>Open positions</button>'],
    ['accessible recruiting anchor', '<a href="https://external.example/search" aria-label="Open positions">Learn more</a>'],
    ['image recruiting anchor', '<a href="https://external.example/search"><img alt="Open positions" src="/openings.png"></a>'],
    ['script-scheme recruiting anchor', '<a href="javascript:location.assign(\'https://external.example/search\')">Open positions</a>'],
    ['data destination anchor', '<a data-url="https://careers.guardianlife.com/roles">Details</a>'],
    ['scripted recruiting form', '<form onsubmit="location.href=\'https://careers.guardianlife.com/roles\';return false"><input type="submit" value="Go"></form>'],
    ['custom-host iframe', '<iframe src="https://careers.guardianlife.com/roles"></iframe>'],
    ['srcdoc overrides accounted src', '<iframe src="https://guardianlife.wd5.myworkdayjobs.com/Guardian-Life-Careers" srcdoc="&lt;a href=&quot;https://careers.guardianlife.com/roles&quot;&gt;Open positions&lt;/a&gt;"></iframe>'],
    ['embed child document', '<embed type="text/html" src="https://careers.guardianlife.com/roles">'],
    ['object child document', '<object type="text/html" data="https://careers.guardianlife.com/roles"></object>'],
    ['control grammar bound', '<button>Details</button>'.repeat(129)],
  ]
  for (const [name, markup] of cases) await t.test(name, async () => {
    const result = await exercise(t, { change: state => {
      positiveIndia(state)
      state.corporate.get(corporate).body += markup
    } })
    assertPartial(result)
    assert.equal(result.jobs.length, 1)
    assertIndiaContent(result)
    assert.equal(result.jobs[proofSymbol].guardian.cleanupAllowed, false)
    assert.deepEqual(result.jobs[0].sourceRawDates, { startDate: '2026-10-28', endDate: '2026-12-20' })
  })
})

test('Guardian inactive markup and raw iframe fallback do not create current recruiting channels', async t => {
  for (const markup of [
    '<template><a href="https://careers.guardianlife.com/roles">Open positions</a><iframe srcdoc="More jobs"></iframe></template>',
    '<div hidden><form action="https://careers.guardianlife.com/roles"><button>Open positions</button></form><iframe srcdoc="More jobs"></iframe></div>',
    '<iframe style="display:none" srcdoc="More jobs"></iframe>',
    '<iframe src="https://guardianlife.wd5.myworkdayjobs.com/Guardian-Life-Careers"><a href="https://careers.guardianlife.com/roles">Open positions</a></iframe>',
    '<object hidden data="https://careers.guardianlife.com/roles"></object>',
    '<script>const markup = \'<form action="https://careers.guardianlife.com/roles"><button>Open positions</button></form>\';</script>',
    '<span id="unreferenced-hidden-name" hidden>Open positions</span>',
    '<div hidden><span id="hidden-control-name">Open positions</span><a href="https://external.example/search" aria-labelledby="hidden-control-name">Learn more</a></div>',
    '<input hidden type="image" alt="Open positions" formaction="https://external.example/search">',
  ]) {
    const result = await exercise(t, { change: state => { state.corporate.get(corporate).body += markup } })
    assert.ifError(result.error)
    assert.equal(result.evidence.status, 'complete-inventory', JSON.stringify(result.jobs[proofSymbol]?.guardian?.failures))
    assert.equal(result.jobs[proofSymbol].guardian.cleanupAllowed, true)
  }
})

test('Guardian hidden referenced accessible link names disable completion while retaining the proven India role', async t => {
  const result = await exercise(t, { change: state => {
    positiveIndia(state)
    state.corporate.get(corporate).body += '<span id="external-positions-name" hidden>Open positions</span><a href="https://external.example/search" aria-labelledby="external-positions-name">Learn more</a>'
  } })
  assertPartial(result)
  assert.equal(result.jobs.length, 1)
  assertIndiaContent(result)
  assert.equal(result.jobs[proofSymbol].guardian.cleanupAllowed, false)
  assert.deepEqual(result.jobs[0].sourceRawDates, { startDate: '2026-10-28', endDate: '2026-12-20' })
})

test('Guardian image-submit alt names disable completion while retaining the proven India role', async t => {
  const result = await exercise(t, { change: state => {
    positiveIndia(state)
    state.corporate.get(corporate).body += '<input type="image" alt="Open positions" formaction="https://external.example/search">'
  } })
  assertPartial(result)
  assert.equal(result.jobs.length, 1)
  assertIndiaContent(result)
  assert.equal(result.jobs[proofSymbol].guardian.cleanupAllowed, false)
  assert.deepEqual(result.jobs[0].sourceRawDates, { startDate: '2026-10-28', endDate: '2026-12-20' })
})

test('Guardian unknown or ambiguous accessible references and image-submit form names stay partial', async t => {
  for (const [name, markup] of [
    ['duplicate ID with hidden first match', '<span id="duplicate-name" hidden>Open positions</span><span id="duplicate-name">Details</span><a href="https://external.example/search" aria-labelledby="duplicate-name">Learn more</a>'],
    ['missing referenced name', '<a href="https://external.example/search" aria-labelledby="missing-name">Learn more</a>'],
    ['non-ASCII whitespace remains an unknown reference', '<span id="\u00a0" hidden>Open positions</span><a href="https://external.example/search" aria-labelledby="\u00a0">Learn more</a>'],
    ['visible referenced name', '<span id="visible-name">Open positions</span><a href="https://external.example/search" aria-labelledby="visible-name">Learn more</a>'],
    ['hidden referenced button name', '<span id="button-name" hidden>Open positions</span><button aria-labelledby="button-name" data-url="https://external.example/search">Details</button>'],
    ['image submit named through its form', '<form action="https://external.example/search"><input type="image" alt="Open positions"></form>'],
  ]) await t.test(name, async () => {
    const result = await exercise(t, { change: state => {
      positiveIndia(state)
      state.corporate.get(corporate).body += markup
    } })
    assertPartial(result)
    assert.equal(result.jobs.length, 1)
    assertIndiaContent(result)
    assert.equal(result.jobs[proofSymbol].guardian.cleanupAllowed, false)
    assert.deepEqual(result.jobs[0].sourceRawDates, { startDate: '2026-10-28', endDate: '2026-12-20' })
  })
})

test('Guardian referenced-name attribute spellings cannot bypass the finite corporate scope grammar', async t => {
  for (const [name, value] of [
    ['named NBSP', '&nbsp;'],
    ['numeric NBSP', '&#160;'],
    ['literal NBSP', '\u00a0'],
    ['empty attribute', ''],
    ['ASCII spaces', '   '],
  ]) await t.test(name, async () => {
    const result = await exercise(t, { change: state => {
      positiveIndia(state)
      state.corporate.get(corporate).body += `<span id="${value}" hidden>Open positions</span><a href="https://external.example/search" aria-labelledby="${value}">Learn more</a>`
    } })
    assertPartial(result)
    assert.equal(result.jobs.length, 1)
    assertIndiaContent(result)
    assert.equal(result.jobs[proofSymbol].guardian.cleanupAllowed, false)
    assert.deepEqual(result.jobs[0].sourceRawDates, { startDate: '2026-10-28', endDate: '2026-12-20' })
  })
})
