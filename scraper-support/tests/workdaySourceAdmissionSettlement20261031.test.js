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

test('an aborted active Workday lease stays exclusive until the runner settles the first operation', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workday-settlement-'))
  const source = (name, run) => {
    const sourceDirectory = path.join(directory, name)
    fs.mkdirSync(sourceDirectory)
    fs.writeFileSync(path.join(sourceDirectory, 'config.json'), JSON.stringify({
      listingStrategy: 'jobs-api', inventoryScope: 'complete-board-country-proof',
      jobsApiUrl: `https://${name}.wd987.myworkdayjobs.com/wday/cxs/${name}/External/jobs`,
      detailUrlBase: `https://${name}.wd987.myworkdayjobs.com/External`,
      officialCareersUrl: `https://${name}.example/careers`,
    }))
    return { name, provider: { atsPlatform: 'workday', sourceDirectory }, run }
  }
  const gate = deferred(), started = deferred(), tasks = [], controller = new AbortController()
  t.after(async () => {
    gate.resolve([])
    await Promise.allSettled(tasks)
    const target = fs.realpathSync(directory)
    assert.equal(path.dirname(target), fs.realpathSync(os.tmpdir()))
    assert.ok(path.basename(target).startsWith('workday-settlement-'))
    fs.rmSync(target, { recursive: true })
  })
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  let secondStarted = false, activeSignal
  const first = runScraperWithTimeout(source('active', async ({ signal }) => {
    activeSignal = signal
    started.resolve()
    return gate.promise // Deliberately settles after the abort notification.
  }), 1000, { signal: controller.signal, abortGraceMs: 100, nativeDetailRecovery: false })
  tasks.push(first)
  const reason = new Error('active lifecycle cancelled')
  const firstRejected = assert.rejects(first, error => error === reason)
  await started.promise
  const second = runScraperWithTimeout(source('queued', async () => { secondStarted = true; return [] }),
    1000, { nativeDetailRecovery: false })
  tasks.push(second)
  await setImmediate()
  assert.equal(secondStarted, false)
  controller.abort(reason)
  await setImmediate()
  assert.equal(activeSignal.aborted, true)
  assert.equal(secondStarted, false, 'Abort notification is not settlement of the previous native operation')
  t.mock.timers.tick(99)
  await setImmediate()
  assert.equal(secondStarted, false, 'The runner must retain admission throughout its abort settlement wait')
  gate.resolve([])
  await firstRejected
  assert.deepEqual(await second, [])
  assert.equal(secondStarted, true)
})
