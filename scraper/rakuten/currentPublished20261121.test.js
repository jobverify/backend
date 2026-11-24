import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-public-pair-20261121.json.gz', import.meta.url))))
const AT = '2026-11-20T20:10:00.000Z'
const HOME = 'https://corp.rakuten.co.in/', PORTAL = 'https://rakuten.openings.co/', PAGE = PORTAL + 'rakuten/'
const CLIENT = PAGE + 'main.32e0c94ed6e2194e.js', CONFIG = 'https://apic2.zwayam.com/data-service/v2/company/15124/careersite-configurations'
const LIST = 'https://apic2.zwayam.com/jobs/search', DETAIL = 'https://apic2.zwayam.com/jobs-service/v1/jobs/careersite'
const decode = record => Buffer.from(record.bodyBase64, 'base64').toString('utf8')
const record = url => fixture.responses.find(r => r.requestedUrl === url)
const list = () => JSON.parse(decode(record(LIST)))
const role = id => JSON.parse(decode(fixture.responses.find(r => r.requestedUrl === DETAIL && r.requestJSON.jobId === id)))
const exact = (source, before, after) => { assert.equal(source.split(before).length, 2); return source.replace(before, () => after) }
const load = () => import('./currentPublished20261121.js')
const client = async text => (await load()).qualifyCurrentClient(text ?? decode(record(CLIENT)))
const inventory = async change => { const value = list(); change?.(value); return (await load()).readCurrentInventory(JSON.stringify(value), { observedAt: AT, client: await client() }) }

test('current source qualifies the actual corporate literal handoff and native portal', async () => {
  const m = await load()
  assert.equal(m.readCurrentOwn(decode(record(HOME)), { observedAt: AT }).portalURL, PORTAL)
  assert.equal(m.readCurrentPortal(decode(record(PAGE)), { observedAt: AT }).clientURL, CLIENT)
})
test('current connected public client supplies exact account and both read-only endpoints', async () => {
  const c = await client()
  assert.equal(c.companyId, '15124'); assert.equal(c.encodedCompanyId, 'MTUxMjQ=')
  assert.equal(c.domain, 'rakuten.openings.co'); assert.equal(c.listURL, LIST); assert.equal(c.detailURL, DETAIL)
})
test('actual Elasticsearch wrappers expose seven bound India records', async () => {
  const value = await inventory()
  assert.equal(value.rows.length, 7); assert.equal(value.held.length, 0)
  assert.equal(value.rows[0].id, '5000207')
  assert.equal(value.rows[0].title, 'Systems Engineer II-MqSql DBA-Contract')
})
for (const [name, edit] of [
  ['selector account', m => { m.data.facetedSearchConfig.queryCriteria.careersite.and[0].fieldValueString = '999' }],
  ['selected current status', m => { m.data.facetedSearchConfig.queryCriteria.careersite.and[1].fieldValueString = '0' }],
  ['selected current date range', m => { m.data.facetedSearchConfig.queryCriteria.careersite.and[3].dynamicQueryField2 = 'unrelatedDate' }],
  ['selected excluded visibility', m => { m.data.facetedSearchConfig.queryCriteria.careersite.not[0].fieldValueString = 'N' }],
  ['reported completeness', m => { m.data.totalCount = 8 }],
  ['native more-data flag', m => { m.data.hasMoreData = true }],
]) test('native inventory rejects changed ' + name, async () => { await assert.rejects(() => inventory(edit)) })

for (const [name, field, value] of [['closed status', 'status', 0], ['hidden status', 'status', 2], ['closed display', 'displayStatus', 'Closed'], ['hidden visibility', 'jobVisibiltyLevel', 'P'], ['foreign company', 'companyId', 999], ['foreign country', 'country', 'Canada'], ['foreign location', 'location', 'Toronto, Canada'], ['foreign application', 'applicationUrl', 'https://other.example/apply']]) {
  test('one contradictory row holds itself: ' + name, async () => {
    const result = await inventory(m => { m.data.data[0]._source[field] = value })
    assert.equal(result.rows.length, 6); assert.equal(result.held.length, 1)
  })
}
test('unscoped other-status strings are preserved without making an active status claim', async () => {
  const result = await inventory(m => { m.data.data[0]._source.otherStatusOne = 'Closed'; m.data.data[0]._source.otherStatusTwo = 'Unscoped native choice wording' })
  assert.equal(result.rows.length, 7)
  assert.equal(result.rows[0].originalRecord.otherStatusOne, 'Closed')
})
test('same-role detail retains earliest actual creation instead of later modification/public identifier day', async () => {
  const m = await load(), inv = await inventory(), row = inv.rows.find(r => r.id === '5005402')
  const result = m.inspectCurrentRole(JSON.stringify(role(5005402)), row, { observedAt: AT, client: await client() })
  assert.equal(result.postingDate, '2026-11-11T10:47:27.000Z')
  assert.equal(result.country, 'India'); assert.equal(result.nativeLegalEmployer, null); assert.equal(result.requisitionId, null)
})
for (const [name, edit] of [
  ['closed', r => { r.status = 0 }], ['hidden', r => { r.jobVisibiltyLevel = 'P' }],
  ['identity mismatch', r => { r.id = 5005403 }], ['country contradiction', r => { r.country = 'Canada' }],
  ['application contradiction', r => { r.applicationUrl = 'https://other.example/apply' }],
  ['future creation', r => { r.createdDate = Date.parse(AT) + 1 }],
  ['expired end', r => { r.endtDate = 946684800000 }],
  ['semantic employer', r => { r.jobConfigurationData.Description += '<section><p>Employer</p><p>Other Employer</p></section>' }],
  ['semantic country', r => { r.jobConfigurationData.Description += '<section><p>Country</p><p>Canada</p></section>' }],
  ['semantic application', r => { r.jobConfigurationData.Description += '<section><p>Application URL</p><p>https://other.example/apply</p></section>' }],
]) test('same-role current detail rejects ' + name, async () => {
  const m = await load(), inv = await inventory(), row = inv.rows.find(r => r.id === '5005402'), value = role(5005402)
  edit(value); assert.throws(() => m.inspectCurrentRole(JSON.stringify(value), row, { observedAt: AT }))
})
test('actual own contradictory heading is not discarded', async () => {
  const m = await load(), html = exact(decode(record(HOME)), '</body>', '<h1>Careers at Other Employer</h1></body>')
  assert.throws(() => m.readCurrentOwn(html, { observedAt: AT }))
})
for (const [name, before, after] of [['company account', 'COMPANYID:"MTUxMjQ="', 'COMPANYID:"OTk5"'], ['domain account', 'DOMAIN:"rakuten.openings.co"', 'DOMAIN:"other.openings.co"'], ['native list path', 'v1:"jobs/search"', 'v1:"jobs/private-search"'], ['success closed mapping', 'closedJob:!1', 'closedJob:!0']]) {
  test('connected client rejects changed ' + name, async () => { await assert.rejects(() => client(exact(decode(record(CLIENT)), before, after))) })
}
test('client account local rename and comments are compatible', async () => {
  const text = decode(record(CLIENT)).replace(/\bed\b/g, 'currentPublicEnvironment')
  const result = await client('/* independent current consumer */\n' + text)
  assert.equal(result.companyId, '15124')
})

function replay(edit) {
  const calls = [], counts = new Map(), detailCounts = new Map()
  const fetchImpl = async (url, init) => {
    const occurrence = counts.get(url) ?? 0; counts.set(url, occurrence + 1)
    let original
    if (url === DETAIL) {
      const params = JSON.parse(init.body)
      assert.equal(params.externalSource, 'CareerSite'); assert.equal(params.companyId, '15124')
      const n = detailCounts.get(params.jobId) ?? 0; detailCounts.set(params.jobId, n + 1)
      original = fixture.responses.filter(r => r.requestedUrl === url && r.requestJSON.jobId === params.jobId)[n]
    } else original = fixture.responses.filter(r => r.requestedUrl === url)[occurrence]
    assert.ok(original, 'Current exact declared request only: ' + url)
    const response = { ...original, headers: { ...original.headers }, text: decode(original) }
    edit?.(response, url, occurrence, init)
    calls.push({ url, method: init.method })
    const result = new Response(response.text, { status: response.status, headers: response.headers })
    Object.defineProperties(result, { url: { value: url }, redirected: { value: false } })
    return result
  }
  return { calls, fetchImpl }
}
test('default native collector reconciles current publication partials without company or cleanup claims', async () => {
  const m = await load(), io = replay()
  const jobs = await m.runCurrentRakuten({ fetchImpl: io.fetchImpl, requestIntervalMs: 0, now: AT })
  assert.equal(jobs.length, 7)
  assert.equal(io.calls.length, 26)
  assert.ok(jobs.every(j => j.sourceScopeComplete === false && j.lifecycleCleanupAllowed === false && j.nativeLegalEmployer === null))
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  const assessment = assessSoftFailureAcquisition({ source: 'rakuten', companyName: 'Rakuten' }, jobs)
  assert.equal(assessment.indiaJobs, 7); assert.notEqual(assessment.zeroJobEvidence?.verified, true)
})
test('closing same-role active-status contradiction holds that role and retains other India partials', async () => {
  const m = await load(), io = replay((r, url, n) => { if (url === DETAIL && n === 7) { const value = JSON.parse(r.text); value.status = 0; r.text = JSON.stringify(value) } })
  const jobs = await m.runCurrentRakuten({ fetchImpl: io.fetchImpl, requestIntervalMs: 0, now: AT })
  assert.equal(jobs.length, 6)
})
for (const status of [202, 401, 402, 403, 406, 407, 429, 451]) test('HTTP' + status + ' permanently stops its origin', async () => {
  const m = await load(), io = replay((r, url) => { if (url === HOME) { r.status = status; r.text = 'Unavailable' } })
  await assert.rejects(() => m.runCurrentRakuten({ fetchImpl: io.fetchImpl, requestIntervalMs: 0, now: AT }))
  assert.equal(io.calls.length, 1)
})
test('opaque final-audit cancellation rejects before disposal', async () => {
  const m = await load(), io = replay(), controller = new AbortController(), reason = Object.freeze({ nativeFinalAudit: true })
  await assert.rejects(() => m.runCurrentRakuten({ fetchImpl: io.fetchImpl, requestIntervalMs: 0, now: AT, signal: controller.signal, onAudit: () => queueMicrotask(() => controller.abort(reason)) }), error => error === reason)
})
test('stable public factory fetchImpl path uses current original Responses', async () => {
  const { createRakutenScraper } = await import('./script.js'), io = replay()
  const jobs = await createRakutenScraper().run({ fetchImpl: io.fetchImpl, requestIntervalMs: 0, now: AT })
  assert.equal(jobs.length, 7); assert.equal(jobs[0].company, 'Rakuten'); assert.equal(io.calls.length, 26)
})
test('paired legacy hooks retain observations without fresh-date India, recovery, zero or cleanup credit', async () => {
  const { createRakutenScraper } = await import('./script.js')
  const fresh = new Date().toISOString()
  const record = { id: 48152, jobTitle: 'Software Engineer', jobUrl: 'software-engineer', location: 'Bangalore, Karnataka, India', createdDate: fresh, jobConfigurationData: { Description: 'Original supplied legacy observation.' } }
  const jobs = await createRakutenScraper({ maxJobs: 1, maxPages: 1 }).run({ fetchListingPage: async () => ({ data: { data: [record], totalCount: 1 } }), fetchJobDetail: async () => record })
  assert.equal(jobs.length, 1); assert.equal(jobs[0].jobId, '48152'); assert.equal(jobs[0].jobDescription, 'Original supplied legacy observation.')
  assert.equal(jobs[0].company, null); assert.equal(jobs[0].country, null); assert.equal(jobs[0].postingDate, null)
  assert.equal(jobs[0].sourceLegacyObservation.originalProjection.postingDate, fresh)
  const assessment = assessSoftFailureAcquisition({ source: 'rakuten', companyName: 'Rakuten' }, jobs)
  assert.equal(assessment.indiaJobs, 0); assert.equal(assessment.eligibleJobs, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'unverified'); assert.notEqual(assessment.zeroJobEvidence?.verified, true)
  assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed, false)
})
for (const hooks of [{ fetchListingPage: async () => ({}) }, { fetchJobDetail: async () => ({}) }, { fetchListingPage: async () => ({}), fetchJobDetail: async () => ({}), fetchImpl: async () => { throw Error('Must not fetch') } }]) {
  test('stable public factory rejects ambiguous single or mixed legacy transport', async () => {
    const { createRakutenScraper } = await import('./script.js')
    await assert.rejects(() => createRakutenScraper().run(hooks))
  })
}
test('genuine source fixture has two separately acquired observations and all26 original bodies', () => {
  assert.equal(fixture.genuineOriginalResponses, 26); assert.equal(fixture.responses.length, 26)
  assert.notEqual(fixture.openingObservedAt, fixture.closingObservedAt)
  assert.equal(fixture.responses.reduce((n, r) => n + r.bytes, 0), 5678252)
})
for (const [name, before, after] of [
  ['unreachable successful native result', 'this.jobViewLoad.emit({jobData:this.jobData,isDataLoaded:this.isDataLoaded,closedJob:!1})', '(()=>{if(false){this.jobViewLoad.emit({jobData:this.jobData,isDataLoaded:this.isDataLoaded,closedJob:!1})}})()'],
  ['role view inverts the successful open state', 'onJobViewLoad(t){if(t.closedJob)return void(this.isJobClosed=!0);this.isJobClosed=!1;', 'onJobViewLoad(t){if(t.closedJob)return void(this.isJobClosed=!0);this.isJobClosed=!0;'],
]) test('connected client rejects ' + name, async () => { await assert.rejects(() => client(exact(decode(record(CLIENT)), before, after))) })
test('actual current head title carrier cannot specify a foreign employer', async () => {
  const m = await load(), html = exact(decode(record(HOME)), '<title>', '<title data-employer="Other Employer">')
  assert.throws(() => m.readCurrentOwn(html, { observedAt: AT }))
})
for (const [name, suffix] of [
  ['explicit closed role notice', '<p>This job is no longer accepting applications.</p>'],
  ['authored expired closing date', '<p>Closing date: 2000-01-01</p>'],
  ['authored future publication', '<p>Posting date: 2099-01-01</p>'],
]) test('all authored native criteria constrain ' + name, async () => {
  const m = await load(), row = (await inventory()).rows.find(r => r.id === '5005402'), value = role(5005402)
  value.jobConfigurationData.Description += suffix
  assert.throws(() => m.inspectCurrentRole(JSON.stringify(value), row, { observedAt: AT }))
})
test('coherent same-role structured Open status preserves an India partial', async () => {
  const m = await load(), row = (await inventory()).rows.find(r => r.id === '5005402'), value = role(5005402)
  value.jobConfigurationData.Description += '<script type="application/ld+json">' + JSON.stringify({ '@context': 'http://schema.org', '@type': 'WebPage', url: row.url, status: 'Open', country: 'India' }) + '</script>'
  assert.equal(m.inspectCurrentRole(JSON.stringify(value), row, { observedAt: AT }).country, 'India')
})
test('coherent typed applicant India condition preserves a bound India workplace', async () => {
  const m = await load(), row = (await inventory()).rows.find(r => r.id === '5005402'), value = role(5005402)
  value.applicantLocationRequirements = { '@type': 'Country', name: 'India' }
  assert.equal(m.inspectCurrentRole(JSON.stringify(value), row, { observedAt: AT }).country, 'India')
})
test('same-role structured employer URL cannot identify a different issuer', async () => {
  const m = await load(), row = (await inventory()).rows.find(r => r.id === '5005402'), value = role(5005402)
  value.hiringOrganization = { '@type': 'Organization', name: 'Rakuten', url: 'https://other.example/' }
  assert.throws(() => m.inspectCurrentRole(JSON.stringify(value), row, { observedAt: AT }))
})
test('unscoped ordinary closed-loop wording does not fabricate a closed vacancy', async () => {
  const m = await load(), row = (await inventory()).rows.find(r => r.id === '5005402'), value = role(5005402)
  value.jobConfigurationData.Description += '<p>Build reliable closed-loop controllers with our team.</p>'
  assert.equal(m.inspectCurrentRole(JSON.stringify(value), row, { observedAt: AT }).country, 'India')
})
for (const [name, model] of [
  ['foreign scoped WebPage employer', { '@type': 'WebPage', url: HOME, name: 'Other Employer Careers' }],
  ['foreign scoped publisher root', { '@type': 'WebPage', url: HOME, name: 'Rakuten India', publisher: { '@type': 'Organization', name: 'Other Employer', url: 'https://other.example/' } }],
]) test('own publisher retains contradictory ' + name, async () => {
  const m = await load(), html = exact(decode(record(HOME)), '</head>', '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', ...model }) + '</script></head>')
  assert.throws(() => m.readCurrentOwn(html, { observedAt: AT }))
})

for (const [name, before, after] of [
  ['actual OpenGraph publisher title', 'property="og:title" content="Rakuten India"', 'property="og:title" content="Other Employer Careers"'],
  ['actual OpenGraph page identity', 'property="og:url" content="https://corp.rakuten.co.in"', 'property="og:url" content="https://other.example/"'],
]) test('own actual metadata rejects changed ' + name, async () => {
  const m = await load(), html = exact(decode(record(HOME)), before, after)
  assert.throws(() => m.readCurrentOwn(html, { observedAt: AT }))
})
for (const [name, pageName, valid] of [['foreign', 'Other Employer Careers', false], ['same-role', 'Senior Systems Engineer II - MySQL DBA', true]]) {
  test('same-role WebPage name is qualified: ' + name, async () => {
    const m = await load(), row = (await inventory()).rows.find(r => r.id === '5005402'), value = role(5005402)
    const nameValue = valid ? row.title : pageName
    value.jobConfigurationData.Description += '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', url: row.url, name: nameValue }) + '</script>'
    const run = () => m.inspectCurrentRole(JSON.stringify(value), row, { observedAt: AT })
    if (valid) assert.equal(run().country, 'India'); else assert.throws(run)
  })
}

for (const targetPhase of [0, 1]) for (const [name, url, mutate, expected] of [
  ['row active status', LIST, v => { v.data.data[0]._source.status = 0 }, 6],
  ['row public visibility', LIST, v => { v.data.data[0]._source.jobVisibiltyLevel = 'C' }, 6],
  ['row selected display status', LIST, v => { v.data.data[0]._source.displayStatus = 'Closed' }, 6],
  ['detail active status', DETAIL, v => { v.status = 2 }, 6],
  ['detail selected display status', DETAIL, v => { v.displayStatus = 'Closed' }, 6],
  ['detail employer', DETAIL, v => { v.companyName = 'Other Employer' }, 6],
  ['detail expiry', DETAIL, v => { v.endtDate = 946684800000 }, 6],
  ['detail authored criteria', DETAIL, v => { v.jobConfigurationData.Description += '<section><p>Country</p><p>Canada</p></section>' }, 6],
  ['detail public application', DETAIL, v => { v.applyUrl = 'https://other.example/apply' }, 6],
  ['detail role identity', DETAIL, v => { v.id = 999 }, 6],
  ['unscoped detail labels', DETAIL, v => { v.otherStatusOne = 'Unscoped label'; v.otherStatusTwo = 'Closed' }, 7],
]) test('full collector constrains ' + (targetPhase ? 'closing' : 'opening') + ' ' + name, async () => {
  const m = await load(), io = replay((r, currentURL, n) => {
    const targetOccurrence = url === LIST ? targetPhase : targetPhase * 7
    if (currentURL === url && n === targetOccurrence) { const value = JSON.parse(r.text); mutate(value); r.text = JSON.stringify(value) }
  })
  const jobs = await m.runCurrentRakuten({ fetchImpl: io.fetchImpl, requestIntervalMs: 0, now: AT })
  assert.equal(jobs.length, expected)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal, null)
  assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed, false)
})
test('unrelated SVG title with identical text cannot become the streamed publisher title', async () => {
  const m = await load(), html = exact(decode(record(HOME)), '</body>', '<svg><title>Rakuten India</title></svg></body>')
  assert.equal(m.readCurrentOwn(html, { observedAt: AT }).portalURL, PORTAL)
})
test('the actual streamed publisher title cannot identify a foreign publisher', async () => {
  const m = await load(), html = exact(decode(record(HOME)), '<title>Rakuten India</title>', '<title>Other Employer Careers</title>')
  assert.throws(() => m.readCurrentOwn(html, { observedAt: AT }))
})
test('the actual streamed publisher title cannot be explicitly withdrawn', async () => {
  const m = await load(), html = exact(decode(record(HOME)), '<title>Rakuten India</title>', '<title hidden>Rakuten India</title>')
  assert.throws(() => m.readCurrentOwn(html, { observedAt: AT }))
})
for (const [name, edit, valid] of [
  ['plural authored workplaces', r => { r.workLocations = ['Toronto, Canada'] }, false],
  ['structured workplace name', r => { r.workLocation = { '@type': 'Place', name: 'Toronto, Canada' } }, false],
  ['structured postal address locality', r => { r.jobLocation = { '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: 'India', addressLocality: 'Toronto, Canada' } } }, false],
  ['explicit applicant context', r => { r.applicantLocationRequirements = { '@context': 'https://other.example', '@type': 'Country', name: 'India' } }, false],
  ['explicit disabled Apply owner', r => { r.jobConfigurationData.Description += '<fieldset disabled><a href="' + PAGE + 'jobview/' + r.jobUrl + '?id=' + r.id + '">Apply</a></fieldset>' }, false],
  ['coherent plural workplaces', r => { r.workLocations = ['Bengaluru, India'] }, true],
  ['coherent structured workplace', r => { r.workLocation = { '@type': 'Place', name: 'Bengaluru, India' } }, true],
  ['coherent applicant context', r => { r.applicantLocationRequirements = { '@context': 'https://schema.org', '@type': 'Country', name: 'India' } }, true],
]) test('all supplied known native criteria qualify ' + name, async () => {
  const m = await load(), row = (await inventory()).rows.find(r => r.id === '5005402'), value = role(5005402)
  edit(value); const run = () => m.inspectCurrentRole(JSON.stringify(value), row, { observedAt: AT })
  if (valid) assert.equal(run().country, 'India'); else assert.throws(run)
})
