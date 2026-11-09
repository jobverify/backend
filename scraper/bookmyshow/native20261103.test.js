import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import zlib from 'node:zlib'
import { createHash } from 'node:crypto'
import { run } from './script.js'
import { gzipSha256, responseSha256 } from './test-data/manifest-20261103.js'
const gzip = fs.readFileSync(new URL('./test-data/native-20261103.json.gz', import.meta.url))
assert.equal(createHash('sha256').update(gzip).digest('hex'), gzipSha256)
const pages = new Map(JSON.parse(zlib.gunzipSync(gzip)).map(row => {
  assert.equal(createHash('sha256').update(row.body).digest('hex'), responseSha256[row.requestedUrl])
  return [row.requestedUrl, { status: row.status, url: row.finalUrl, html: row.body }]
}))
test('BookMyShow current India access blocks remain explicit upstream failures', async () => {
  let report
  await assert.rejects(run({ fetchPage: async url => pages.get(url), onAudit: async value => { report = value } }), error => error.code === 'BOOKMYSHOW_PUBLIC_ACCESS_BLOCKED')
  assert.equal(report.inventoryEvidence.status, 'coverage-gap')
  assert.equal(report.inventoryEvidence.reportedTotal, null)
  assert.deepEqual(report.observations.map(row => row.status), [403, 403])
})
test('BookMyShow cannot substitute its reachable Sri Lanka mirror for India', async () => {
  await assert.rejects(run({ fetchPage: async url => ({ ...pages.get('https://lk.bookmyshow.com/careers/'), url: 'https://lk.bookmyshow.com/careers/' }) }), /response identity/i)
})
test('BookMyShow forwards cancellation before network access', async () => {
  const controller = new AbortController(), reason = new Error('cancelled'); controller.abort(reason)
  let requests = 0
  await assert.rejects(run({ signal: controller.signal, fetchPage: async () => { requests++; return {} } }), error => error === reason)
  assert.equal(requests, 0)
})
