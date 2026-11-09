import assert from 'node:assert/strict'
import test from 'node:test'
import mongoose from 'mongoose'

import Job from '../../src/models/Job.js'
import JobDatasetSummary from '../../src/models/JobDatasetSummary.js'
import ScraperRun from '../../src/models/ScraperRun.js'
import ScraperStatus from '../../src/models/ScraperStatus.js'
import { resolveZeroJobOutcome, runAll } from '../runner.js'
import {
  upsertScraperStatus,
  writeScraperRun,
  readPreviousScraperRun,
} from '../utils/scraperPersistence.js'
import { generateFingerprint, saveToDB as persistJobs } from '../utils/saveToDB.js'

// These persistence fixtures stub MongoDB; transactional alert behavior has its own replica-set suite.
const saveToDB = (jobs, source, options = {}) => persistJobs(jobs, source, { enqueueAlerts: false, enrichPublicExperience: false, ...options })
import { DEFAULT_JOB_RETENTION_DAYS } from '../../src/utils/jobLifecycle.js'
import { attachInventoryEvidence } from '../utils/inventoryEvidence.js'

const setReadyState = (value) => {
  const hadOwn = Object.prototype.hasOwnProperty.call(mongoose.connection, 'readyState')
  const original = hadOwn
    ? Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState')
    : null

  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    value,
  })

  return () => {
    if (hadOwn && original) {
      Object.defineProperty(mongoose.connection, 'readyState', original)
      return
    }

    delete mongoose.connection.readyState
  }
}

const setMongoUri = (value = 'mongodb://127.0.0.1:27017/jobverify-test') => {
  const original = process.env.MONGO_URI
  process.env.MONGO_URI = value

  return () => {
    if (original === undefined) {
      delete process.env.MONGO_URI
      return
    }

    process.env.MONGO_URI = original
  }
}

test('detail-incomplete success never advances complete-check status or replaces complete counts', async () => {
  const restore = setReadyState(1)
  const original = ScraperStatus.findOneAndUpdate
  let captured
  ScraperStatus.findOneAndUpdate = async (_filter, update) => { captured = update; return {} }
  const at = new Date().toISOString()
  const inventoryEvidence = { status: 'complete-inventory', firstParty: true, listingComplete: true,
    pagesFetched: 1, reportedTotal: 192, surface: 'https://example.com/jobs', verifiedAt: at }
  const detailHealth = { complete: false, inspectedJobs: 192, incompleteJobs: 79,
    missingDescriptions: 79, failureKinds: { 'detail-budget-exhausted': 79 } }
  try {
    for (const diagnostics of [
      { detailHealth, filteredEmptyDescription: 79, inventoryEvidence },
      { filteredEmptyDescription: 79, inventoryEvidence },
      { detailHealth, filteredEmptyDescription: 0, inventoryEvidence },
      { detailHealth, filteredEmptyDescription: 0 },
    ]) {
      await upsertScraperStatus('detail-health-source', { success: true, jobs: 192, eligibleJobs: 113,
        attemptedAt: at, completedAt: at, ...diagnostics })
      assert.equal(Object.hasOwn(captured.$set, 'lastCompleteCheckAt'), false)
      assert.equal(Object.hasOwn(captured.$set, 'lastCompleteJobsFound'), false)
      assert.equal(Object.hasOwn(captured.$set, 'lastJobsFound'), false)
      assert.ok(captured.$set.lastPartialAt instanceof Date)
      assert.equal(captured.$set.latestAttempt.detailHealth, diagnostics.detailHealth ?? null)
      if (diagnostics.inventoryEvidence) assert.equal(captured.$set.latestAttempt.inventoryEvidence.listingComplete, true)
    }
    await upsertScraperStatus('detail-health-source', { success: true, jobs: 192, eligibleJobs: 192,
      completedAt: at, inventoryEvidence, detailHealth: { complete: true, inspectedJobs: 192,
        incompleteJobs: 0, missingDescriptions: 0, failureKinds: {} }, filteredEmptyDescription: 0 })
    assert.equal(captured.$set.lastCompleteCheckAt.toISOString(), at)
    assert.equal(captured.$set.lastCompleteJobsFound, 192)
  } finally {
    ScraperStatus.findOneAndUpdate = original
    restore()
  }
})

test('run history persists detail health independently of complete enumeration evidence', async () => {
  const restore = setReadyState(1)
  const original = ScraperRun.create
  let captured
  ScraperRun.create = async document => { captured = document; return {} }
  const detailHealth = { complete: false, inspectedJobs: 2, incompleteJobs: 1,
    missingDescriptions: 1, failureKinds: { 'missing-content': 1 } }
  try {
    await writeScraperRun(new Date(), { 'detail-health-source': { success: true, jobs: 2, eligibleJobs: 1,
      detailHealth, inventoryEvidence: { listingComplete: true }, filteredEmptyDescription: 1 } })
    assert.deepEqual(captured.sources['detail-health-source'].detailHealth, detailHealth)
    const model = new ScraperRun(captured)
    assert.deepEqual(model.sources.get('detail-health-source').detailHealth, detailHealth)
    assert.equal(model.sources.get('detail-health-source').inventoryEvidence.listingComplete, true)
    const legacy = new ScraperRun({ sources: { legacy: { success: true } }, overall: { totalJobs: 0,
      sourcesSucceeded: 1, sourcesFailed: 0 } })
    assert.equal(legacy.sources.get('legacy').detailHealth, null)
  } finally {
    ScraperRun.create = original
    restore()
  }
})

test('runAll preserves the existing jobs collection during a full live run', async () => {
  const restoreReadyState = setReadyState(1)
  const restoreMongoUri = setMongoUri()
  const originalDeleteMany = Job.deleteMany
  const originalFindOneAndUpdate = ScraperStatus.findOneAndUpdate
  const originalFindOne = ScraperStatus.findOne
  const originalCreate = ScraperRun.create
  const originalBulkWrite = ScraperStatus.bulkWrite
  const originalSummaryFindOne = JobDatasetSummary.findOne
  let summaryReads = 0
  const summaryUnavailable = new Error('Controlled fixture: summary read unavailable')

  const deleteFilters = []

  JobDatasetSummary.findOne = filter => {
    assert.deepEqual(filter, { key: 'public-active' })
    let sorted = false, leaned = false
    return {
      sort(order) { assert.deepEqual(order, { _id: 1 }); sorted = true; return this },
      lean() { assert.equal(sorted, true); leaned = true; return this },
      async exec() {
        assert.equal(leaned, true)
        summaryReads++
        throw summaryUnavailable
      },
    }
  }

  Job.deleteMany = async (filter) => {
    deleteFilters.push(filter)
    return { deletedCount: 0 }
  }

  ScraperStatus.findOneAndUpdate = async () => ({})
  ScraperStatus.findOne = () => ({
    lean() {
      return {
        exec: async () => ({ isActive: false }),
      }
    },
  })
  ScraperRun.create = async () => ({})
  ScraperStatus.bulkWrite = async () => ({})

  try {
    await runAll()

    assert.deepEqual(deleteFilters, [])
    assert.equal(summaryReads, 1)
  } finally {
    Job.deleteMany = originalDeleteMany
    JobDatasetSummary.findOne = originalSummaryFindOne
    ScraperStatus.findOneAndUpdate = originalFindOneAndUpdate
    ScraperStatus.findOne = originalFindOne
    ScraperRun.create = originalCreate
    ScraperStatus.bulkWrite = originalBulkWrite
    restoreMongoUri()
    restoreReadyState()
  }
})

test('runAll defers sources without starting scrapers when Atlas storage quota blocks status seeding', async () => {
  const restoreReadyState = setReadyState(1)
  const restoreMongoUri = setMongoUri()
  const originalBulkWrite = ScraperStatus.bulkWrite
  const originalFindOneAndUpdate = ScraperStatus.findOneAndUpdate
  const originalFindOne = ScraperStatus.findOne
  const originalCreate = ScraperRun.create
  const originalDeleteMany = Job.deleteMany
  const originalJobFind = Job.find
  let recoveryReads = 0
  const recoveryUnavailable = new Error('Controlled fixture: expired-job read unavailable')

  let activeStatusReads = 0
  let pipelineStatusWrites = 0
  const deleteFilters = []
  const quotaError = new Error(
    'you are over your space quota, using 521 MB of 512 MB. Writes are blocked on your cluster.',
  )

  Job.find = filter => {
    assert.deepEqual(Object.keys(filter).sort(), ['lastSeenAt', 'status'])
    assert.equal(filter.status, 'expired')
    assert.deepEqual(Object.keys(filter.lastSeenAt), ['$lt'])
    assert.ok(filter.lastSeenAt.$lt instanceof Date)
    assert.ok(Number.isFinite(filter.lastSeenAt.$lt.getTime()))
    let sorted = false, limited = false, leaned = false
    return {
      sort(order) { assert.deepEqual(order, { lastSeenAt: 1, _id: 1 }); sorted = true; return this },
      limit(value) { assert.equal(sorted, true); assert.equal(value, 100); limited = true; return this },
      lean() { assert.equal(limited, true); leaned = true; return this },
      async exec() {
        assert.equal(leaned, true)
        recoveryReads++
        throw recoveryUnavailable
      },
    }
  }
  Job.deleteMany = async (filter) => {
    deleteFilters.push(filter)
    return { deletedCount: 0 }
  }
  ScraperStatus.bulkWrite = async () => {
    throw quotaError
  }
  ScraperStatus.findOneAndUpdate = async () => {
    pipelineStatusWrites += 1
    return {}
  }
  ScraperStatus.findOne = () => {
    activeStatusReads += 1
    return {
      lean() {
        return {
          exec: async () => ({ isActive: true }),
        }
      },
    }
  }
  ScraperRun.create = async () => ({})

  try {
    const summary = await runAll()
    assert.ok(Object.keys(summary).length > 0)
    assert.ok(Object.values(summary).every(result => result.persistencePending && result.processingComplete === false))
    assert.equal(pipelineStatusWrites, 0)
    assert.equal(activeStatusReads, 0)
    assert.deepEqual(deleteFilters, [])
    assert.equal(recoveryReads, 3)
  } finally {
    Job.deleteMany = originalDeleteMany
    Job.find = originalJobFind
    ScraperStatus.bulkWrite = originalBulkWrite
    ScraperStatus.findOneAndUpdate = originalFindOneAndUpdate
    ScraperStatus.findOne = originalFindOne
    ScraperRun.create = originalCreate
    restoreMongoUri()
    restoreReadyState()
  }
})

test('generateFingerprint tolerates jobs whose location cannot be normalized into a city', () => {
  const fingerprint = generateFingerprint({
    title: 'Software Engineer',
    company: 'Example',
    location: 'Multiple locations',
    city: null,
    link: 'https://example.com/job-1',
  })

  assert.equal(typeof fingerprint, 'string')
  assert.equal(fingerprint.length, 64)
})

test('saveToDB upserts source jobs before recording misses for unseen jobs', async () => {
  const restoreReadyState = setReadyState(1)
  const originalBulkWrite = Job.bulkWrite
  const originalUpdateMany = Job.updateMany
  const originalDeleteMany = Job.deleteMany

  const operations = []
  let capturedBulkOps = []
  const capturedLifecycleUpdates = []
  const deletionFilters = []

  Job.bulkWrite = async (bulkOps) => {
    operations.push('bulkWrite')
    capturedBulkOps = bulkOps
    return {
      upsertedCount: bulkOps.length,
      modifiedCount: 0,
    }
  }

  Job.updateMany = (filter, update) => {
    operations.push('updateMany')
    capturedLifecycleUpdates.push({ filter, update })
    return {
      exec: async () => ({
        matchedCount: update.$set?.status === 'expired' ? 1 : 2,
        modifiedCount: update.$set?.status === 'expired' ? 1 : 2,
      }),
    }
  }

  Job.deleteMany = (filter) => {
    operations.push('deleteMany')
    deletionFilters.push(filter)
    return {
      exec: async () => ({ deletedCount: 1 }),
    }
  }

  const jobs = [
    {
      title: 'Software Engineer',
      company: 'Example',
      location: 'Bengaluru, India',
      city: 'Bangalore',
      link: 'https://example.com/job-1',
      description: 'Build and maintain software for customers.',
    },
    {
      title: 'QA Engineer',
      company: 'Example',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      link: 'https://example.com/job-2',
      description: 'Test and verify software for customers.',
    },
  ]

  const expectedFingerprints = jobs.map((job) => generateFingerprint(job))

  try {
    const result = await saveToDB(jobs, 'example-source', { missesBeforeExpiry: 2 })

    assert.deepEqual(operations, ['bulkWrite', 'deleteMany', 'updateMany'])
    assert.deepEqual(deletionFilters, [{
      source: 'example-source',
      status: 'active',
      fingerprint: { $nin: expectedFingerprints },
      missedScrapeCount: { $gte: 1 },
    }])
    assert.deepEqual(capturedLifecycleUpdates[0].filter, {
      source: 'example-source',
      status: 'active',
      fingerprint: { $nin: expectedFingerprints },
    })
    assert.deepEqual(capturedLifecycleUpdates[0].update, {
      $inc: { missedScrapeCount: 1 },
    })
    assert.equal(result.inserted, 2)
    assert.equal(result.missed, 3)
    assert.equal(result.expired, 1)
    assert.equal(result.deleted, 1)
    for (const operation of capturedBulkOps) {
      const seenJobState = operation.updateOne.update.$set
      assert.equal(seenJobState.status, 'active')
      assert.equal(seenJobState.missedScrapeCount, 0)
      assert.ok(seenJobState.lastSeenAt instanceof Date)
    }
  } finally {
    Job.bulkWrite = originalBulkWrite
    Job.updateMany = originalUpdateMany
    Job.deleteMany = originalDeleteMany
    restoreReadyState()
  }
})

test('saveToDB persists the employer description as the rewrite source', async () => {
  const restoreReadyState = setReadyState(1)
  const originalBulkWrite = Job.bulkWrite
  const originalUpdateMany = Job.updateMany
  const originalDeleteMany = Job.deleteMany

  let capturedBulkOps = []
  Job.bulkWrite = async (bulkOps) => {
    capturedBulkOps = bulkOps
    return { upsertedCount: bulkOps.length, modifiedCount: 0 }
  }
  Job.updateMany = () => ({ exec: async () => ({ matchedCount: 0, modifiedCount: 0 }) })
  Job.deleteMany = () => ({ exec: async () => ({ deletedCount: 0 }) })

  try {
    await saveToDB([{
      title: 'Software Engineer',
      company: 'Example',
      location: 'Bengaluru, India',
      city: 'Bangalore',
      link: 'https://example.com/job-1',
      description: 'Build student-facing software with Node.js and React.',
    }], 'example-source', { missesBeforeExpiry: 2 })

    const persistedFields = capturedBulkOps[0].updateOne.update.$set
    assert.equal(persistedFields.description, 'Build student-facing software with Node.js and React.')
    assert.equal(persistedFields.sourceDescription, 'Build student-facing software with Node.js and React.')
    assert.equal(Object.hasOwn(capturedBulkOps[0].updateOne.update.$unset || {}, 'description'), false)
  } finally {
    Job.bulkWrite = originalBulkWrite
    Job.updateMany = originalUpdateMany
    Job.deleteMany = originalDeleteMany
    restoreReadyState()
  }
})

// Alert atomicity and active-insert selection are covered against a real replica
// set in test/jobAlertOutboxMongo.test.js. These fixtures test job normalization.

test('saveToDB preserves open roles regardless of their normalized postingDate age', async () => {
  const restoreReadyState = setReadyState(1)
  const originalBulkWrite = Job.bulkWrite
  const originalDeleteMany = Job.deleteMany

  let capturedBulkOps = []

  Job.bulkWrite = async (bulkOps) => {
    capturedBulkOps = bulkOps
    return {
      upsertedCount: bulkOps.length,
      modifiedCount: 0,
    }
  }

  Job.deleteMany = async () => ({ deletedCount: 0 })

  const now = Date.now()
  const freshPostingDate = new Date(now - (2 * 24 * 60 * 60 * 1000)).toISOString()
  const stalePostingDate = new Date(now - (20 * 24 * 60 * 60 * 1000)).toISOString()

  try {
    const result = await saveToDB(
      [
        {
          title: 'Fresh Software Engineer',
          company: 'Example',
          location: 'Bengaluru, India',
          city: 'Bangalore',
          link: 'https://example.com/jobs/fresh',
          description: 'Build and maintain software for customers.',
          postingDate: freshPostingDate,
        },
        {
          title: 'Stale Software Engineer',
          company: 'Example',
          location: 'Bengaluru, India',
          city: 'Bangalore',
          link: 'https://example.com/jobs/stale',
          description: 'Build and maintain software for customers.',
          postingDate: stalePostingDate,
        },
        {
          title: 'Stale Fallback Software Engineer',
          company: 'Example',
          location: 'Bengaluru, India',
          city: 'Bangalore',
          link: 'https://example.com/jobs/stale-fallback',
          description: 'Build and maintain software for customers.',
          postingDate: 'not-a-date',
          postedAt: stalePostingDate,
        },
      ],
      'example-source',
      { retentionDays: 10, replaceExisting: false, enrichPublicExperience: false },
    )

    assert.equal(result.filteredOld, 0)
    assert.equal(result.eligibleJobs, 3)
    assert.equal(capturedBulkOps.length, 3)
    assert.equal(
      capturedBulkOps[0].updateOne.update.$set.applyUrl,
      'https://example.com/jobs/fresh',
    )
  } finally {
    Job.bulkWrite = originalBulkWrite
    Job.deleteMany = originalDeleteMany
    restoreReadyState()
  }
})

test('saveToDB preserves existing source jobs when the replacement write fails', async () => {
  const restoreReadyState = setReadyState(1)
  const originalBulkWrite = Job.bulkWrite
  const originalUpdateMany = Job.updateMany
  const originalDeleteMany = Job.deleteMany

  let lifecycleAttempted = false
  let deleteAttempted = false

  Job.bulkWrite = async () => {
    throw new Error('bulk write failed')
  }

  Job.updateMany = () => {
    lifecycleAttempted = true
    return {
      exec: async () => ({ matchedCount: 1, modifiedCount: 1 }),
    }
  }

  Job.deleteMany = async () => {
    deleteAttempted = true
    return { deletedCount: 1 }
  }

  try {
    await assert.rejects(
      saveToDB(
        [
          {
            title: 'Software Engineer',
            company: 'Example',
            location: 'Bengaluru, India',
            city: 'Bangalore',
            link: 'https://example.com/job-1',
            description: 'Build and maintain software for customers.',
          },
        ],
        'example-source',
      ),
      /bulk write failed/,
    )

    assert.equal(lifecycleAttempted, false)
    assert.equal(deleteAttempted, false)
  } finally {
    Job.bulkWrite = originalBulkWrite
    Job.updateMany = originalUpdateMany
    Job.deleteMany = originalDeleteMany
    restoreReadyState()
  }
})

test('saveToDB preserves existing jobs when a scrape yields an untrusted zero eligible result', async () => {
  const restoreReadyState = setReadyState(1)
  const originalBulkWrite = Job.bulkWrite
  const originalUpdateMany = Job.updateMany
  const originalDeleteMany = Job.deleteMany

  let bulkWriteAttempted = false
  const capturedLifecycleUpdates = []
  let deleteAttempted = false

  Job.bulkWrite = async () => {
    bulkWriteAttempted = true
    return { upsertedCount: 0, modifiedCount: 0 }
  }

  Job.updateMany = (filter, update) => {
    capturedLifecycleUpdates.push({ filter, update })
    return {
      exec: async () => ({
        matchedCount: update.$set?.status === 'expired' ? 1 : 3,
        modifiedCount: update.$set?.status === 'expired' ? 1 : 3,
      }),
    }
  }

  Job.deleteMany = async () => {
    deleteAttempted = true
    return { deletedCount: 0 }
  }

  try {
    const result = await saveToDB(
      [
        {
          title: 'Staff Engineer',
          company: 'Example',
          location: 'Berlin, Germany',
          city: 'Berlin',
          link: 'https://example.com/staff-role',
        },
      ],
      'example-source',
      { missesBeforeExpiry: 2 },
    )

    assert.equal(bulkWriteAttempted, false)
    assert.equal(deleteAttempted, false)
    assert.deepEqual(capturedLifecycleUpdates, [])
    assert.equal(result.eligibleJobs, 0)
    assert.equal(result.deleted, 0)
    assert.equal(result.missed, 0)
    assert.equal(result.expired, 0)
    assert.equal(result.staleCheckSkipped, true)
    assert.match(result.staleCheckReason, /preserved without recording lifecycle misses/i)
  } finally {
    Job.bulkWrite = originalBulkWrite
    Job.updateMany = originalUpdateMany
    Job.deleteMany = originalDeleteMany
    restoreReadyState()
  }
})

test('saveToDB can record lifecycle misses for an explicitly authoritative empty result', async t => {
  const restoreReadyState = setReadyState(1)
  const originalUpdateMany = Job.updateMany
  const capturedLifecycleUpdates = []

  t.mock.method(Job, 'deleteMany', filter => {
    assert.deepEqual(filter, { source: 'example-source', status: 'active', missedScrapeCount: { $gte: 1 } })
    return { exec: async () => ({ deletedCount: 1 }) }
  })

  Job.updateMany = (filter, update) => {
    capturedLifecycleUpdates.push({ filter, update })
    return {
      exec: async () => ({
        matchedCount: update.$set?.status === 'expired' ? 1 : 3,
        modifiedCount: update.$set?.status === 'expired' ? 1 : 3,
      }),
    }
  }

  try {
    const result = await saveToDB(
      [],
      'example-source',
      {
        authoritativeEmpty: true,
        missesBeforeExpiry: 2,
      },
    )

    assert.equal(capturedLifecycleUpdates.length, 1)
    assert.equal(result.missed, 4)
    assert.equal(result.expired, 1)
    assert.equal(result.staleCheckSkipped, false)
    assert.equal(result.staleCheckReason, null)
  } finally {
    Job.updateMany = originalUpdateMany
    restoreReadyState()
  }
})

test('unverified, discovery-only, and coverage-gap zeros preserve previous jobs', async () => {
  const restoreReadyState = setReadyState(1)
  const originalUpdateMany = Job.updateMany
  const capturedLifecycleUpdates = []

  Job.updateMany = (filter, update) => {
    capturedLifecycleUpdates.push({ filter, update })
    return { exec: async () => ({ matchedCount: 0, modifiedCount: 0 }) }
  }

  const cases = [
    { policy: 'evidence-required', jobs: [] },
    {
      policy: 'discovery-only',
      jobs: attachInventoryEvidence([], {
        status: 'discovery-only',
        surface: 'https://directory.example.test/jobs',
        firstParty: false,
        listingComplete: true,
        pagesFetched: 1,
        reportedTotal: 0,
        indiaFacetCount: 0,
        verifiedAt: null,
        reason: 'third-party-directory',
      }),
    },
    { policy: 'coverage-gap', jobs: [] },
  ]

  try {
    for (const [index, entry] of cases.entries()) {
      const outcome = resolveZeroJobOutcome(
        { provider: { zeroResultPolicy: entry.policy } },
        entry.jobs,
        [],
      )
      const result = await saveToDB(entry.jobs, `zero-source-${index}`, {
        authoritativeEmpty: outcome === 'verified-empty',
        missesBeforeExpiry: 2,
      })

      assert.equal(result.staleCheckSkipped, true, outcome)
      assert.match(result.staleCheckReason, /preserved without recording lifecycle misses/i)
    }

    assert.deepEqual(capturedLifecycleUpdates, [])
  } finally {
    Job.updateMany = originalUpdateMany
    restoreReadyState()
  }
})

test('saveToDB filters jobs whose advertised closing date has passed', async () => {
  const restoreReadyState = setReadyState(1)
  const originalBulkWrite = Job.bulkWrite
  const originalUpdateMany = Job.updateMany
  const originalDeleteMany = Job.deleteMany

  let capturedBulkOps = []

  Job.bulkWrite = async (bulkOps) => {
    capturedBulkOps = bulkOps
    return {
      upsertedCount: bulkOps.length,
      modifiedCount: 0,
    }
  }

  Job.updateMany = () => ({
    exec: async () => ({ matchedCount: 0, modifiedCount: 0 }),
  })
  Job.deleteMany = () => ({ exec: async () => ({ deletedCount: 0 }) })

  try {
    const result = await saveToDB(
      [
        {
          title: 'Closed Software Engineer',
          company: 'Example',
          location: 'Bengaluru, India',
          city: 'Bangalore',
          link: 'https://example.com/jobs/closed',
          closingDate: '2026-07-24T00:00:00.000Z',
        },
        {
          title: 'Closing Today Software Engineer',
          company: 'Example',
          location: 'Bengaluru, India',
          city: 'Bangalore',
          link: 'https://example.com/jobs/today',
          description: 'Build and maintain software for customers.',
          closingDate: '2026-07-25T00:00:00.000Z',
        },
      ],
      'example-source',
      {
        now: new Date('2026-07-25T12:00:00.000Z'),
        missesBeforeExpiry: 2,
      },
    )

    assert.equal(result.filteredClosed, 1)
    assert.equal(result.eligibleJobs, 1)
    assert.equal(capturedBulkOps.length, 1)
    assert.equal(
      capturedBulkOps[0].updateOne.update.$set.applyUrl,
      'https://example.com/jobs/today',
    )
  } finally {
    Job.bulkWrite = originalBulkWrite
    Job.updateMany = originalUpdateMany
    Job.deleteMany = originalDeleteMany
    restoreReadyState()
  }
})

test('saveToDB persists unified normalized fields alongside the legacy job shape', async () => {
  const restoreReadyState = setReadyState(1)
  const originalBulkWrite = Job.bulkWrite
  const originalDeleteMany = Job.deleteMany

  let capturedBulkOps = []

  Job.bulkWrite = async (bulkOps) => {
    capturedBulkOps = bulkOps
    return {
      upsertedCount: bulkOps.length,
      modifiedCount: 0,
    }
  }

  Job.deleteMany = async () => ({ deletedCount: 0 })

  try {
    await saveToDB(
      [
        {
          title: 'SDE II',
          company: 'Example Corp',
          location: 'Bengaluru, India',
          city: 'Bangalore',
          department: 'Platform Engineering',
          link: 'https://careers.example.com/jobs/123',
          description: 'Design platform software using Node.js and AWS.',
          jobId: 'JR-123',
          companyCareerPage: 'https://careers.example.com',
          atsPlatform: 'workday',
          requiredSkills: ['Node.js', 'AWS'],
        },
      ],
      'example-source',
      { replaceExisting: false },
    )

    const persistedJob = capturedBulkOps[0].updateOne.update.$set

    assert.equal(persistedJob.title, 'SDE II')
    assert.equal(persistedJob.originalTitle, 'SDE II')
    assert.equal(persistedJob.normalizedTitle, 'Software Engineer')
    assert.equal(persistedJob.jobCategory, 'Software Engineer')
    assert.equal(persistedJob.engineeringDomain, 'Software Engineering')
    assert.equal(persistedJob.applyUrl, 'https://careers.example.com/jobs/123')
    assert.equal(persistedJob.sourceUrl, 'https://careers.example.com/jobs/123')
    assert.equal(persistedJob.companyCareerPage, 'https://careers.example.com')
    assert.equal(persistedJob.companyDomain, 'careers.example.com')
    assert.equal(persistedJob.atsPlatform, 'workday')
    assert.equal(persistedJob.jobId, 'JR-123')
    assert.equal(persistedJob.country, 'India')
    assert.equal(persistedJob.jobType, 'Full-time Experienced')
    assert.equal(persistedJob.employmentType, 'Full-time')
    assert.equal(persistedJob.experienceLevel, 'Mid Level')
    assert.deepEqual(persistedJob.requiredSkills, ['Node.js', 'AWS'])
  } finally {
    Job.bulkWrite = originalBulkWrite
    Job.deleteMany = originalDeleteMany
    restoreReadyState()
  }
})

test('upsertScraperStatus records partial scrape details without overwriting last complete counts', async () => {
  const restoreReadyState = setReadyState(1)
  const originalFindOneAndUpdate = ScraperStatus.findOneAndUpdate

  let capturedUpdate = null

  ScraperStatus.findOneAndUpdate = async (_filter, update) => {
    capturedUpdate = update
    return {}
  }

  try {
    await upsertScraperStatus('example-source', {
      success: true,
      jobs: 0,
      eligibleJobs: 0,
      inserted: 0,
      updated: 0,
      deleted: 0,
      missed: 3,
      expired: 1,
      staleCheckSkipped: true,
      staleCheckReason: 'No eligible jobs survived filtering; preserved previous source jobs.',
      retentionDays: 10,
      durationMs: 1250,
    })

    assert.equal('lastJobsFound' in capturedUpdate.$set, false)
    assert.equal('lastEligibleJobsFound' in capturedUpdate.$set, false)
    assert.equal('lastDeleted' in capturedUpdate.$set, false)
    assert.equal('lastMissed' in capturedUpdate.$set, false)
    assert.equal('lastExpired' in capturedUpdate.$set, false)
    assert.ok(capturedUpdate.$set.lastPartialAt instanceof Date)
    assert.match(capturedUpdate.$set.lastPartialReason, /preserved previous source jobs/i)
    assert.equal('lastCompleteJobsFound' in capturedUpdate.$set, false)
    assert.equal('lastCompleteEligibleJobsFound' in capturedUpdate.$set, false)
  } finally {
    ScraperStatus.findOneAndUpdate = originalFindOneAndUpdate
    restoreReadyState()
  }
})

test('upsertScraperStatus defaults lifecycle retention tracking to 30 days when omitted', async () => {
  const restoreReadyState = setReadyState(1)
  const originalFindOneAndUpdate = ScraperStatus.findOneAndUpdate

  let capturedUpdate = null

  ScraperStatus.findOneAndUpdate = async (_filter, update) => {
    capturedUpdate = update
    return {}
  }

  try {
    await upsertScraperStatus('example-source', {
      success: true,
      jobs: 2,
      eligibleJobs: 2,
      inserted: 1,
      updated: 1,
      deleted: 0,
      filteredOld: 0,
      missed: 0,
      expired: 0,
      durationMs: 500,
    })

    assert.equal(capturedUpdate.$set.lastRetentionDays, DEFAULT_JOB_RETENTION_DAYS)
  } finally {
    ScraperStatus.findOneAndUpdate = originalFindOneAndUpdate
    restoreReadyState()
  }
})

test('upsertScraperStatus records soft failures without incrementing hard failure alerts', async () => {
  const restoreReadyState = setReadyState(1)
  const originalFindOneAndUpdate = ScraperStatus.findOneAndUpdate

  let capturedUpdate = null

  ScraperStatus.findOneAndUpdate = async (_filter, update) => {
    capturedUpdate = update
    return {}
  }

  try {
    await upsertScraperStatus('example-source', {
      success: false,
      softFailure: true,
      upstreamOutage: true,
      failureKind: 'network_or_timeout',
      error: 'HTTP 503 for https://example.com/jobs',
      durationMs: 1000,
    })

    assert.equal(capturedUpdate.$set.lastSuccess, true)
    assert.equal(capturedUpdate.$set.consecutiveFailures, 0)
    assert.equal(capturedUpdate.$set.softFailure, true)
    assert.equal(capturedUpdate.$set.upstreamOutage, true)
    assert.equal(capturedUpdate.$set.failureKind, 'network_or_timeout')
    assert.equal(capturedUpdate.$inc, undefined)
    for (const field of [
      'lastJobsFound',
      'lastEligibleJobsFound',
      'lastCompleteJobsFound',
      'lastCompleteEligibleJobsFound',
      'lastInserted',
      'lastUpdated',
      'lastDeleted',
      'lastMissed',
      'lastExpired',
    ]) {
      assert.equal(field in capturedUpdate.$set, false)
    }
  } finally {
    ScraperStatus.findOneAndUpdate = originalFindOneAndUpdate
    restoreReadyState()
  }
})

test('upsertScraperStatus records hard failures without replacing the last successful job counts', async () => {
  const restoreReadyState = setReadyState(1)
  const originalFindOneAndUpdate = ScraperStatus.findOneAndUpdate

  let capturedUpdate = null
  ScraperStatus.findOneAndUpdate = async (_filter, update) => {
    capturedUpdate = update
    return {}
  }

  try {
    await upsertScraperStatus('example-source', {
      success: false,
      softFailure: false,
      failureKind: 'parser_or_contract_error',
      error: 'Unexpected Workday response contract',
      durationMs: 1000,
    })

    assert.equal(capturedUpdate.$set.lastSuccess, false)
    assert.equal(capturedUpdate.$inc.consecutiveFailures, 1)
    for (const field of [
      'lastJobsFound',
      'lastEligibleJobsFound',
      'lastCompleteJobsFound',
      'lastCompleteEligibleJobsFound',
      'lastInserted',
      'lastUpdated',
      'lastDeleted',
      'lastMissed',
      'lastExpired',
    ]) {
      assert.equal(field in capturedUpdate.$set, false)
    }
  } finally {
    ScraperStatus.findOneAndUpdate = originalFindOneAndUpdate
    restoreReadyState()
  }
})

test('writeScraperRun stores when stale cleanup was skipped for a partial source refresh', async () => {
  const restoreReadyState = setReadyState(1)
  const originalCreate = ScraperRun.create

  let capturedPayload = null

  ScraperRun.create = async (payload) => {
    capturedPayload = payload
    return payload
  }

  try {
    await writeScraperRun(new Date('2026-06-13T00:00:00.000Z'), {
      'example-source': {
        success: true,
        jobs: 0,
        eligibleJobs: 0,
        inserted: 0,
        updated: 0,
        deleted: 0,
        missed: 3,
        expired: 1,
        staleCheckSkipped: true,
        staleCheckReason: 'No eligible jobs survived filtering; preserved previous source jobs.',
      },
    })

    assert.equal(capturedPayload.sources['example-source'].staleCheckSkipped, true)
    assert.equal(capturedPayload.sources['example-source'].deleted, 0)
    assert.equal(capturedPayload.sources['example-source'].missed, 3)
    assert.equal(capturedPayload.sources['example-source'].expired, 1)
    assert.match(
      capturedPayload.sources['example-source'].staleCheckReason,
      /preserved previous source jobs/i,
    )
  } finally {
    ScraperRun.create = originalCreate
    restoreReadyState()
  }
})

test('writeScraperRun encodes Mongo-unsafe source keys before creating run history', async () => {
  const restoreReadyState = setReadyState(1)
  const originalCreate = ScraperRun.create

  let capturedPayload = null

  ScraperRun.create = async (payload) => {
    capturedPayload = payload
    const validationError = new ScraperRun(payload).validateSync()
    if (validationError) throw validationError
    return payload
  }

  try {
    await writeScraperRun(new Date('2026-08-17T00:00:00.000Z'), {
      'source.with.dots': {
        success: true,
        jobs: 3,
        eligibleJobs: 3,
        inserted: 3,
        updated: 0,
        deleted: 0,
      },
      '$internal.source': {
        success: false,
        error: 'synthetic failure',
      },
    })

    assert.ok(capturedPayload)
    assert.equal(
      Object.prototype.hasOwnProperty.call(capturedPayload.sources, 'source.with.dots'),
      false,
    )
    assert.equal(
      Object.prototype.hasOwnProperty.call(capturedPayload.sources, '$internal.source'),
      false,
    )
    assert.equal(
      capturedPayload.sources['source\uFF0Ewith\uFF0Edots'].jobsFound,
      3,
    )
    assert.equal(
      capturedPayload.sources['\uFF04internal\uFF0Esource'].error,
      'synthetic failure',
    )
  } finally {
    ScraperRun.create = originalCreate
    restoreReadyState()
  }
})

test('readPreviousScraperRun decodes persisted Mongo-safe source keys', async () => {
  const restoreReadyState = setReadyState(1)
  const originalFindOne = ScraperRun.findOne

  const createQueryDouble = (value) => ({
    sort() {
      return this
    },
    lean() {
      return this
    },
    exec: async () => value,
  })

  ScraperRun.findOne = () => createQueryDouble({
    ranAt: new Date('2026-08-17T00:00:00.000Z'),
    sources: {
      'source\uFF0Ewith\uFF0Edots': { success: true, jobsFound: 3 },
      '\uFF04internal\uFF0Esource': { success: false, error: 'synthetic failure' },
    },
    overall: {
      totalJobs: 3,
      sourcesSucceeded: 1,
      sourcesFailed: 1,
    },
  })

  try {
    const previousRun = await readPreviousScraperRun(new Date('2026-08-18T00:00:00.000Z'))

    assert.ok(previousRun)
    assert.equal(previousRun.sources['source.with.dots'].jobsFound, 3)
    assert.equal(previousRun.sources['$internal.source'].error, 'synthetic failure')
    assert.equal(
      Object.prototype.hasOwnProperty.call(previousRun.sources, 'source\uFF0Ewith\uFF0Edots'),
      false,
    )
  } finally {
    ScraperRun.findOne = originalFindOne
    restoreReadyState()
  }
})
  const stages = []
