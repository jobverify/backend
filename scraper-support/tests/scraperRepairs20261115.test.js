import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { runNativeCheckmarx } from '../../scraper/checkmarx/nativeRun.js'
import { runNativeEverstage } from '../../scraper/everstage/nativeRun.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'
import { getScraperCatalog } from '../providers/index.js'

const cases = [
  { source: 'checkmarx', run: runNativeCheckmarx,
    fixture: '../../scraper/checkmarx/test-inputs/current-full-workflow-20261115.json.gz',
    ids: ['5D.474', 'C7.471'] },
  { source: 'everstage', run: runNativeEverstage,
    fixture: '../../scraper/everstage/fixtures/current-full-workflow-20261115.json.gz',
    ids: ['81087ce5-8949-4a11-8db7-795cf78b84f4', 'fed6a655-c192-41b9-aa7d-d8b866e4f132',
      '11c6292e-03b5-4732-8624-11675bead6c1', '16ef4cf6-eff9-41b2-9d03-037054612d20'] },
]

for (const scenario of cases) test(`${scenario.source} exact current full workflow recovers eligible India jobs through the runner assessment`, async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Full workflow replay forbids live network'))
  const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL(scenario.fixture, import.meta.url))))
  let requestIndex = 0
  const fetchImpl = async (url, options) => {
    options.signal.throwIfAborted()
    assert.equal(options.method || 'GET', 'GET')
    const packet = capture.packets[requestIndex++]
    assert.ok(packet, 'No unrecorded requests or application submissions')
    assert.equal(url, packet.url)
    const response = new Response(packet.body, { status: packet.status,
      headers: { 'content-type': url.endsWith('.js') ? 'application/javascript' : 'text/html' } })
    Object.defineProperty(response, 'url', { value: packet.finalUrl })
    return response
  }
  const jobs = await scenario.run({ fetchImpl, now: '2026-11-15T04:20:00.000Z', signal: AbortSignal.timeout(20000) })
  assert.equal(requestIndex, capture.packets.length)
  assert.deepEqual(jobs.map(job => job.jobId).sort(), [...scenario.ids].sort())
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete && job.sourceDescription.length > 100))
  const provider = getScraperCatalog().find(provider => provider.source === scenario.source)
  const assessment = assessSoftFailureAcquisition(provider, jobs)
  assert.equal(assessment.runnerOutcome.success, true)
  assert.equal(assessment.indiaJobs, scenario.ids.length)
  assert.equal(assessment.eligibleJobs, scenario.ids.length)
  assert.equal(assessment.inventoryEvidence.listingComplete, false)
  assert.equal(assessment.cleanupOptions.replaceExisting, false)
})
