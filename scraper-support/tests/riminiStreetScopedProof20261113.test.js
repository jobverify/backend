import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { workdayRequestScheduler } from '../myworkday/requestScheduler.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'

const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL(
  './fixtures/riminiStreetScopedProof20261113/capture.json.gz', import.meta.url))))
const packets = Object.fromEntries(capture.captures.map(packet => {
  const body = Buffer.from(packet.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(body).digest('hex'), packet.sha256)
  assert.equal(body.length, packet.receipt.bytes)
  return [packet.label, { ...packet.receipt, body }]
}))
const listingRows = JSON.parse(packets.listing.body).jobPostings
const indiaDetail = JSON.parse(packets['india-detail'].body)
const foreignDetail = JSON.parse(packets['foreign-detail'].body)
const selectedRows = [foreignDetail, indiaDetail].map(({ jobPostingInfo: info }) => listingRows.find(row =>
  row.externalPath === new URL(info.externalUrl).pathname.split('/RiminiStreet')[1]))
assert.ok(selectedRows.every(Boolean))
const provider = getScraperCatalog().find(row => row.source === 'riministreet')
assert.ok(provider)
const board = 'https://riministreet.wd1.myworkdayjobs.com/RiminiStreet'
const api = 'https://riministreet.wd1.myworkdayjobs.com/wday/cxs/riministreet/RiminiStreet/jobs'
const proofKey = Symbol.for('jobverify.workday.country-inventory-proof')
const snapshot = indices => ({ total: indices.length, jobPostings: indices.map(index => structuredClone(selectedRows[index])), facets: [] })

// Exact native rows, countries, criteria and handoffs in a SYNTHETIC two-role
// projection. Only separately captured live runs establish current company yield.
const exercise = async (t, options = {}) => {
  const calls = [], snapshots = options.snapshots || [snapshot(options.foreignOnly ? [0] : [0, 1]), snapshot(options.foreignOnly ? [0] : [0, 1])]
  let posts = 0, corporateReads = 0
  t.mock.method(workdayRequestScheduler, 'acquire', async () => () => {})
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input), method = init.method || 'GET'
    calls.push({ url, method })
    let response
    if (url === packets.corporate.requestedUrl) {
      corporateReads++
      response = new Response(packets.corporate.body, { status: options.corporateDenied ? 403 : 200,
        headers: { 'content-type': 'text/html' } })
    } else if (url === board || url.startsWith(board + '?')) {
      response = new Response(packets.bootstrap.body, { headers: { 'content-type': 'text/html' } })
    } else if (method === 'POST') {
      assert.equal(url, api)
      assert.deepEqual(JSON.parse(init.body), { appliedFacets: {}, limit: 20, offset: 0, searchText: '' },
        'A missing native country facet cannot silently authorize an India-filtered inventory')
      assert.ok(posts < snapshots.length, 'Only bounded native snapshots may be read')
      response = Response.json(snapshots[posts++])
    } else {
      const packet = [packets['foreign-detail'], packets['india-detail']].find(packet => packet.requestedUrl === url)
      assert.ok(packet, 'Uncaptured request is prohibited: ' + url)
      const payload = JSON.parse(packet.body)
      if (packet === packets['india-detail']) options.changeIndia?.(payload.jobPostingInfo)
      else options.changeForeign?.(payload.jobPostingInfo)
      response = Response.json(payload)
    }
    Object.defineProperty(response, 'url', { value: url })
    return response
  })
  let jobs, error
  try { jobs = await createCatalogScraper(provider).run({ signal: options.signal }) }
  catch (failure) { error = failure }
  return { jobs, error, calls, posts, corporateReads,
    assessment: jobs ? assessSoftFailureAcquisition(provider, jobs) : null }
}

test('registered Rimini Street retains full native India roles while representing the unresolved Pleasanton office', async t => {
  const result = await exercise(t)
  assert.ifError(result.error)
  assert.deepEqual(result.jobs.map(job => job.requisitionId), ['R-102480'])
  const [job] = result.jobs
  assert.equal(job.title, 'Support Engineer, FCUBE Techno-Functional')
  assert.equal(job.sourceDetailComplete, true)
  // The registered decorator stores plain text. Compare every authored word
  // independently of the production HTML-to-text helper, allowing whitespace.
  const authoredWords = indiaDetail.jobPostingInfo.jobDescription.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  assert.equal(job.sourceDescription.replace(/\s+/g, ' ').trim(), authoredWords)
  assert.equal(job.sourceRawDates.startDate, '2026-11-10')
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.sourceListingComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
  const proof = result.jobs[proofKey]
  assert.equal(proof.initial.count, 2)
  assert.equal(proof.closing.count, 2)
  assert.equal(proof.initial.sha256, proof.closing.sha256)
  assert.equal(proof.unresolvedRoles.length, 1)
  assert.equal(proof.unresolvedRoles[0].requisitionId, 'R-102512')
  assert.ok(proof.unresolvedRoles[0].locations.includes('Pleasanton'))
  assert.equal(readInventoryEvidence(result.jobs).status, 'coverage-gap')
  assert.equal(result.assessment.rawJobs, 1)
  assert.equal(result.assessment.eligibleJobs, 1)
  assert.equal(result.assessment.zeroJobEvidence, null)
  assert.equal(result.assessment.runnerOutcome.success, true)
  assert.deepEqual(result.assessment.cleanupOptions, { replaceExisting: false })
  assert.equal(result.corporateReads, 2, 'Both the source wrapper and engine acquire current corporate evidence')
})

test('Rimini Street does not turn an unresolved foreign-only projection into an accepted empty inventory', async t => {
  const result = await exercise(t, { foreignOnly: true })
  assert.ifError(result.error)
  assert.equal(result.jobs.length, 0)
  assert.equal(result.assessment.zeroJobEvidence, 'coverage-gap')
  assert.equal(result.assessment.runnerOutcome.success, false)
  assert.deepEqual(result.assessment.cleanupOptions, { replaceExisting: false })
})

test('Rimini Street partial proof still rejects contradictory current native countries', async t => {
  const result = await exercise(t, { changeIndia: info => {
    info.country = { ...info.country, descriptor: 'United States of America', alpha2Code: 'US' }
  } })
  assert.equal(result.error?.code, 'WORKDAY_NATIVE_COUNTRY_MISMATCH')
  assert.equal(result.jobs, undefined)
})

test('Rimini Street partial proof still rejects another role or tenant supplying the India criteria', async t => {
  const result = await exercise(t, { changeIndia: info => { info.externalUrl = info.externalUrl.replace('riministreet.', 'other-tenant.') } })
  assert.equal(result.error?.name, 'WorkdayIncompleteScopeError')
  assert.equal(result.jobs, undefined)
})

test('Rimini Street requires a successful current corporate handoff even when the Workday board is reachable', async t => {
  const result = await exercise(t, { corporateDenied: true })
  assert.ok(result.error)
  assert.equal(result.posts, 0)
  assert.equal(result.jobs, undefined)
})

test('Rimini Street partial India observations still reject two drifting closing cohorts', async t => {
  const result = await exercise(t, { snapshots: [snapshot([0, 1]), snapshot([0]), snapshot([0, 1]), snapshot([0])] })
  assert.equal(result.error?.code, 'WORKDAY_INVENTORY_CHANGED')
  assert.equal(result.posts, 4)
  assert.equal(result.jobs, undefined)
})

test('Rimini Street returns a pre-aborted caller reason before public requests', async t => {
  const controller = new AbortController(), reason = Object.freeze({ caller: 'rimini-country-proof' })
  controller.abort(reason)
  const result = await exercise(t, { signal: controller.signal })
  assert.equal(result.error, reason)
  assert.equal(result.calls.length, 0)
})
