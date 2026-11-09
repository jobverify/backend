import assert from 'node:assert/strict'
import test from 'node:test'
import mongoose from 'mongoose'

import Job from '../../src/models/Job.js'
import { saveToDB as persistJobs } from '../utils/saveToDB.js'

// These persistence fixtures stub MongoDB; transactional alert behavior has its own replica-set suite.
const saveToDB = (jobs, source, options = {}) => persistJobs(jobs, source, { enqueueAlerts: false, ...options })

test('saveToDB preserves last good source content when a detail fetch fallback is persisted', async () => {
  const originalReadyState = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState')
  const originalBulkWrite = Job.bulkWrite
  const storedJob = {
    description: 'Complete source description from the previous successful detail fetch.',
    experienceRequired: '5+ years',
    publicExperienceChecked: true,
    requiredSkills: ['AWS'],
    engineeringDomain: 'Cloud / DevOps',
    experienceLevel: 'Senior Level',
    seniority: 'Senior',
    primaryRoleDomain: 'Cloud / DevOps',
    secondaryRoleDomains: ['Infrastructure'],
    workArrangement: 'Hybrid',
  }
  let capturedSet = null

  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    value: 1,
  })
  Job.bulkWrite = async ([operation]) => {
    capturedSet = operation.updateOne.update.$set
    Object.assign(storedJob, capturedSet)
    return { upsertedCount: 0, modifiedCount: 1 }
  }

  try {
    await saveToDB([{
      title: 'AWS Network Engineer',
      company: 'Renesas Electronics',
      location: 'Bengaluru, KA, India',
      city: 'Bengaluru',
      country: 'India',
      source: 'renesas',
      sourceUrl: 'https://jobs.renesas.com/job/aws-network-engineer-in-bengaluru-ka-india-jid-3274',
      applyUrl: 'https://jobs.renesas.com/job/aws-network-engineer-in-bengaluru-ka-india-jid-3274',
      jobId: 'aa937808-af8d-4fd5-bc09-c1d2e5c231d0',
      jobDescription: null,
      experienceRequired: null,
      publicExperienceChecked: false,
      preserveExistingSourceContent: true,
      scrapedTimestamp: '2026-09-13T10:30:00.000Z',
    }], 'renesas', {
      enrichPublicExperience: false,
      replaceExisting: false,
      refreshDatasetSummary: false,
      now: new Date('2026-09-13T10:31:00.000Z'),
    })

    assert.ok(capturedSet)
    assert.equal(Object.hasOwn(capturedSet, 'description'), false)
    assert.equal(Object.hasOwn(capturedSet, 'experienceRequired'), false)
    assert.equal(Object.hasOwn(capturedSet, 'publicExperienceChecked'), false)
    assert.equal(Object.hasOwn(capturedSet, 'requiredSkills'), false)
    assert.equal(Object.hasOwn(capturedSet, 'engineeringDomain'), false)
    assert.equal(Object.hasOwn(capturedSet, 'experienceLevel'), false)
    assert.equal(Object.hasOwn(capturedSet, 'seniority'), false)
    assert.equal(Object.hasOwn(capturedSet, 'primaryRoleDomain'), false)
    assert.equal(Object.hasOwn(capturedSet, 'secondaryRoleDomains'), false)
    assert.equal(Object.hasOwn(capturedSet, 'workArrangement'), false)
    assert.equal(storedJob.description, 'Complete source description from the previous successful detail fetch.')
    assert.equal(storedJob.experienceRequired, '5+ years')
    assert.equal(storedJob.publicExperienceChecked, true)
    assert.deepEqual(storedJob.requiredSkills, ['AWS'])
    assert.equal(storedJob.engineeringDomain, 'Cloud / DevOps')
    assert.equal(storedJob.experienceLevel, 'Senior Level')
    assert.equal(storedJob.seniority, 'Senior')
    assert.equal(storedJob.primaryRoleDomain, 'Cloud / DevOps')
    assert.deepEqual(storedJob.secondaryRoleDomains, ['Infrastructure'])
    assert.equal(storedJob.workArrangement, 'Hybrid')
    assert.equal(storedJob.lastSeenAt.toISOString(), '2026-09-13T10:31:00.000Z')
  } finally {
    Job.bulkWrite = originalBulkWrite
    if (originalReadyState) {
      Object.defineProperty(mongoose.connection, 'readyState', originalReadyState)
    } else {
      delete mongoose.connection.readyState
    }
  }
})
