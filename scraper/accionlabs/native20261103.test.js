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
  return [row.requestedUrl, { ok: row.status === 200, status: row.status, url: row.requestedUrl, finalUrl: row.finalUrl, text: row.body }]
}))
const reader = mutate => async url => {
  assert.ok(pages.has(url), 'captured current protocol URL: ' + url)
  return mutate?.(url, pages.get(url)) || pages.get(url)
}
test('Accion follows the current native role rather than assuming the old redirect means no jobs', async () => {
  let report
  const jobs = await run({ fetchPage: reader(), onAudit: async value => { report = value } })
  assert.equal(jobs.length, 0)
  assert.equal(report.nativeRecords.length, 1)
  const row = report.nativeRecords[0]
  assert.equal(row.title, 'Technical Delivery Manager')
  assert.equal(row.legalEmployer, 'Accion Labs US, Inc.')
  assert.equal(row.country, null)
  assert.equal(row.nativeCountryScope, 'US Opportunities')
  assert.equal(row.location, 'Bridgeville, PA 15017')
  assert.match(row.jobDescription, /Bachelor.*Master.*IT project management/s)
  assert.ok(!row.jobDescription.includes('Bengaluru'))
  assert.equal(row.sourceDetailComplete, true)
  assert.equal(readSourceObservationEvidence(jobs, 'accionlabs').observedVacancyCount, 1)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})
test('Accion requires its typed native employer on a role detail', async () => {
  await assert.rejects(run({ fetchPage: reader((url, page) => url.includes('technical-delivery-manager')
    ? { ...page, text: page.text.replaceAll('Accion Labs US, Inc.', 'Other Employer, Inc.') } : page) }), /native.*employer/i)
})
test('Accion retains rendering uncertainty in the full criteria observation', async () => {
  let report
  await run({ fetchPage: reader((url, page) => url.includes('technical-delivery-manager')
    ? { ...page, text: page.text.replace('<li>Bachelor', '<li style="position:absolute;left:-99999px">Bachelor') } : page), onAudit: async value => { report = value } })
  assert.equal(report.nativeRecords[0].sourceDetailComplete, false)
  assert.match(report.inventoryEvidence.reason, /criteria/)
})
test('Accion awaits and propagates audit callback failures once', async () => {
  const failure = new Error('audit failed'); let calls = 0
  await assert.rejects(run({ fetchPage: reader(), onAudit: async () => { calls++; throw failure } }), error => error === failure)
  assert.equal(calls, 1)
})
test('Accion forwards cancellation before network access', async () => {
  const controller = new AbortController(), reason = new Error('cancelled'); controller.abort(reason)
  let requests = 0
  await assert.rejects(run({ signal: controller.signal, fetchPage: async () => { requests++; return {} } }), error => error === reason)
  assert.equal(requests, 0)
})
