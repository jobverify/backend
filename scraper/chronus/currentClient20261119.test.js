import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'

const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261119/current-native.json.gz', import.meta.url))))
const page = 'https://chronus.com/about-us/careers'
const client = 'https://chronus.com/_next/static/immutable/chunks/41cg6wrlkolod.js'
const api = 'https://app.recruiterbox.com/widget/8241/openings/'
const options = (change = (_url, body) => body) => ({
  fetchText: async url => change(url, capture.packets.find(row => row.requestUrl === url)?.body),
  fetchImpl: async url => {
    const packet = capture.packets.find(row => row.requestUrl === url)
    assert.ok(packet, 'No undeclared current native request: ' + url)
    return Object.defineProperty(new Response(change(url, packet.body), { status: packet.status,
      headers: { 'content-type': packet.contentType } }), 'url', { value: packet.url })
  },
})

test('Chronus reviews the rebuilt current JobOpenings client and reconciles the original configured widget at closing', async () => {
  const jobs = await run(options())
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 0)
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
  assert.deepEqual(assessSoftFailureAcquisition({ source: 'chronus', companyName: 'Chronus', zeroResultPolicy: 'evidence-required' }, jobs).cleanupOptions,
    { replaceExisting: false }, 'An empty configured widget cannot authorize company cleanup')
  assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete, false)
  assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed, false)
  assert.deepEqual(jobs.nativeCollectionEvidence.phases.map(phase => phase.originalInventory), [[], []])
  assert.deepEqual(jobs.nativeCollectionEvidence.phases.map(phase => phase.clientURL), [client, client])
})

test('Chronus rejects a changed tenant, dormant client or changed reviewed program', async () => {
  for (const change of [
    (url, body) => url === client ? body.replaceAll('8241', '9999') : body,
    (url, body) => url === client ? body.replace('t.appendChild(r)', 't.removeChild(r)') : body,
    (url, body) => url === page ? body.replace('src="' + new URL(client).pathname + '"', 'type="text/plain" src="' + new URL(client).pathname + '"') : body,
  ]) await assert.rejects(run(options(change)), /client|program|profile|widget/i)
})

test('positive unqualified Chronus observations remain original evidence and cannot certify empty', async () => {
  const record = { id: 151, title: 'Software Engineer', company_name: 'Chronus', location: { city: 'Chennai', country: 'India' } }
  const jobs = await run(options((url, body) => url === api ? JSON.stringify([record]) : body))
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  assert.deepEqual(jobs.nativeCollectionEvidence.phases[0].originalInventory, [record])
})
