import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { runWorkdayScraper } from '../myworkday/engine.js'

const folder = new URL('./fixtures/workdayEmptyRoleSlug/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder), 'utf8'))
const receipts = manifest.requests.map(receipt => {
  const body = gunzipSync(fs.readFileSync(new URL(receipt.filename, folder)))
  assert.equal(createHash('sha256').update(body).digest('hex'), receipt.bodySHA256)
  return { ...receipt, body }
})
const CAREERS = 'https://www.covestro.com/en/career'
const BASE = 'https://covestro.wd3.myworkdayjobs.com/cov_external'
const API = 'https://covestro.wd3.myworkdayjobs.com/wday/cxs/covestro/cov_external/jobs'
const EMPTY_SLUG = '/job/_JR-2023-01064-1'
const realDetail = JSON.parse(receipts.find(row => row.url.endsWith(EMPTY_SLUG)).body)
assert.equal(realDetail.jobPostingInfo.jobPostingId, '_JR-2023-01064-1')
assert.equal(realDetail.jobPostingInfo.jobReqId, 'JR-2023-01064')
assert.equal(realDetail.jobPostingInfo.canApply, true)
assert.equal(realDetail.jobPostingInfo.posted, true)

async function exercise(t, changedPath, blankTitle = false) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workday-empty-slug-'))
  t.after(() => {
    const target = fs.realpathSync(directory)
    assert.equal(path.dirname(target), fs.realpathSync(os.tmpdir()))
    assert.ok(path.basename(target).startsWith('workday-empty-slug-'))
    fs.rmSync(target, { recursive: true })
  })
  fs.writeFileSync(path.join(directory, 'config.json'), JSON.stringify({ listingStrategy: 'jobs-api', jobsApiUrl: API,
    detailUrlBase: BASE, officialCareersUrl: CAREERS, inventoryScope: 'complete-board-country-proof',
    retainProvenIndiaOnUnresolvedLocations: true, locationCountry: null, workdayMaxPages: 100 }))
  const stop = Error('Controlled stop after accepting the real native listing, before uncaptured country detail reads')
  const controller = new AbortController()
  const reads = []
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.href || input.url
    const method = init.method || 'GET', body = init.body || null
    reads.push({ url, method, body })
    const receipt = receipts.find(row => row.url === url && row.method === method && (row.requestBody || null) === body)
    // No invented country responses or live HTTP. Reaching an uncaptured detail
    // proves that the full real175-row listing passed its native identity gate.
    if (!receipt) { controller.abort(stop); throw stop }
    let content = receipt.body
    if (method === 'POST' && (changedPath || blankTitle)) {
      const payload = JSON.parse(content)
      for (const row of payload.jobPostings) if (row.externalPath === EMPTY_SLUG) {
        if (changedPath) row.externalPath = changedPath
        if (blankTitle) row.title = ''
      }
      content = Buffer.from(JSON.stringify(payload))
    }
    const response = new Response(content, { status: receipt.status, headers: receipt.headers })
    Object.defineProperty(response, 'url', { value: receipt.finalURL })
    return response
  })
  let error
  try {
    await runWorkdayScraper({ source: 'covestro', company: 'Covestro', baseUrl: BASE, scraperDir: directory,
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]), nativeDetailRecovery: false, retryBaseDelayMs: 0,
      requestTimeoutMs: 1000, requestScheduler: { acquire: async () => () => {}, recordRateLimit() {}, minIntervalMs: 0 } })
  } catch (failure) { error = failure }
  return { error, stop, reads }
}

test('a real published Workday role may omit the title/location slug before its requisition identifier', async t => {
  const result = await exercise(t)
  assert.equal(result.error, result.stop)
  assert.equal(result.reads.filter(row => row.method === 'POST').length, 9)
  assert.ok(result.reads.some(row => row.method === 'GET' && row.url.includes('/wday/cxs/') && row.url.includes('/job/')))
})

for (const bad of ['/job/_', '/job/../_JR-2023-01064-1', 'https://unrelated.example/job/_JR-2023-01064-1',
  '/job/_JR-2023-01064-1?unreviewed=1', '/job/_JR-2023-01064-1#unreviewed']) {
  test('empty-slug support still rejects invalid native role identity: ' + bad, async t => {
    const result = await exercise(t, bad)
    assert.notEqual(result.error, result.stop)
    assert.match(result.error?.message || '', /role identity|listing|scope/i)
  })
}

test('an empty native URL title slug does not permit an empty actual job title', async t => {
  const result = await exercise(t, null, true)
  assert.notEqual(result.error, result.stop)
  assert.match(result.error?.message || '', /role identity|listing|scope/i)
})
