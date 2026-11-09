import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { setImmediate } from 'node:timers/promises'
import test from 'node:test'
import { runScraperWithTimeout } from '../runner.js'

const deferred = () => {
  let resolve
  const promise = new Promise(yes => { resolve = yes })
  return { promise, resolve }
}
const setup = t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workday-grace-expiry-'))
  const gate = deferred(), started = deferred(), tasks = []
  t.after(async () => {
    gate.resolve([])
    await Promise.allSettled(tasks)
    const target = fs.realpathSync(directory)
    assert.equal(path.dirname(target), fs.realpathSync(os.tmpdir()))
    assert.ok(path.basename(target).startsWith('workday-grace-expiry-'))
    fs.rmSync(target, { recursive: true })
  })
  const source = (name, run) => {
    const sourceDirectory = path.join(directory, name)
    fs.mkdirSync(sourceDirectory)
    fs.writeFileSync(path.join(sourceDirectory, 'config.json'), JSON.stringify({
      listingStrategy: 'jobs-api', inventoryScope: 'complete-board-country-proof',
      jobsApiUrl: `https://${name}.wd986.myworkdayjobs.com/wday/cxs/${name}/External/jobs`,
      detailUrlBase: `https://${name}.wd986.myworkdayjobs.com/External`,
      officialCareersUrl: `https://${name}.example/careers`,
    }))
    return { name, provider: { atsPlatform: 'workday', sourceDirectory }, run }
  }
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  return { gate, started, tasks, source }
}

for (const nativeDetailRecovery of [false, true]) for (const kind of ['cancellation', 'timeout']) {
  test(`Workday ${kind} beyond abort grace retains admission until actual settlement (recovery=${nativeDetailRecovery})`, async t => {
    const { gate, started, tasks, source } = setup(t), controller = new AbortController()
    let secondStarted = false, nativeSettled = false
    const first = runScraperWithTimeout(source('active', async () => {
      started.resolve()
      await gate.promise // Deliberately ignores cancellation longer than grace.
      nativeSettled = true
      return []
    }), kind === 'timeout' ? 50 : 1000, { signal: controller.signal, abortGraceMs: 10, nativeDetailRecovery })
    tasks.push(first)
    const reason = Error('cancel the caller while native work remains active')
    const rejected = assert.rejects(first, error => kind === 'cancellation' ? error === reason : error.name === 'ScraperSourceTimeoutError')
    await started.promise
    const second = runScraperWithTimeout(source('queued', async () => { secondStarted = true; return [] }), 1000,
      { nativeDetailRecovery: false, admissionTimeoutMs: 500 })
    tasks.push(second)
    await setImmediate()
    if (kind === 'cancellation') controller.abort(reason)
    else t.mock.timers.tick(50)
    await setImmediate()
    t.mock.timers.tick(11)
    await rejected
    assert.equal(nativeSettled, false)
    assert.equal(secondStarted, false, 'Returning to a timed-out caller cannot release an active native board')
    gate.resolve([])
    assert.deepEqual(await second, [])
    assert.equal(nativeSettled, true)
    assert.equal(secondStarted, true)
  })
}

test('queued Workday admission still expires while an uncooperative native operation is quarantined', async t => {
  const { gate, started, tasks, source } = setup(t), controller = new AbortController()
  let queuedStarted = false
  const first = runScraperWithTimeout(source('active', async () => { started.resolve(); return gate.promise }), 1000,
    { signal: controller.signal, abortGraceMs: 10, nativeDetailRecovery: false })
  tasks.push(first)
  const reason = Error('caller deadline')
  const firstRejected = assert.rejects(first, error => error === reason)
  await started.promise
  const queued = runScraperWithTimeout(source('queued', async () => { queuedStarted = true; return [] }), 1000,
    { nativeDetailRecovery: false, admissionTimeoutMs: 40 })
  tasks.push(queued)
  const queueRejected = assert.rejects(queued, error => error.code === 'WORKDAY_SOURCE_ADMISSION_TIMEOUT' && error.phase === 'queue')
  await setImmediate()
  controller.abort(reason)
  await setImmediate()
  t.mock.timers.tick(11)
  await firstRejected
  t.mock.timers.tick(30)
  await queueRejected
  assert.equal(queuedStarted, false)
})
