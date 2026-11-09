import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { setImmediate } from 'node:timers/promises'
import test from 'node:test'
import { runScraperWithTimeout } from '../runner.js'
import { withRetry, getRetryPressure } from '../utils/retry.js'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const sources = t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-workday-admission-'))
  t.after(() => {
    const target = fs.realpathSync(directory)
    assert.equal(path.dirname(target), fs.realpathSync(os.tmpdir()))
    assert.ok(path.basename(target).startsWith('runner-workday-admission-'))
    fs.rmSync(target, { recursive: true })
  })
  return (name, run) => {
    const sourceDirectory = path.join(directory, name)
    fs.mkdirSync(sourceDirectory)
    fs.writeFileSync(path.join(sourceDirectory, 'config.json'), JSON.stringify({
      listingStrategy: 'jobs-api', inventoryScope: 'complete-board-country-proof',
      jobsApiUrl: `https://${name}.wd998.myworkdayjobs.com/wday/cxs/${name}/External/jobs`,
      detailUrlBase: `https://${name}.wd998.myworkdayjobs.com/External`,
      officialCareersUrl: `https://${name}.example/careers`,
    }))
    return { name, provider: { atsPlatform: 'workday', sourceDirectory }, run }
  }
}

test('Workday admission wait precedes the source timer and is preserved in source telemetry', async t => {
  const source = sources(t), started = deferred(), gate = deferred(), tasks = [], events = []
  t.after(async () => { gate.resolve([]); await Promise.allSettled(tasks) })
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  let secondStarted = false
  const first = withRetry(() => runScraperWithTimeout(source('first', async () => {
    started.resolve(); return gate.promise
  }), 1000, { nativeDetailRecovery: false }), { attempts: 1 })
  tasks.push(first)
  await started.promise
  const second = withRetry(() => runScraperWithTimeout(source('second', async () => {
    secondStarted = true; return []
  }), 5, { nativeDetailRecovery: false, onAdmission: event => events.push(event) }), { attempts: 1 })
  tasks.push(second)
  await setImmediate()
  assert.equal(secondStarted, false, 'A competing proof must wait for its shared shard')
  t.mock.timers.tick(20)
  await setImmediate()
  assert.equal(secondStarted, false, 'The five-millisecond attempt clock must not run while queued')
  gate.resolve([])
  await first
  const jobs = await second
  assert.equal(secondStarted, true)
  assert.equal(getRetryPressure(jobs).sourceAdmission.queueWaitMs, 20)
  assert.equal(getRetryPressure(jobs).sourceAdmission.admittedAttempts, 1)
  assert.deepEqual(getRetryPressure(jobs).sourceAdmission.groups, ['workday:wd998'])
  assert.deepEqual(events.map(event => event.status), ['waiting', 'admitted'])
})

test('cancelling a queued Workday source never starts its native operation', async t => {
  const source = sources(t), started = deferred(), gate = deferred(), tasks = [], controller = new AbortController()
  t.after(async () => { gate.resolve([]); await Promise.allSettled(tasks) })
  let secondStarted = false
  const first = runScraperWithTimeout(source('active', async () => { started.resolve(); return gate.promise }),
    1000, { nativeDetailRecovery: false })
  tasks.push(first)
  await started.promise
  const second = runScraperWithTimeout(source('cancelled', async () => { secondStarted = true; return [] }),
    1000, { nativeDetailRecovery: false, signal: controller.signal })
  tasks.push(second)
  const reason = new Error('cancel while queued')
  const rejected = assert.rejects(second, error => error === reason)
  await setImmediate()
  controller.abort(reason)
  await rejected
  assert.equal(secondStarted, false)
})

test('a failed Workday operation releases admission for the next native proof', async t => {
  const source = sources(t), started = deferred(), gate = deferred(), tasks = []
  t.after(async () => { gate.resolve([]); await Promise.allSettled(tasks) })
  let secondStarted = false
  const first = runScraperWithTimeout(source('failed', async () => { started.resolve(); return gate.promise }),
    1000, { nativeDetailRecovery: false })
  tasks.push(first)
  const rejected = assert.rejects(first, /native proof unavailable/)
  await started.promise
  const second = runScraperWithTimeout(source('next', async () => { secondStarted = true; return [] }),
    1000, { nativeDetailRecovery: false })
  tasks.push(second)
  await setImmediate()
  assert.equal(secondStarted, false)
  gate.reject(new Error('native proof unavailable'))
  await rejected
  assert.deepEqual(await second, [])
  assert.equal(secondStarted, true)
})
