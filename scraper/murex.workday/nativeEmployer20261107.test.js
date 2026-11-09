import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import * as source from './script.js'
import { remainingRecruitmentBatchProvider } from '../../scraper-support/utils/remainingRecruitmentBatch20261103.js'
import { recruitmentEmployerMatches, RECRUITMENT_OBSERVATIONS } from '../../scraper-support/utils/verifiedRecruitment.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { classifyScraperError } from '../../scraper-support/utils/failureClassification.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261107/current-native-employer.json.gz', import.meta.url))))
const employer = 'MIND Murex India Solutions Private Limited'
const sha = body => createHash('sha256').update(body).digest('hex')
const profile = { ...remainingRecruitmentBatchProvider('murex'), nativeEmployerNames: [employer], requireNativeEmployerName: true }
const snapshot = (jobs, requests) => ({ jobs: JSON.parse(JSON.stringify(jobs)), audit: jobs[RECRUITMENT_OBSERVATIONS],
  inventory: readInventoryEvidence(jobs), observations: readSourceObservationEvidence(jobs, 'murex'), requests })

test.beforeEach(t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Offline tests forbid external HTTP'))
})

// This is a controlled source-parser workflow, not a default or live capture:
// the unretained homepage has an explicit synthetic unavailable failure,
// maxPages is two, and the observation clock is fixed. Four successful response
// bodies are exact original public bytes. Reader init is asserted separately
// from the different original wire diagnostic init, which remains in fixture.
const replay = async ({ mutateDetail, mutateCorporate, denyAll, signal, abortOnRequest } = {}) => {
  let sequence = 0
  const requests = []
  const jobs = await source.run({ maxPages: 2, now: () => fixture.observedAt, signal,
    fetchImpl: async (url, init) => {
      const method = init.method ?? 'GET', body = init.body ?? null
      requests.push({ url, method, body, redirect: init.redirect, credentials: init.credentials, headers: init.headers })
      assert.equal(init.credentials, 'omit')
      assert.equal(init.headers['User-Agent'], 'Mozilla/5.0 (compatible; Jobverify careers inventory check)')
      assert.ok(init.signal instanceof AbortSignal)
      if (abortOnRequest) { abortOnRequest(); init.signal.throwIfAborted() }
      if (denyAll) {
        assert.ok([fixture.unretainedHomepage.url, fixture.packets[0].request.url].includes(url))
        const response = new Response('<h1>Denied</h1>', { status: 403, headers: { 'content-type': 'text/html' } })
        Object.defineProperty(response, 'url', { value: url })
        return response
      }
      if (url === fixture.unretainedHomepage.url) {
        assert.equal(sequence++, 0)
        throw Error(fixture.unretainedHomepage.message)
      }
      const packet = fixture.packets[sequence - 1]
      assert.ok(packet, 'Unexpected read beyond retained controlled workflow')
      assert.equal(url, packet.request.url)
      assert.equal(method, packet.request.method)
      assert.equal(body, packet.request.body)
      assert.equal(init.redirect, packet.response.mime.startsWith('text/html') ? 'follow' : 'error')
      assert.equal(init.headers.Accept, packet.response.mime.startsWith('text/html') ? 'text/html' : 'application/json')
      if (method === 'POST') assert.equal(init.headers['Content-Type'], 'application/json')
      const original = Buffer.from(packet.response.bodyBase64, 'base64')
      assert.equal(sha(original), packet.response.sha256)
      let bytes = original
      if (sequence === 1 && mutateCorporate) bytes = Buffer.from(mutateCorporate(original.toString('utf8')))
      if (sequence === 4 && mutateDetail) {
        const detail = JSON.parse(original.toString('utf8'))
        mutateDetail(detail)
        bytes = Buffer.from(JSON.stringify(detail))
      }
      sequence++
      const response = new Response(bytes, { status: packet.response.status, headers: packet.response.headers })
      Object.defineProperty(response, 'url', { value: packet.response.finalURL })
      return response
    } })
  if (!mutateCorporate) assert.equal(sequence, 5)
  return { jobs, output: snapshot(jobs, requests) }
}

test('portable inputs retain four genuine public bodies and explicitly controlled transport/clock boundaries', () => {
  assert.equal(fixture.packets.length, 4)
  assert.equal(fixture.packets.reduce((n, packet) => n + packet.response.bytes, 0), 84659)
  for (const packet of fixture.packets) {
    const body = Buffer.from(packet.response.bodyBase64, 'base64')
    assert.equal(sha(body), packet.response.sha256)
    assert.equal(body.length, packet.response.bytes)
    assert.equal(packet.response.status, 200)
    assert.equal(packet.originalReceipt.bodySHA256, packet.response.sha256)
    assert.equal(packet.originalReceipt.authOrCookieReuse, false)
  }
  assert.equal(fixture.unretainedHomepage.synthetic, true)
  assert.equal(fixture.options.maxPages, 2)
  assert.match(fixture.qualification, /not a full default\/live workflow/)
})

test('real wrapper admits the same-role native organization with entire controlled output parity', async () => {
  const { output } = await replay()
  assert.equal(output.jobs.length, 1)
  assert.deepEqual(output, fixture.expectedAfter)
  assert.equal(JSON.stringify(output), JSON.stringify(fixture.expectedAfter))
})

test('accepted role preserves exact native legal label, full criteria, typed country, source dates and partial failures', async () => {
  const { jobs, output } = await replay()
  assert.equal(jobs.length, 1)
  const native = JSON.parse(Buffer.from(fixture.packets[3].response.bodyBase64, 'base64').toString('utf8'))
  assert.equal(jobs[0].company, 'Murex')
  assert.deepEqual(jobs[0].nativeHiringOrganization, native.hiringOrganization)
  assert.equal(jobs[0].nativeHiringOrganization.name, employer)
  assert.deepEqual(jobs[0].nativeSourceRecord, native)
  assert.equal(jobs[0].sourceDescription, native.jobPostingInfo.jobDescription)
  assert.equal(jobs[0].postingDate, native.jobPostingInfo.startDate)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(jobs[0].applicationVisited, false)
  assert.equal(output.inventory.status, 'coverage-gap')
  assert.equal(output.inventory.listingComplete, false)
  assert.equal(output.inventory.reportedTotal, null)
  assert.equal(output.audit.failures.length, 1)
  assert.match(output.audit.failures[0].message, /CONTROLLED_UNRETAINED_HOMEPAGE_UNAVAILABLE/)
  assert.equal(output.audit.sourceScopeComplete, false)
  assert.equal(output.audit.lifecycleCleanupAllowed, false)
  assert.equal(output.observations.observedVacancyCount, 20)
  assert.equal(output.observations.companyGlobalTotal, null)
})

test('source exports and provider/catalog configuration retain their prior contract', () => {
  assert.equal(source.SOURCE, 'murex')
  assert.equal(source.COMPANY, 'Murex')
  assert.equal(source.CAREERS_URL, 'https://www.murex.com/en/careers/overview')
  assert.equal(source.DISPOSITION, 'runtime-verified-recruitment')
  assert.equal(source.VERIFIED_ON, null)
  const provider = remainingRecruitmentBatchProvider('murex')
  assert.equal(provider.nativeEmployerNames, undefined)
  assert.equal(provider.requireNativeEmployerName, false)
  assert.equal(provider.prioritizeRecruitmentSearch, true)
  assert.equal(provider.preferIndiaInventory, true)
  assert.equal(provider.searchIndiaWithoutFacet, true)
  assert.equal(provider.lifecycleCleanupAllowed, false)
})

for (const [name, expected] of [[employer, true], ['Murex', true], ['MIND Murex India Solutions', false],
  ['Murex India Solutions Private Limited', false], ['MIND Murex United States Solutions Private Limited', false],
  ['Unrelated Murex Company', false], ['Unrelated Private Limited', false], ['', false]]) {
  test('finite strict shared matcher control: ' + (name || '(empty)'), () => {
    assert.equal(recruitmentEmployerMatches(profile, name), expected)
  })
}
for (const name of ['MIND Murex India Solutions', 'Murex India Solutions Private Limited',
  'MIND Murex United States Solutions Private Limited', 'Unrelated Murex Company', 'Unrelated Private Limited', '']) {
  test('actual wrapper rejects unapproved or near native organization: ' + (name || '(empty)'), async () => {
    const { jobs, output } = await replay({ mutateDetail: detail => { detail.hiringOrganization.name = name } })
    assert.equal(jobs.length, 0)
    assert.ok(output.audit.unresolved.includes('native-employer-mismatch'))
    assert.equal(output.inventory.listingComplete, false)
  })
}
for (const [name, change] of [
  ['contradictory countries', d => { d.jobPostingInfo.country = { descriptor: 'United States' } }],
  ['explicit foreign countries', d => { d.jobPostingInfo.country = { descriptor: 'United States' }; d.jobPostingInfo.jobRequisitionLocation.country = { descriptor: 'United States', alpha2Code: 'US' } }],
  ['missing countries despite Mumbai', d => { d.jobPostingInfo.country = null; d.jobPostingInfo.jobRequisitionLocation.country = null }],
  ['changed title', d => { d.jobPostingInfo.title = 'Different role' }],
  ['changed requisition', d => { d.jobPostingInfo.jobReqId = 'OTHER123' }],
  ['foreign canonical', d => { d.jobPostingInfo.externalUrl = 'https://unrelated.invalid/job/JR103248' }],
  ['wrong site', d => { d.jobPostingInfo.jobPostingSiteId = 'DifferentSite' }],
  ['unposted role', d => { d.jobPostingInfo.posted = false }],
  ['closed application', d => { d.jobPostingInfo.canApply = false }],
  ['hidden-only criteria', d => { d.jobPostingInfo.jobDescription = '<div hidden>' + 'Hidden criteria '.repeat(50) + '</div>' }],
  ['short criteria', d => { d.jobPostingInfo.jobDescription = '<p>Apply today</p>' }],
  ['expired role', d => { d.jobPostingInfo.endDate = '2020-01-01' }],
]) test('actual wrapper preserves existing guard: ' + name, async () => {
  const { jobs, output } = await replay({ mutateDetail: change })
  assert.equal(jobs.length, 0)
  assert.equal(output.inventory.status, 'coverage-gap')
  assert.equal(output.inventory.listingComplete, false)
  assert.equal(output.inventory.reportedTotal, null)
  assert.equal(output.audit.lifecycleCleanupAllowed, false)
})

test('synthetic negative HTTP403 keeps the existing numeric/classification/audit contract', async () => {
  await assert.rejects(replay({ denyAll: true }), error => {
    assert.equal(error.status, 403)
    assert.equal(error.abortRetries, true)
    assert.deepEqual(classifyScraperError(error), { softFailure: true, upstreamOutage: true, failureKind: 'blocked_or_access_denied' })
    assert.equal(error.recruitmentObservations.sourceScopeComplete, false)
    assert.equal(error.recruitmentObservations.lifecycleCleanupAllowed, false)
    assert.deepEqual(error.recruitmentObservations.receipts.map(row => row.status), [403, 403])
    return true
  })
})
for (const during of [false, true]) test('exact opaque caller reason is retained ' + (during ? 'during' : 'before') + ' a request', async () => {
  const controller = new AbortController(), reason = Object.freeze({ caller: 'murex-negative-control', during })
  if (!during) controller.abort(reason)
  await assert.rejects(replay({ signal: controller.signal, abortOnRequest: during ? () => controller.abort(reason) : undefined }), error => error === reason)
})
