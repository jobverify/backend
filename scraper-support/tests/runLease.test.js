import assert from 'node:assert/strict'
import test from 'node:test'
import * as runLease from '../utils/runLease.js'
import { isMongoOperationalError } from '../../src/utils/mongoOperationalError.js'

import {
  acquireMongoRunLease,
  MongoRunLeaseHeldError,
} from '../utils/runLease.js'

const waitForLease = options => {
  assert.equal(typeof runLease.waitForMongoRunLease, 'function', 'bounded lease waiting is available')
  return runLease.waitForMongoRunLease(options)
}

test('Mongo run lease releases only the owner record', async () => {
  const calls = []
  const collection = {
    findOneAndUpdate: async () => ({ ownerId: 'owner-a' }),
    deleteOne: async (filter) => {
      calls.push(filter)
      return { deletedCount: 1 }
    },
  }

  const lease = await acquireMongoRunLease({
    collection,
    ownerId: 'owner-a',
    heartbeatIntervalMs: 0,
  })
  await lease.release()

  assert.deepEqual(calls, [{ _id: 'jobverify-live-scraper', ownerId: 'owner-a' }])
})

test('Mongo run lease reports the active owner instead of allowing a duplicate run', async () => {
  const collection = {
    findOneAndUpdate: async () => {
      const error = new Error('duplicate key')
      error.code = 11000
      throw error
    },
    findOne: async () => ({
      ownerId: 'owner-existing',
      hostname: 'build-host',
      pid: 4421,
      expiresAt: new Date('2026-09-12T06:02:00.000Z'),
    }),
  }

  await assert.rejects(
    acquireMongoRunLease({
      collection,
      ownerId: 'owner-new',
      heartbeatIntervalMs: 0,
      now: () => new Date('2026-09-12T06:00:00.000Z'),
    }),
    (error) => {
      assert.ok(error instanceof MongoRunLeaseHeldError)
      assert.match(error.message, /build-host/)
      assert.match(error.message, /4421/)
      return true
    },
  )
})

test('held leases are retryable contention rather than database unavailability', () => {
  const error = new MongoRunLeaseHeldError({ ownerId: 'existing' })
  assert.equal(isMongoOperationalError(error), false)
  assert.equal(error.failureKind, 'run_lease_held')
  assert.equal(error.retryable, true)
  assert.equal(error.exitCode, 75)
})

test('bounded waiting acquires a released lease without replacing a live owner', async () => {
  let elapsed = 0
  let active = true
  const calls = []
  const waits = []
  const collection = {
    findOneAndUpdate: async filter => {
      calls.push(filter)
      if (active) throw Object.assign(new Error('duplicate key'), { code: 11000 })
      return { ownerId: 'new-owner' }
    },
    findOne: async () => ({ ownerId: 'existing', expiresAt: new Date(60000) }),
    deleteOne: async filter => { calls.push(filter) },
  }
  const lease = await waitForLease({
    acquire: () => acquireMongoRunLease({ collection, ownerId: 'new-owner', heartbeatIntervalMs: 0, now: () => new Date(elapsed) }),
    waitTimeoutMs: 3000, retryIntervalMs: 1000, clock: () => elapsed,
    wait: async delay => { waits.push(delay); elapsed += delay; active = false },
  })
  assert.deepEqual(waits, [1000])
  assert.equal(lease.ownerId, 'new-owner')
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0].$or, [{ expiresAt: { $lte: new Date(0) } }, { ownerId: 'new-owner' }])
  await lease.release()
  assert.deepEqual(calls.at(-1), { _id: 'jobverify-live-scraper', ownerId: 'new-owner' })
})

test('bounded waiting can acquire an expired lease through the existing atomic expiry filter', async () => {
  let elapsed = 0
  let attempts = 0
  const collection = {
    async findOneAndUpdate(filter) {
      attempts++
      if (filter.$or[0].expiresAt.$lte.getTime() < 1500) throw Object.assign(new Error('duplicate key'), { code: 11000 })
      return { ownerId: 'new-owner' }
    },
    findOne: async () => ({ ownerId: 'expired-owner', expiresAt: new Date(1500) }),
  }
  const lease = await waitForLease({
    acquire: () => acquireMongoRunLease({ collection, ownerId: 'new-owner', heartbeatIntervalMs: 0, now: () => new Date(elapsed) }),
    waitTimeoutMs: 3000, retryIntervalMs: 1000, clock: () => elapsed,
    wait: async delay => { elapsed += delay },
  })
  assert.equal(lease.ownerId, 'new-owner')
  assert.equal(attempts, 3)
  assert.equal(elapsed, 2000)
})

test('a renewing owner is never replaced when the wait deadline expires', async () => {
  let elapsed = 0
  let attempts = 0
  const notices = []
  await assert.rejects(waitForLease({
    acquire: async () => {
      attempts++
      throw new MongoRunLeaseHeldError({ ownerId: 'renewing', runId: 'other-run', expiresAt: new Date(elapsed + 60000) })
    },
    waitTimeoutMs: 2500, retryIntervalMs: 1000, clock: () => elapsed,
    wait: async delay => { elapsed += delay },
    onWait: (error, details) => notices.push({ owner: error.lease.ownerId, ...details }),
  }), error => {
    assert.ok(error instanceof MongoRunLeaseHeldError)
    assert.equal(error.lease.ownerId, 'renewing')
    assert.equal(error.waitedMs, 2500)
    return true
  })
  assert.equal(attempts, 4)
  assert.equal(elapsed, 2500)
  assert.deepEqual(notices.map(value => value.delayMs), [1000, 1000, 500])
})

test('zero waiting attempts acquisition once and non-lease failures propagate immediately', async () => {
  for (const error of [new MongoRunLeaseHeldError(), Object.assign(new Error('offline'), { name: 'MongoNetworkError' }), new TypeError('bug')]) {
    let attempts = 0
    await assert.rejects(waitForLease({
      acquire: async () => { attempts++; throw error }, waitTimeoutMs: 0,
      wait: async () => assert.fail('must not wait'),
    }), value => value === error)
    assert.equal(attempts, 1)
  }
})

test('cancellation before and during lease waiting prevents further acquisition', async () => {
  const before = new AbortController()
  before.abort(new Error('cancelled before acquisition'))
  await assert.rejects(waitForLease({ acquire: () => assert.fail('already cancelled'), signal: before.signal }), before.signal.reason)

  const during = new AbortController()
  let attempts = 0
  const promise = waitForLease({
    acquire: async () => { attempts++; throw new MongoRunLeaseHeldError() },
    signal: during.signal, retryIntervalMs: 60000,
    onWait: () => setImmediate(() => during.abort(new Error('cancelled during wait'))),
  })
  await assert.rejects(promise, during.signal.reason || /cancelled|abort/i)
  assert.equal(attempts, 1)
})

test('invalid wait budgets fail before attempting database acquisition', async () => {
  for (const options of [{ waitTimeoutMs: -1 }, { waitTimeoutMs: NaN }, { waitTimeoutMs: Infinity }, { retryIntervalMs: 0 }]) {
    await assert.rejects(waitForLease({ ...options, acquire: () => assert.fail('invalid budget') }), RangeError)
  }
})
