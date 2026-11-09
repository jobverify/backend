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
const reader = mutate => async (url, options = {}) => {
  assert.ok(pages.has(url), 'captured current protocol URL: ' + url)
  if (url.includes('/api/v3/jobs?')) assert.match(options.headers.Authorization, /^Bearer [\w.-]{32,}$/)
  return mutate?.(url, pages.get(url)) || pages.get(url)
}
test('ABFRL reads the hydrated 27-role sector while holding unresolved employer and broken store scope', async () => {
  let report
  const jobs = await run({ fetchPage: reader(), onAudit: async value => { report = value } })
  assert.equal(jobs.length, 0)
  assert.equal(report.delegatedSectorRecords.length, 27)
  assert.equal(report.unboundEmployerIds.length, 27)
  assert.equal(report.storeManagerStatus, 404)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readSourceObservationEvidence(jobs, 'adityabirlafashion').observedVacancyCount, 0)
})
test('ABFRL description or transferred-brand mentions cannot bind the current native employer', async () => {
  let report
  const jobs = await run({ fetchPage: reader((url, page) => {
    if (!url.includes('/api/v3/jobs?')) return page
    const body = JSON.parse(page.html)
    for (const row of body.data) row.jobDescription += '<p>Aditya Birla Fashion and Retail Limited product expertise</p>'
    return { ...page, html: JSON.stringify(body) }
  }), onAudit: async value => { report = value } })
  assert.equal(jobs.length, 0)
  assert.equal(report.unboundEmployerIds.length, 27)
})
test('ABFRL rejects a truncated native sector page', async () => {
  await assert.rejects(run({ fetchPage: reader((url, page) => {
    if (!url.includes('orgunit=') || !url.includes('offset=0')) return page
    const body = JSON.parse(page.html); body.data.pop(); return { ...page, html: JSON.stringify(body) }
  }) }), /native sector page.*count/i)
})
test('ABFRL awaits and propagates audit callback errors once', async () => {
  const failure = new Error('audit failed'); let calls = 0
  await assert.rejects(run({ fetchPage: reader(), onAudit: async () => { calls++; throw failure } }), error => error === failure)
  assert.equal(calls, 1)
})
test('ABFRL forwards cancellation before network access', async () => {
  const controller = new AbortController(), reason = new Error('cancelled'); controller.abort(reason)
  let requests = 0
  await assert.rejects(run({ signal: controller.signal, fetchPage: async () => { requests++; return {} } }), error => error === reason)
  assert.equal(requests, 0)
})
