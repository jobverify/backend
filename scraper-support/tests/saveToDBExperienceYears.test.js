import assert from 'node:assert/strict'
import test from 'node:test'
import mongoose from 'mongoose'

import Job from '../../src/models/Job.js'
import { saveToDB as persistJobs } from '../utils/saveToDB.js'

// These persistence fixtures stub MongoDB; transactional alert behavior has its own replica-set suite.
const saveToDB = (jobs, source, options = {}) => persistJobs(jobs, source, { enqueueAlerts: false, ...options })

const setReadyState = (value) => {
  const descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState')
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    value,
  })

  return () => {
    if (descriptor) Object.defineProperty(mongoose.connection, 'readyState', descriptor)
    else delete mongoose.connection.readyState
  }
}

test('generic persistence accepts missing descriptions while retaining incomplete-detail lifecycle protection', async t => {
  const restore = setReadyState(1)
  t.after(restore)
  const written = []
  t.mock.method(Job, 'bulkWrite', async operations => { written.push(...operations); return { upsertedCount: operations.length, modifiedCount: 0 } })
  t.mock.method(Job, 'deleteMany', async () => assert.fail('filtered descriptions must not authorize deletion'))
  t.mock.method(Job, 'updateMany', async () => assert.fail('filtered descriptions must not authorize lifecycle misses'))
  const base = { title: 'Engineer', company: 'Example', location: 'Bengaluru, India' }
  const result = await saveToDB([
    { ...base, link: 'https://example.test/jobs/empty', description: ' \n\t' },
    { ...base, link: 'https://example.test/jobs/full', description: 'Build reliable APIs for customers.' },
  ], 'example', { classifier: { mode: 'off' }, descriptionRewriteMode: 'off', enrichPublicExperience: false, refreshDatasetSummary: false, replaceExisting: false, enqueueAlerts: false })
  assert.equal(result.inserted, 2)
  assert.equal(result.eligibleJobs, 2)
  assert.equal(result.filteredEmptyDescription, 0)
  assert.equal(written.length, 2)
  assert.equal(written[0].updateOne.update.$set.applyUrl, 'https://example.test/jobs/empty')
  assert.equal(written[0].updateOne.update.$set.sourceDescription, null)
  assert.equal(written[0].updateOne.update.$set.description, undefined)
  const accepted = await saveToDB([{ ...base, link: 'https://example.test/jobs/empty', description: null }], 'example', {
    classifier: { mode: 'off' }, descriptionRewriteMode: 'off', enrichPublicExperience: false, refreshDatasetSummary: false, enqueueAlerts: false,
  })
  assert.equal(accepted.inserted, 1)
  assert.equal(accepted.staleCheckSkipped, true)
  assert.equal(accepted.filteredEmptyDescription, 0)
  assert.equal(written.length, 3)
})

test('accepted markup-only rescrapes retain saved employer descriptions and source hashes', async t => {
  const restore = setReadyState(1)
  t.after(restore)
  let saved
  t.mock.method(Job, 'find', () => ({ select() { return this }, lean() { return this }, exec: async () => saved ? [saved] : [] }))
  t.mock.method(Job, 'bulkWrite', async operations => {
    saved = { ...saved, ...operations[0].updateOne.update.$set }
    return { upsertedCount: 0, modifiedCount: 1 }
  })
  const job = { title: 'Engineer', company: 'Example', location: 'Bengaluru, India',
    link: 'https://example.test/jobs/preserved', jobDescription: 'Build reliable APIs for customers.' }
  const options = { enrichPublicExperience: false, refreshDatasetSummary: false,
    replaceExisting: false, enqueueAlerts: false, descriptionRewriteMode: 'publish' }
  await saveToDB([job], 'example', options)
  const expectedDescription = saved.description
  const expectedHash = saved.sourceContentHash
  for (const jobDescription of ['<p>&nbsp;<br></p>', '&#160;&#xA0;', '<!-- no details --><script>ignored()</script>']) {
    const result = await saveToDB([{ ...job, jobDescription }], 'example', options)
    assert.equal(result.eligibleJobs, 1)
    assert.equal(saved.description, expectedDescription)
    assert.equal(saved.sourceDescription, expectedDescription)
    assert.equal(saved.sourceContentHash, expectedHash)
  }
})

test('scraped jobs are persisted as pending without invoking a classifier', async () => {
  const restore = setReadyState(1)
  const originals = { bulkWrite: Job.bulkWrite, find: Job.find, updateMany: Job.updateMany, deleteMany: Job.deleteMany }
  Job.find = () => ({ select() { return this }, lean() { return this }, exec: async () => [] })
  const written = []
  Job.bulkWrite = async operations => { written.push(...operations); return { upsertedCount: operations.length, modifiedCount: 0 } }
  Job.updateMany = async () => assert.fail('replacement is disabled')
  Job.deleteMany = async () => assert.fail('replacement is disabled')
  try {
    const result = await saveToDB([{
      title: 'Engineering Intern', company: 'Example', location: 'Bengaluru, India',
      link: 'https://example.com/jobs/intern', description: 'Internship for currently pursuing students.',
    }], 'example', { enrichPublicExperience: false, refreshDatasetSummary: false, replaceExisting: false, enqueueAlerts: false,
      classifier: { mode: 'policy', classifyJobs: async () => assert.fail('scraping must not run inference') },
    })
    assert.equal(result.inserted, 1)
    assert.equal(written[0].updateOne.update.$set.postClassification.status, 'pending')
    assert.ok(written[0].updateOne.update.$unset.classification !== undefined)
  } finally { Object.assign(Job, originals); restore() }
})

test('quota recovery deletes oldest expired jobs until the 10 MB estimate is reached', async () => {
  const { purgeExpiredJobsForQuotaRecovery } = await import('../utils/saveToDB.js')
  const deletedIds = []
  const jobs = [
    { _id: 'oldest', lastSeenAt: new Date('2026-01-01T00:00:00.000Z'), payload: 'a'.repeat(700) },
    { _id: 'next', lastSeenAt: new Date('2026-01-02T00:00:00.000Z'), payload: 'b'.repeat(700) },
  ]
  const jobModel = {
    find() {
      return {
        sort() { return this },
        limit() { return this },
        lean() { return this },
        exec: async () => jobs.splice(0, 1),
      }
    },
    deleteMany: async ({ _id }) => {
      deletedIds.push(..._id.$in)
      return { deletedCount: _id.$in.length }
    },
  }

  const result = await purgeExpiredJobsForQuotaRecovery({
    jobModel,
    now: new Date('2026-02-01T00:00:00.000Z'),
    retentionDays: 30,
    targetBytes: 600,
    batchSize: 1,
  })

  assert.deepEqual(deletedIds, ['oldest'])
  assert.equal(result.deletedCount, 1)
  assert.ok(result.estimatedBytes >= 600)
})

test('quota recovery dry run paginates until the requested estimate is reached', async () => {
  const { purgeExpiredJobsForQuotaRecovery } = await import('../utils/saveToDB.js')
  const jobs = [
    { _id: 'oldest', lastSeenAt: new Date('2026-01-01T00:00:00.000Z'), payload: 'a'.repeat(700) },
    { _id: 'next', lastSeenAt: new Date('2026-01-02T00:00:00.000Z'), payload: 'b'.repeat(700) },
    { _id: 'newest', lastSeenAt: new Date('2026-01-03T00:00:00.000Z'), payload: 'c'.repeat(700) },
  ]
  let calls = 0
  const jobModel = {
    find() {
      return {
        sort() { return this },
        limit() { return this },
        lean() { return this },
        exec: async () => jobs.slice(calls++, calls),
      }
    },
    deleteMany: async () => {
      throw new Error('dry run must not delete expired jobs')
    },
  }

  const result = await purgeExpiredJobsForQuotaRecovery({
    jobModel,
    now: new Date('2026-02-01T00:00:00.000Z'),
    retentionDays: 30,
    targetBytes: 1300,
    batchSize: 1,
    dryRun: true,
  })

  assert.equal(result.dryRun, true)
  assert.equal(result.deletedCount, 2)
  assert.equal(calls, 2)
  assert.ok(result.estimatedBytes >= 1300)
})

test('saveToDB persists normalized experience years for filtering', async () => {
  const restoreReadyState = setReadyState(1)
  const originalBulkWrite = Job.bulkWrite
  const originalDeleteMany = Job.deleteMany
  let persistedJob

  Job.bulkWrite = async (operations) => {
    persistedJob = operations[0].updateOne.update.$set
    return { upsertedCount: operations.length, modifiedCount: 0 }
  }
  Job.deleteMany = async () => ({ deletedCount: 0 })

  try {
    await saveToDB([{
      title: 'Backend Engineer',
      company: 'Example Corp',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      link: 'https://careers.example.com/jobs/2',
      description: 'Build and maintain backend services.',
      experienceRequired: '2 years of backend engineering experience',
    }], 'example-source', {
      enrichPublicExperience: false,
      refreshDatasetSummary: false,
      replaceExisting: false,
    })

    assert.deepEqual(persistedJob.experienceYears, [2])
    assert.equal(persistedJob.publicExperienceChecked, false)
  } finally {
    Job.bulkWrite = originalBulkWrite
    Job.deleteMany = originalDeleteMany
    restoreReadyState()
  }
})

test('saveToDB enriches missing experience from the official public job page before persisting', async () => {
  const restoreReadyState = setReadyState(1)
  const originalBulkWrite = Job.bulkWrite
  const originalDeleteMany = Job.deleteMany
  let persistedJob

  Job.bulkWrite = async (operations) => {
    persistedJob = operations[0].updateOne.update.$set
    return { upsertedCount: operations.length, modifiedCount: 0 }
  }
  Job.deleteMany = async () => ({ deletedCount: 0 })

  try {
    await saveToDB([{
      title: 'Cloud Engineer',
      company: 'Virtusa',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      link: 'https://www.virtusa.com/careers/job-search/in/cloud-engineer-vrt-123',
      applyUrl: 'https://www.virtusa.com/careers/job-search/in/cloud-engineer-vrt-123',
      sourceUrl: 'https://www.virtusa.com/careers/job-search/in/cloud-engineer-vrt-123',
      description: 'Build and maintain cloud infrastructure.',
      experienceRequired: null,
    }], 'virtusa', {
      refreshDatasetSummary: false,
      replaceExisting: false,
      fetchText: async () => `
        <html>
          <body>
            <h1>Cloud Engineer</h1>
            <section>
              <h6>Required Experience</h6>
              <div>5</div>
            </section>
          </body>
        </html>
      `,
    })

    assert.equal(persistedJob.experienceRequired, '5 years')
    assert.deepEqual(persistedJob.experienceYears, [5])
    assert.equal(persistedJob.publicExperienceChecked, true)
  } finally {
    Job.bulkWrite = originalBulkWrite
    Job.deleteMany = originalDeleteMany
    restoreReadyState()
  }
})

test('saveToDB reports enrichment and bulk write stage boundaries', async () => {
  const restoreReadyState = setReadyState(1)
  const originalBulkWrite = Job.bulkWrite
  const originalDeleteMany = Job.deleteMany
  const stages = []

  Job.bulkWrite = async (operations) => ({
    upsertedCount: operations.length,
    modifiedCount: 0,
  })
  Job.deleteMany = async () => ({ deletedCount: 0 })

  try {
    await saveToDB([{
      title: 'Cloud Engineer',
      company: 'Virtusa',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      link: 'https://www.virtusa.com/careers/job-search/in/cloud-engineer-vrt-123',
      applyUrl: 'https://www.virtusa.com/careers/job-search/in/cloud-engineer-vrt-123',
      sourceUrl: 'https://www.virtusa.com/careers/job-search/in/cloud-engineer-vrt-123',
      description: 'Build and maintain cloud infrastructure.',
      experienceRequired: null,
    }], 'virtusa', {
      refreshDatasetSummary: false,
      replaceExisting: false,
      useBrowserFallback: false,
      onStage: (event) => stages.push(`${event.stage}:${event.status}`),
      fetchText: async () => `
        <html>
          <body>
            <h1>Cloud Engineer</h1>
            <section>
              <h6>Required Experience</h6>
              <div>5</div>
            </section>
          </body>
        </html>
      `,
    })

    assert.deepEqual(stages, [
      'enrichment:start',
      'enrichment:done',
      'classification:deferred',
      'bulkWrite:start',
      'bulkWrite:done',
    ])
  } finally {
    Job.bulkWrite = originalBulkWrite
    Job.deleteMany = originalDeleteMany
    restoreReadyState()
  }
})

test('saveToDB does not start bulk write after a lifecycle abort', async () => {
  const restoreReadyState = setReadyState(1)
  const originalBulkWrite = Job.bulkWrite
  const originalDeleteMany = Job.deleteMany
  const controller = new AbortController()
  const abortReason = new Error('source lifecycle expired')
  const stages = []
  let bulkWriteStarted = false

  Job.bulkWrite = async () => {
    bulkWriteStarted = true
    return { upsertedCount: 1, modifiedCount: 0 }
  }
  Job.deleteMany = async () => ({ deletedCount: 0 })

  try {
    await assert.rejects(
      saveToDB([{
        title: 'Cloud Engineer',
        company: 'Virtusa',
        location: 'Hyderabad, India',
        city: 'Hyderabad',
        link: 'https://www.virtusa.com/careers/job-search/in/cloud-engineer-vrt-123',
        applyUrl: 'https://www.virtusa.com/careers/job-search/in/cloud-engineer-vrt-123',
        sourceUrl: 'https://www.virtusa.com/careers/job-search/in/cloud-engineer-vrt-123',
        experienceRequired: '5 years',
      }], 'virtusa', {
        refreshDatasetSummary: false,
        replaceExisting: false,
        enrichPublicExperience: false,
        signal: controller.signal,
        onStage: (event) => {
          stages.push(`${event.stage}:${event.status}`)
          if (event.stage === 'enrichment' && event.status === 'skipped') {
            controller.abort(abortReason)
          }
        },
      }),
      abortReason,
    )

    assert.equal(bulkWriteStarted, false)
    assert.deepEqual(stages, ['enrichment:skipped'])
  } finally {
    Job.bulkWrite = originalBulkWrite
    Job.deleteMany = originalDeleteMany
    restoreReadyState()
  }
})

test('saveToDB preserves source wording and does not write a later empty description', async () => {
  const restoreReadyState = setReadyState(1)
  const originalBulkWrite = Job.bulkWrite
  const updates = []

  Job.bulkWrite = async (operations) => {
    updates.push(operations[0].updateOne.update)
    return { upsertedCount: 0, modifiedCount: 1 }
  }

  try {
    const job = {
      title: 'Backend Engineer',
      company: 'Example Corp',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      link: 'https://careers.example.com/jobs/description-test',
      jobDescription: 'Responsibilities:\nBuild services.\n\nRequirements:\nFive years of experience.',
    }
    const options = {
      enrichPublicExperience: false,
      refreshDatasetSummary: false,
      replaceExisting: false,
    }

    await saveToDB([job], 'example-source', options)
    await saveToDB([{ ...job, jobDescription: null }], 'example-source', options)
    await saveToDB([{ ...job, jobDescription: null, description: 'Full alternate description.' }], 'example-source', options)

    assert.equal(
      updates[0].$set.description,
      'Responsibilities:\nBuild services.\n\nRequirements:\nFive years of experience.',
    )
    assert.equal(Object.hasOwn(updates[0], '$unset') && Object.hasOwn(updates[0].$unset, 'description'), false)
    assert.equal(updates.length, 3)
    assert.equal(Object.hasOwn(updates[1].$set, 'description'), false)
    assert.equal(updates[2].$set.description, 'Full alternate description.')
    assert.equal(Object.hasOwn(updates[1], '$unset') && Object.hasOwn(updates[1].$unset, 'description'), false)
  } finally {
    Job.bulkWrite = originalBulkWrite
    restoreReadyState()
  }
})
