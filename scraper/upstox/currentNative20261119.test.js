import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261119/current-native.json.gz', import.meta.url))))
const root = 'https://upstox.com/careers/', feed = 'https://service.upstox.com/content/open/v1/jobs/'
const options = (change = (_url, body) => body) => ({
  fetchText: async url => fixture.packets.find(packet => packet.requestUrl === url)?.body,
  fetchImpl: async (url, init) => {
    assert.equal(init.method, 'GET')
    assert.doesNotMatch(url, /\/apply(?:[/?]|$)/)
    const packet = fixture.packets.find(packet => packet.requestUrl === url)
    assert.ok(packet, 'Only publisher-declared feed, program and current native account reads: ' + url)
    return Object.defineProperty(new Response(change(url, packet.body), { status: packet.status,
      headers: { 'content-type': packet.contentType } }), 'url', { value: packet.url })
  },
})

test('Upstox retains all original native records and the thirteen currently published roles when full native criteria are blocked', async () => {
  const jobs = await run(options())
  assert.equal(jobs.length, 0, 'Generated public summaries cannot stand in for full criteria')
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
  assert.equal(readSourceObservationEvidence(jobs, 'upstox').observedRecordCount, 57)
  assert.equal(readSourceObservationEvidence(jobs, 'upstox').observedVacancyCount, 13)
  assert.equal(jobs.nativeCollectionEvidence.originalPayload.data.length, 57)
  assert.equal(jobs.nativeCollectionEvidence.originalPublicRecords.length, 13)
  assert.equal(jobs.nativeCollectionEvidence.originalRenderedModels[0].id, 'a69d777abc807b')
  assert.equal(jobs.nativeCollectionEvidence.failures[0].status, 403)
  assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete, false)
  assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed, false)
})

test('Upstox refuses a changed executable feed declaration or native renderer', async () => {
  for (const change of [
    (url, body) => url.includes('careers/page-') ? body.replace('service.upstox.com', 'foreign.test') : body,
    (url, body) => url.endsWith('main.aad4e9f12624d60f.js') ? body.replace('jobDetails:', 'unknownJobDetails:') : body,
    (url, body) => url === root ? body.replace('src="/marketing-page-assets/_next/static/chunks/app/careers/page-', 'type="text/plain" src="/marketing-page-assets/_next/static/chunks/app/careers/page-') : body,
  ]) await assert.rejects(run(options(change)), /native|program|client|renderer|declaration/i)
})

test('Upstox reconciles current publication and publisher identity before trusting the native feed', async () => {
  for (const update of [value => { value.data.find(row => row.job_id === 'a69d777abc807b').post_on_careers_page = 0 },
    value => { value.data.find(row => row.job_id === 'a69d777abc807b').group_company = 'Different Employer' },
    value => { value.data.push({ ...value.data[0] }) }]) {
    await assert.rejects(run(options((url, body) => {
      if (url !== feed) return body
      const value = JSON.parse(body); update(value); return JSON.stringify(value)
    })), /native|identity|publication|duplicate|employer/i)
  }
})
