import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { runWorkdayScraper, WorkdayHostCircuitBreaker } from '../myworkday/engine.js'
import { classifyScraperError } from '../utils/failureClassification.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

// Only response bytes/metadata are genuine captures. Listing envelopes and
// explicitly identified transport variations below are synthetic controls.
const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/workdayScopeFailure20261106/capture.json.gz', import.meta.url))))
const captured = (source, api = true) => {
  const row = capture.responses.find(row => row.source === source && row.receipt.requestedUrl.includes('/wday/cxs/') === api)
  assert.ok(row)
  const body = Buffer.from(row.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(body).digest('hex'), row.receipt.sha256)
  assert.equal(body.length, row.receipt.bytes)
  return { ...row, body }
}
const exercise = async (t, row, respond = null, requestTimeoutMs = 500) => {
  const api = new URL(row.receipt.requestedUrl)
  const [, tenant, site, rolePath] = api.pathname.match(/^\/wday\/cxs\/([^/]+)\/([^/]+)(\/job\/.+)$/)
  const prefix = api.origin + '/wday/cxs/' + tenant + '/' + site
  const info = row.receipt.status === 200 ? JSON.parse(row.body).jobPostingInfo : null
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workday-scope-failure-'))
  fs.writeFileSync(path.join(directory, 'config.json'), JSON.stringify({
    mode: 'jobs-api', jobsApiUrl: prefix + '/jobs', locationCountry: null,
    searchText: '', maxPages: 2, detailEnrichmentBudgetMs: 0,
  }))
  t.after(() => {
    const resolved = path.resolve(directory)
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()))
    assert.ok(path.basename(resolved).startsWith('workday-scope-failure-'))
    fs.rmSync(resolved, { recursive: true, force: true })
  })
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (String(url) === api.origin + '/en-US/' + site && (init.method || 'GET') === 'GET') {
      return new Response('<html>Synthetic anonymous Workday bootstrap control</html>', {
        headers: { 'content-type': 'text/html' },
      })
    }
    if (String(url) === prefix + '/jobs' && init.method === 'POST') {
      return Response.json({ total: 1, jobPostings: [{
        title: info?.title || 'Synthetic listing for captured denied role',
        externalPath: rolePath, locationsText: '2 Locations',
        bulletFields: [info?.jobReqId || 'CAPTURE-CONTROL'], postedOn: 'Posted Today',
      }] })
    }
    assert.equal(String(url), api.href, 'No implicit HTML/network fallback is allowed')
    assert.equal(init.method || 'GET', 'GET')
    return respond ? respond(init) : new Response(row.body, {
      status: row.receipt.status, headers: { 'content-type': row.receipt.contentType },
    })
  })
  return runWorkdayScraper({ source: row.source, company: row.source,
    baseUrl: api.origin + '/en-US/' + site, scraperDir: directory,
    boardIdentityVerified: true, requestTimeoutMs, retryBaseDelayMs: 0,
    nativeDetailRecovery: false, circuitBreaker: new WorkdayHostCircuitBreaker({ failureThreshold: 20 }),
    detailCircuitBreaker: new WorkdayHostCircuitBreaker({ failureThreshold: 20 }),
    requestScheduler: { acquire: async () => () => {}, recordRateLimit() {} },
  })
}
const rejectsKind = (run, kind, validate = () => true) => assert.rejects(run, error => {
  const classification = classifyScraperError(error)
  assert.equal(classification.failureKind, kind)
  if (kind === 'parser_or_contract_error') {
    assert.equal(classification.softFailure, false)
    assert.equal(classification.upstreamOutage, false)
    assert.equal(error.name, 'WorkdayScopeApiContractError')
  }
  assert.equal(error.name === 'WorkdayIncompleteScopeError', kind === 'incomplete_location_scope')
  assert.ok(validate(error))
  return true
})

for (const source of ['caeinc', 'telstra']) test('Workday preserves the original captured ' + source + ' detail API HTTP 403', async t => {
  await rejectsKind(exercise(t, captured(source)), 'blocked_or_access_denied', error => error.jobsApiHttpStatus === 403 && error.abortRetries === true)
})
for (const status of [429, 503]) test('Workday preserves synthetic detail HTTP ' + status + ' and its upstream status', async t => {
  await rejectsKind(exercise(t, captured('caeinc'), () => new Response('Synthetic upstream control', {
    status, headers: { 'retry-after': '0', 'content-type': 'text/plain' },
  })), 'network_or_timeout', error => error.jobsApiHttpStatus === status && error.upstreamOutage === true)
})
test('Workday preserves a synthetic scope transport failure', async t => {
  await rejectsKind(exercise(t, captured('caeinc'), () => { throw new TypeError('fetch failed', { cause: Object.assign(new Error('Synthetic DNS failure'), { code: 'ENOTFOUND' }) }) }), 'network_or_timeout')
})
test('Workday preserves a synthetic scope request deadline before response headers', async t => {
  await rejectsKind(exercise(t, captured('caeinc'), init => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
  }), 20), 'network_or_timeout', error => error.name === 'WorkdayRequestTimeoutError')
})
test('Workday identifies HTML substituted for the detail JSON contract', async t => {
  // This is the genuine public role HTML, synthetically substituted at its API URL.
  const html = captured('spgi', false)
  await rejectsKind(exercise(t, captured('caeinc'), () => new Response(html.body, {
    headers: { 'content-type': 'text/html' },
  })), 'parser_or_contract_error')
})
test('Workday identifies malformed detail JSON as a contract failure', async t => {
  await rejectsKind(exercise(t, captured('caeinc'), () => new Response('{"jobPostingInfo":', {
    headers: { 'content-type': 'application/json' },
  })), 'parser_or_contract_error')
})
for (const slug of ['Network-Engineer', 'Verified-Engineer', 'Blocked-Engineer']) test('Workday typed JSON contract failure is not overridden by synthetic role slug ' + slug, async t => {
  const original = captured('caeinc')
  const row = { ...original, receipt: { ...original.receipt,
    requestedUrl: original.receipt.requestedUrl.replace(/\/job\/.+$/, '/job/Synthetic-Campus/' + slug + '_SYNTHETIC-CONTROL'),
  } }
  await rejectsKind(exercise(t, row, () => new Response('{', {
    headers: { 'content-type': 'application/json' },
  })), 'parser_or_contract_error')
})
test('Workday typed JSON contract failure is not overridden by misleading parser cause text', async t => {
  await rejectsKind(exercise(t, captured('caeinc'), () => new Response('blocked response', {
    headers: { 'content-type': 'application/json' },
  })), 'parser_or_contract_error', error => error.cause instanceof SyntaxError)
})
test('Workday keeps the captured AspenTech missing geography incomplete', async t => {
  await rejectsKind(exercise(t, captured('aspentechnology')), 'incomplete_location_scope')
})
test('Workday accepts current SPGI JSON and retains its native India locations', async t => {
  const jobs = await exercise(t, captured('spgi'))
  assert.equal(jobs.length, 1)
  assert.match(jobs[0].title, /Due Diligence Analyst/)
  assert.ok(jobs[0].locations.some(value => /Gurugram/i.test(value)))
  assert.ok(jobs[0].locations.some(value => /Hyderabad/i.test(value)))
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
})
