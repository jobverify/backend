import { randomUUID } from 'node:crypto'
import os from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'
import mongoose from 'mongoose'

import connectDB from '../../db/db.js'

export const DEFAULT_RUN_LEASE_ID = 'jobverify-live-scraper'
export const DEFAULT_RUN_LEASE_MS = 2 * 60 * 1000
export const DEFAULT_RUN_LEASE_HEARTBEAT_MS = 30 * 1000
export const DEFAULT_RUN_LEASE_WAIT_MS = 5 * 60 * 1000
export const DEFAULT_RUN_LEASE_RETRY_MS = 5 * 1000

export class MongoRunLeaseHeldError extends Error {
  constructor(lease = {}) {
    const owner = [lease.hostname, lease.pid].filter(Boolean).join(':') || lease.ownerId || 'unknown owner'
    super(
      `Another live scraper owns the MongoDB run lease (${owner}) until `
      + `${lease.expiresAt ? new Date(lease.expiresAt).toISOString() : 'an unknown time'}.`,
    )
    this.name = 'MongoRunLeaseHeldError'
    this.exitCode = 75
    this.failureKind = 'run_lease_held'
    this.retryable = true
    this.lease = lease
  }
}

// Recheck ownership through the atomic acquisition query. Never delete another
// owner's record or assume an observed expiry cannot be renewed while waiting.
export const waitForMongoRunLease = async ({
  acquire = () => acquireMongoRunLease(),
  waitTimeoutMs = DEFAULT_RUN_LEASE_WAIT_MS,
  retryIntervalMs = DEFAULT_RUN_LEASE_RETRY_MS,
  signal,
  wait = (milliseconds, stopSignal) => delay(milliseconds, undefined, { signal: stopSignal }),
  clock = () => performance.now(),
  onWait = () => {},
} = {}) => {
  if (!Number.isSafeInteger(waitTimeoutMs) || waitTimeoutMs < 0
    || !Number.isSafeInteger(retryIntervalMs) || retryIntervalMs <= 0) {
    throw new RangeError('Lease wait must be a nonnegative integer and retry interval a positive integer in milliseconds.')
  }
  const startedAt = clock()
  for (;;) {
    signal?.throwIfAborted()
    try {
      const lease = await acquire()
      if (signal?.aborted) {
        try { await lease.release() } finally { signal.throwIfAborted() }
      }
      return lease
    } catch (error) {
      signal?.throwIfAborted()
      if (!(error instanceof MongoRunLeaseHeldError)) throw error
      const waitedMs = Math.max(0, clock() - startedAt)
      const remainingMs = waitTimeoutMs - waitedMs
      if (remainingMs <= 0) {
        error.waitedMs = waitedMs
        throw error
      }
      const delayMs = Math.min(retryIntervalMs, remainingMs)
      onWait(error, { waitedMs, remainingMs, delayMs })
      try { await wait(delayMs, signal) }
      catch (waitError) { signal?.throwIfAborted(); throw waitError }
    }
  }
}

const resolveCollection = async (collection) => {
  if (collection) return collection
  if (mongoose.connection.readyState === 0) await connectDB()
  return mongoose.connection.db.collection('scraper_run_leases')
}

export const acquireMongoRunLease = async ({
  collection = null,
  leaseId = DEFAULT_RUN_LEASE_ID,
  ownerId = randomUUID(),
  runId = null,
  leaseMs = DEFAULT_RUN_LEASE_MS,
  heartbeatIntervalMs = DEFAULT_RUN_LEASE_HEARTBEAT_MS,
  hostname = os.hostname(),
  pid = process.pid,
  now = () => new Date(),
  onLost = (error) => console.error(`[runner] MongoDB run lease lost: ${error.message}`),
} = {}) => {
  const leases = await resolveCollection(collection)
  const acquiredAt = now()
  const expiresAt = new Date(acquiredAt.getTime() + leaseMs)
  let document

  try {
    document = await leases.findOneAndUpdate(
      {
        _id: leaseId,
        $or: [
          { expiresAt: { $lte: acquiredAt } },
          { ownerId },
        ],
      },
      {
        $set: {
          ownerId,
          runId,
          hostname,
          pid,
          acquiredAt,
          heartbeatAt: acquiredAt,
          expiresAt,
        },
      },
      { upsert: true, returnDocument: 'after' },
    )
  } catch (error) {
    if (error?.code !== 11000) throw error
    const activeLease = await leases.findOne({ _id: leaseId })
    throw new MongoRunLeaseHeldError(activeLease || {})
  }

  if (!document || document.ownerId !== ownerId) {
    throw new MongoRunLeaseHeldError(document || {})
  }

  let released = false
  let renewing = false
  let lossReported = false
  const renew = async () => {
    if (released || renewing) return
    renewing = true
    try {
      const heartbeatAt = now()
      const result = await leases.updateOne(
        { _id: leaseId, ownerId },
        {
          $set: {
            heartbeatAt,
            expiresAt: new Date(heartbeatAt.getTime() + leaseMs),
          },
        },
      )
      if (result.matchedCount !== 1) {
        throw new MongoRunLeaseHeldError(await leases.findOne({ _id: leaseId }) || {})
      }
    } catch (error) {
      if (!lossReported) {
        lossReported = true
        onLost(error)
      }
    } finally {
      renewing = false
    }
  }

  const heartbeatTimer = heartbeatIntervalMs > 0
    ? setInterval(renew, heartbeatIntervalMs)
    : null
  heartbeatTimer?.unref?.()

  return {
    ownerId,
    async release() {
      if (released) return
      released = true
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      await leases.deleteOne({ _id: leaseId, ownerId })
    },
  }
}
