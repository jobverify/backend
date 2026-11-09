import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { createPublicAtsAuditCapture } from '../scripts/catalogExtractionPublicAtsCapture.js'
import { auditExtraction } from '../scripts/catalogExtractionWorker.js'
import { isExtractionAuditCacheReusable } from '../scripts/auditCatalogExtractions.js'

const provider = { source: 'fixture', adapter: 'publicAts', atsPlatform: 'greenhouse', boardToken: 'fixture' }
const endpoint = 'https://boards-api.greenhouse.io/v1/boards/fixture/jobs?content=true'
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
async function temporary(fn) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ats-audit-capture-'))
  try { await fn(directory) } finally { fs.rmSync(directory, { recursive: true, force: true }) }
}

test('capture requests cannot reuse a cached attempt that has no retained API evidence', () => {
  const now = +new Date('2026-10-22T23:00:00Z')
  const row = { completedAt: '2026-10-22T22:00:00Z' }
  assert.equal(isExtractionAuditCacheReusable(row, { now }), true)
  assert.equal(isExtractionAuditCacheReusable(row, { now, capturePublicAts: true }), false)
  const captured = { ...row, retainedNativeApiEvidence: [{ body: 'public-ats-response-001.body' }] }
  assert.equal(isExtractionAuditCacheReusable(captured, { now, capturePublicAts: true }), true)
  for (const completedAt of [null, 'not-a-date', '2026-10-23T00:00:00Z', '2026-10-20T23:00:00Z']) {
    assert.equal(isExtractionAuditCacheReusable({ ...captured, completedAt }, { now, capturePublicAts: true }), false)
  }
})

test('captures the exact GET bytes and timestamps for positive and zero payloads', async () => temporary(async outputDirectory => {
  for (const jobs of [[{ id: 1 }], []]) {
    const body = Buffer.from(JSON.stringify({ jobs, meta: { total: jobs.length } }) + '\n')
    const capture = createPublicAtsAuditCapture(provider, { outputDirectory, fetchImpl: async (url, options) => {
      assert.equal(url, endpoint)
      assert.equal(options.method, 'GET')
      assert.equal(options.redirect, 'error')
      assert.ok(options.signal)
      return new Response(body, { status: 200, headers: { 'content-type': 'application/json', 'set-cookie': 'PRIVATE_COOKIE' } })
    } })
    assert.equal((await capture.fetchJson(endpoint)).jobs.length, jobs.length)
    assert.equal(capture.evidence.length, 1)
    const receipt = capture.evidence[0]
    assert.deepEqual(fs.readFileSync(path.join(outputDirectory, receipt.body)), body)
    assert.equal(receipt.bodySHA256, digest(body))
    assert.equal(receipt.bodyComplete, true)
    assert.ok(new Date(receipt.completedAt) >= new Date(receipt.requestedAt))
    assert.doesNotMatch(JSON.stringify(receipt), /PRIVATE_COOKIE/)
    const saved = JSON.parse(fs.readFileSync(path.join(outputDirectory, receipt.receipt)))
    assert.equal(saved.bodySHA256, receipt.bodySHA256)
  }
}))

test('rejects foreign endpoints, role/application paths and unsafe source identities without fetching', async () => temporary(async outputDirectory => {
  let calls = 0
  const capture = createPublicAtsAuditCapture(provider, { outputDirectory, fetchImpl: async () => { calls++; throw new Error('unexpected') } })
  for (const url of ['https://boards-api.greenhouse.io/v1/boards/other/jobs?content=true', 'https://job-boards.greenhouse.io/fixture/jobs/1', endpoint + '&page=2', 'http://127.0.0.1/']) {
    await assert.rejects(capture.fetchJson(url), /endpoint/)
  }
  assert.equal(calls, 0)
  assert.throws(() => createPublicAtsAuditCapture({ ...provider, source: '../escape' }, { outputDirectory }), /source/)
  assert.throws(() => createPublicAtsAuditCapture({ ...provider, adapter: 'script' }, { outputDirectory }), /publicAts/)
}))

test('upstream HTTP, invalid JSON, body overflow and network failures retain failures, never empty jobs', async () => temporary(async outputDirectory => {
  for (const [fetchImpl, pattern, complete] of [
    [async () => new Response('temporarily unavailable', { status: 503 }), /503/, true],
    [async () => new Response('<html>not JSON</html>'), /JSON/, true],
    [async () => new Response('x'.repeat(100)), /limit/, false],
    [async () => { throw new Error('network unavailable') }, /network/, false],
  ]) {
    const capture = createPublicAtsAuditCapture(provider, { outputDirectory, fetchImpl, maxBytes: 64 })
    await assert.rejects(capture.fetchJson(endpoint), pattern)
    assert.equal(capture.evidence.length, 1)
    assert.equal(capture.evidence[0].bodyComplete, complete)
    assert.ok(capture.evidence[0].failure)
    assert.equal(capture.evidence[0].verifiedZeroInventory, false)
  }
}))

test('worker captures zero inventories and keeps failed attempt counts unknown; capture is opt-in', async () => temporary(async outputDirectory => {
  const original = globalThis.fetch
  const configured = { ...provider, companyName: 'Fixture', sourceScopeComplete: false,
    bindingEvidence: { verified: true, matchedLinks: ['https://job-boards.greenhouse.io/fixture'] } }
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ jobs: [], meta: { total: 0 } }), { headers: { 'content-type': 'application/json' } })
    const zero = await auditExtraction(configured, { outputDirectory, capturePublicAts: true })
    assert.equal(zero.outcome, 'unverified-zero')
    assert.equal(zero.rawJobs, 0)
    assert.equal(zero.retainedNativeApiEvidence[0].bodyComplete, true)
    assert.equal(zero.inventoryEvidence.listingComplete, false)
    const disabled = await auditExtraction(configured, { outputDirectory })
    assert.equal(disabled.retainedNativeApiEvidence, undefined)
    globalThis.fetch = async () => new Response('unavailable', { status: 503 })
    const failed = await auditExtraction(configured, { outputDirectory, capturePublicAts: true })
    assert.equal(failed.outcome, 'extraction-failed')
    for (const key of ['rawJobs', 'indiaJobs', 'eligibleJobs', 'inventoryEvidence']) assert.equal(failed[key], null)
    assert.equal(failed.retainedNativeApiEvidence[0].status, 503)
    assert.equal(failed.retainedNativeApiEvidence[0].verifiedZeroInventory, false)
  } finally { globalThis.fetch = original }
}))
