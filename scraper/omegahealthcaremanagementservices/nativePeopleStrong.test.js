import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { buildScrapers } from '../../scraper-support/providers/index.js'
import * as omega from './script.js'
const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/peoplestrong-current-derived-20261107.json.gz', import.meta.url))))
const packets = Object.fromEntries(fixture.capturedInputs.map(value => [value.name, value]))
const bytes = name => Buffer.from(packets[name].bodyBase64, 'base64')
const value = name => JSON.parse(bytes(name))
const response = (url, body, status = 200, mime = 'application/json') => {
  const result = new Response(body, { status, headers: { 'content-type': mime } })
  Object.defineProperty(result, 'url', { value: url })
  return result
}
let native
try { native = await import('./nativePeopleStrong.js') } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error }
const firstListing = () => value('native-listing').response[0]
const projectFirst = () => native?.projectPeopleStrongRole({ listing: firstListing(), detail: value('role1-detail'), organization: value('role1-organization'), now: '2026-11-07T14:31:36.709Z' })

test('derived genuine samples preserve independent body digests and remove only declared personal role fields', () => {
  assert.equal(fixture.capturedInputs.length, 5)
  for (const packet of fixture.capturedInputs) {
    const body = bytes(packet.name)
    assert.equal(body.length, packet.fixtureBodyBytes)
    assert.equal(createHash('sha256').update(body).digest('hex'), packet.fixtureBodySHA256)
    if (packet.derivedRedactedBody) {
      assert.notEqual(packet.fixtureBodySHA256, packet.originalBodySHA256)
      assert.deepEqual(packet.redactions.map(item => item.path), ['$.response.FirstName', '$.response.LastName', '$.response.Username', '$.response.hiringManagerName'])
      for (const key of ['FirstName', 'LastName', 'Username', 'hiringManagerName']) assert.equal(Object.hasOwn(JSON.parse(body).response, key), false)
    } else assert.equal(packet.fixtureBodySHA256, packet.originalBodySHA256)
  }
  assert.equal(value('native-listing').totalRecords, 32)
  assert.equal(value('native-listing').response.length, 32)
})

test('registered current India CTA reaches the declared native POST boundary without foreign Oracle fallback (controlled global denial, genuine India HTML)', async () => {
  const calls = [], boundary = Object.freeze({ kind: 'UNOBSERVED_NEXT_NATIVE_LISTING_BOUNDARY' })
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    if (url === omega.GLOBAL_CAREERS_URL) return response(url, 'Controlled unrelated global unavailability; not an original body.', 503, 'text/html')
    if (url === omega.INDIA_CAREERS_URL) return response(url, bytes('corporate-india'), 200, 'text/html')
    throw boundary
  }
  const registered = buildScrapers().find(item => item.name === 'omegahealthcaremanagementservices')
  await assert.rejects(registered.run({ fetchImpl }), error => error === boundary)
  const attempted = calls.find(item => item.url === 'https://omegacareers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=45')
  assert.ok(attempted, 'current genuine India CTA must route to its declared PeopleStrong listing, not fixed foreign Oracle')
  assert.equal(attempted.init.method, 'POST')
  assert.equal(attempted.init.body, '{}')
  assert.deepEqual(attempted.init.headers, { 'Content-Type': 'application/json' })
  assert.equal(attempted.init.credentials, 'omit')
  assert.equal(attempted.init.redirect, 'manual')
  assert.equal(calls.some(item => String(item.url).includes('oraclecloud.com')), false)
})

test('genuine own-role Country and Legal Entity survive unsupported location/experience projection without relabeling workCenter', () => {
  const result = projectFirst()
  assert.equal(result?.country, 'India')
  assert.equal(result.title, 'Coder')
  assert.equal(result.company, 'Omega Healthcare Management Services')
  assert.equal(result.sourceNativeEmployerEvidence.legalEntityName, 'Omega Healthcare Management Services Private Limited')
  assert.equal(result.city, null)
  assert.equal(result.location, null)
  assert.equal(result.experienceRequired, null)
  assert.deepEqual(result.requiredSkills, [])
  assert.equal(result.sourceNativeCriteria.jobDescription, value('role1-detail').response.jobDescription)
  assert.deepEqual(result.sourceNativeCriteria.skills, value('role1-detail').response.skills)
  assert.deepEqual(result.sourceNativeOrganizationRecord, value('role1-organization').response)
  assert.equal(result.sourceNativeLocations.listingHierarchy, 'IN>TAMIL NADU>CHENNAI>Chennai-I')
  assert.equal(result.sourceNativeLocations.detailHierarchy, 'IN>TAMIL NADU>CHENNAI>Chennai-I_C1')
  assert.equal(result.sourceDetailComplete, false)
  assert.equal(result.sourceScopeComplete, false)
  assert.equal(result.lifecycleCleanupAllowed, false)
  assert.equal(result.inventoryCleanupAllowed, false)
})

const clone = value => structuredClone(value)
const firstInput = () => ({ listing: firstListing(), detail: value('role1-detail'), organization: value('role1-organization'), now: '2026-11-07T14:31:36.709Z' })
const requireNative = () => { assert.ok(native, 'source-local native reader must exist'); return native }
const LIST_URL = 'https://omegacareers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=45'
const DETAIL_URL = 'https://omegacareers.peoplestrong.com/api/cp/rest/altone/cp/job/OMH_C_1870684/v2?part=basic,organisational,descriprion,workflow,skill,qualification,certification,language,applied&isReqId=false'
const ORG_URL = 'https://omegacareers.peoplestrong.com/api/cp/rest/altone/cp/job/organizationDetails?jobCode=OMH/C/1870684'

// Explicit controlled protocol: one real record, a SYNTHETIC total/page and
// reused opening models as controlled closing. This is not a current capture.
const controlledWorkflow = ({ listChange, detailChange, organizationChange, transport, options = {} } = {}) => {
  const calls = [], counts = { list: 0, detail: 0, organization: 0 }
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    if (transport) { const override = await transport(url, init, counts); if (override) return override }
    if (url === omega.GLOBAL_CAREERS_URL) return response(url, 'Synthetic unrelated global denial for protocol isolation.', 503, 'text/html')
    if (url === omega.INDIA_CAREERS_URL) return response(url, bytes('corporate-india'), 200, 'text/html')
    assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit')
    if (url === LIST_URL) {
      assert.equal(init.method, 'POST'); assert.equal(init.body, '{}'); assert.deepEqual(init.headers, { 'Content-Type': 'application/json' })
      const payload = value('native-listing'); payload.response = [payload.response[0]]; payload.totalRecords = 1
      counts.list++; listChange?.(payload, counts.list)
      return response(url, JSON.stringify(payload))
    }
    if (url === DETAIL_URL) {
      assert.equal(init.method, 'GET'); assert.deepEqual(init.headers, {})
      const payload = value('role1-detail'); counts.detail++; detailChange?.(payload, counts.detail)
      return response(url, JSON.stringify(payload))
    }
    if (url === ORG_URL) {
      assert.equal(init.method, 'GET'); assert.deepEqual(init.headers, {})
      const payload = value('role1-organization'); counts.organization++; organizationChange?.(payload, counts.organization)
      return response(url, JSON.stringify(payload))
    }
    throw new Error('Unobserved or unsupported controlled route: ' + url)
  }
  return { calls, counts, run: () => omega.run({ fetchImpl, now: () => '2026-11-07T14:31:36.709Z', ...options }) }
}

test('controlled closing protocol returns supported India facts with full business models and no completeness authority', async () => {
  const workflow = controlledWorkflow()
  const jobs = await workflow.run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India'); assert.equal(jobs[0].city, null); assert.equal(jobs[0].location, null); assert.equal(jobs[0].experienceRequired, null)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.deepEqual(workflow.counts, { list: 2, detail: 2, organization: 2 })
  assert.equal(workflow.calls.length, 9)
  assert.equal(workflow.calls.some(call => call.url.includes('oraclecloud.com')), false)
  const audit = jobs[omega.OMEGA_INVENTORY_EVIDENCE]
  assert.equal(audit.configuredBoardObservationCount, 1)
  assert.equal(audit.companyGlobalTotal, null); assert.equal(audit.companyIndiaTotal, null)
  assert.equal(audit.sourceScopeComplete, false); assert.equal(audit.inventoryCleanupAllowed, false)
  assert.equal(audit.native.configuredInventoryReconciled, true)
  assert.deepEqual(audit.native.opening.listing.records, [firstListing()])
  assert.deepEqual(audit.native.opening.roles[0].detail, value('role1-detail').response)
  assert.deepEqual(audit.native.opening.roles[0].organization, value('role1-organization').response)
  assert.deepEqual(audit.native.closing.roles, audit.native.opening.roles)
})

test('runtime never retains four named personal values even while native identity and all business criteria remain intact', async () => {
  const workflow = controlledWorkflow({ detailChange: payload => { for (const key of ['FirstName', 'LastName', 'Username', 'hiringManagerName']) payload.response[key] = 'SYNTHETIC-PRIVATE-' + key } })
  const jobs = await workflow.run(); const serialized = JSON.stringify({ jobs, audit: jobs[omega.OMEGA_INVENTORY_EVIDENCE] })
  assert.equal(serialized.includes('SYNTHETIC-PRIVATE-'), false)
  assert.equal(jobs[0].sourceNativeCriteria.jobDescription, value('role1-detail').response.jobDescription)
  assert.deepEqual(jobs[0].sourceNativeOrganizationRecord, value('role1-organization').response)
})

test('second genuine role never borrows first-role Country or Legal Entity when own hierarchy is unobserved', () => {
  const list = value('native-listing').response.find(item => item.jobCode === 'OMH/QCA-A/1917245')
  const result = requireNative().projectPeopleStrongRole({ listing: list, detail: value('role2-detail'), organization: null, now: '2026-11-07T14:31:36.709Z' })
  assert.equal(result.country, null); assert.equal(result.sourceCountryScopeUnresolved, true)
  assert.equal(result.sourceNativeEmployerEvidence, null)
  assert.equal(result.sourceNativeCriteria.jobDescription.length, 1960)
  assert.equal(result.sourceNativeCriteria.skills.length, 11)
  assert.equal(result.sourceDetailComplete, false)
})

for (const [name, change] of [
  ['wrong native title', x => { x.detail.response.jobTitle = 'Wrong role' }],
  ['wrong native code', x => { x.detail.response.requisitionCode = 'OMH/C/9999999' }],
  ['wrong native numeric identity', x => { x.detail.response.requisitionId = '9999999' }],
  ['cross-tenant detail URL', x => { x.listing.jobDetailUrl = x.listing.jobDetailUrl.replace('omegacareers', 'foreigncareers') }],
  ['nondefault native port', x => { x.listing.jobDetailUrl = x.listing.jobDetailUrl.replace('.com/', '.com:444/') }],
  ['credential-bearing native URL', x => { x.listing.jobDetailUrl = x.listing.jobDetailUrl.replace('https://', 'https://user:pass@') }],
  ['query-bearing native URL', x => { x.listing.jobDetailUrl += '?mode=social' }],
  ['foreign typed Country conflict', x => { x.organization.response.workSiteHierarchy[3].orgUnitName = 'US' }],
  ['unknown typed Country', x => { x.organization.response.workSiteHierarchy[3].orgUnitName = 'ZZ' }],
  ['duplicated typed Country', x => { x.organization.response.workSiteHierarchy.push({ orgUnitType: 'Country', orgUnitName: 'US' }) }],
  ['country alias on nested Country', x => { x.organization.response.workSiteHierarchy[3].addressCountry = 'US' }],
  ['country alias on detail', x => { x.detail.response.countryCode = 'US' }],
  ['nested foreign address', x => { x.organization.response.secondaryLocation = { address: { addressCountry: 'US' } } }],
  ['wrong typed Legal Entity', x => { x.organization.response.orgUnitHierarchy[1].orgUnitName = 'Unrelated Foreign Employer' }],
  ['duplicate typed Legal Entity', x => { x.organization.response.orgUnitHierarchy.push({ orgUnitType: 'Legal Entity', orgUnitName: 'Unrelated Foreign Employer' }) }],
  ['nonstring workCenter with new country', x => { x.organization.response.workCenter = { name: 'Other', country: 'US' } }],
  ['unknown full criteria section', x => { x.detail.response.extraMandatoryRequirements = { degree: 'Required' } }],
  ['invalid posting calendar', x => { x.detail.response.CandidatePortalStartDate = '2026-02-30 00:00:00.0' }],
  ['posting calendar mismatch', x => { x.detail.response.CandidatePortalStartDate = '2026-11-05 00:00:00.0' }],
  ['invalid expiry calendar', x => { x.detail.response.CandidatePortalEndDate = '2026-13-20 00:00:00.0' }],
  ['unknown public status', x => { x.detail.response.requisitionStatus = 'SOMETHING_NEW' }],
  ['private role marker', x => { x.detail.response.confidential = true }],
]) test('native own-role model rejects ' + name, () => {
  const input = firstInput(); change(input)
  assert.throws(() => requireNative().projectPeopleStrongRole(input), /identity|country|Country|authority|organization|Legal|criteria|calendar|date|status|private|contract|carrier|URL|url|workCenter/i)
})

test('empty optional country metadata is retained as uncertainty and does not invent a second country', () => {
  const input = firstInput(); input.organization.response.workSiteHierarchy[3].addressCountry = ''
  const result = requireNative().projectPeopleStrongRole(input)
  assert.equal(result.country, 'India')
  assert.equal(result.sourceNativeOrganizationRecord.workSiteHierarchy[3].addressCountry, '')
})

test('authored hidden ordinary criteria and all nonempty native qualification data are retained without required-skill fabrication', () => {
  const input = firstInput(); input.detail.response.jobDescription += '<div hidden>Additional mandatory coding qualification.</div>'
  input.detail.response.qualifications = [{ qualificationName: 'Native specialty qualification', mandatory: true }]
  const result = requireNative().projectPeopleStrongRole(input)
  assert.match(result.jobDescription, /Additional mandatory coding qualification/)
  assert.equal(result.sourceNativeCriteria.jobDescription, input.detail.response.jobDescription)
  assert.deepEqual(result.sourceNativeCriteria.qualifications, input.detail.response.qualifications)
  assert.deepEqual(result.requiredSkills, [])
})

for (const html of ['<meta name="country" content="US">', '<div hidden itemprop="addressCountry">US</div>', '<script>changeAuthority()</script>']) test('unreviewed native criterion authority/program carrier is refused: ' + html.slice(0, 35), () => {
  const input = firstInput(); input.detail.response.jobDescription += html
  assert.throws(() => requireNative().projectPeopleStrongRole(input), /criteria|authority|country|program|contract/i)
})

for (const [name, change] of [
  ['wrong tenant', s => s.replaceAll('omegacareers.peoplestrong.com', 'foreign.peoplestrong.com')],
  ['unreviewed query', s => s.replaceAll('omegacareers.peoplestrong.com/job/joblist', 'omegacareers.peoplestrong.com/job/joblist?mode=social')],
  ['hidden sole CTA', s => s.replace(/(<a\b[^>]*href=["']https:\/\/omegacareers\.peoplestrong\.com\/job\/joblist["'][^>]*>)/i, '<div hidden>$1').replace(/(Search Open Positions[\s\S]{0,100}<\/a>)/i, '$1</div>')],
  ['extra hidden canonical', s => s + '<div hidden><link rel="canonical" href="https://foreign.example/careers"></div>'],
  ['hidden base', s => s + '<div hidden><base href="https://foreign.example/"></div>'],
]) test('genuine corporate CTA rejects ' + name, () => {
  assert.throws(() => requireNative().discoverPeopleStrongIndiaChannel(change(bytes('corporate-india').toString())), /handoff|authority|canonical|CTA|channel|contract|base/i)
})

for (const [name, raw] of [
  ['duplicate root key', '{"country":"US","country":"IN"}'],
  ['escaped duplicate key', '{"country":"US","coun\\u0074ry":"IN"}'],
  ['nested duplicate', '{"a":{"x":1,"x":2}}'],
  ['trailing content', '{} false'],
  ['trailing comma', '{"x":1,}'],
  ['invalid number', '{"n":01}'],
  ['invalid escape', '{"x":"\\q"}'],
]) test('strict native JSON rejects ' + name, () => assert.throws(() => requireNative().parsePeopleStrongJson(raw), /JSON|duplicate|grammar|contract/i))

test('strict native JSON preserves valid Unicode, sibling keys and JSON-looking strings as data', () => {
  const raw = '{"a":{"x":1},"b":{"x":2},"text":"{\\"x\\":1,\\"x\\":2}","unicode":"\\uD83D\\uDE00","n":-1.5e+2}'
  assert.deepEqual(requireNative().parsePeopleStrongJson(raw), JSON.parse(raw))
})

for (const [name, kind] of [['changed closing criteria','detail'],['changed closing Country','organization'],['changed closing workCenter','workCenter'],['changed closing listing','list']]) test('controlled protocol refuses ' + name, async () => {
  const workflow = controlledWorkflow({ detailChange: (p,pass) => { if (kind === 'detail' && pass === 2) p.response.jobDescription += '<p>New mandatory criterion.</p>' }, organizationChange: (p,pass) => { if (pass === 2 && kind === 'organization') p.response.workSiteHierarchy[3].orgUnitName = 'US'; if (pass === 2 && kind === 'workCenter') p.response.workCenter = 'Changed opaque business carrier' }, listChange: (p,pass) => { if (kind === 'list' && pass === 2) p.response[0].jobTitle = 'Changed title' } })
  await assert.rejects(workflow.run(), /closing|changed|country|inventory|contract/i)
})

test('native HTTP denial remains a source failure and never falls back to Oracle or empty inventory', async () => {
  const workflow = controlledWorkflow({ transport: (url) => url === LIST_URL ? response(url, 'Controlled HTTP denial', 403, 'text/html') : null })
  await assert.rejects(workflow.run(), error => error.status === 403 && error.upstreamOutage === true)
  assert.equal(workflow.calls.filter(c => c.url === LIST_URL).length, 1)
  assert.equal(workflow.calls.some(c => c.url.includes('oraclecloud.com')), false)
})

const reader = options => requireNative().createPeopleStrongReader({ fetchImpl: async () => { throw Error('No controlled fetch') }, signal: new AbortController().signal, check: () => {}, consume: () => {}, receipts: [], maxRequests: 2000, maxResponseBytes: 3 * 1024 * 1024, requestTimeoutMs: 1000, now: () => '2026-11-07T14:31:36.709Z', ...options })

test('known native 403 survives a body failure with exact original cause and no invented full-body hash', async () => {
  const failure = new Error('Controlled body stream failure'), receipts = []
  const request = reader({ receipts, fetchImpl: async url => ({ status: 403, url, headers: new Headers({ 'content-type': 'text/html' }), body: { getReader: () => ({ read: async () => { throw failure }, cancel: () => { throw Error('cleanup failure') }, releaseLock: () => {} }) } }) })
  await assert.rejects(request(LIST_URL, { method: 'POST', body: '{}' }), error => error.status === 403 && error.cause === failure)
  assert.equal(receipts[0].status, 403); assert.equal(receipts[0].bodyComplete, false); assert.equal(receipts[0].bodySHA256, undefined)
})

test('known native 406 survives body deadline and nonblocking cancellation', async () => {
  const request = reader({ requestTimeoutMs: 5, fetchImpl: async url => ({ status: 406, url, headers: new Headers({ 'content-type': 'text/html' }), body: { getReader: () => ({ read: () => new Promise(() => {}), cancel: () => new Promise(() => {}), releaseLock: () => {} }) } }) })
  await assert.rejects(request(LIST_URL, { method: 'POST', body: '{}' }), error => error.status === 406 && /timed out/i.test(error.cause.message))
})

for (const reason of [Symbol('opaque-caller'), Object.freeze({ aborted: 'caller' }), null]) test('exact opaque caller abort wins before launch and during pending headers: ' + typeof reason, async () => {
  const pre = new AbortController(); pre.abort(reason); let calls = 0
  await assert.rejects(reader({ callerSignal: pre.signal, signal: pre.signal, fetchImpl: async () => { calls++ } })(LIST_URL, { method: 'POST', body: '{}' }), value => value === reason)
  assert.equal(calls, 0)
  const during = new AbortController(); let resolve, cancelled = 0
  const request = reader({ callerSignal: during.signal, signal: during.signal, fetchImpl: async () => { calls++; return new Promise(r => { resolve = r }) } })
  const operation = request(LIST_URL, { method: 'POST', body: '{}' }); await new Promise(r => setImmediate(r)); during.abort(reason)
  await assert.rejects(operation, value => value === reason)
  resolve({ body: { cancel: () => { cancelled++ } } }); await new Promise(r => setImmediate(r))
  assert.equal(cancelled, 1)
})

test('immediate caller abort before microtask admission makes zero native fetch calls', async () => {
  const controller = new AbortController(), reason = Object.freeze({ immediate: true }); let calls = 0
  const operation = reader({ callerSignal: controller.signal, signal: controller.signal, fetchImpl: async () => { calls++ } })(LIST_URL, { method: 'POST', body: '{}' })
  controller.abort(reason); await assert.rejects(operation, value => value === reason); assert.equal(calls, 0)
})

test('native response byte cap stops before full allocation and cancels the body', async () => {
  let cancelled = 0, pulls = 0
  const request = reader({ maxResponseBytes: 8, fetchImpl: async url => ({ status: 200, url, headers: new Headers({ 'content-type': 'application/json' }), body: { getReader: () => ({ read: async () => { pulls++; return { done: false, value: new Uint8Array(9) } }, cancel: () => { cancelled++ }, releaseLock: () => {} }) } }) })
  await assert.rejects(request(LIST_URL, { method: 'POST', body: '{}' }), /byte|budget/i)
  assert.equal(pulls, 1); assert.equal(cancelled, 1)
})

test('native public request grants reject foreign URLs, mutated query flags and auth-bearing paths before fetch', async () => {
  let calls = 0; const request = reader({ fetchImpl: async () => { calls++ } })
  for (const url of [LIST_URL.replace('omegacareers', 'foreign'), DETAIL_URL.replace('isReqId=false', 'isReqId=true'), DETAIL_URL + '&mode=social', 'https://omegacareers.peoplestrong.com/api/cp/rest/altone/cp/apply/123']) await assert.rejects(request(url), /request|grant|authority|contract/i)
  assert.equal(calls, 0)
})

// Additional bounded carrier/transport controls discovered during local review.
for (const [name, change] of [
  ['object inside scalar experience', x => { x.detail.response.minimumExp = { country: 'US' } }],
  ['object inside scalar cost center', x => { x.organization.response.costCenter = { addressCountry: 'US' } }],
  ['unreviewed department hierarchy object', x => { x.organization.response.departmentHierarchy = [{ country: 'US' }] }],
  ['foreign country in qualification', x => { x.detail.response.qualifications = [{ qualificationName: 'Specialty', addressCountry: 'US' }] }],
  ['foreign country in optional listing skill', x => { x.listing.skills.goodtohave.push({ country: 'US' }) }],
  ['authority added to status envelope', x => { x.detail.messageCode.country = 'US' }],
]) test('unreviewed nested business authority is refused: ' + name, () => {
  const input = firstInput(); change(input)
  assert.throws(() => requireNative().projectPeopleStrongRole(input), /contract|carrier|criteria|authority|hierarchy/)
})

test('known 403 cannot inspect a foreign body error property while preserving its exact cause', async () => {
  const failure = new Error('Synthetic foreign body failure')
  Object.defineProperty(failure, 'nativeHttpReceipt', { get() { throw Error('Must not inspect foreign error') } })
  const request = reader({ fetchImpl: async url => ({ status: 403, url, headers: new Headers({'content-type':'text/html'}), body: { getReader: () => ({ read: async () => { throw failure }, cancel: () => {}, releaseLock: () => {} }) } }) })
  await assert.rejects(request(LIST_URL, { method:'POST', body:'{}' }), error => error.status === 403 && error.cause === failure)
})

test('foreign final response authority cannot be promoted to an own-native denied HTTP receipt', async () => {
  const request = reader({ fetchImpl: async () => response('https://foreign.example/unreviewed', 'Denied elsewhere', 403, 'text/html') })
  await assert.rejects(request(LIST_URL, { method:'POST', body:'{}' }), error => error.failureKind === 'upstream_contract_changed' && error.status === undefined)
})


for (const [name, mutate] of [
  ['direct inline event override', s => s.replace(/(<a\b[^>]*href=["']https:\/\/omegacareers\.peoplestrong\.com\/job\/joblist["'][^>]*>)/i, tag => tag.replace('<a', '<a onclick="event.preventDefault();location.href=\'https://unrelated.invalid/\'"'))],
  ['ancestor inline event override', s => s.replace(/(<a\b[^>]*href=["']https:\/\/omegacareers\.peoplestrong\.com\/job\/joblist["'][^>]*>)/i, '<div onclick="event.preventDefault()">$1').replace(/(Search Open Positions[\s\S]{0,100}<\/a>)/i, '$1</div>')],
]) test('native CTA refuses effectful navigation carrier: ' + name, () => {
  const original = bytes('corporate-india').toString(), changed = mutate(original); assert.notEqual(changed, original)
  assert.throws(() => requireNative().discoverPeopleStrongIndiaChannel(changed), /CTA|authority|event|handoff|contract/)
})

for (const section of ['qualifications','certifications','languages']) test('unreviewed nested applicant structure is refused rather than retained as ' + section, () => {
  const input = firstInput(); input.detail.response[section] = [{ applicant: { email: 'CONTROLLED_PRIVATE_VALUE' } }]
  assert.throws(() => requireNative().projectPeopleStrongRole(input), /criteria|carrier|contract/)
})

test('known own403 headers retain numeric HTTP authority when inherited aggregate stops a stalled body', async () => {
  const aggregate = new AbortController(), reason = Object.assign(new Error('Controlled inherited aggregate deadline'), { failureKind: 'coverage_gap', upstreamOutage: false })
  let observed = false, cancelled = 0
  const request = reader({ signal: aggregate.signal, check: () => aggregate.signal.throwIfAborted(), fetchImpl: async url => {
    observed = true
    return { status:403, url, headers:new Headers({'content-type':'text/html'}), body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:()=>{cancelled++},releaseLock:()=>{}})} }
  } })
  const op = request(LIST_URL,{method:'POST',body:'{}'}); await new Promise(r=>setImmediate(r)); assert.equal(observed,true); aggregate.abort(reason)
  await assert.rejects(op, error => error.status===403 && error.upstreamOutage===true && error.cause===reason)
  assert.equal(cancelled,1)
})


for (const status of [403,406]) test('registered final failure preserves known ownHTTP' + status + ' through inherited aggregate without Oracle fallback', async () => {
  const workflow = controlledWorkflow({ options: { collectionBudgetMs:500, requestTimeoutMs:2000 }, transport: url => {
    if(url!==LIST_URL)return null
    return {status,url,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:()=>{},releaseLock:()=>{}})}}
  } })
  await assert.rejects(workflow.run(),error=>error.status===status && error.upstreamOutage===true && error.cause.failureKind==='coverage_gap')
  assert.equal(workflow.calls.filter(x=>x.url===LIST_URL).length,1)
  assert.equal(workflow.calls.some(x=>x.url.includes('oraclecloud.com')),false)
})

test('native-first duplicate CTA href cannot hide an unreviewed second navigation attribute',()=>{
 const original=bytes('corporate-india').toString()
 const changed=original.replace(/(<a\b[^>]*href=["']https:\/\/omegacareers\.peoplestrong\.com\/job\/joblist["'])/i,'$1 href="https://unrelated.invalid/"')
 assert.notEqual(original,changed)
 assert.throws(()=>requireNative().discoverPeopleStrongIndiaChannel(changed),/authority|duplicate|contract|CTA/)
})


// Successor samples are additional original opening-prefix responses; the
// original5packet fixture entries and preceding76tests remain byte-exact.
const successorPackets=Object.fromEntries(fixture.successorCapturedInputs.map(p=>[p.name,p]))
const successorBytes=name=>Buffer.from(successorPackets[name].bodyBase64,'base64')
const successorValue=name=>JSON.parse(successorBytes(name))
const thirdInput=()=>({listing:value('native-listing').response[2],detail:successorValue('role3-null-description-detail-current'),organization:successorValue('role3-organization-current'),now:'2026-11-07T15:46:37.794Z'})
const inspectRole=input=>{assert.equal(typeof requireNative().inspectPeopleStrongRole,'function','finite whole-role inspector must expose an ineligible observation separately from a job');return native.inspectPeopleStrongRole(input)}

test('genuine third null-description role is retained as a fully validated observation, never a brief-only returned job',()=>{
 const input=thirdInput(),observed=inspectRole(input)
 assert.equal(observed.job,null);assert.equal(observed.hold.country,'India')
 assert.equal(observed.hold.reason,'native-public-description-null;optional-skills-not-full-role-criteria')
 assert.equal(observed.hold.sourceNativeEmployerEvidence.legalEntityName,'Omega Healthcare Management Services Private Limited')
 assert.deepEqual(observed.model.detail,input.detail.response);assert.deepEqual(observed.model.organization,input.organization.response)
 assert.equal(observed.model.detail.jobDescription,null);assert.equal(observed.model.detail.internalJobDescription,null)
 assert.equal(observed.model.detail.skills.length,17);assert.equal(observed.model.detail.skills.every(x=>x.mandatory===false),true)
 assert.equal(observed.hold.sourceScopeComplete,false);assert.equal(observed.hold.inventoryCleanupAllowed,false)
 assert.throws(()=>native.projectPeopleStrongRole(input),/native criteria missing/,'legacy pure job projector still refuses missing criteria')
})

test('new inspector preserves complete existing healthy role projection without hold metadata additions',()=>{
 const input=firstInput(),observed=inspectRole(input)
 assert.equal(observed.hold,null);assert.deepEqual(observed.job,native.projectPeopleStrongRole(input))
 const secondListing=value('native-listing').response.find(x=>x.jobCode==='OMH/QCA-A/1917245')
 const second={listing:secondListing,detail:value('role2-detail'),organization:successorValue('role2-organization-current'),now:input.now}
 const role=inspectRole(second);assert.equal(role.job.country,'India');assert.equal(role.hold,null)
 assert.deepEqual(role.job,native.projectPeopleStrongRole(second))
})

for(const [name,change,pattern]of[
 ['wrong code',x=>{x.detail.response.requisitionCode='OMH/QCA-C/9999999'},/identity/],
 ['wrong numeric ID',x=>{x.detail.response.requisitionId='9999999'},/identity/],
 ['wrong title',x=>{x.detail.response.jobTitle='Wrong title'},/identity/],
 ['wrong URL',x=>{x.listing.jobDetailUrl+='?apply=true'},/URL/],
 ['wrong Legal Entity',x=>{x.organization.response.orgUnitHierarchy[1].orgUnitName='Unreviewed employer'},/Legal|organization/],
 ['wrong own Country',x=>{x.organization.response.workSiteHierarchy[3].orgUnitName='US'},/Country|country/],
 ['duplicate own Country',x=>{x.organization.response.workSiteHierarchy.push({orgUnitType:'Country',orgUnitName:'US'})},/country|hierarchy/],
 ['foreign nested address',x=>{x.organization.response.workSiteHierarchy[3].addressCountry='US'},/carrier/],
 ['private flag',x=>{x.detail.response.confidential=true},/private|status/],
 ['unknown status',x=>{x.detail.response.requisitionStatus='CHANGED'},/status/],
 ['invalid local calendar',x=>{x.detail.response.CandidatePortalStartDate='2026-02-30 00:00:00.0'},/calendar|date/],
 ['unknown private criteria',x=>{x.detail.response.qualifications=[{applicant:{email:'CONTROLLED_PRIVATE'}}]},/criteria|carrier/],
 ['unreviewed mandatory criteria carrier',x=>{x.detail.response.additionalMandatoryCriteria={degree:'Required'}},/criteria|carrier/],
 ['nonstring workCenter',x=>{x.organization.response.workCenter={country:'US'}},/workCenter|carrier/],
 ['missing own organization',x=>{x.organization=null},/organization|authority/],
])test('null-description hold does not swallow '+name,()=>{
 const input=thirdInput();change(input);assert.throws(()=>inspectRole(input),pattern)
})

for(const invalid of [' ',false,0,{},'<script>newProgram()</script>','Null'])test('only witnessed null or exact empty description can hold; unsupported '+JSON.stringify(invalid)+' still refuses',()=>{
 const input=thirdInput();input.detail.response.jobDescription=invalid
 assert.throws(()=>inspectRole(input),/criteria|carrier|program|contract/)
})
for(const [name,change]of[
 ['new internal description',x=>{x.detail.response.internalJobDescription='<p>Controlled nonempty internal-only criteria must not become a public job.</p>'}],
 ['new required skill',x=>{x.detail.response.skills[0].mandatory=true}],
 ['new qualification',x=>{x.detail.response.qualifications=[{qualificationName:'Controlled new criterion',mandatory:true}]}],
])test('null-description profile refuses unreviewed additional '+name,()=>{
 const input=thirdInput();change(input);assert.throws(()=>inspectRole(input),/criteria|carrier|contract/)
})

// Synthetic two-row total/page + opening bytes REUSED as controlled closing;
// this is never the actual failed9 or a fresh complete32-role live workflow.
const controlledHeldWorkflow=({detailChange,organizationChange}={})=>{
 const calls=[],count=new Map(),listing=value('native-listing');listing.response=[listing.response[0],listing.response[2]];listing.totalRecords=2
 const fetchImpl=async(url,init)=>{
  calls.push({url,init});const pass=(count.get(url)??0)+1;count.set(url,pass)
  if(url===omega.GLOBAL_CAREERS_URL)return response(url,'SYNTHETIC global503, not actual opening.',503,'text/html')
  if(url===omega.INDIA_CAREERS_URL)return response(url,bytes('corporate-india'),200,'text/html')
  if(url===LIST_URL)return response(url,JSON.stringify(listing))
  if(url===DETAIL_URL)return response(url,bytes('role1-detail'))
  if(url===ORG_URL)return response(url,bytes('role1-organization'))
  if(url==='https://omegacareers.peoplestrong.com/api/cp/rest/altone/cp/job/OMH_QCA-C_1792170/v2?part=basic,organisational,descriprion,workflow,skill,qualification,certification,language,applied&isReqId=false'){
   const payload=successorValue('role3-null-description-detail-current');detailChange?.(payload,pass);return response(url,JSON.stringify(payload))
  }
  if(url==='https://omegacareers.peoplestrong.com/api/cp/rest/altone/cp/job/organizationDetails?jobCode=OMH/QCA-C/1792170'){
   const payload=successorValue('role3-organization-current');organizationChange?.(payload,pass);return response(url,JSON.stringify(payload))
  }
  throw Error('Unobserved controlled hold route '+url)
 }
 return {calls,run:()=>omega.run({fetchImpl,now:()=> '2026-11-07T15:46:37.794Z'})}
}

test('controlled held-role closing keeps both native observations and whole models while returning only full-criteria role',async()=>{
 const control=controlledHeldWorkflow(),jobs=await control.run(),audit=jobs[omega.OMEGA_INVENTORY_EVIDENCE]
 assert.equal(jobs.length,1);assert.equal(control.calls.length,13)
 assert.equal(audit.configuredBoardObservationCount,2);assert.equal(audit.selectedTypedIndiaCount,1)
 assert.equal(audit.observedTypedIndiaCount,2);assert.equal(audit.returnedTypedIndiaCount,1);assert.equal(audit.heldTypedIndiaCount,1)
 assert.equal(audit.heldNativeRoleCount,1);assert.match(audit.selectedTypedIndiaCountSemantics,/returned/)
 assert.equal(audit.native.opening.roles.length,2);assert.equal(audit.native.closing.roles.length,2)
 assert.deepEqual(audit.native.opening.roles[1].detail,thirdInput().detail.response)
 assert.deepEqual(audit.native.opening.roles[1].organization,thirdInput().organization.response)
 assert.deepEqual(audit.native.closing.roles,audit.native.opening.roles)
 assert.equal(audit.native.opening.heldRoles.length,1);assert.deepEqual(audit.native.closing.heldRoles,audit.native.opening.heldRoles)
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.inventoryCleanupAllowed,false)
 assert.equal(jobs.some(x=>x.jobId==='OMH/QCA-C/1792170'),false)
})
for(const[name,detailChange,organizationChange]of[
 ['held description changed',(p,n)=>{if(n===2)p.response.jobDescription='<p>Changed substantive public description with new obligations and actual external criteria for this synthetic closing control.</p>'},null],
 ['held workCenter changed',null,(p,n)=>{if(n===2)p.response.workCenter='Controlled different opaque carrier'}],
 ['held Country changed',null,(p,n)=>{if(n===2)p.response.workSiteHierarchy[3].orgUnitName='US'}],
 ['held date changed',(p,n)=>{if(n===2)p.response.CandidatePortalEndDate='2026-11-19 00:00:00.0'},null],
])test('controlled closing refuses '+name,async()=>{
 await assert.rejects(controlledHeldWorkflow({detailChange,organizationChange}).run(),/closing|changed|country|Country|calendar|date|contract/)
})

test('held model omits only approved four personal metadata paths and retains every business null/criterion',async()=>{
 const control=controlledHeldWorkflow({detailChange:p=>{for(const key of ['FirstName','LastName','Username','hiringManagerName'])p.response[key]='SYNTHETIC_HELD_PRIVATE_'+key}})
 const jobs=await control.run(),audit=jobs[omega.OMEGA_INVENTORY_EVIDENCE]
 assert.equal(JSON.stringify({jobs,audit}).includes('SYNTHETIC_HELD_PRIVATE_'),false)
 assert.deepEqual(audit.native.opening.roles[1].detail,thirdInput().detail.response)
})

// Actual default02 opening sample21. These are redacted DERIVED bytes, not
// original raw detail; no full32 detail/closing workflow was acquired.
const emptyPackets=Object.fromEntries(fixture.emptyDescriptionCapturedInputs.map(p=>[p.name,p]))
const emptyValue=name=>JSON.parse(Buffer.from(emptyPackets[name].bodyBase64,'base64'))
const emptyInput=()=>({listing:value('native-listing').response[20],detail:emptyValue('role21-empty-description-detail-current'),organization:emptyValue('role21-organization-current'),now:'2026-11-07T16:40:59.328Z'})
test('actual21 exact empty description retains all independently validated native facts as an ineligible observation',()=>{
 const input=emptyInput(),observed=inspectRole(input)
 assert.equal(input.listing.jobCode,'OMH/C/1861256');assert.equal(observed.job,null)
 assert.equal(observed.hold.country,'India');assert.equal(observed.hold.reason,'native-public-description-empty;optional-skills-not-full-role-criteria')
 assert.equal(observed.hold.sourceNativeEmployerEvidence.legalEntityName,'Omega Healthcare Management Services Private Limited')
 assert.deepEqual(observed.model.detail,input.detail.response);assert.deepEqual(observed.model.organization,input.organization.response)
 assert.equal(observed.model.detail.jobDescription,'');assert.equal(observed.model.detail.internalJobDescription,null)
 assert.equal(observed.model.detail.skills.length,10);assert.equal(observed.model.detail.skills.every(x=>x.mandatory===false),true)
 for(const field of ['qualifications','certifications','languages'])assert.deepEqual(observed.model.detail[field],[])
 assert.equal(observed.hold.sourceScopeComplete,false);assert.equal(observed.hold.inventoryCleanupAllowed,false)
 assert.throws(()=>native.projectPeopleStrongRole(input),/native criteria missing/)
})
test('actual21 derived packet digests bind exactly four private omissions with unchanged own organization',()=>{
 assert.equal(fixture.emptyDescriptionCapturedInputs.length,2)
 for(const packet of fixture.emptyDescriptionCapturedInputs){
  const body=Buffer.from(packet.bodyBase64,'base64');assert.equal(body.length,packet.fixtureBodyBytes)
  assert.equal(createHash('sha256').update(body).digest('hex'),packet.fixtureBodySHA256)
  if(packet.derivedRedactedBody){
   assert.deepEqual(packet.redactions.map(x=>x.path),['$.response.FirstName','$.response.LastName','$.response.Username','$.response.hiringManagerName'])
   for(const key of ['FirstName','LastName','Username','hiringManagerName'])assert.equal(Object.hasOwn(JSON.parse(body).response,key),false)
  }else assert.equal(packet.fixtureBodySHA256,packet.originalBodySHA256)
 }
})
for(const[name,change]of[
 ['wrong code',x=>{x.detail.response.requisitionCode='OMH/C/9999999'}],
 ['wrong numeric ID',x=>{x.detail.response.requisitionId='9999999'}],
 ['wrong title',x=>{x.detail.response.jobTitle='Wrong title'}],
 ['unsafe canonical route',x=>{x.listing.jobDetailUrl+='?apply=true'}],
 ['foreign Legal Entity',x=>{x.organization.response.orgUnitHierarchy[1].orgUnitName='Foreign employer'}],
 ['foreign own Country',x=>{x.organization.response.workSiteHierarchy[3].orgUnitName='US'}],
 ['unreviewed nested country',x=>{x.organization.response.workSiteHierarchy[3].addressCountry='US'}],
 ['private flag',x=>{x.detail.response.confidential=true}],
 ['unsupported state',x=>{x.detail.response.requisitionStatus='CHANGED'}],
 ['invalid calendar',x=>{x.detail.response.CandidatePortalStartDate='2026-02-30 00:00:00.0'}],
 ['missing own organization',x=>{x.organization=null}],
 ['private nested criteria',x=>{x.detail.response.qualifications=[{applicant:{email:'SYNTHETIC_PRIVATE_EMPTY'}}]}],
 ['nonempty internal criteria',x=>{x.detail.response.internalJobDescription='<p>Additional internal criteria remain unsupported for a missing public description.</p>'}],
 ['empty internal string',x=>{x.detail.response.internalJobDescription=''}],
 ['required skill',x=>{x.detail.response.skills[0].mandatory=true}],
 ['qualification',x=>{x.detail.response.qualifications=[{qualificationName:'Controlled required degree',mandatory:true}]}],
 ['certification',x=>{x.detail.response.certifications=[{certificationName:'Controlled certification',mandatory:true}]}],
 ['language',x=>{x.detail.response.languages=[{languageName:'Controlled language',mandatory:true}]}],
 ['unknown criterion carrier',x=>{x.detail.response.additionalMandatoryCriteria={degree:'Controlled'}}],
])test('exact empty hold validates all own facts before retaining '+name,()=>{
 const input=emptyInput();change(input);assert.throws(()=>inspectRole(input),/contract|criteria|carrier|identity|URL|Legal|country|Country|private|status|calendar|date|organization|authority/)
})
for(const invalid of [' ','\t','<p></p>','Short','<script>controlled()</script>',false,{},[]])test('exact empty companion refuses nearby unsupported '+JSON.stringify(invalid),()=>{
 const input=emptyInput();input.detail.response.jobDescription=invalid
 assert.throws(()=>inspectRole(input),/criteria|carrier|program|contract/)
})
// SYNTHETIC two-row listing and original opening reused as controlled closing.
const controlledEmptyWorkflow=({changeDetail,changeOrganization,privateControl=false}={})=>{
 const calls=[],seen=new Map(),list=value('native-listing');list.response=[list.response[0],list.response[20]];list.totalRecords=2
 const durl='https://omegacareers.peoplestrong.com/api/cp/rest/altone/cp/job/OMH_C_1861256/v2?part=basic,organisational,descriprion,workflow,skill,qualification,certification,language,applied&isReqId=false'
 const ourl='https://omegacareers.peoplestrong.com/api/cp/rest/altone/cp/job/organizationDetails?jobCode=OMH/C/1861256'
 const fetchImpl=async(url,init)=>{
  calls.push({url,init});const pass=(seen.get(url)??0)+1;seen.set(url,pass)
  if(url===omega.GLOBAL_CAREERS_URL)return response(url,'SYNTHETIC unrelated global503, not an actual response.',503,'text/html')
  if(url===omega.INDIA_CAREERS_URL)return response(url,bytes('corporate-india'),200,'text/html')
  if(url===LIST_URL)return response(url,JSON.stringify(list))
  if(url===DETAIL_URL)return response(url,bytes('role1-detail'))
  if(url===ORG_URL)return response(url,bytes('role1-organization'))
  if(url===durl){const p=emptyInput().detail;if(privateControl)for(const key of ['FirstName','LastName','Username','hiringManagerName'])p.response[key]='CONTROLLED_PRIVATE_EMPTY_'+key;changeDetail?.(p,pass);return response(url,JSON.stringify(p))}
  if(url===ourl){const p=emptyInput().organization;changeOrganization?.(p,pass);return response(url,JSON.stringify(p))}
  throw Error('Unobserved synthetic empty-hold route '+url)
 }
 return {calls,run:()=>omega.run({fetchImpl,now:()=> '2026-11-07T16:40:59.328Z'})}
}
test('controlled exact empty closing retains2 whole observations but returns only1 full-criteria job with explicit counts',async()=>{
 const control=controlledEmptyWorkflow({privateControl:true}),jobs=await control.run(),audit=jobs[omega.OMEGA_INVENTORY_EVIDENCE]
 assert.equal(control.calls.length,13);assert.equal(jobs.length,1);assert.equal(jobs.some(x=>x.jobId==='OMH/C/1861256'),false)
 assert.equal(audit.configuredBoardObservationCount,2);assert.equal(audit.selectedTypedIndiaCount,1)
 assert.equal(audit.observedTypedIndiaCount,2);assert.equal(audit.returnedTypedIndiaCount,1);assert.equal(audit.heldTypedIndiaCount,1);assert.equal(audit.heldNativeRoleCount,1)
 assert.equal(audit.native.opening.roles.length,2);assert.equal(audit.native.closing.roles.length,2)
 assert.deepEqual(audit.native.opening.roles[1].detail,emptyInput().detail.response)
 assert.deepEqual(audit.native.opening.roles[1].organization,emptyInput().organization.response)
 assert.deepEqual(audit.native.closing.roles,audit.native.opening.roles)
 assert.deepEqual(audit.native.closing.heldRoles,audit.native.opening.heldRoles)
 assert.equal(audit.native.opening.roles[1].detail.jobDescription,'')
 assert.equal(JSON.stringify({jobs,audit}).includes('CONTROLLED_PRIVATE_EMPTY_'),false)
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.inventoryCleanupAllowed,false)
})
for(const[name,changeDetail,changeOrganization]of[
 ['exact empty changed to null',(p,n)=>{if(n===2)p.response.jobDescription=null},null],
 ['exact empty changed to whitespace',(p,n)=>{if(n===2)p.response.jobDescription=' '},null],
 ['office carrier changed',null,(p,n)=>{if(n===2)p.response.workCenter='Controlled distinct opaque workCenter'}],
 ['own Country changed',null,(p,n)=>{if(n===2)p.response.workSiteHierarchy[3].orgUnitName='US'}],
 ['date changed',(p,n)=>{if(n===2)p.response.CandidatePortalEndDate='2026-11-19 00:00:00.0'},null],
])test('controlled exact empty closing refuses '+name,async()=>{
 await assert.rejects(controlledEmptyWorkflow({changeDetail,changeOrganization}).run(),/contract|closing|changed|criteria|country|Country|calendar|date/)
})

// Actual failed DEFAULT03 role22: original2674-char JD plus unclassified native
// qualification STRING labels. Extra samples are DERIVED, not raw staff bodies.
const qualificationPackets=Object.fromEntries(fixture.qualificationLabelCapturedInputs.map(p=>[p.name,p]))
const qualificationValue=name=>JSON.parse(Buffer.from(qualificationPackets[name].bodyBase64,'base64'))
const qualificationInput=()=>({listing:value('native-listing').response[21],detail:qualificationValue('role22-qualification-labels-detail-current'),organization:qualificationValue('role22-organization-current'),now:'2026-11-07T17:06:50.344Z'})
test('actual22 full native JD retains own string qualification labels without deriving degree/required/preferred semantics',()=>{
 const input=qualificationInput(),observed=inspectRole(input),job=observed.job
 assert.equal(input.listing.jobCode,'OMH/AM-D/1901314');assert.equal(observed.hold,null)
 assert.equal(input.detail.response.jobDescription.length,2674);assert.equal(job.sourceDescription,input.detail.response.jobDescription)
 assert.equal(job.country,'India');assert.equal(job.sourceNativeEmployerEvidence.legalEntityName,'Omega Healthcare Management Services Private Limited')
 assert.deepEqual(job.sourceNativeCriteria.qualifications,['Other','Degree']);assert.deepEqual(observed.model.detail,input.detail.response)
 assert.deepEqual(observed.model.organization,input.organization.response)
 assert.equal(job.minimumQualification,null);assert.equal(job.preferredQualifications,null);assert.deepEqual(job.requiredSkills,[])
 const semantics=job.sourceNativeCriteria.qualificationStringSemantics
 assert.equal(semantics.carrier,'own-native-plain-string-qualification-label');assert.equal(semantics.mandatory,null);assert.equal(semantics.requiredOrPreferred,null);assert.equal(semantics.minimumDegree,null)
 assert.deepEqual(semantics.entries,[{index:0,label:'Other',mandatory:null,classification:'unclassified-native-label'},{index:1,label:'Degree',mandatory:null,classification:'unclassified-native-label'}])
 assert.equal(job.sourceScopeComplete,false);assert.equal(job.sourceDetailComplete,false);assert.equal(job.inventoryCleanupAllowed,false)
 for(const label of input.detail.response.qualifications)assert.equal(input.detail.response.jobDescription.includes(label),false,'Independent native labels do not occur in this own JD; do not append them as requirements')
})
test('actual22 detail/org derived digests bind original bodies and exactly four private omissions',()=>{
 assert.equal(fixture.qualificationLabelCapturedInputs.length,2)
 for(const p of fixture.qualificationLabelCapturedInputs){const body=Buffer.from(p.bodyBase64,'base64');assert.equal(body.length,p.fixtureBodyBytes);assert.equal(createHash('sha256').update(body).digest('hex'),p.fixtureBodySHA256)
  if(p.derivedRedactedBody){assert.deepEqual(p.redactions.map(x=>x.path),['$.response.FirstName','$.response.LastName','$.response.Username','$.response.hiringManagerName']);for(const key of ['FirstName','LastName','Username','hiringManagerName'])assert.equal(Object.hasOwn(JSON.parse(body).response,key),false)}
  else assert.equal(p.fixtureBodySHA256,p.originalBodySHA256)
 }
})
test('controlled alternative plain business label is retained verbatim and still has no minimum-degree/mandatory authority',()=>{
 const input=qualificationInput();input.detail.response.qualifications=['Bachelor of Technology']
 const job=inspectRole(input).job
 assert.deepEqual(job.sourceNativeCriteria.qualifications,['Bachelor of Technology']);assert.equal(job.minimumQualification,null);assert.equal(job.preferredQualifications,null);assert.deepEqual(job.requiredSkills,[])
 assert.deepEqual(job.sourceNativeCriteria.qualificationStringSemantics.entries,[{index:0,label:'Bachelor of Technology',mandatory:null,classification:'unclassified-native-label'}])
})
test('controlled mixed valid native labels and preexisting typed object preserve their separate semantics',()=>{
 const input=qualificationInput();input.detail.response.qualifications.push({qualificationName:'Controlled native specialty',mandatory:true})
 const job=inspectRole(input).job
 assert.deepEqual(job.sourceNativeCriteria.qualifications,input.detail.response.qualifications)
 assert.equal(job.sourceNativeCriteria.qualificationStringSemantics.entries.length,2)
 assert.equal(job.sourceNativeCriteria.qualifications[2].mandatory,true);assert.equal(job.minimumQualification,null);assert.equal(job.preferredQualifications,null)
})
for(const invalid of ['', ' ', '\t', ' Other','Degree ','Other\nDegree','<b>Degree</b>','<script>controlled()</script>','https://unrelated.invalid/','{"applicant":{"email":"CONTROLLED_PRIVATE"}}','window.location','eval','alert(1)','Degree=Required','Applicant Name','Username CONTROLLED_PRIVATE','x'.repeat(257),true,0,null,[],{applicant:{email:'CONTROLLED_PRIVATE'}}])test('plain qualification labels refuse unreviewed carrier '+JSON.stringify(invalid),()=>{
 const input=qualificationInput();input.detail.response.qualifications=['Other',invalid]
 assert.throws(()=>inspectRole(input),/contract|criteria|carrier|qualification/)
})
for(const section of ['certifications','languages'])test('qualification string admission does not broaden '+section,()=>{
 const input=qualificationInput();input.detail.response[section]=['Degree'];assert.throws(()=>inspectRole(input),/criteria|contract/)
})
for(const[name,change]of[
 ['foreign ownCountry',x=>{x.organization.response.workSiteHierarchy[3].orgUnitName='US'}],
 ['wrong ownLegalEntity',x=>{x.organization.response.orgUnitHierarchy[1].orgUnitName='Foreign employer'}],
 ['wrong native ID',x=>{x.detail.response.requisitionId='9999999'}],
 ['wrong canonical route',x=>{x.listing.jobDetailUrl+='?application=true'}],
 ['private job',x=>{x.detail.response.confidential=true}],
 ['wrong public state',x=>{x.detail.response.requisitionStatus='CLOSED'}],
 ['invalid calendar',x=>{x.detail.response.CandidatePortalStartDate='2026-02-30 00:00:00.0'}],
 ['unknown nested authority',x=>{x.detail.response.qualifications.push({qualificationName:'Degree',addressCountry:'US'})}],
 ['missing public JD null',x=>{x.detail.response.jobDescription=null}],
 ['missing public JD empty',x=>{x.detail.response.jobDescription=''}],
])test('qualification string carrier preserves whole-role guard '+name,()=>{
 const input=qualificationInput();change(input);assert.throws(()=>inspectRole(input),/contract|criteria|carrier|country|Country|Legal|identity|URL|status|private|calendar|date/)
})
// SYNTHETIC two-row listing total and opening sample bytes reused as closing.
// No actual DEFAULT03 closing response or remaining10 role detail is invented.
const controlledQualificationWorkflow=({changeDetail,changeOrganization,privateControl=false}={})=>{
 const calls=[],seen=new Map(),list=value('native-listing');list.response=[list.response[0],list.response[21]];list.totalRecords=2
 const durl='https://omegacareers.peoplestrong.com/api/cp/rest/altone/cp/job/OMH_AM-D_1901314/v2?part=basic,organisational,descriprion,workflow,skill,qualification,certification,language,applied&isReqId=false'
 const ourl='https://omegacareers.peoplestrong.com/api/cp/rest/altone/cp/job/organizationDetails?jobCode=OMH/AM-D/1901314'
 const fetchImpl=async(url,init)=>{calls.push({url,init});const pass=(seen.get(url)??0)+1;seen.set(url,pass)
  if(url===omega.GLOBAL_CAREERS_URL)return response(url,'SYNTHETIC unrelated global503, not actual response.',503,'text/html')
  if(url===omega.INDIA_CAREERS_URL)return response(url,bytes('corporate-india'),200,'text/html')
  if(url===LIST_URL)return response(url,JSON.stringify(list))
  if(url===DETAIL_URL)return response(url,bytes('role1-detail'))
  if(url===ORG_URL)return response(url,bytes('role1-organization'))
  if(url===durl){const p=qualificationInput().detail;if(privateControl)for(const key of ['FirstName','LastName','Username','hiringManagerName'])p.response[key]='SYNTHETIC_PRIVATE_QUAL_'+key;changeDetail?.(p,pass);return response(url,JSON.stringify(p))}
  if(url===ourl){const p=qualificationInput().organization;changeOrganization?.(p,pass);return response(url,JSON.stringify(p))}
  throw Error('Unobserved controlled qualification route '+url)
 }
 return {calls,run:()=>omega.run({fetchImpl,now:()=> '2026-11-07T17:06:50.344Z'})}
}
test('controlled whole qualification workflow returns supported full-JD role and retains exact raw opening/closing labels with unknown semantics',async()=>{
 const control=controlledQualificationWorkflow({privateControl:true}),jobs=await control.run(),audit=jobs[omega.OMEGA_INVENTORY_EVIDENCE]
 assert.equal(control.calls.length,13);assert.equal(jobs.length,2);assert.equal(jobs[1].jobId,'OMH/AM-D/1901314')
 assert.deepEqual(jobs[1].sourceNativeCriteria.qualifications,['Other','Degree']);assert.equal(jobs[1].minimumQualification,null)
 assert.deepEqual(audit.native.opening.roles[1].detail,qualificationInput().detail.response)
 assert.deepEqual(audit.native.opening.roles[1].organization,qualificationInput().organization.response)
 assert.deepEqual(audit.native.closing.roles,audit.native.opening.roles)
 assert.equal(JSON.stringify({jobs,audit}).includes('SYNTHETIC_PRIVATE_QUAL_'),false)
 assert.equal(audit.configuredBoardObservationCount,2);assert.equal(audit.selectedTypedIndiaCount,2)
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.inventoryCleanupAllowed,false)
})
for(const[name,changeDetail,changeOrganization]of[
 ['changed admitted label',(p,n)=>{if(n===2)p.response.qualifications[1]='Bachelor of Technology'},null],
 ['reordered admitted labels',(p,n)=>{if(n===2)p.response.qualifications.reverse()},null],
 ['added typed mandatory object',(p,n)=>{if(n===2)p.response.qualifications.push({qualificationName:'Controlled new criterion',mandatory:true})},null],
 ['native JD changed',(p,n)=>{if(n===2)p.response.jobDescription+='<p>Controlled extra authored criterion that changes closing.</p>'},null],
 ['own Country changed',null,(p,n)=>{if(n===2)p.response.workSiteHierarchy[3].orgUnitName='US'}],
])test('controlled closing refuses qualification model '+name,async()=>{
 await assert.rejects(controlledQualificationWorkflow({changeDetail,changeOrganization}).run(),/closing|changed|contract|country|Country/)
})

for(const control of [0,9,10,127])test('bounded qualification plain labels reject actual control character '+control,()=>{
 const input=qualificationInput();input.detail.response.qualifications=['Other','Degree'+String.fromCharCode(control)+'Label']
 assert.throws(()=>inspectRole(input),/qualification|criteria|carrier|contract/)
})
