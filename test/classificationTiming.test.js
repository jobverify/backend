import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import Job from '../src/models/Job.js'
import { classifySavedJobs } from '../scripts/classifySavedJobs.js'

const now = new Date('2026-11-04T04:00:00Z')
const prediction = { modelLabel: 'Full-time Experienced', fullDescriptionCovered: true,
  windows: 1, seconds: .002,
  scores: { 'Full-time Experienced': .97, 'Full-time Fresher': .01, Intern: .01, Contract: .01 } }

test('phase diagnostics preserve real Mongo outcomes and separate worker round trips from inference', async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } })
  t.after(async () => { await mongoose.disconnect(); await mongo.stop() })
  await mongoose.connect(mongo.getUri())

  // A deterministic monotonic clock measures the real runner without sleeps.
  // Persistence still goes to Mongo; only the clock and model boundary are controlled.
  let ticks = 0, calls = 0
  const originalUpdate = Job.updateOne.bind(Job)
  t.mock.method(Job, 'updateOne', (...args) => { ticks += 11; return originalUpdate(...args) })
  const run = async worker => {
    const rows = []
    const summary = await classifySavedJobs({ model: Job, mode: 'policy', now: () => now,
      monotonicNow: () => ticks++, worker,
      onResult: row => { ticks += 13; rows.push(row) }, onProgress: () => { ticks += 17 } })
    return { rows, summary }
  }
  const worker = { classify: async () => { calls++; ticks += 100; return prediction } }
  await Job.create({ title: 'Engineer', company: 'Timing Test', fingerprint: 'timing-complete',
    status: 'active', sourceDescription: 'Minimum 3 years of professional experience required.' })

  await t.test('successful results measure preparation, claim, model, decision, save and reporting', async () => {
    const { rows, summary } = await run(worker)
    assert.equal(summary.completed, 1)
    assert.equal(summary.failed, 0)
    assert.equal(summary.timingMs?.modelRoundTrip, 101)
    assert.equal(summary.timingMs.claim, 12)
    assert.equal(summary.timingMs.save, 12)
    assert.equal(summary.timingMs.reporting, 31)
    assert.ok(summary.timingMs.sourceRead > 0)
    assert.ok(summary.timingMs.input > 0)
    assert.ok(summary.timingMs.decision > 0)
    assert.equal(summary.inference.seconds, .002)
    assert.equal(rows[0].timingMs.modelRoundTrip, 101)
    assert.equal(rows[0].timingMs.save, 12)
    assert.equal(rows[0].timingMs.sourceRead, undefined, 'batched reads are run-level measurements')
    assert.equal(rows[0].timingMs.reporting, undefined, 'a diagnostic cannot include its own completed write')
    const saved = await Job.findOne({ fingerprint: 'timing-complete' }).lean()
    assert.equal(saved.postClassification.status, 'completed')
    assert.equal(saved.jobType, 'Full-time Experienced')
  })

  await t.test('cached results perform no claim, model or save work', async () => {
    const { rows, summary } = await run(worker)
    assert.equal(summary.cached, 1)
    assert.equal(calls, 1)
    assert.equal(summary.timingMs?.modelRoundTrip, 0)
    assert.equal(summary.timingMs.claim, 0)
    assert.equal(summary.timingMs.save, 0)
    assert.equal(summary.timingMs.reporting, 31)
    assert.equal(rows[0].modelRequest, false)
  })

  await t.test('failed inference retains its round-trip time and records the failure save', async () => {
    await Job.deleteMany({})
    await Job.create({ title: 'Engineer', company: 'Timing Test', fingerprint: 'timing-failure',
      status: 'active', sourceDescription: 'Build and test employer production services.' })
    const { rows, summary } = await run({ classify: async () => { ticks += 50; throw new Error('test worker failure') } })
    assert.equal(summary.failed, 1)
    assert.equal(summary.timingMs?.modelRoundTrip, 51)
    assert.equal(summary.timingMs.save, 12)
    assert.equal(rows[0].status, 'failed')
    const saved = await Job.findOne({ fingerprint: 'timing-failure' }).lean()
    assert.equal(saved.postClassification.status, 'failed')
  })

  await t.test('missing input measures a skip save without claiming or calling the model', async () => {
    await Job.deleteMany({})
    await Job.create({ title: 'Engineer', company: 'Timing Test', fingerprint: 'timing-skipped', status: 'active' })
    const { rows, summary } = await run({ classify: async () => assert.fail('missing input reached inference') })
    assert.equal(summary.skipped, 1)
    assert.equal(summary.timingMs?.modelRoundTrip, 0)
    assert.equal(summary.timingMs.claim, 0)
    assert.equal(summary.timingMs.save, 12)
    assert.equal(rows[0].status, 'skipped')
  })
})
