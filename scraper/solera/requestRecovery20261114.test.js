import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { auditSoleraRawScope } from './nativeRawScope.js'

const api = 'https://solera.wd5.myworkdayjobs.com/wday/cxs/solera/Global_Career_Site/jobs'
const board = 'https://solera.wd5.myworkdayjobs.com/Global_Career_Site'
const schema = JSON.parse(fs.readFileSync(new URL('./reviewedNativeScope.json', import.meta.url)))
const scheduler = () => ({ cooldowns: [], acquire: async () => () => {},
  recordRateLimit(url, delay) { this.cooldowns.push({ url, delay }) } })
const response = (status, url = api, headers = {}) => Object.defineProperty(new Response(
  JSON.stringify({ total: 0, jobPostings: [] }), { status, headers: { 'content-type': 'application/json', ...headers } }), 'url', { value: url })

test('Solera retries a rate-limited raw page with shared cooldown and still reconciles the native envelope', async t => {
  const capacity = scheduler()
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => ++calls === 1 ? response(429, api, { 'retry-after': '0' }) : response(200))
  const result = await auditSoleraRawScope({ apiUrl: api, boardUrl: board, schema, requestScheduler: capacity })
  assert.equal(calls, 2)
  assert.equal(result.total, 0)
  assert.deepEqual(capacity.cooldowns, [{ url: api, delay: 0 }])
})

test('Solera preserves exact request and response evidence for a Workday maintenance redirect', async t => {
  const maintenance = 'https://community.workday.com/maintenance-page'
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; return response(302, api, { location: maintenance }) })
  await assert.rejects(auditSoleraRawScope({ apiUrl: api, boardUrl: board, schema, requestScheduler: scheduler() }), error => {
    assert.equal(error.abortRetries, true)
    assert.equal(error.upstreamOutage, true)
    assert.equal(error.requestedUrl, api)
    assert.equal(error.responseUrl, api)
    assert.equal(error.redirectUrl, maintenance)
    assert.equal(error.httpStatus, 302)
    return true
  })
  assert.equal(calls, 1)
})

test('Solera never retries or accepts a successful response from a different native identity', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; return response(200, 'https://other.example/jobs') })
  await assert.rejects(auditSoleraRawScope({ apiUrl: api, boardUrl: board, schema, requestScheduler: scheduler() }), error => {
    assert.equal(error.abortRetries, true)
    assert.equal(error.upstreamOutage, false)
    assert.equal(error.failureKind, 'parser_or_contract_error')
    return true
  })
  assert.equal(calls, 1)
})


test('Solera bounds a persistent rate limit and retains the final shared cooldown', async t => {
  let calls = 0
  const capacity = scheduler()
  t.mock.method(globalThis, 'fetch', async () => { calls++; return response(429, api, { 'retry-after': '0' }) })
  await assert.rejects(auditSoleraRawScope({ apiUrl: api, boardUrl: board, schema, requestScheduler: capacity }), error => {
    assert.equal(error.abortRetries, true)
    assert.equal(error.upstreamOutage, true)
    assert.equal(error.httpStatus, 429)
    return true
  })
  assert.equal(calls, 3)
  assert.equal(capacity.cooldowns.length, 3)
})
