import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const moduleURL = new URL('../shared/workdaySourceAdmission.js', import.meta.url)
const admission = async () => {
  assert.ok(fs.existsSync(moduleURL), 'A bounded Workday full-board admission implementation is required')
  return import(moduleURL)
}
const sources = t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workday-admission-'))
  t.after(() => {
    const target = fs.realpathSync(directory)
    assert.equal(path.dirname(target), fs.realpathSync(os.tmpdir()))
    assert.ok(path.basename(target).startsWith('workday-admission-'))
    fs.rmSync(target, { recursive: true })
  })
  return (name, shard = 'wd981', configOverrides = {}) => {
    const sourceDirectory = path.join(directory, name)
    fs.mkdirSync(sourceDirectory)
    fs.writeFileSync(path.join(sourceDirectory, 'config.json'), JSON.stringify({
      listingStrategy: 'jobs-api', inventoryScope: 'complete-board-country-proof',
      jobsApiUrl: `https://${name}.${shard}.myworkdayjobs.com/wday/cxs/${name}/External/jobs`,
      detailUrlBase: `https://${name}.${shard}.myworkdayjobs.com/External`,
      officialCareersUrl: `https://${name}.example/careers`, ...configOverrides,
    }))
    return { name, provider: { atsPlatform: 'workday', sourceDirectory } }
  }
}

test('only an explicitly configured native full-board proof acquires admission', async t => {
  const { acquireWorkdaySourceAdmission: acquire } = await admission(), source = sources(t)
  assert.equal(await acquire({ name: 'other', provider: { atsPlatform: 'greenhouse' } }), null)
  assert.equal(await acquire(source('facet', 'wd981', { inventoryScope: 'india-country-facet' })), null)
  assert.equal(await acquire(source('mismatch', 'wd981', { jobsApiUrl: 'https://unrelated.wd981.myworkdayjobs.com/wday/cxs/unrelated/External/jobs' })), null)
  const lease = await acquire(source('native'))
  assert.equal(lease.groupKey, 'workday:wd981')
  assert.ok(lease.queueWaitMs >= 0)
  assert.equal(lease.signal.aborted, false)
  lease.release()
})

test('full-board admission is FIFO across tenants on one shard while another shard remains independent', async t => {
  const { acquireWorkdaySourceAdmission: acquire } = await admission(), source = sources(t), waits = []
  const first = await acquire(source('first'))
  let second, third
  const pendingSecond = acquire(source('second'), { onWait: value => waits.push(value) }).then(value => { second = value; return value })
  const pendingThird = acquire(source('third'), { onWait: value => waits.push(value) }).then(value => { third = value; return value })
  const independent = await acquire(source('independent', 'wd982'))
  assert.equal(second, undefined)
  assert.equal(third, undefined)
  assert.deepEqual(waits.map(wait => wait.queuePosition), [1, 2])
  assert.ok(waits.every(wait => wait.groupKey === 'workday:wd981'))
  independent.release()
  first.release()
  second = await pendingSecond
  assert.equal(third, undefined)
  first.release()
  await Promise.resolve()
  assert.equal(third, undefined, 'Releasing an old lease twice must not release the current holder')
  second.release()
  third = await pendingThird
  third.release()
})

test('caller cancellation removes a queued source and preserves its exact reason', async t => {
  const { acquireWorkdaySourceAdmission: acquire } = await admission(), source = sources(t)
  const first = await acquire(source('active')), controller = new AbortController(), reason = new Error('lifecycle ended while queued')
  const pending = acquire(source('cancelled'), { signal: controller.signal })
  const rejected = assert.rejects(pending, error => error === reason)
  controller.abort(reason)
  await rejected
  const next = acquire(source('next'))
  first.release()
  ;(await next).release()
})

test('the supplied lifecycle aborts an admitted operation while release waits for its owner to settle', async t => {
  const { acquireWorkdaySourceAdmission: acquire } = await admission(), source = sources(t)
  const controller = new AbortController(), reason = new Error('source lifecycle expired')
  let nextAdmitted = false
  const first = await acquire(source('active'), { signal: controller.signal })
  const next = acquire(source('next')).then(lease => { nextAdmitted = true; return lease })
  controller.abort(reason)
  assert.equal(first.signal.aborted, true)
  assert.equal(first.signal.reason, reason)
  await Promise.resolve()
  assert.equal(nextAdmitted, false, 'An aborted owner may still be settling its native requests')
  first.release()
  const second = await next
  assert.equal(second.signal.aborted, false)
  first.release()
  second.release()
})

test('direct calls have a finite thirty-minute admission and operation-cancellation deadline', async t => {
  const { acquireWorkdaySourceAdmission: acquire, DEFAULT_WORKDAY_SOURCE_ADMISSION_TIMEOUT_MS: timeoutMs } = await admission()
  assert.equal(timeoutMs, 1800000)
  const source = sources(t)
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  const first = await acquire(source('active'))
  t.mock.timers.tick(1)
  let nextAdmitted = false
  const pending = acquire(source('next')).then(lease => { nextAdmitted = true; return lease })
  t.mock.timers.tick(timeoutMs - 1)
  assert.equal(first.signal.aborted, true, 'The default deadline must abort the native operation signal')
  await Promise.resolve()
  assert.equal(nextAdmitted, false, 'The deadline must not admit work before the cancelled operation settles')
  first.release()
  const second = await pending
  assert.equal(second.queueWaitMs, timeoutMs - 1)
  assert.equal(second.signal.aborted, false)
  second.release()
})

test('an explicit bounded queue deadline rejects without releasing another active proof', async t => {
  const { acquireWorkdaySourceAdmission: acquire } = await admission(), source = sources(t)
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  const first = await acquire(source('active'))
  const pending = acquire(source('limited'), { admissionTimeoutMs: 25 })
  const rejected = assert.rejects(pending, error => error.code === 'WORKDAY_SOURCE_ADMISSION_TIMEOUT' && error.queueWaitMs === 25)
  t.mock.timers.tick(25)
  await rejected
  assert.equal(first.signal.aborted, false)
  first.release()
  ;(await acquire(source('next'))).release()
})

test('a queued deadline stays bounded while an aborted active owner is still settling', async t => {
  const { acquireWorkdaySourceAdmission: acquire } = await admission(), source = sources(t)
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  const controller = new AbortController(), first = await acquire(source('settling'), { signal: controller.signal })
  controller.abort(new Error('active operation cancelled'))
  const pending = acquire(source('limited'), { admissionTimeoutMs: 25 })
  const rejected = assert.rejects(pending, error => error.code === 'WORKDAY_SOURCE_ADMISSION_TIMEOUT' && error.queueWaitMs === 25)
  t.mock.timers.tick(25)
  await rejected
  assert.equal(first.signal.aborted, true)
  first.release()
  ;(await acquire(source('next'))).release()
})

test('pre-cancelled callers and invalid deadlines cannot reserve shard capacity', async t => {
  const { acquireWorkdaySourceAdmission: acquire } = await admission(), source = sources(t)
  const controller = new AbortController(), reason = new Error('already ended')
  controller.abort(reason)
  await assert.rejects(acquire(source('cancelled'), { signal: controller.signal }), error => error === reason)
  for (const [index, value] of [0, -1, Infinity, 1800001].entries()) await assert.rejects(acquire(source('invalid' + index), { admissionTimeoutMs: value }), /deadline/)
  ;(await acquire(source('next'))).release()
})
