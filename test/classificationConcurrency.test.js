import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import Job from '../src/models/Job.js'
import { classifySavedJobs } from '../scripts/classifySavedJobs.js'
import { aggregateClassificationSummaries } from '../classification/reporting.js'

const now = new Date('2026-11-06T04:00:00Z')
const prediction = { modelLabel: 'Full-time Experienced', fullDescriptionCovered: true, windows: 1,
  scores: { 'Full-time Experienced': .97, 'Full-time Fresher': .01, Intern: .01, Contract: .01 } }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

test('bounded classification overlap preserves Mongo ownership, cache reuse and failure boundaries', { timeout: 30000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } })
  t.after(async () => { await mongoose.disconnect(); await mongo.stop() })
  await mongoose.connect(mongo.getUri())
  const seed = async count => {
    await Job.deleteMany({})
    return Job.insertMany(Array.from({ length: count }, (_, index) => ({ title: `Engineer ${index}`,
      company: 'Concurrency Test', fingerprint: `overlap-${index}`, status: 'active', jobType: 'Unspecified',
      sourceDescription: 'Minimum 3 years of professional experience required. Build production services.' })))
  }

  await t.test('at most two admitted jobs overlap and every assignment finishes once', async () => {
    await seed(7)
    const bothEntered = deferred(), release = deferred()
    let active = 0, maximum = 0, requests = 0
    const rows = []
    const running = classifySavedJobs({ concurrency: 2, mode: 'policy', now: () => now,
      onResult: row => rows.push(row), worker: { classify: async () => {
        requests++; active++; maximum = Math.max(maximum, active)
        if (active === 2) bothEntered.resolve(true)
        await release.promise
        active--
        return prediction
      } } })
    const overlapped = await Promise.race([bothEntered.promise, delay(750).then(() => false)])
    release.resolve()
    const summary = await running
    assert.equal(overlapped, true, 'a second job must enter before the first inference finishes')
    assert.equal(maximum, 2)
    assert.equal(summary.concurrency, 2)
    assert.equal(summary.completed, 7)
    assert.equal(summary.failed, 0)
    assert.equal(requests, 7)
    assert.equal(new Set(rows.map(row => row.id)).size, 7)
    assert.equal(await Job.countDocuments({ 'postClassification.status': 'processing' }), 0)
    const rerun = await classifySavedJobs({ concurrency: 2, mode: 'policy', now: () => now,
      worker: { classify: async () => assert.fail('cached source reached inference') } })
    assert.equal(rerun.cached, 7)
    assert.equal(rerun.modelRequests, 0)
    const aggregate = aggregateClassificationSummaries([summary])
    assert.equal(aggregate.workers[0].concurrency, 2)
    assert.equal(aggregate.timingBasis, 'summed_operation_durations')
  })

  await t.test('omitting concurrency preserves serial library behavior', async () => {
    await seed(3)
    let active = 0, maximum = 0
    const summary = await classifySavedJobs({ mode: 'policy', now: () => now,
      worker: { classify: async () => {
        active++; maximum = Math.max(maximum, active)
        await delay(1)
        active--
        return prediction
      } } })
    assert.equal(maximum, 1)
    assert.equal(summary.concurrency, 1)
    assert.equal(summary.completed, 3)
  })

  await t.test('a source edit under overlap still rejects the old prediction', async () => {
    const jobs = await seed(3)
    const firstId = jobs[0]._id
    const summary = await classifySavedJobs({ concurrency: 3, mode: 'policy', now: () => now,
      worker: { classify: async input => {
        if (input.title === 'Engineer 0') await Job.updateOne({ _id: firstId }, { $set: {
          sourceDescription: 'No prior experience required. Fresh graduates welcome.' } })
        return prediction
      } } })
    assert.equal(summary.completed, 2)
    assert.equal(summary.stale, 1)
    const changed = await Job.findById(firstId).lean()
    assert.equal(changed.jobType, 'Unspecified')
    assert.equal(changed.postClassification.reason, 'source_changed')
    assert.equal(await Job.countDocuments({ 'postClassification.status': 'processing' }), 0)
  })

  await t.test('competing concurrent runs never publish or infer the same leased input twice', async () => {
    await seed(8)
    let requests = 0
    const worker = { classify: async () => { requests++; await delay(3); return prediction } }
    const results = await Promise.all([0, 1].map(() => classifySavedJobs({ concurrency: 2,
      mode: 'policy', now: () => now, worker })))
    assert.equal(results.reduce((sum, part) => sum+part.completed, 0), 8)
    assert.equal(requests, 8)
    assert.equal(await Job.countDocuments({ 'postClassification.status': 'completed' }), 8)
  })

  await t.test('leases cover healthy requests waiting in the serialized inference queue', async () => {
    await seed(4)
    let virtualTime = now.getTime(), submitted = 0, executed = 0, reported = 0, duplicateRequests = 0
    let queue = Promise.resolve()
    const allSubmitted = deferred(), fourthStarted = deferred(), releaseFourth = deferred(), threeReported = deferred()
    const worker = { classify: () => {
      if (++submitted === 4) allSubmitted.resolve()
      const next = queue.then(async () => {
        await allSubmitted.promise
        if (++executed === 4) { fourthStarted.resolve(); await releaseFourth.promise }
        virtualTime += 4*60*1000
        return prediction
      })
      queue = next.catch(() => {})
      return next
    } }
    const running = classifySavedJobs({ concurrency: 4, mode: 'policy', now: () => new Date(virtualTime), worker,
      onResult: row => { if (row.status === 'completed' && ++reported === 3) threeReported.resolve() } })
    let first, competitor
    try {
      await Promise.race([Promise.all([fourthStarted.promise, threeReported.promise]),
        delay(5000).then(() => { throw new Error('the serialized queue did not reach its fourth request') })])
      competitor = await classifySavedJobs({ mode: 'policy', now: () => new Date(virtualTime),
        worker: { classify: async () => { duplicateRequests++; return prediction } } })
    } finally { releaseFourth.resolve(); first = await running }
    assert.equal(duplicateRequests, 0, 'waiting for healthy requests must not expire a queued job lease')
    assert.equal(first.completed, 4)
    assert.equal(first.stale, 0)
    assert.equal(competitor.cached, 3)
    assert.equal(competitor.leased, 1)
  })

  await t.test('a diagnostic failure stops new admissions and drains already owned jobs', async () => {
    await seed(9)
    let requests = 0
    await assert.rejects(classifySavedJobs({ concurrency: 3, mode: 'policy', now: () => now,
      worker: { classify: async () => { requests++; await delay(15); return prediction } },
      onResult: () => { throw new Error('diagnostic destination unavailable') },
    }), /diagnostic destination unavailable/)
    assert.ok(requests >= 1 && requests <= 3, `admitted ${requests} requests after a fatal diagnostic failure`)
    assert.equal(await Job.countDocuments({ 'postClassification.status': 'processing' }), 0)
    assert.equal(await Job.countDocuments({ 'postClassification.status': 'completed' }), requests)
  })

  await t.test('invalid concurrency is rejected before scanning or inference', async () => {
    await seed(0)
    for (const concurrency of [0, -1, 1.5, 9, NaN]) {
      await assert.rejects(classifySavedJobs({ concurrency, worker: { classify: async () => prediction } }), /concurrency/i)
    }
  })
})
