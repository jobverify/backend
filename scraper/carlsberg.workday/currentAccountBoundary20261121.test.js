import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import http from 'node:http'
import https from 'node:https'
import { syncBuiltinESMExports } from 'node:module'
import { gunzipSync } from 'node:zlib'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import * as current from './script.js'

// Genuine Carlsberg observations from Nov19. These remain historical evidence;
// controls below never represent a new opening/closing observation pair.
const base = new URL('../../reports/scraper-20261118-soft-failures/continuation-20261119/native-carlsberg-account-boundary-repair-20261121/originals/', import.meta.url)
const receipts = JSON.parse(fs.readFileSync(new URL('carlsberg.receipts.json', base)))
const rows = receipts.map(receipt => {
  const bytes = gunzipSync(fs.readFileSync(new URL(receipt.file, base)))
  assert.equal(bytes.length, receipt.bytes)
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), receipt.sha256)
  return { receipt, body: bytes.toString('utf8') }
})
const accountMode = value => {
  const url = new URL(value)
  return url.searchParams.has('login_ns') || url.searchParams.get('loginFlowRequired') === 'true'
}
const retainedURLs = new Set(receipts.map(row => row.requestedUrl))
const declaredPublicURLs = new Set(rows.slice(0, 5).flatMap(row =>
  readNativeDocument(row.body).nodes(node => node.tag === 'a' && node.attrs.href).flatMap(node => {
    try {
      const url = new URL(node.attrs.href, row.receipt.url)
      return url.protocol === 'https:' && url.origin === 'https://careers.carlsberg.com' && !accountMode(url.href) ? [url.href] : []
    } catch { return [] }
  })))
const originalResponse = row => {
  const response = new Response(row.body, { status: row.receipt.status, headers: row.receipt.headers })
  Object.defineProperty(response, 'url', { value: row.receipt.url })
  return response
}
const fenced = async callback => {
  const saved = { fetch: globalThis.fetch, httpRequest: http.request, httpGet: http.get, httpsRequest: https.request, httpsGet: https.get }
  let leaks = 0
  const deny = () => { leaks++; throw new Error('Unexpected live request in retained Carlsberg replay') }
  globalThis.fetch = http.request = http.get = https.request = https.get = deny
  syncBuiltinESMExports()
  try { return await callback() }
  finally {
    globalThis.fetch = saved.fetch; http.request = saved.httpRequest; http.get = saved.httpGet; https.request = saved.httpsRequest; https.get = saved.httpsGet
    syncBuiltinESMExports(); assert.equal(leaks, 0, 'all five live-network fences remain unused')
  }
}
const replay = async (mode = 'native') => fenced(async () => {
  const physical = [], unread = [], queues = new Map()
  for (const row of rows) {
    const key = row.receipt.requestedUrl
    if (!queues.has(key)) queues.set(key, [])
    queues.get(key).push(row)
  }
  const transport = async (url, init) => {
    physical.push(url)
    assert.equal(init?.method ?? 'GET', 'GET')
    const row = queues.get(url)?.shift()
    if (!row) {
      unread.push(url)
      throw Object.assign(new Error('Actual declared public page has no retained response body'), { code: 'RETAINED_PUBLIC_BODY_UNAVAILABLE' })
    }
    return mode === 'page' ? { status: row.receipt.status, url: row.receipt.url, contentType: 'text/html', html: row.body } : originalResponse(row)
  }
  let jobs, failure
  try { jobs = await current.run(mode === 'page' ? { fetchPage: transport } : { fetchImpl: transport }) } catch (error) { failure = error }
  assert(unread.every(url => declaredPublicURLs.has(url) && !accountMode(url)), 'every unavailable page must be an actual active original public declaration; no invented response')
  assert.equal(failure, undefined, 'public observations survive local account refusal')
  assert(Array.isArray(jobs))
  const evidence = Object.getOwnPropertyDescriptor(jobs, 'nativeCollectionEvidence')?.value
  assert.equal(evidence?.source, 'carlsberg')
  assert.equal(evidence?.observedVacancyCount, 2, 'both original public native candidates remain represented')
  assert.equal(evidence?.sourceScopeComplete, false)
  assert.equal(evidence?.companyIndiaTotal, null)
  assert.equal(evidence?.companyGlobalTotal, null)
  assert.deepEqual(physical.filter(url => retainedURLs.has(url) && !accountMode(url)), receipts.slice(0, 5).map(row => row.requestedUrl), 'all unchanged public original reads survive')
  return { physical, unread, jobs, evidence }
})

test('genuine eight-response Carlsberg packet retains original bytes and three account-only modes', () => {
  assert.equal(rows.length, 8)
  assert.equal(rows.filter(row => accountMode(row.receipt.requestedUrl)).length, 3)
  assert.equal(current.SOURCE, 'carlsberg')
  assert.equal(current.COMPANY, 'Carlsberg')
  assert.equal(current.CAREERS_URL, receipts[0].requestedUrl)
})

test('actual current Carlsberg factory leaves account-only native handoffs unread while retaining both public candidates', async () => {
  const result = await replay()
  assert.equal(result.physical.filter(accountMode).length, 0, 'physical account/login/password/register reads must be zero')
  assert(result.unread.length > 0, 'later actually declared public discovery continues after account refusal; unretained bodies remain unread holds')
})

const boundary = transport => {
  assert.equal(typeof current.withPublicRecruitmentBoundary, 'function', 'source-private public transport boundary exists')
  return current.withPublicRecruitmentBoundary(transport)
}
const refused = error => error?.softFailure === true && error.failureKind === 'coverage_gap' && error.abortRetries === true
  && error.sourceScopeComplete === false && error.lifecycleCleanupAllowed === false

for (const row of rows.filter(row => accountMode(row.receipt.requestedUrl))) {
  const mode = new URL(row.receipt.requestedUrl).searchParams
  test('retained account mode stays before transport: ' + (mode.get('login_ns') ?? 'loginFlowRequired=true'), () => {
    let physical = 0
    const read = boundary(() => { physical++ })
    assert.throws(() => read(row.receipt.requestedUrl, { method: 'GET' }), refused)
    assert.equal(physical, 0)
  })
}

test('encoded case variants and explicit account paths remain unread without company/account pins', () => {
  const variants = [
    'https://career2.successfactors.eu/career?company=unrelated&%4cOGIN%5fNS=register',
    'https://career2.successfactors.eu/career?LogInFlOwReQuIrEd=TrUe',
    'https://careers.carlsberg.com/%72eGiStEr/',
    'https://careers.carlsberg.com/login/',
    'https://careers.carlsberg.com/sign-in/',
    'https://careers.carlsberg.com/registration/',
    'https://careers.carlsberg.com/forgot_password/',
    'https://careers.carlsberg.com/reset-password/'
  ]
  let physical = 0
  const read = boundary(() => { physical++ })
  for (const url of variants) assert.throws(() => read(url), refused)
  assert.equal(physical, 0)
})

test('harmless public queries and job-title text pass through unchanged', () => {
  const publicURLs = [
    ...receipts.slice(0, 5).map(row => row.requestedUrl),
    'https://careers.carlsberg.com/search/?loginFlowRequired=false&q=register',
    'https://careers.carlsberg.com/search/?q=login_ns&redirect=%2Fregister',
    'https://careers.carlsberg.com/search/?login_ns_extra=register',
    'https://careers.carlsberg.com/job/Login-Systems-Engineer/12345/'
  ]
  const calls = [], response = {}
  const read = boundary((...args) => { calls.push(args); return response })
  const init = { method: 'GET', headers: { Accept: 'text/html' } }
  for (const url of publicURLs) assert.equal(read(url, init), response)
  assert.deepEqual(calls, publicURLs.map(url => [url, init]))
  assert(calls.every(call => call[1] === init))
})

test('a later genuine public role remains readable after account refusal with exact Response/init/receiver', async () => {
  const role = rows[4], response = originalResponse(role), init = { method: 'GET', headers: { Accept: 'text/html' } }, receiver = {}, calls = []
  const read = boundary(function (...args) { assert.equal(this, receiver); calls.push(args); return response })
  assert.throws(() => read.call(receiver, rows[5].receipt.requestedUrl, init), refused)
  assert.equal(read.call(receiver, role.receipt.requestedUrl, init), response)
  assert.deepEqual(calls, [[role.receipt.requestedUrl, init]])
  assert.equal(calls[0][1], init)
  assert.equal(await response.text(), role.body)
})

test('public native transport errors retain their exact identity', async () => {
  const failure = new Error('original public transport failure'), url = rows[2].receipt.requestedUrl
  const syncRead = boundary(() => { throw failure })
  assert.throws(() => syncRead(url), error => error === failure)
  const asyncRead = boundary(() => Promise.reject(failure))
  await assert.rejects(asyncRead(url), error => error === failure)
})

test('existing fetchPage seam cannot bypass the same account boundary or lose public observations', async () => {
  const result = await replay('page')
  assert.equal(result.physical.filter(accountMode).length, 0)
})
