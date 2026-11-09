import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { setImmediate } from 'node:timers/promises'
import test from 'node:test'

import { run } from '../../scraper/generalmills.workday/script.js'
import { WorkdayRequestScheduler } from '../myworkday/requestScheduler.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const folder = new URL('../../scraper/generalmills.workday/fixtures/current-20261029/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder)))
const receipts = manifest.requests.map(row => {
  const body = gunzipSync(fs.readFileSync(new URL(row.filename, folder)))
  assert.equal(createHash('sha256').update(body).digest('hex'), row.bodySHA256)
  return { ...row, body }
})

test('General Mills reconciles its captured global board within 210 seconds at one-second native latency', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse(manifest.requests[0].requestedAt) })
  const startedAt = Date.now(), queues = new Map(), detailReads = new Map(), starts = []
  let active = 0, maxActive = 0
  for (const row of receipts) {
    const key = JSON.stringify([row.method, row.url, row.requestBody])
    if (!queues.has(key)) queues.set(key, [])
    queues.get(key).push(row)
  }
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input), key = JSON.stringify([init.method || 'GET', url, init.body || null])
    const queue = queues.get(key)
    assert.ok(queue?.length, 'Only the captured official native requests are permitted: ' + key)
    const row = queue.length > 1 ? queue.shift() : queue[0]
    starts.push(Date.now())
    if (url.includes('/job/')) detailReads.set(url, (detailReads.get(url) || 0) + 1)
    active++
    maxActive = Math.max(maxActive, active)
    await new Promise(resolve => setTimeout(resolve, 1000))
    active--
    const response = new Response(row.body, { status: row.status, headers: row.headers })
    Object.defineProperty(response, 'url', { value: row.finalURL })
    return response
  })
  let completion
  const pending = run({ now: () => manifest.capturedAt, requestScheduler: new WorkdayRequestScheduler(),
    nativeDetailRecovery: false }).then(jobs => { completion = { jobs } }, error => { completion = { error } })
  for (let step = 0; !completion && step < 2000; step++) {
    await setImmediate()
    t.mock.timers.tick(250)
  }
  assert.ok(completion, 'The bounded proof must settle')
  await pending
  assert.ifError(completion.error)
  assert.equal(completion.jobs.length, manifest.returnedIndiaRoles)
  assert.ok(Date.now() - startedAt < 210000,
    'Sequential closing details must not exhaust the runner deadline: ' + (Date.now() - startedAt) + 'ms')
  const indiaDetails = new Set(completion.jobs.map(job => job.link.replace('/GMI_External_Careers/job/', '/wday/cxs/genmills/GMI_External_Careers/job/')))
  for (const [url, count] of detailReads) assert.equal(count, indiaDetails.has(url) ? 2 : 1,
    'Every India role must retain its independent fresh closing detail read')
  assert.ok(maxActive <= 4, 'The repair must preserve the existing shard capacity')
  assert.ok(starts.every((start, index) => !index || start - starts[index - 1] >= 250),
    'Concurrent closing workers must preserve request pacing')
  const board = completion.jobs[0].sourceBoardInventories[0]
  assert.equal(board.reconciliation.initial.sha256, board.reconciliation.closing.sha256)
  assert.equal(board.reconciliation.initial.count, board.reportedTotal)
  assert.equal(board.reconciliation.closing.count, board.reportedTotal)
  assert.equal(readInventoryEvidence(completion.jobs).listingComplete, false)
  assert.ok(completion.jobs.every(job => job.lifecycleCleanupAllowed === false))
  t.diagnostic('Reconciled ' + completion.jobs.length + ' India roles in ' + (Date.now() - startedAt) + 'ms with ' + starts.length + ' paced requests')
})

