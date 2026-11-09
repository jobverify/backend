import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import zlib from 'node:zlib'
import { createHash } from 'node:crypto'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { gzipSha256, responseSha256 } from './test-data/manifest-20261103.js'
const gzip = fs.readFileSync(new URL('./test-data/native-20261103.json.gz', import.meta.url))
assert.equal(createHash('sha256').update(gzip).digest('hex'), gzipSha256)
const pages = new Map(JSON.parse(zlib.gunzipSync(gzip)).map(row => {
  assert.equal(createHash('sha256').update(row.body).digest('hex'), responseSha256[row.requestedUrl])
  return [row.requestedUrl, { status: row.status, url: row.finalUrl, html: row.body }]
}))
test('Apar current resume upload form remains an unqualified hiring signal', async () => {
  let report
  const jobs = await run({ fetchPage: async url => pages.get(url), onAudit: async value => { report = value } })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readSourceObservationEvidence(jobs, 'apartechnologies').observedVacancyCount, 0)
  assert.equal(report.observations[0].kind, 'general-cv-intake')
})
test('Apar audit callback errors propagate once', async () => {
  const failure = new Error('audit failed'); let calls = 0
  await assert.rejects(run({ fetchPage: async url => pages.get(url), onAudit: async () => { calls++; throw failure } }), error => error === failure)
  assert.equal(calls, 1)
})
test('Apar forwards cancellation before network access', async () => {
  const controller = new AbortController(), reason = new Error('cancelled'); controller.abort(reason)
  let requests = 0
  await assert.rejects(run({ signal: controller.signal, fetchPage: async () => { requests++; return {} } }), error => error === reason)
  assert.equal(requests, 0)
})
