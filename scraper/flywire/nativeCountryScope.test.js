import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parseNativeDetail, parseIndiaPage, parseBinding } from './native.js'

const fixture = JSON.parse(readFileSync(new URL('./test-data/2026-10-31-jr1070.json', import.meta.url), 'utf8'))
const NOW = '2026-10-31T06:00:00.000Z'
const native = (change = () => {}, row = fixture.row) => {
  const payload = structuredClone(fixture.payload)
  change(payload.jobPostingInfo, payload)
  return parseNativeDetail(JSON.stringify(payload), row, { now: NOW })
}
const mutateLD = change => fixture.html.replace(/(<script\b[^>]*application\/ld\+json[^>]*>)([\s\S]*?)(<\/script>)/gi, (all, open, body, close) => {
  const value = JSON.parse(body)
  if (value['@type'] === 'JobPosting') change(value)
  return open + JSON.stringify(value) + close
})

test('Flywire keeps native India country scope, public Bangalore location and Hybrid mode as separate evidence', () => {
  const job = parseIndiaPage(fixture.html, native(), { now: NOW })
  assert.equal(job.country, 'India')
  assert.equal(job.city, 'Bangalore')
  assert.equal(job.location, 'Bangalore, India')
  assert.equal(job.nativeRequisitionLocationOriginal.descriptor, 'India, Remote')
  assert.equal(job.nativeRemoteTypeOriginal, 'Hybrid')
  assert.equal(job.nativeStructuredJobPosting.jobLocation.address.addressLocality, 'India, Remote')
  assert.equal(job.sourceWorkplaceEvidence.kind, 'native-india-country-scope')
  assert.equal(job.sourceWorkplaceEvidence.workArrangementQualified, false)
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.originalPublicationDateQualified, false)
  assert.equal(job.applicationAccessValidated, false)
})

test('Flywire accepts the same country-scoped format on another valid role without any role-ID exception', () => {
  const payload = structuredClone(fixture.payload), row = structuredClone(fixture.row)
  row.title = 'Relationship Associate II'
  row.bulletFields = ['JR-2099']
  row.externalPath = row.externalPath.replaceAll('JR-1070', 'JR-2099')
  payload.jobPostingInfo.title = row.title
  payload.jobPostingInfo.jobReqId = 'JR-2099'
  payload.jobPostingInfo.jobPostingId = payload.jobPostingInfo.jobPostingId.replaceAll('JR-1070', 'JR-2099')
  payload.jobPostingInfo.externalUrl = payload.jobPostingInfo.externalUrl.replaceAll('JR-1070', 'JR-2099')
  const parsed = parseNativeDetail(JSON.stringify(payload), row, { now: NOW })
  assert.equal(parsed.india, true)
  assert.equal(parsed.info.jobReqId, 'JR-2099')
})

for (const place of ['London, United Kingdom', 'New York, United States, India', 'Unknown City, India']) test('Flywire refuses country-scoped requisitions with an unqualified public location ' + place, () => {
  assert.throws(() => native(info => { info.location = place }), /country\/location|location mismatch/)
})

test('Flywire still rejects different specific native cities rather than treating all India cities as equivalent', () => {
  assert.throws(() => native(info => { info.jobRequisitionLocation.descriptor = 'Mumbai' }), /country\/location/)
})

test('Flywire preserves typed-country and secondary-country contradictions', () => {
  assert.throws(() => native(info => { info.jobRequisitionLocation.country.alpha2Code = 'US' }), /country code|ISO/)
  assert.throws(() => native(info => { info.additionalLocations = [{ descriptor: 'Mumbai', country: { descriptor: 'United States of America', id: 'bc33aa3152ec42d4995f4791a106ed09', alpha2Code: 'US' } }] }), /secondary country/)
})

test('Flywire rejects a different concrete HTML city even when the requisition is country-scoped', () => {
  assert.throws(() => parseIndiaPage(mutateLD(job => { job.jobLocation.address.addressLocality = 'Mumbai' }), native(), { now: NOW }), /HTML typed India geography/)
})

test('Flywire cannot use a hidden or duplicate native JobPosting to prove the country-scoped workplace', () => {
  const block = fixture.html.match(/<script\b[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/i)[0]
  assert.throws(() => parseIndiaPage(fixture.html.replace(block, '<template>' + block + '</template>'), native(), { now: NOW }), /Missing or ambiguous native JobPosting/)
  assert.throws(() => parseIndiaPage(fixture.html.replace(block, block + block), native(), { now: NOW }), /Missing or ambiguous native JobPosting/)
})

test('Flywire country scope does not bypass native role identity or active-state checks', () => {
  assert.throws(() => native(info => { info.jobReqId = 'JR-9999' }), /title\/requisition\/board/)
  assert.throws(() => native(info => { info.canApply = false }), /closed|application status/)
})
