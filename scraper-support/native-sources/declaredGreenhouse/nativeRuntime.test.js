import assert from 'node:assert/strict'
import test from 'node:test'
import * as eqt from '../../../scraper/eqtcorporation.workday/script.js'
import {createNativeGreenhouseScraper,NATIVE_GREENHOUSE_PROFILES} from './nativeCareers.js'
// Archived API controls retain their exact original engine and corpus; the
// expanded current registered source has separate original hosted-page checks.
const doximity=createNativeGreenhouseScraper(NATIVE_GREENHOUSE_PROFILES.doximity)
import { fixture, replay } from './fixtureReplay.js'
import { readInventoryEvidence } from '../../utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../utils/sourceObservationEvidence.js'

globalThis.fetch = async () => { throw Error('Artificial transport controls prohibit all real network') }
const source = 'eqtcorporation', profile = fixture.profiles[source], first = fixture.oracle[source].records[0]
const feed = profile.publicAPIBase + '/jobs?content=true', own = profile.publicAPIBase + '/jobs/' + first.postId + '?pay_transparency=true'
const jsonChange = (page, change) => {
  const value = JSON.parse(Buffer.from(page.bodyBase64, 'base64').toString('utf8'));change(value)
  return { ...page, bodyBase64: Buffer.from(JSON.stringify(value)).toString('base64') }
}

test('artificial closing own-post failure retains the complete earlier model and holds only that candidate', async () => {
  const r = replay((url, page, visit) => url === own && visit === 2 ? { ...page, status: 503 } : page)
  const jobs = await eqt.run(r.options), audit = r.audits[0], held = audit.observations.find(job => job.jobId === String(first.postId))
  assert.equal(held.sourceCurrentNativeRoleQualified, false);assert.ok(held.jobDescription)
  assert.deepEqual(held.sourceNativeRecord, first.nativeOwnPostRecord)
  assert.ok(held.sourceNativeClosingObservation.sourceNativeIssues.length)
  assert.ok(!jobs.some(job => job.jobId === held.jobId));assert.equal(audit.observations.length, 65)
})

for (const field of ['internal_job_id', 'absolute_url']) test('artificial coherent changed closing ' + field + ' retains both snapshots and holds temporal identity', async () => {
  const change = row => { row[field] = field === 'internal_job_id' ? row.internal_job_id + 1 : row.absolute_url.replace('job-boards.greenhouse.io', 'boards.greenhouse.io') }
  const r = replay((url, page, visit) => visit !== 2 ? page : url === own ? jsonChange(page, change)
    : url === feed ? jsonChange(page, body => change(body.jobs.find(row => row.id === first.postId))) : page)
  const jobs = await eqt.run(r.options), audit = r.audits[0], held = audit.observations.find(job => job.jobId === String(first.postId))
  assert.equal(held.sourceCurrentNativeRoleQualified, false);assert.match(held.sourceNativeTemporalQualification, /identity|handoff/)
  const pair = audit.observationHistory.find(item => item.postId === first.postId)
  assert.ok(pair.earlier.jobDescription && pair.current.jobDescription)
  assert.notDeepEqual(pair.earlier.sourceNativeRecord[field], pair.current.sourceNativeRecord[field])
  assert.ok(!jobs.some(job => job.jobId === held.jobId))
})

test('artificial recovered closing company declaration requalifies paired original native records', async () => {
  const html = '<html><head><title>Unqualified current page</title></head><body>Nothing advertised</body></html>'
  const r = replay((url, page, visit) => url === profile.primaryURL && visit === 1 ? { ...page, bodyBase64: Buffer.from(html).toString('base64') } : page)
  const jobs = await eqt.run(r.options), audit = r.audits[0]
  assert.equal(audit.opening.publisherQualified, false);assert.equal(audit.closing.publisherQualified, true)
  assert.ok(audit.observations.every(job => job.sourceCurrentNativeRoleQualified))
  assert.ok(jobs.length > 0);assert.equal(audit.sourceScopeComplete, false)
})

test('artificial closing employer declaration loss preserves all records without current candidate promotion', async () => {
  const r = replay((url, page, visit) => url === profile.primaryURL && visit === 2 ? { ...page, bodyBase64: Buffer.from('<title>Other page</title>').toString('base64') } : page)
  const jobs = await eqt.run(r.options), audit = r.audits[0]
  assert.equal(jobs.length, 0);assert.equal(audit.observations.length, 65)
  assert.ok(audit.observations.every(job => job.jobDescription && !job.sourceCurrentNativeRoleQualified))
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
})

test('artificial result cap and out-of-order requests never change full audit or native prefix order', async () => {
  const run = async delayed => {
    const r = replay(async (url, page) => { if (delayed && url === own) await new Promise(resolve => setTimeout(resolve, 50));return page })
    return { jobs: await eqt.run({ ...r.options, maxJobs: 1 }), audit: r.audits[0] }
  }
  const a = await run(false), b = await run(true), ids = fixture.oracle[source].records.map(row => String(row.postId))
  assert.equal(a.jobs.length, 1);assert.equal(b.jobs.length, 1);assert.equal(a.jobs[0].jobId, b.jobs[0].jobId)
  for (const result of [a, b]) {
    assert.deepEqual(result.audit.observations.map(job => job.jobId), ids)
    assert.deepEqual(result.audit.observationHistory.map(pair => String(pair.postId)), ids)
  }
})

test('awaited audit rejection and cancellation propagate without unretained background work', async () => {
  const r = replay()
  await assert.rejects(eqt.run({ ...r.options, onAudit: async () => { throw Error('audit failed') } }), /audit failed/)
  const controller = new AbortController();controller.abort(Error('control cancelled'))
  const cancelled = replay()
  await assert.rejects(eqt.run({ ...cancelled.options, signal: controller.signal }), /control cancelled/)
  assert.equal(cancelled.requests.length, 0)
})

test('artificial 403 on a native host stops further requests to that host and cannot become a source zero', async () => {
  const r = replay((url, page) => url === profile.publicAPIBase ? { ...page, status: 403 } : page)
  const jobs = await eqt.run(r.options)
  assert.equal(r.requests.filter(url => new URL(url).hostname === 'boards-api.greenhouse.io').length, 1)
  assert.equal(jobs.length, 0);assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('artificial non-executable native embed script is data and cannot delegate an employer board', async () => {
  const p = fixture.profiles.doximity, r = replay((url, page) => {
    if (url !== p.primaryURL) return page
    const body = Buffer.from(page.bodyBase64, 'base64').toString('utf8')
    const changed = body.replace(/<script\b[^>]*src="https:\/\/boards\.greenhouse\.io\/embed\/job_board\/js\?for=doximity"[^>]*>/,
      '<script type="application/json" src="https://boards.greenhouse.io/embed/job_board/js?for=doximity">')
    assert.notEqual(changed, body)
    return { ...page, bodyBase64: Buffer.from(changed).toString('base64') }
  })
  const jobs = await doximity.run(r.options)
  assert.equal(r.audits[0].closing.publisherQualified, false);assert.equal(jobs.length, 0)
  assert.equal(r.audits[0].observations.length, 11)
})

test('artificial incomplete native count retains supported post positives without authorizing totals or cleanup', async () => {
  const r = replay((url, page) => url === feed ? jsonChange(page, data => { data.meta.total += 1 }) : page)
  const jobs = await eqt.run(r.options), audit = r.audits[0]
  assert.equal(audit.closing.nativeListingComplete, false);assert.equal(audit.observations.length, 65)
  assert.ok(jobs.length > 0);assert.equal(audit.authoritativeSourceTotal, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false);assert.equal(audit.lifecycleCleanupAllowed, false)
})

test('artificial absent native post kind is unresolved and cannot invent a vacancy count', async () => {
  const r = replay((url, page) => url === own ? jsonChange(page, row => { delete row.internal_job_id })
    : url === feed ? jsonChange(page, body => { delete body.jobs.find(row => row.id === first.postId).internal_job_id }) : page)
  const jobs = await eqt.run(r.options), held = r.audits[0].observations.find(job => job.jobId === String(first.postId))
  assert.equal(held.sourceNativePostKind, 'unresolved');assert.equal(held.sourceCurrentNativeRoleQualified, false)
  assert.equal(readSourceObservationEvidence(jobs, source).observedVacancyCount, 63)
})

test('artificial explicit failed native envelope cannot qualify merely because HTTP and matching company fields are present', async () => {
  const r = replay((url, page) => url === profile.publicAPIBase ? jsonChange(page, body => { body.status = 'error' }) : page)
  const jobs = await eqt.run(r.options)
  assert.equal(r.audits[0].closing.publisherQualified, false);assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
})
