import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { CAREERS_PAGE_URL, createCamsScraper } from './script.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence, isVerifiedEmptyEvidence, isFreshCompleteInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const archive = readFileSync(new URL('./test-data/native-20261103.json.gz', import.meta.url))
const manifest = JSON.parse(readFileSync(new URL('./test-data/manifest-20261103.json', import.meta.url)))
const sha = body => createHash('sha256').update(body).digest('hex')
assert.equal(sha(archive), manifest.archiveSha256)
const native = JSON.parse(gunzipSync(archive)).find(packet => packet.key === 'careers')
const receipt = manifest.responses.find(packet => packet.key === 'careers')
assert.equal(Buffer.byteLength(native.html), receipt.bytes)
assert.equal(sha(native.html), receipt.sha256)
const page = () => structuredClone(native)
const provider = getScraperCatalog().find(item => item.source === 'cams')
assert.ok(provider)
const entries = [
  ['factory', options => createCamsScraper().run(options)],
  ['registered', options => createCatalogScraper(provider).run(options)],
]

test.beforeEach(t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('CAMS contract tests forbid live HTTP'))
})

const assertUnknownInventory = (jobs, audit, firstParty) => {
  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.firstParty, firstParty)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(isVerifiedEmptyEvidence(evidence), false)
  assert.equal(isFreshCompleteInventoryEvidence(evidence), false, 'The shell cannot qualify for fetched-zero')
  assert.equal(audit.companyGlobalTotal, null)
  assert.equal(audit.companyIndiaTotal, null)
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(audit.sourceDeclaredBoardScopeComplete, false)
  assert.equal(audit.sourceCompanyWideScopeComplete, false)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  assert.equal(audit.privateApplicationRequests, 0)
  assert.equal(audit.observations.length, 1)
  const observed = audit.observations[0]
  assert.equal(observed.kind, 'unresolved-client-rendered-careers-entry')
  assert.equal(observed.nativeVacancyTotal, null)
  assert.equal(observed.indiaVacancyTotal, null)
  assert.equal(observed.explicitNoOpeningsStatement, false)
  assert.equal(observed.jobId, null)
  assert.equal(observed.country, null)
  assert.equal(observed.lifecycleCleanupAllowed, false)
}

for (const [label, run] of entries) test(label + ' CAMS preserves the genuine shell as an unresolved observation with HTTP provenance', async () => {
  const requests = [], responses = []
  let audit
  const jobs = await run({
    fetchPage: async (url, request) => {
      requests.push(url)
      assert.equal(request.method, 'GET')
      return page()
    },
    onResponse: value => { responses.push(value) },
    onAudit: value => { audit = value },
  })
  assert.equal(CAREERS_PAGE_URL, 'https://www.camsonline.com/about-cams/careers')
  assert.deepEqual(requests, [CAREERS_PAGE_URL, CAREERS_PAGE_URL])
  assertUnknownInventory(jobs, audit, true)
  assert.equal(audit.closingReconciled, true)
  assert.deepEqual(responses.map(value => value.phase), ['opening', 'closing'])
  for (const response of responses) {
    assert.equal(response.status, receipt.status)
    assert.equal(response.url, receipt.url)
    assert.equal(response.finalUrl, receipt.finalUrl)
    assert.equal(response.sha256, receipt.sha256)
    assert.equal(sha(Buffer.from(response.bodyBase64, 'base64')), receipt.sha256)
  }
  const observation = readSourceObservationEvidence(jobs, 'cams')
  assert.equal(observation.recordKind, 'hiring-signals')
  assert.equal(observation.observedRecordCount, 1)
  assert.equal(observation.observedVacancyCount, 0)
  assert.equal(observation.companyGlobalTotal, null)
  assert.equal(observation.companyIndiaTotal, null)
})

test('CAMS text-only compatibility input cannot acquire first-party response or zero-inventory authority', async () => {
  let audit
  const jobs = await createCamsScraper().run({
    fetchText: async () => native.html,
    onAudit: value => { audit = value },
  })
  assertUnknownInventory(jobs, audit, false)
  assert.ok(audit.responses.every(response => response.status === null && response.finalUrl === null && !response.firstParty))
})

test('CAMS valid shell markup cannot hide failed, missing or foreign response metadata', async () => {
  for (const response of [{ ...page(), status: 403 }, { ...page(), status: 503 },
    { ...page(), url: 'https://unrelated.test/careers' }, { html: native.html }]) {
    let requests = 0, audited = false
    await assert.rejects(createCamsScraper().run({
      fetchPage: async () => { requests++; return response },
      onAudit: () => { audited = true },
    }), error => {
      assert.equal(error.code, response.status === 403 ? 'CAMS_PUBLIC_ACCESS_DENIED' : 'CAMS_PUBLIC_RESPONSE_UNQUALIFIED')
      assert.equal(error.status, response.status ?? null)
      assert.equal(error.abortRetries, true)
      return true
    })
    assert.equal(requests, 1)
    assert.equal(audited, false)
  }
})

test('CAMS unrelated, inert or changed-canonical content cannot qualify as its current public entry', async () => {
  for (const html of ['<main>Career @ CAMS</main>', '<template>' + native.html + '</template>',
    native.html.replaceAll(CAREERS_PAGE_URL, 'https://unrelated.test/careers')]) {
    let audited = false
    await assert.rejects(createCamsScraper().run({
      fetchPage: async () => ({ ...page(), html }),
      onAudit: () => { audited = true },
    }), error => error.code === 'CAMS_PUBLIC_ENTRY_CHANGED')
    assert.equal(audited, false)
  }
})

test('CAMS changed closing shell content cannot produce a reconciled observation', async () => {
  const changed = native.html.replace(/(<title[^>]*>)([\s\S]*?)(<\/title>)/i, '$1$2 Updated$3')
  assert.notEqual(changed, native.html)
  let requests = 0, audited = false
  await assert.rejects(createCamsScraper().run({
    fetchPage: async () => ({ ...page(), html: ++requests === 1 ? native.html : changed }),
    onAudit: () => { audited = true },
  }), /changed during closing read/)
  assert.equal(requests, 2)
  assert.equal(audited, false)
})

test('CAMS factory and registered requests preserve exact caller cancellation before and during collection', { timeout: 5000 }, async () => {
  for (const [label, run] of entries) {
    const before = new AbortController(), beforeReason = Object.freeze({ caller: label + '-before' })
    before.abort(beforeReason)
    await assert.rejects(run({ signal: before.signal, fetchPage: () => assert.fail('Pre-aborted source must not fetch') }),
      error => error === beforeReason)
    const controller = new AbortController(), reason = Object.freeze({ caller: label + '-during' })
    let begin, requestSignal, audited = false
    const started = new Promise(resolve => { begin = resolve })
    const pending = run({
      signal: controller.signal,
      fetchPage: (_url, request) => {
        requestSignal = request.signal
        begin()
        return new Promise(() => {})
      },
      onAudit: () => { audited = true },
    })
    await started
    controller.abort(reason)
    await assert.rejects(pending, error => error === reason)
    assert.equal(requestSignal.aborted, true)
    assert.equal(audited, false)
  }
})
