import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run } from './script.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/delegation-20261031.json.gz', import.meta.url))))
const nativePages = new Map(capture.packets.map(p => [p.url, p]))
const home = 'https://www.okta.com/company/careers/'
const options = extra => ({ fetchPage: async url => structuredClone(nativePages.get(url)), ...extra })
const rejectsUnavailable = error => error.softFailure === true && error.abortRetries === true
  && error.failureKind === 'source_identity_unverified'

test('Auth0 current native redirect delegates to the canonical Okta runtime without changing child ownership or evidence', async () => {
  // Controlled child boundary; this is not a new live vacancy or inventory claim.
  const child = attachInventoryEvidence([{ jobId: 'controlled-child', source: 'okta', company: 'Okta' }], {
    status: 'discovery-only', surface: home, firstParty: true, listingComplete: false, pagesFetched: 1,
    verifiedAt: capture.packets[1].capturedAt,
  })
  let called = 0
  const jobs = await run(options({ oktaRun: async () => { called += 1; return child } }))
  assert.equal(called, 1)
  assert.equal(jobs, child)
  assert.equal(jobs[0].source, 'okta')
  assert.equal(jobs[0].company, 'Okta')
  assert.equal(readInventoryEvidence(jobs), readInventoryEvidence(child))
  const proof = jobs[Symbol.for('jobverify.inventory-delegation-evidence')]
  assert.equal(proof.source, 'auth0')
  assert.deepEqual(proof.sources, ['okta'])
  assert.equal(proof.verifiedAt, capture.packets[0].capturedAt, 'Captured evidence must retain its original clock')
  assert.deepEqual(proof.evidence.responses.map(page => page.sha256), capture.packets.map(page => page.sha256))
})

for (const [label, change] of [
  ['foreign redirect', p => { p.headers.location = 'https://unrelated.invalid/company/careers/' }],
  ['error redirect response', p => { p.status = 403 }],
  ['no actual redirect', p => { p.status = 200 }],
]) test(`Auth0 ${label} cannot call the delegated source`, async () => {
  const pages = structuredClone(nativePages), first = pages.get(capture.packets[0].url)
  change(first)
  await assert.rejects(run(options({ fetchPage: async url => pages.get(url), oktaRun: async () => assert.fail('invalid delegation') })), rejectsUnavailable)
})

test('Auth0 hidden or script-only native job-board references cannot validate the destination company page', async () => {
  for (const body of [`<title>Careers | Okta</title><link rel="canonical" href="${home}"><script>"${home}job-listing/"</script>`,
    `<title>Careers | Okta</title><link rel="canonical" href="${home}"><div hidden><a href="${home}job-listing/">View jobs</a></div>`]) {
    await assert.rejects(run(options({ fetchPage: async url => url === home ? { ...nativePages.get(url), body } : nativePages.get(url),
      oktaRun: async () => assert.fail('inactive delegation') })), rejectsUnavailable)
  }
})

test('Auth0 propagates exact cancellation before reads and into the canonical child runtime', async () => {
  const reason = Error('cancel Auth0 delegation')
  await assert.rejects(run(options({ signal: AbortSignal.abort(reason), fetchPage: async () => assert.fail('already cancelled') })), error => error === reason)
  const controller = new AbortController()
  await assert.rejects(run(options({ signal: controller.signal, oktaRun: async passed => {
    assert.equal(passed.signal, controller.signal)
    controller.abort(reason)
    throw reason
  } })), error => error === reason)
})
