import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parseCurrentIndex, parseCurrentRole, runCurrentNative, PROFILE } from './currentNative20261119.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261119.json.gz', import.meta.url))))
const pages = new Map(fixture.records.map(row => [row.requestedUrl, row]))
const indexHTML = pages.get(PROFILE.indexURL).body
const listings = () => parseCurrentIndex(indexHTML)
const first = () => listings()[0]
const original = () => pages.get(first().sourceUrl).body
const mutateModel = (body, change) => body.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/, (_, head, json, tail) => {
 const model = JSON.parse(json); change(model); return head + JSON.stringify(model) + tail
})
const response = (row, body = row.body, status = row.status) => {
 const result = new Response([204,205,304].includes(status) ? null : body, { status, headers: row.headers })
 Object.defineProperty(result, 'url', { value: row.url }); return result
}

test('current original employer roles and full criteria retain exact native identity and original dates', () => {
 const rows = listings(); assert.ok(rows.length > 0 && rows.length <= 32)
 const facts = rows.map(row => parseCurrentRole(pages.get(row.sourceUrl).body, row, '2026-11-19T18:00:00Z'))
 assert.ok(facts.some(row => row.country === 'India' && row.sourceDetailComplete))
 assert.deepEqual(facts.filter(row => row.country === 'India' && !row.sourceDetailComplete).map(row => row.requisitionId), PROFILE.source === 'carrier' ? ['30209880'] : [])
 for (const row of facts) {
  assert.equal(row.nativeEmployerDisplayName, PROFILE.company)
  assert.equal(row.sourceNativeJobPosting.url, row.sourceUrl)
  assert.ok(row.sourceNativePublicationDates.length >= 1)
  assert.equal(row.sourceScopeComplete, false)
  assert.equal(row.lifecycleCleanupAllowed, false)
  assert.equal(row.backendApplicationActivationVerified, false)
  if (row.sourceDetailComplete) assert.ok(row.sourceDescription.length > 300)
 }
})

test('foreign employer, conflicting title, mixed geography and expired native deadline cannot acquire India identity', () => {
 const row = first(), html = original()
 for (const change of [m => { m.hiringOrganization.name = 'Other Employer' }, m => { m.title = 'Unrelated position' },
  m => { m.jobLocation.push({ '@type':'Place', address:{ '@type':'PostalAddress', addressCountry:'US', addressLocality:'London' } }) },
  m => { m.validThrough = '2026-11-18' }, m => { m.datePosted = '2026-02-30' }, m => { m.status = 'Closed' }]) {
  assert.throws(() => parseCurrentRole(mutateModel(html, change), row, '2026-11-19T18:00:00Z'))
 }
})

test('hidden role authority, inactive application and foreign canonical are held', () => {
 const row = first(), html = original()
 for (const body of [html.replace('data-selector-name="jobdetails"', 'hidden data-selector-name="jobdetails"'),
  html.replaceAll('data-selector-name="job-apply-link"', 'aria-disabled="true" data-selector-name="job-apply-link"'),
  html.replace('</head>', '<link rel="canonical" href="https://example.net/foreign"></head>')]) {
  assert.throws(() => parseCurrentRole(body, row, '2026-11-19T18:00:00Z'))
 }
})

test('valid native job identity survives absent or hidden criteria as an explicit partial record', () => {
 const row = first(), html = original()
 for (const body of [mutateModel(html, m => { m.description = '' }), html.replace('class="ats-description"', 'hidden class="ats-description"')]) {
  const fact = parseCurrentRole(body, row, '2026-11-19T18:00:00Z')
  assert.equal(fact.country, 'India'); assert.equal(fact.sourceDetailComplete, false)
  assert.equal(fact.sourceDescription, null); assert.ok(fact.sourceDetailFailureKind)
  assert.equal(fact.sourceScopeComplete, false)
 }
})

test('real original HTTP replay reconciles all observed roles and retains pipeline publication plus cleanup holds', async () => {
 const calls = []
 const jobs = await runCurrentNative({ now: () => '2026-11-19T18:00:00Z', fetchImpl: async (url, init) => {
  calls.push(url); assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual')
  const row = pages.get(url); assert.ok(row, 'unbound URL ' + url); return response(row)
 } })
 assert.ok(jobs.length > 0)
 assert.equal(readInventoryEvidence(jobs).listingComplete, false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningClosingRecordsMatch, true)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal, null)
 assert.ok(calls.length >= listings().length * 2 + 2)
 const assessment = assessSoftFailureAcquisition({source: PROFILE.source, companyName: PROFILE.company, adapter:'script', countryFilter:'India'}, jobs)
 assert.equal(assessment.runnerOutcome.success, true)
})

test('cancellation preserves an opaque caller reason and original non-200 HTTP is rejected', async () => {
 const reason = { caller: PROFILE.source }, controller = new AbortController(); controller.abort(reason)
 await assert.rejects(runCurrentNative({ signal: controller.signal, fetchImpl: () => { throw Error('must not fetch') } }), error => error === reason)
 await assert.rejects(runCurrentNative({ fetchImpl: async url => response({url, status:503, headers:{'content-type':'text/html'}, body:'Unavailable'}) }), /HTTP 503/)
 const pending = new AbortController(), opaque = { pending: PROFILE.source }
 const task = runCurrentNative({signal: pending.signal, fetchImpl: () => new Promise(() => {})})
 setTimeout(() => pending.abort(opaque), 10)
 await assert.rejects(task, error => error === opaque)
})


test('closing role criteria changes and original closing HTTP errors retain the company hold', async () => {
 for (const status of [200, 503]) {
  const counts = new Map()
  await assert.rejects(runCurrentNative({ now: () => '2026-11-19T18:00:00Z', fetchImpl: async url => {
   const row = pages.get(url); assert.ok(row)
   const count = (counts.get(url) ?? 0) + 1; counts.set(url, count)
   if (url === first().sourceUrl && count === 2) return response(row, row.body.replaceAll('team', 'TEAM'), status)
   return response(row)
  } }), status === 503 ? /HTTP 503/ : /Closing native role/)
 }
})

test('native location tuples and added country or expiry authorities cannot contradict the original role', () => {
 const row = first(), html = original()
 const bodies = [html.replace(/(name="gtm_tbcn_location" content=")[^"]+/, '$1Hyderabad~Telangana~United States|Hyderabad~Telangana~India'),
  html.replace('</head>', '<meta itemprop="validThrough" content="2026-11-18"></head>'),
  html.replace('data-selector-name="jobdetails"', 'onmouseover="location.href=location.href" data-selector-name="jobdetails"')]
 for (const body of bodies) assert.throws(() => parseCurrentRole(body, row, '2026-11-19T18:00:00Z'))
})


test('ordinary production invocation uses the real global transport without a fixture callback option', async () => {
 const saved = globalThis.fetch, urls = []
 globalThis.fetch = async (url, init) => { urls.push(url); assert.equal(init.method, 'GET'); return response({url,status:503,headers:{'content-type':'text/html'},body:'Unavailable'}) }
 try { await assert.rejects(runCurrentNative(), /HTTP 503/); assert.equal(urls.length, 1) }
 finally { globalThis.fetch = saved }
})


test('new critical presentation classes cannot silently qualify full criteria or native application identity', () => {
 const row = first(), html = original()
 const hiddenCriteria = parseCurrentRole(html.replace('class="ats-description"', 'class="ats-description d-none"'), row, '2026-11-19T18:00:00Z')
 assert.equal(hiddenCriteria.sourceDetailComplete, false)
 assert.throws(() => parseCurrentRole(html.replace(/<section\b[^>]*data-selector-name="jobdetails"[^>]*>/, opening => opening.replace('class="', 'class="d-none ')), row, '2026-11-19T18:00:00Z'))
})
