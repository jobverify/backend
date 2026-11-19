import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { setTimeout as delay } from 'node:timers/promises'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261118.json.gz', import.meta.url))))
const pages = new Map(fixture.pages.map(page => [page.url, page]))
const assertSettles = async operation => {
  const guard = new AbortController()
  try {
    return await Promise.race([operation, delay(250, undefined, { signal: guard.signal })
      .then(() => { throw Error('Source acquisition did not settle within its configured deadline') })])
  } finally { guard.abort() }
}

test('current first-party Amity roles retain full criteria while company inventory stays held', async () => {
  const reads = []
  const jobs = await run({ fetchPage: async url => {
    reads.push(url)
    assert.ok(pages.has(url), 'only the publisher-bound current opening routes are read')
    return structuredClone(pages.get(url))
  } })
  assert.equal(jobs.length, 8)
  assert.equal(reads.length, 11)
  assert.ok(jobs.every(job => job.country === 'India' && job.jobDescription.length > 100))
  assert.equal(readInventoryEvidence(jobs)?.lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('an already-aborted Amity caller starts no request and keeps its exact reason', async () => {
  const controller = new AbortController(), reason = { caller: 'closed' }
  controller.abort(reason)
  let reads = 0
  await assert.rejects(run({ signal: controller.signal, fetchPage: async () => {
    reads++
    return { status: 500, html: '' }
  } }), error => error === reason)
  assert.equal(reads, 0)
})

test('Amity caller cancellation settles even when the injected acquisition ignores its signal', async () => {
  const controller = new AbortController(), reason = Symbol('caller cancellation')
  let reads = 0, observedSignal
  const pending = run({ signal: controller.signal, fetchPage: async (url, init) => {
    reads++
    observedSignal = init?.signal
    controller.abort(reason)
    return new Promise(() => {})
  } })
  await assertSettles(assert.rejects(pending, error => error === reason))
  assert.equal(reads, 1)
  assert.equal(observedSignal?.aborted, true)
})

test('Amity request deadline bounds an uncooperative page callback', async () => {
  let reads = 0
  await assertSettles(assert.rejects(run({ requestTimeoutMs: 15, fetchPage: async () => {
    reads++
    return new Promise(() => {})
  } }), error => error.failureKind === 'network_or_timeout'))
  assert.equal(reads, 1)
})

test('Amity total acquisition deadline bounds a stalled native response body', async () => {
  let reads = 0, cancellations = 0
  const response = new Response(new ReadableStream({ cancel() { cancellations++ } }), {
    status: 200, headers: { 'content-type': 'text/html' },
  })
  Object.defineProperty(response, 'url', { value: fixture.pages[0].url })
  await assertSettles(assert.rejects(run({ collectionTimeoutMs: 15, fetchImpl: async () => {
    reads++
    return response
  } }), error => error.failureKind === 'network_or_timeout'))
  await delay(0)
  assert.equal(reads, 1)
  assert.equal(cancellations, 1)
})

test('Amity still rejects missing published detail criteria and undeclared role routes', async () => {
  await assert.rejects(run({ fetchPage: async url => {
    const page = structuredClone(pages.get(url))
    if (url.includes('careers/')) page.html = page.html.replaceAll('https://www.amitysoftware.com/associate-project-manager-scrum-master-banking-domain/', 'https://www.amitysoftware.com/unreviewed-role/')
    return page
  } }), /known first-party surface/)
  await assert.rejects(run({ fetchPage: async url => {
    const page = structuredClone(pages.get(url))
    if (url.includes('associate-project-manager-scrum-master-banking-domain/')) page.html = '<html><title>Job</title><p>Partial preview</p></html>'
    return page
  } }), /detail page surface changed/)
})
