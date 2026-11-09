import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { setImmediate } from 'node:timers/promises'
import test from 'node:test'
import { runWorkdayScraper } from '../myworkday/engine.js'

const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/workdayCountryInventoryProof/capture.json.gz', import.meta.url))))
const packet = name => {
  const receipt = capture.responses[name], body = Buffer.from(receipt.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(body).digest('hex'), receipt.sha256)
  return { ...receipt, body }
}
const response = (url, body, type = 'application/json') => {
  const result = new Response(body, { headers: { 'content-type': type } })
  Object.defineProperty(result, 'url', { value: url })
  return result
}
const deferred = () => {
  let resolve, reject
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail })
  return { promise, resolve, reject }
}
const flush = async () => { for (let turn = 0; turn < 8; turn++) await setImmediate() }

const setup = async (t, { proof = true, caller = null } = {}) => {
  const api = packet('csg-initial').url, board = 'https://csgi.wd5.myworkdayjobs.com/CSGCareers'
  const initial = JSON.parse(packet('csg-initial').body)
  const recorded = job => Object.values(capture.responses).some(row => row.url === api.replace(/\/jobs$/, '') + job.externalPath)
  initial.jobPostings = [...initial.jobPostings.filter(recorded).slice(0, 2), initial.jobPostings.find(job => !recorded(job))]
  initial.total = initial.jobPostings.length
  if (!proof) for (const job of initial.jobPostings) job.locationsText = 'Bengaluru, Karnataka, India'
  const nativeUrls = initial.jobPostings.map(job => api.replace(/\/jobs$/, '') + job.externalPath)
  const nativeBodies = nativeUrls.slice(0, 2).map(url => {
    const receipt = Object.values(capture.responses).find(row => row.url === url)
    assert.ok(receipt, 'Expected recorded native CSG role ' + url)
    const body = Buffer.from(receipt.bodyBase64, 'base64')
    assert.equal(createHash('sha256').update(body).digest('hex'), receipt.sha256)
    return JSON.parse(body)
  })
  nativeBodies[0].jobPostingInfo.jobReqId = 'UNRELATED-NATIVE-ROLE'
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workday-worker-settlement-'))
  fs.writeFileSync(path.join(directory, 'config.json'), JSON.stringify({ listingStrategy: 'jobs-api', jobsApiUrl: api,
    detailUrlBase: 'https://csgi.wd5.myworkdayjobs.com/en-US/CSGCareers', locationCountry: null, searchText: '',
    ...(proof && { inventoryScope: 'complete-board-country-proof', officialCareersUrl: 'https://www.csgi.com/careers' }) }))
  const previousConcurrency = process.env.WORKDAY_DETAIL_FETCH_CONCURRENCY
  process.env.WORKDAY_DETAIL_FETCH_CONCURRENCY = '2'
  const gates = [deferred(), deferred()], started = deferred(), requests = [], slots = new Set()
  let settled = false, failure
  t.mock.method(globalThis, 'fetch', async (input, options = {}) => {
    const url = String(input), index = nativeUrls.indexOf(url)
    if (url === 'https://www.csgi.com/careers') return response(url, packet('csg-corporate').body, 'text/html')
    if (url === board || url === 'https://csgi.wd5.myworkdayjobs.com/en-US/CSGCareers') return response(url, '<title>Workday careers</title>', 'text/html')
    if (url === api && options.method === 'POST') return response(url, JSON.stringify(initial))
    assert.ok(index >= 0 && index < 2, 'No unvisited tail role may start after a fatal worker error: ' + url)
    requests.push({ index, signal: options.signal })
    if (requests.length === 2) started.resolve()
    // Deliberately hold transport settlement after abort to prove the source
    // awaits native workers, rather than merely racing their AbortSignals.
    return gates[index].promise
  })
  const operation = runWorkdayScraper({ source: 'csg-worker-settlement', company: 'CSG', baseUrl: board, scraperDir: directory,
    signal: caller?.signal, nativeDetailRecovery: false, requestTimeoutMs: 10000, retryBaseDelayMs: 0,
    requestScheduler: { minIntervalMs: 0, recordRateLimit() {}, acquire: async () => {
      const slot = Symbol('native-request'); slots.add(slot); return () => slots.delete(slot)
    } },
  }).then(() => { settled = true }, error => { failure = error; settled = true })
  t.after(async () => {
    gates.forEach((gate, index) => gate.resolve(response(nativeUrls[index], JSON.stringify(nativeBodies[index]))))
    await operation
    assert.equal(slots.size, 0, 'Every request scheduler lease must settle before source completion')
    if (previousConcurrency === undefined) delete process.env.WORKDAY_DETAIL_FETCH_CONCURRENCY
    else process.env.WORKDAY_DETAIL_FETCH_CONCURRENCY = previousConcurrency
    const target = fs.realpathSync(directory)
    assert.equal(path.dirname(target), fs.realpathSync(os.tmpdir()))
    assert.ok(path.basename(target).startsWith('workday-worker-settlement-'))
    fs.rmSync(target, { recursive: true })
  })
  await Promise.race([started.promise, operation.then(() => { throw failure || new Error('Source completed before both controlled workers started') })])
  return { gates, requests, slots, operation, nativeUrls, nativeBodies, get settled() { return settled }, get failure() { return failure } }
}

for (const proof of [true, false]) test('fatal Workday ' + (proof ? 'required-scope' : 'detail') + ' identity validation cancels peers and awaits their actual settlement', async t => {
  const state = await setup(t, { proof })
  state.gates[0].resolve(response(state.nativeUrls[0], JSON.stringify(state.nativeBodies[0])))
  await flush()
  assert.equal(state.settled, false, 'The source must retain ownership while its native peer is settling')
  assert.equal(state.requests[1].signal.aborted, true, 'The first fatal identity validation must cancel the active native peer')
  const originalFailure = state.requests[1].signal.reason
  assert.equal(state.slots.size, 1)
  state.gates[1].reject(originalFailure)
  await state.operation
  assert.equal(state.failure, originalFailure, 'Peer cancellation must not replace the first native validation error')
  assert.match([state.failure.message, state.failure.cause?.message].join(' '), /identity|requisition|canonical/i)
  assert.equal(state.requests.length, 2)
  assert.equal(state.slots.size, 0)
})

test('Workday caller cancellation keeps all native workers owned until the aborted requests settle', async t => {
  const caller = new AbortController(), reason = Object.freeze(new Error('caller-cancelled-native-workers'))
  const state = await setup(t, { caller })
  caller.abort(reason)
  await flush()
  assert.equal(state.requests.every(request => request.signal.aborted && request.signal.reason === reason), true)
  assert.equal(state.settled, false)
  state.gates[0].reject(reason)
  await flush()
  assert.equal(state.settled, false)
  state.gates[1].reject(reason)
  await state.operation
  assert.equal(state.failure, reason)
  assert.equal(state.slots.size, 0)
})
