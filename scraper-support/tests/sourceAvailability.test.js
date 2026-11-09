import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { parseDetail } from '../../scraper/enphaseenergy.workday/native.js'
import { inspectSearch, parsePage, parseDetail as parseDisneyDetail } from '../../scraper/disney.workday/nativeContract.js'
import * as availability from '../utils/sourceAvailability.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/enphaseenergy.workday/fixtures/native-002.json.gz', import.meta.url))))
const row = fixture.receipts.filter(r => r.kind.startsWith('listing-page-')).flatMap(r => JSON.parse(r.storedBodyUTF8).rows).find(r => r.jid === 'o9tUAfwQ')
const actualHtml = fixture.receipts.find(r => r.kind === 'india-detail-' + row.jid).storedBodyUTF8
const now = '2026-10-25T08:00:00.000Z'
const closedHtml = actualHtml.replace('<div class="jobvite-detail__intro">', '<div class="jobvite-detail__intro"><p>This position is closed.</p>')
const raw = (html = closedHtml) => parseDetail(html, structuredClone(row), { now })
const evidenceJob = (html = closedHtml, state = 'closed', observedAt = now, nativeStatus = null) => {
  const job = raw(html)
  job.sourceAvailabilityEvidence = availability.createNativeRoleAvailability(job, { state, observedAt, evidenceHtml: html, nativeStatus })
  return job
}

test('actual Enphase identity with synthetically closed native header emits verifiable role-scoped evidence', () => {
  const job = evidenceJob(), fact = availability.readNativeRoleAvailability(job)
  assert.equal(fact.state, 'closed')
  assert.equal(fact.validated, true)
  assert.equal(fact.jobId, 'o9tUAfwQ')
  assert.equal(fact.canonicalUrl, 'https://enphase.com/job/o9tUAfwQ')
  assert.equal(fact.notice, 'This position is closed.')
  assert.equal(fact.observedAt, now)
  assert.equal(fact.evidenceHtml, closedHtml)
  assert.equal(availability.isFreshNativeAvailability(fact, new Date(now)), true)
  assert.equal(job.closingDate, null)
})

test('validated explicit closure is filtered before publication age and does not become a new insertion candidate', () => {
  const job = { ...evidenceJob(), postingDate: '2026-01-01' }, metrics = analyzePublishableJobs([job], { now: new Date(now) })
  assert.equal(metrics.eligibleJobs.length, 0)
  assert.equal(metrics.filterCounts.closed, 1)
  assert.equal(metrics.filterCounts.old, 0)
})

test('missing/inert/unavailable-only native detail remains availability unknown', () => {
  const ordinary = raw(actualHtml)
  delete ordinary.sourceAvailabilityEvidence
  ordinary.sourceDetailComplete = false; ordinary.sourceDescription = null; ordinary.jobDescription = null
  ordinary.sourceDetailStatus = 'native-description-missing'
  assert.equal(availability.readNativeRoleAvailability(ordinary), null)
  assert.equal(analyzePublishableJobs([ordinary], { now: new Date(now) }).eligibleJobs.length, 1)
  for (const notice of ['<p hidden>This position is closed.</p>', '<p inert>This position is closed.</p>', '<template><p>This position is closed.</p></template>',
    '<p>If this position is closed, please browse other vacancies.</p>']) {
    const html = actualHtml.replace('<div class="jobvite-detail__intro">', '<div class="jobvite-detail__intro">' + notice) + '<footer>This position is closed.</footer>'
    assert.throws(() => evidenceJob(html), /availability/i)
  }
})

test('availability proof is bound to native source, role, title, employer and exact canonical snapshot', () => {
  for (const change of [x => { x.source = 'other' }, x => { x.jobId = 'other' }, x => { x.title = 'Other role' },
    x => { x.company = 'Other employer' }, x => { x.sourceUrl = 'https://enphase.com/job/other' },
    x => { x.sourceAvailabilityEvidence.evidenceHtml = actualHtml }, x => { x.sourceAvailabilityEvidence.observedAt = 'bad date' }]) {
    const job = evidenceJob(); change(job)
    const fact = availability.readNativeRoleAvailability(job)
    assert.equal(fact?.validated, false)
    assert.notEqual(fact?.state, 'closed')
  }
})

test('freshness rejects future and older-than48h proof without manufacturing a closure time', () => {
  const fact = availability.readNativeRoleAvailability(evidenceJob())
  assert.equal(availability.isFreshNativeAvailability(fact, new Date('2026-10-27T08:00:00.000Z')), true)
  assert.equal(availability.isFreshNativeAvailability(fact, new Date('2026-10-27T08:00:00.001Z')), false)
  assert.equal(availability.isFreshNativeAvailability(fact, new Date('2026-10-25T07:59:59.999Z')), false)
  assert.equal(Object.hasOwn(fact, 'closedAt'), false)
})

test('authoritative native CXS open flags contradict a closed notice and produce unavailable evidence', () => {
  const job = evidenceJob(closedHtml, 'closed', now, { kind: 'workday-cxs-jobPostingInfo', posted: true, canApply: true })
  const fact = availability.readNativeRoleAvailability(job)
  assert.equal(fact.state, 'unavailable')
  assert.equal(fact.validated, true)
  const metrics = analyzePublishableJobs([job], { now: new Date(now) })
  assert.equal(metrics.eligibleJobs.length, 0)
  assert.equal(metrics.filterCounts.closed, 0)
  assert.equal(metrics.filterCounts.unavailable, 1)
})

test('a real complete native role can emit a positive open observation independently of processing clocks', () => {
  const job = evidenceJob(actualHtml, 'open')
  assert.equal(availability.readNativeRoleAvailability(job).state, 'open')
  assert.equal(availability.readNativeRoleAvailability(job).observedAt, now)
})

const disneyFixture = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/disney.workday/fixtures/current-radancy-41.json.gz', import.meta.url))))
const disneyScope = inspectSearch(disneyFixture.records[0].body)
const disneyRow = parsePage(disneyFixture.records[1].body, { scope: disneyScope, page: 1, now }).rows[0]
const disneyHtml = disneyFixture.records.find(packet => packet.url === disneyRow.url).body
const disneyOpen = () => parseDisneyDetail(disneyHtml, structuredClone(disneyRow), now)

for (const [name, mutate] of [
  ['requisition', job => { job.jobId = '99999999'; job.nativeRequisitionId = job.jobId }],
  ['legal employer', job => { job.nativeLegalEmployer = 'Lucasfilm Visual Effects (India) Private Limited' }],
  ['posting brand', job => { job.nativePostingBrand = 'A different Disney brand' }],
]) test('Disney availability factory and rebuild bind supplied ' + name + ' to the actual native snapshot', () => {
  const job = disneyOpen(); mutate(job)
  assert.throws(() => availability.createNativeRoleAvailability(job, { state: 'open', observedAt: now, evidenceHtml: disneyHtml }), /availability/i)
  const proof = structuredClone(job.sourceAvailabilityEvidence)
  if (name === 'requisition') proof.jobId = job.jobId
  if (name === 'legal employer') proof.employer = job.nativeLegalEmployer
  if (name === 'posting brand') proof.nativePostingBrand = job.nativePostingBrand
  job.sourceAvailabilityEvidence = proof
  assert.equal(availability.readNativeRoleAvailability(job).validated, false)
})

for (const [name, mutate] of [
  ['organization', body => body.replace('data-org-id="391"', 'data-org-id="999"')],
  ['header native role', body => body.replace('data-job-id="' + disneyRow.id + '"', 'data-job-id="999999999"')],
  ['header requisition', body => body.replace('data-tm-job-id="' + disneyRow.req + '"', 'data-tm-job-id="99999999"')],
  ['description requisition', body => { const start = body.indexOf('id="job-details-3"'); return body.slice(0, start) + body.slice(start).replace('data-tm-job-id="' + disneyRow.req + '"', 'data-tm-job-id="99999999"') }],
  ['native requisition metadata', body => body.replace('name="job-ats-req-id" content="' + disneyRow.req + '"', 'name="job-ats-req-id" content="99999999"')],
  ['native employer metadata', body => body.replace(/(name="gtm_tbcn_division" content=")[^"]*"/, '$1999,Wrong employer"')],
]) test('Disney availability rejects contradictory ' + name + ' without relying on a snapshot hash mismatch', () => {
  const job = disneyOpen(), body = mutate(disneyHtml)
  assert.notEqual(body, disneyHtml, 'Adverse native metadata mutation must change the captured packet')
  assert.throws(() => availability.createNativeRoleAvailability(job, { state: 'open', observedAt: now, evidenceHtml: body }), /availability/i)
})
