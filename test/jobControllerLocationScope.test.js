/**
 * @file Tests for job query location filtering and scoping controllers.
 * @module test/jobControllerLocationScope
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import mongoose from 'mongoose'

import Job from '../src/models/Job.js'
import JobDatasetSummary from '../src/models/JobDatasetSummary.js'
import { PUBLIC_JOB_TYPE_EXPRESSION } from '../src/utils/publicJobType.js'
import { PUBLIC_JOB_TYPES } from '../src/utils/publicJobTypeLabel.js'
import { JOB_DATASET_LIFECYCLE_VERSION } from '../src/services/jobDatasetSummaryService.js'
import { buildPublishableJobPostedAtCutoff } from '../src/utils/jobLifecycle.js'
import { buildAggregateHiringSignalFilter } from '../src/utils/jobListingEvidence.js'
import { buildMissingSourceDescriptionFilter } from '../src/utils/jobSourceContent.js'
import { ACCESS_ROLES, PLAN_IDS } from '../src/constants/accessPlans.js'
import {
  JOB_LIST_CARD_PROJECTION,
  getAllJobs,
  getJobById,
  getJobMeta,
  getJobStats,
} from '../src/controllers/jobController.js'
import {
  buildPublicJobLocationScope,
  getValidIndiaCityForJob,
  isJobInPublicLocationScope,
} from '../src/utils/publicJobLocationScope.js'

// Creates a mock response object for controller tests.
const createResponseDouble = () => ({
  statusCode: 200,
  headers: {},
  body: null,
  set(name, value) {
    this.headers[name] = value
    return this
  },
  status(code) {
    this.statusCode = code
    return this
  },
  json(payload) {
    this.body = payload
    return this
  },
})

const createAggregateExecStub = (handler) => (pipeline) => ({
  exec: async () => handler(pipeline),
})

const createSummaryFindOneStub = (summary) => () => ({
  sort() { return this },
  lean() {
    return this
  },
  exec: async () => summary && {
    lifecycleVersion: JOB_DATASET_LIFECYCLE_VERSION, refreshedAt: new Date(),
    publishedSequence: 1, refreshSequence: 1, ...summary,
  },
})

const createSummaryAggregateStub = (summary, inspect = () => {}) => createAggregateExecStub(async pipeline => {
  inspect(pipeline)
  return [{ visible: [summary], futurePublications: [] }]
})

const summaryFromUpdate = update => Array.isArray(update)
  ? Object.fromEntries(Object.entries(update[0].$set)
    .map(([key, expression]) => [key, expression.$cond[2].$literal]))
  : { _id: new mongoose.Types.ObjectId('000000000000000000000001'), refreshSequence: 1 }

const stripPublishedDateScope = (scope = {}) => {
  const { $expr, ...remainingScope } = scope
  return remainingScope
}

const assertHasPublishedDateScope = (scope) => {
  const [
    postedUpperBound,
    closingAvailability,
  ] = scope?.$expr?.$and ?? []
  const now = postedUpperBound?.$lte?.[1]
  const nowFallback = postedUpperBound?.$lte?.[0]?.$ifNull?.[1]
  const closingNow = closingAvailability?.$or?.[1]?.$gt?.[1]

  assert.ok(now instanceof Date)
  assert.ok(closingNow instanceof Date)
  assert.equal(nowFallback?.getTime(), now.getTime())
  assert.equal(closingNow.getTime(), now.getTime())
  assert.equal(JSON.stringify(scope).includes('$$NOW'), false)
  assert.deepEqual(scope.$expr, {
    $and: [
      {
        $lte: [
          { $ifNull: ['$postedAt', now] },
          now,
        ],
      },
      {
        $or: [
          { $eq: [{ $ifNull: ['$closingDate', null] }, null] },
          { $gt: ['$closingDate', now] },
        ],
      },
      {
        $gte: [
          { $ifNull: ['$postedAt', now] },
          buildPublishableJobPostedAtCutoff(now),
        ],
      },
    ],
  })
}

const assertMatchesPublicJobScope = (scope, expectedFilters = {}, { publicVisibility = true } = {}) => {
  assert.ok(scope)
  assert.deepEqual(stripPublishedDateScope(scope), {
    ...expectedFilters,
    isPublicIndia: true,
    $nor: [buildAggregateHiringSignalFilter(), buildMissingSourceDescriptionFilter()],
  })
  if (publicVisibility) {
    const [dates, category] = scope.$expr?.$and || []
    assert.deepEqual(category, { $in: [PUBLIC_JOB_TYPE_EXPRESSION, PUBLIC_JOB_TYPES] })
    assert.equal(scope.$expr.$and.length, 2)
    assertHasPublishedDateScope({ ...scope, $expr: dates })
  } else {
    assertHasPublishedDateScope(scope)
  }
}

const setConnectionReadyState = (readyState) => {
  const originalReadyState = mongoose.connection.readyState
  mongoose.connection.readyState = readyState
  return () => {
    mongoose.connection.readyState = originalReadyState
  }
}

const flushAsyncWork = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

test('getValidIndiaCityForJob keeps city-only India jobs outside the legacy city allowlist', () => {
  const job = {
    city: 'Noida',
    location: 'Noida',
  }

  assert.equal(getValidIndiaCityForJob(job), 'Noida')
  assert.equal(isJobInPublicLocationScope(job), true)
})

test('getValidIndiaCityForJob keeps researched India cities without an explicit country marker', () => {
  const job = {
    city: 'Faridabad',
    location: 'Faridabad',
  }

  assert.equal(getValidIndiaCityForJob(job), 'Faridabad')
  assert.equal(isJobInPublicLocationScope(job), true)
})

test('getValidIndiaCityForJob keeps plain remote jobs in scope', () => {
  const job = {
    city: 'Remote',
    location: 'Remote',
  }

  assert.equal(getValidIndiaCityForJob(job), 'Remote')
  assert.equal(isJobInPublicLocationScope(job), true)
})

test('getValidIndiaCityForJob rejects foreign cities when the country field is mislabeled as India', () => {
  const job = {
    country: 'India',
    city: 'Austin',
    location: 'Austin, Texas, United States of America',
  }

  assert.equal(getValidIndiaCityForJob(job), null)
  assert.equal(isJobInPublicLocationScope(job), false)
})

test('buildPublicJobLocationScope relies on the stored public-visibility flag', () => {
  const scope = buildPublicJobLocationScope()

  assert.equal(scope.isPublicIndia, true)
})

test('buildPublicJobLocationScope excludes jobs older than one month, future and past-closing jobs', () => {
  const now = new Date('2026-07-25T12:00:00.000Z')
  const scope = buildPublicJobLocationScope(now)

  assertMatchesPublicJobScope(scope, {}, { publicVisibility: false })
  assert.equal(
    scope.$expr.$and[0].$lte[1].toISOString(),
    '2026-07-25T12:00:00.000Z',
  )
  assert.equal(
    scope.$expr.$and[1].$or[1].$gt[1].toISOString(),
    '2026-07-25T12:00:00.000Z',
  )
  assert.equal(
    scope.$expr.$and[2].$gte[1].toISOString(),
    '2026-06-25T00:00:00.000Z',
  )
})

test('job list projection includes fields required to compute application availability', () => {
  const projectedFields = new Set(JOB_LIST_CARD_PROJECTION.split(/\s+/))

  assert.equal(projectedFields.has('applyUrl'), true)
  assert.equal(projectedFields.has('sourceUrl'), true)
  assert.equal(projectedFields.has('workdayApplicationStatus'), true)
  assert.equal(projectedFields.has('workdayApplicationStatusReason'), true)
  assert.equal(projectedFields.has('workdayApplicationStatusCheckedAt'), true)
})

// Verifies that the public location scope is applied to job search queries.
test('getAllJobs applies the public location scope to the jobs query', async () => {
  const originalCountDocuments = Job.countDocuments
  const originalDistinct = Job.distinct
  const originalFind = Job.find
  const originalSummaryFindOne = JobDatasetSummary.findOne

  let countFilter = null
  let findFilter = null
  let distinctCalled = false

  Job.countDocuments = async (filter) => {
    countFilter = filter
    return 1
  }
  Job.distinct = async () => {
    distinctCalled = true
    return ['Example Corp']
  }
  JobDatasetSummary.findOne = createSummaryFindOneStub({
    key: 'public-active',
    totalJobs: 14,
    totalCompanies: 7,
  })

  Job.find = (filter) => {
    findFilter = filter

    return {
      select() {
        return this
      },
      sort() {
        return this
      },
      skip() {
        return this
      },
      limit() {
        return this
      },
      lean() {
        return this
      },
      exec: async () => [
        {
          _id: new mongoose.Types.ObjectId(),
          title: 'Software Engineer',
          city: 'Bangalore',
          location: 'Bengaluru, India',
        },
      ],
    }
  }

  try {
    const res = createResponseDouble()

    await getAllJobs({ query: {}, user: null }, res)

    assertMatchesPublicJobScope(findFilter, { status: 'active' })
    assert.equal(countFilter, null)
    assert.equal(distinctCalled, false)
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.data.length, 1)
    assert.equal(res.body.pagination.total, 14)
    assert.equal(res.body.pagination.totalCompanies, 7)
  } finally {
    Job.countDocuments = originalCountDocuments
    Job.distinct = originalDistinct
    Job.find = originalFind
    JobDatasetSummary.findOne = originalSummaryFindOne
  }
})

test('getAllJobs reuses persisted summary totals for unfiltered recommended sorting', async () => {
  const originalCountDocuments = Job.countDocuments
  const originalDistinct = Job.distinct
  const originalAggregate = Job.aggregate
  const originalSummaryFindOne = JobDatasetSummary.findOne

  let capturedMatch = null
  let countCalled = false
  let distinctCalled = false

  Job.countDocuments = async () => {
    countCalled = true
    return 12
  }
  Job.distinct = async () => {
    distinctCalled = true
    return ['Example Corp']
  }
  Job.aggregate = createAggregateExecStub(async (pipeline) => {
    capturedMatch = pipeline[0].$match
    return [
      {
        _id: new mongoose.Types.ObjectId(),
        title: 'Recommended Software Engineer',
        company: 'Example Corp',
        city: 'Bangalore',
        location: 'Bengaluru, India',
      },
    ]
  })
  JobDatasetSummary.findOne = createSummaryFindOneStub({
    key: 'public-active',
    totalJobs: 21,
    totalCompanies: 8,
  })

  try {
    const res = createResponseDouble()

    await getAllJobs({
      query: { sort: 'recommended' },
      user: {
        role: 'user',
        accessRole: ACCESS_ROLES.MONTHLY,
        premium: {
          planId: PLAN_IDS.MONTHLY,
          status: 'active',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      },
    }, res)

    assertMatchesPublicJobScope(capturedMatch, { status: 'active' })
    assert.equal(countCalled, false)
    assert.equal(distinctCalled, false)
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.pagination.total, 21)
    assert.equal(res.body.pagination.totalCompanies, 8)
    assert.equal(res.body.data.length, 1)
  } finally {
    Job.countDocuments = originalCountDocuments
    Job.distinct = originalDistinct
    Job.aggregate = originalAggregate
    JobDatasetSummary.findOne = originalSummaryFindOne
  }
})

// Verifies that raw full-time records are classified before being returned publicly.
test('getAllJobs classifies raw full-time jobs before returning them', async () => {
  const originalCountDocuments = Job.countDocuments
  const originalDistinct = Job.distinct
  const originalFind = Job.find

  Job.countDocuments = async () => 1
  Job.distinct = async () => ['Example Corp']
  Job.find = () => ({
    select() {
      return this
    },
    sort() {
      return this
    },
    skip() {
      return this
    },
    limit() {
      return this
    },
    lean() {
      return this
    },
    exec: async () => [
      {
        _id: new mongoose.Types.ObjectId().toString(),
        title: 'Graduate Software Engineer',
        company: 'Example Corp',
        jobType: 'Full-time',
        employmentType: 'Full-time',
        experienceRequired: '0-1 years of experience',
        description: 'Campus hiring role for 2026 graduates.',
      },
    ],
  })

  try {
    const res = createResponseDouble()

    await getAllJobs({
      query: {},
      user: {
        role: 'user',
        accessRole: ACCESS_ROLES.MONTHLY,
        premium: {
          planId: PLAN_IDS.MONTHLY,
          status: 'active',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      },
    }, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.data[0].jobType, 'Full-time Fresher')
  } finally {
    Job.countDocuments = originalCountDocuments
    Job.distinct = originalDistinct
    Job.find = originalFind
  }
})

// Verifies that chronological sorting is applied correctly when requested.
test('getAllJobs applies oldest chronological sorting when requested', async () => {
  const originalCountDocuments = Job.countDocuments
  const originalDistinct = Job.distinct
  const originalFind = Job.find

  let capturedSort = null

  Job.countDocuments = async () => 0
  Job.distinct = async () => []
  Job.find = () => ({
    select() {
      return this
    },
    sort(sortArg) {
      capturedSort = sortArg
      return this
    },
    skip() {
      return this
    },
    limit() {
      return this
    },
    lean() {
      return this
    },
    exec: async () => [],
  })

  try {
    const res = createResponseDouble()

    await getAllJobs({
      query: { sort: 'oldest' },
      user: {
        role: 'user',
        accessRole: ACCESS_ROLES.MONTHLY,
        premium: {
          planId: PLAN_IDS.MONTHLY,
          status: 'active',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      },
    }, res)

    assert.equal(res.statusCode, 200)
    assert.deepEqual(capturedSort, { sortDate: 1, _id: 1 })
  } finally {
    Job.countDocuments = originalCountDocuments
    Job.distinct = originalDistinct
    Job.find = originalFind
  }
})

// Verifies that the public location scope is applied to the job detail query.
test('getJobById applies the public location scope to the detail query', async () => {
  const originalFindOne = Job.findOne
  const jobId = new mongoose.Types.ObjectId().toString()
  let capturedFilter = null

  Job.findOne = async (filter) => {
    capturedFilter = filter
    return null
  }

  try {
    const res = createResponseDouble()

    const queryStartedAt = Date.now()
    await getJobById({ params: { id: jobId } }, res)

    assert.deepEqual(capturedFilter.$or[0], { closingDate: null })
    assert.ok(capturedFilter.$or[1].closingDate.$gt instanceof Date)
    assert.ok(capturedFilter.$or[1].closingDate.$gt.getTime() >= queryStartedAt && capturedFilter.$or[1].closingDate.$gt.getTime() <= Date.now())
    assertMatchesPublicJobScope(capturedFilter, { _id: jobId, status: 'active', $or: capturedFilter.$or })
    assert.equal(res.statusCode, 404)
  } finally {
    Job.findOne = originalFindOne
  }
})

// Verifies that raw full-time detail records are classified before being returned publicly.
test('getJobById classifies raw full-time jobs before returning them', async () => {
  const originalFindOne = Job.findOne
  const jobId = new mongoose.Types.ObjectId().toString()

  Job.findOne = async () => ({
    _id: jobId,
    title: 'Software Engineer',
    company: 'Example Corp',
    jobType: 'Full-time',
    employmentType: 'Full-time',
    experienceRequired: '3 to 5 years of software engineering experience',
    description: 'Build internal tooling for engineering systems.',
  })

  try {
    const res = createResponseDouble()

    await getJobById({ params: { id: jobId } }, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.data.jobType, 'Full-time Experienced')
  } finally {
    Job.findOne = originalFindOne
  }
})

test('getJobById corrects stale fresher labels when explicit experience shows an experienced role', async () => {
  const originalFindOne = Job.findOne
  const jobId = new mongoose.Types.ObjectId().toString()

  Job.findOne = async () => ({
    _id: jobId,
    title: 'Cloud DevOps Engineer',
    company: 'Airbus',
    jobType: 'Full-time Fresher',
    employmentType: 'Full-time',
    experienceLevel: 'Entry Level',
    experienceRequired: 'Experience: Graduate with 3-7 years of experience in Cloud Platform and DevOps development',
    experienceProfile: {
      minimumYears: 3,
      maximumYears: 7,
      confidence: 'high',
    },
    description: 'Support cloud platform and DevOps operations for Airbus teams.',
  })

  try {
    const res = createResponseDouble()

    await getJobById({ params: { id: jobId } }, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.data.experienceLevel, 'Mid Level')
    assert.equal(res.body.data.jobType, 'Full-time Experienced')
  } finally {
    Job.findOne = originalFindOne
  }
})

test('getJobById returns before a Workday availability refresh completes', async () => {
  const originalFindOne = Job.findOne
  const originalFetch = global.fetch
  const originalUpdateOne = Job.updateOne
  const jobId = new mongoose.Types.ObjectId().toString()
  const workdayJobUrl = 'https://allstate.wd5.myworkdayjobs.com/en-US/allstate_careers/job/non-blocking-refresh'
  let releaseFetch

  Job.findOne = async () => ({
    _id: jobId,
    title: 'Software Engineer Consultant II',
    company: 'Allstate',
    jobType: 'Full-time Experienced',
    applyUrl: workdayJobUrl,
    sourceUrl: workdayJobUrl,
    atsPlatform: 'workday',
  })

  Job.updateOne = () => ({
    exec: async () => ({ matchedCount: 1, modifiedCount: 1 }),
  })

  global.fetch = () => new Promise((resolve) => {
    releaseFetch = () => resolve({
      url: 'https://community.workday.com/maintenance-page?d=5&s=1&e=1&o=',
      text: async () => '<html><head><title>Workday is currently unavailable.</title></head><body>maintenance-page</body></html>',
    })
  })

  try {
    const res = createResponseDouble()

    await getJobById({ params: { id: jobId } }, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.data.applicationUrl, workdayJobUrl)
    assert.equal(res.body.data.applicationStatus, 'available')
    assert.equal(res.body.data.applicationStatusReason, null)

    releaseFetch()
    await flushAsyncWork()
  } finally {
    Job.findOne = originalFindOne
    global.fetch = originalFetch
    Job.updateOne = originalUpdateOne
  }
})

test('getJobById serves cached Workday outage status after an async refresh', async () => {
  const originalFindOne = Job.findOne
  const originalFetch = global.fetch
  const originalUpdateOne = Job.updateOne
  const jobId = new mongoose.Types.ObjectId().toString()
  const workdayJobUrl = 'https://allstate.wd5.myworkdayjobs.com/en-US/allstate_careers/job/cached-maintenance-refresh'
  let persistedUpdate = null

  Job.findOne = async () => ({
    _id: jobId,
    title: 'Software Engineer Consultant II',
    company: 'Allstate',
    jobType: 'Full-time Experienced',
    applyUrl: workdayJobUrl,
    sourceUrl: workdayJobUrl,
    atsPlatform: 'workday',
  })

  Job.updateOne = (_filter, update) => {
    persistedUpdate = update
    return {
      exec: async () => ({ matchedCount: 1, modifiedCount: 1 }),
    }
  }

  global.fetch = async () => ({
    url: 'https://community.workday.com/maintenance-page?d=5&s=1&e=1&o=',
    text: async () => '<html><head><title>Workday is currently unavailable.</title></head><body>maintenance-page</body></html>',
  })

  try {
    const firstResponse = createResponseDouble()

    await getJobById({ params: { id: jobId } }, firstResponse)

    assert.equal(firstResponse.statusCode, 200)
    assert.equal(firstResponse.body.data.applicationStatus, 'available')

    await flushAsyncWork()

    const secondResponse = createResponseDouble()
    await getJobById({ params: { id: jobId } }, secondResponse)

    assert.equal(secondResponse.statusCode, 200)
    assert.equal(secondResponse.body.data.applicationUrl, workdayJobUrl)
    assert.equal(secondResponse.body.data.applicationStatus, 'temporarily_unavailable')
    assert.equal('workdayApplicationStatus' in secondResponse.body.data, false)
    assert.equal('workdayApplicationStatusReason' in secondResponse.body.data, false)
    assert.equal('workdayApplicationStatusCheckedAt' in secondResponse.body.data, false)
    assert.match(
      secondResponse.body.data.applicationStatusReason,
      /workday.+temporarily unavailable/i,
    )
    assert.equal(persistedUpdate.$set.workdayApplicationStatus, 'temporarily_unavailable')
    assert.equal(
      persistedUpdate.$set.workdayApplicationStatusReason,
      'Applications on this Workday portal are temporarily unavailable because Workday is showing a maintenance page. Please try again later.',
    )
    assert.ok(persistedUpdate.$set.workdayApplicationStatusCheckedAt instanceof Date)
  } finally {
    Job.findOne = originalFindOne
    global.fetch = originalFetch
    Job.updateOne = originalUpdateOne
  }
})

test('getJobById marks a Workday application unavailable after a conclusive 404 probe', async () => {
  const originalFindOne = Job.findOne
  const originalFetch = global.fetch
  const originalUpdateOne = Job.updateOne
  const jobId = new mongoose.Types.ObjectId().toString()
  const workdayJobUrl = 'https://example.wd5.myworkdayjobs.com/en-US/careers/job/removed-role'
  let persistedUpdate = null

  Job.findOne = async () => ({
    _id: jobId,
    title: 'Removed Software Engineer',
    company: 'Example',
    jobType: 'Full-time Fresher',
    applyUrl: workdayJobUrl,
    sourceUrl: workdayJobUrl,
    atsPlatform: 'workday',
  })

  Job.updateOne = (_filter, update) => {
    persistedUpdate = update
    return {
      exec: async () => ({ matchedCount: 1, modifiedCount: 1 }),
    }
  }

  global.fetch = async () => ({
    ok: false,
    status: 404,
    url: workdayJobUrl,
    text: async () => '<html><body>Job not found</body></html>',
  })

  try {
    const firstResponse = createResponseDouble()
    await getJobById({ params: { id: jobId } }, firstResponse)

    assert.equal(firstResponse.statusCode, 200)
    assert.equal(firstResponse.body.data.applicationStatus, 'available')

    await flushAsyncWork()

    const secondResponse = createResponseDouble()
    await getJobById({ params: { id: jobId } }, secondResponse)

    assert.equal(secondResponse.statusCode, 200)
    assert.equal(secondResponse.body.data.applicationStatus, 'unavailable')
    assert.match(secondResponse.body.data.applicationStatusReason, /no longer available/i)
    assert.equal(persistedUpdate.$set.workdayApplicationStatus, 'unavailable')
    assert.match(
      persistedUpdate.$set.workdayApplicationStatusReason,
      /no longer available/i,
    )
  } finally {
    Job.findOne = originalFindOne
    global.fetch = originalFetch
    Job.updateOne = originalUpdateOne
  }
})

test('getJobById marks a Workday application unavailable when its bootstrap reports no posting', async () => {
  const originalFindOne = Job.findOne
  const originalFetch = global.fetch
  const originalUpdateOne = Job.updateOne
  const jobId = new mongoose.Types.ObjectId().toString()
  const workdayJobUrl = 'https://boeing.wd1.myworkdayjobs.com/EXTERNAL_CAREERS/job/IND---Bangalore-India/removed-role/apply'
  let persistedUpdate = null

  Job.findOne = async () => ({
    _id: jobId,
    title: 'Removed Structural Analysis Engineer',
    company: 'Boeing India',
    jobType: 'Full-time Experienced',
    applyUrl: workdayJobUrl,
    sourceUrl: workdayJobUrl,
    atsPlatform: 'talentbrew-radancy',
  })

  Job.updateOne = (_filter, update) => {
    persistedUpdate = update
    return {
      exec: async () => ({ matchedCount: 1, modifiedCount: 1 }),
    }
  }

  global.fetch = async () => ({
    ok: true,
    status: 200,
    url: workdayJobUrl,
    text: async () => '<script>window.workday = { postingAvailable: false };</script>',
  })

  try {
    const firstResponse = createResponseDouble()
    await getJobById({ params: { id: jobId } }, firstResponse)
    assert.equal(firstResponse.body.data.applicationStatus, 'available')

    await flushAsyncWork()

    const secondResponse = createResponseDouble()
    await getJobById({ params: { id: jobId } }, secondResponse)

    assert.equal(secondResponse.body.data.applicationStatus, 'unavailable')
    assert.match(secondResponse.body.data.applicationStatusReason, /no longer available/i)
    assert.equal(persistedUpdate.$set.workdayApplicationStatus, 'unavailable')
  } finally {
    Job.findOne = originalFindOne
    global.fetch = originalFetch
    Job.updateOne = originalUpdateOne
  }
})

test('getJobById prefers a newer stored Workday unavailability status over an available cache entry', async () => {
  const originalFindOne = Job.findOne
  const originalFetch = global.fetch
  const originalUpdateOne = Job.updateOne
  const jobId = new mongoose.Types.ObjectId().toString()
  const workdayJobUrl = 'https://example.wd5.myworkdayjobs.com/en-US/careers/job/stale-cache'
  let requestCount = 0

  Job.findOne = async () => {
    requestCount += 1
    return {
      _id: jobId,
      title: 'Removed Software Engineer',
      company: 'Example',
      jobType: 'Full-time Experienced',
      applyUrl: workdayJobUrl,
      sourceUrl: workdayJobUrl,
      ...(requestCount > 1 ? {
        workdayApplicationStatus: 'unavailable',
        workdayApplicationStatusReason: 'This Workday application is no longer available.',
        workdayApplicationStatusCheckedAt: new Date(Date.now() + 60_000),
      } : {}),
    }
  }
  global.fetch = async () => ({
    status: 200,
    url: workdayJobUrl,
    text: async () => '<html><body>Job page</body></html>',
  })
  Job.updateOne = () => ({
    exec: async () => ({ matchedCount: 1, modifiedCount: 1 }),
  })

  try {
    await getJobById({ params: { id: jobId } }, createResponseDouble())
    await flushAsyncWork()

    const res = createResponseDouble()
    await getJobById({ params: { id: jobId } }, res)

    assert.equal(res.body.data.applicationStatus, 'unavailable')
  } finally {
    Job.findOne = originalFindOne
    global.fetch = originalFetch
    Job.updateOne = originalUpdateOne
  }
})

// Verifies that the public location scope is applied to all metadata queries.
test('getJobMeta applies the public location scope to metadata queries', async () => {
  const originalDistinct = Job.distinct
  const originalAggregate = Job.aggregate
  const originalCountDocuments = Job.countDocuments
  const capturedFilters = new Map()
  let capturedCompanyPipeline = null

  // Mocks Job.distinct to capture the filters applied.
  Job.distinct = async (field, filter) => {
    capturedFilters.set(field, filter)
    return []
  }
  Job.aggregate = createAggregateExecStub(async (pipeline) => {
    if (pipeline[1]?.$group?._id === PUBLIC_JOB_TYPE_EXPRESSION) {
      capturedFilters.set('jobType', pipeline[0].$match)
      return []
    }
    if (JSON.stringify(pipeline[1]?.$group?._id).includes('$workArrangement')) {
      capturedFilters.set('workArrangement', pipeline[0].$match)
      return []
    }
    capturedCompanyPipeline = pipeline
    return []
  })
  Job.countDocuments = async () => 1

  try {
    const res = createResponseDouble()

    await getJobMeta({
      query: { company: 'Example Corp' },
      user: {
        role: 'user',
        accessRole: ACCESS_ROLES.MONTHLY,
        premium: {
          planId: PLAN_IDS.MONTHLY,
          status: 'active',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      },
    }, res)

    const expectedCompanyFilter = {
      status: 'active',
      company: { $ne: null },
    }
    const expectedCityFilter = {
      status: 'active',
      companyKey: 'example corp',
      city: { $ne: null },
    }
    const expectedJobTypeFilter = {
      status: 'active',
      companyKey: 'example corp',
    }
    const expectedExperienceFilter = {
      status: 'active',
      companyKey: 'example corp',
    }
    const expectedRoleDomainFilter = {
      status: 'active',
      companyKey: 'example corp',
      primaryRoleDomain: { $ne: null },
    }
    const expectedWorkArrangementFilter = {
      status: 'active',
      companyKey: 'example corp',
    }

    if (capturedCompanyPipeline) {
      assertMatchesPublicJobScope(capturedCompanyPipeline[0].$match, expectedCompanyFilter)
      assertMatchesPublicJobScope(capturedFilters.get('city'), expectedCityFilter)
      assertMatchesPublicJobScope(capturedFilters.get('jobType'), expectedJobTypeFilter)
    } else {
      assertMatchesPublicJobScope(capturedFilters.get('company'), expectedCompanyFilter)
      assertMatchesPublicJobScope(capturedFilters.get('city'), expectedCityFilter)
      assertMatchesPublicJobScope(capturedFilters.get('jobType'), expectedJobTypeFilter)
    }
    assertMatchesPublicJobScope(capturedFilters.get('experienceYears'), expectedExperienceFilter)
    assertMatchesPublicJobScope(capturedFilters.get('primaryRoleDomain'), expectedRoleDomainFilter)
    assertMatchesPublicJobScope(capturedFilters.get('workArrangement'), expectedWorkArrangementFilter)

    assert.equal(res.statusCode, 200)
  } finally {
    Job.distinct = originalDistinct
    Job.aggregate = originalAggregate
    Job.countDocuments = originalCountDocuments
  }
})

test('getJobMeta preserves unspecified eligibility alongside known effective categories', async () => {
  const originalDistinct = Job.distinct
  const originalAggregate = Job.aggregate
  const originalCountDocuments = Job.countDocuments

  Job.distinct = async (field) => {
    if (field === 'company') return ['Example Corp']
    if (field === 'city') return ['Bangalore']
    if (field === 'jobType') return ['Part-time', 'Contract', 'Full-time']
    return []
  }
  Job.aggregate = createAggregateExecStub(async pipeline => {
    if (pipeline[1]?.$group?._id === PUBLIC_JOB_TYPE_EXPRESSION) {
      return [{ _id: 'Unspecified' }, { _id: 'Contract' }, { _id: 'Full-time Experienced' }]
    }
    if (JSON.stringify(pipeline[1]?.$group?._id).includes('$workArrangement')) return []
    return [{ company: 'Example Corp' }]
  })
  Job.countDocuments = async () => 1

  try {
    const res = createResponseDouble()

    await getJobMeta({
      query: { company: 'Example Corp' },
      user: {
        role: 'user',
        accessRole: ACCESS_ROLES.MONTHLY,
        premium: {
          planId: PLAN_IDS.MONTHLY,
          status: 'active',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      },
    }, res)

    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body.data.jobTypes, ['Contract', 'Full-time Experienced', 'Unspecified'])
  } finally {
    Job.distinct = originalDistinct
    Job.aggregate = originalAggregate
    Job.countDocuments = originalCountDocuments
  }
})

// Verifies that public stats are served from the persisted summary when available.
test('getJobStats returns the persisted dataset summary without re-counting jobs', async () => {
  const originalFindOne = JobDatasetSummary.findOne

  JobDatasetSummary.findOne = () => ({
    sort() { return this },
    lean() {
      return this
    },
    exec: async () => ({
      key: 'public-active',
      totalJobs: 14,
      totalCompanies: 1,
    }),
  })

  try {
    const res = createResponseDouble()

    await getJobStats({}, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.data.totalJobs, 14)
    assert.equal(res.body.data.totalCompanies, 1)
  } finally {
    JobDatasetSummary.findOne = originalFindOne
  }
})

test('getJobStats rebuilds a current-day summary from the previous lifecycle scope', async () => {
  const originalFindOne = JobDatasetSummary.findOne
  const originalFindOneAndUpdate = JobDatasetSummary.findOneAndUpdate
  const originalAggregate = Job.aggregate
  const restoreReadyState = setConnectionReadyState(1)
  let aggregateCalled = false

  JobDatasetSummary.findOne = () => ({
    sort() { return this },
    lean() {
      return this
    },
    exec: async () => ({
      key: 'public-active',
      totalJobs: 999,
      totalCompanies: 99,
      refreshedAt: new Date(),
    }),
  })
  Job.aggregate = createSummaryAggregateStub({
      totalJobs: 8,
      companies: ['Example Corp'],
      cities: ['Bangalore'],
      jobTypes: ['Full-time Fresher'],
    }, () => { aggregateCalled = true })
  JobDatasetSummary.findOneAndUpdate = (_filter, update) => ({
    lean() {
      return this
    },
    exec: async () => summaryFromUpdate(update),
  })

  try {
    const res = createResponseDouble()

    await getJobStats({}, res)

    assert.equal(aggregateCalled, true)
    assert.equal(res.body.data.totalJobs, 8)
  } finally {
    restoreReadyState()
    JobDatasetSummary.findOne = originalFindOne
    JobDatasetSummary.findOneAndUpdate = originalFindOneAndUpdate
    Job.aggregate = originalAggregate
  }
})

test('getJobStats rebuilds a summary created before the current lifecycle day', async () => {
  const originalFindOne = JobDatasetSummary.findOne
  const originalFindOneAndUpdate = JobDatasetSummary.findOneAndUpdate
  const originalAggregate = Job.aggregate
  const restoreReadyState = setConnectionReadyState(1)
  let aggregateCalled = false

  JobDatasetSummary.findOne = () => ({
    sort() { return this },
    lean() {
      return this
    },
    exec: async () => ({
      key: 'public-active',
      totalJobs: 999,
      totalCompanies: 99,
      refreshedAt: new Date(Date.now() - (36 * 60 * 60 * 1000)),
    }),
  })
  Job.aggregate = createSummaryAggregateStub({
      totalJobs: 7,
      companies: ['Example Corp'],
      cities: ['Bangalore'],
      jobTypes: ['Full-time Fresher'],
    }, () => { aggregateCalled = true })
  JobDatasetSummary.findOneAndUpdate = (_filter, update) => ({
    lean() {
      return this
    },
    exec: async () => summaryFromUpdate(update),
  })

  try {
    const res = createResponseDouble()

    await getJobStats({}, res)

    assert.equal(aggregateCalled, true)
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.data.totalJobs, 7)
    assert.equal(res.body.data.totalCompanies, 1)
  } finally {
    restoreReadyState()
    JobDatasetSummary.findOne = originalFindOne
    JobDatasetSummary.findOneAndUpdate = originalFindOneAndUpdate
    Job.aggregate = originalAggregate
  }
})

test('getJobStats rebuilds the persisted dataset summary before falling back to live counts', async () => {
  const originalFindOne = JobDatasetSummary.findOne
  const originalFindOneAndUpdate = JobDatasetSummary.findOneAndUpdate
  const originalAggregate = Job.aggregate
  const originalCountDocuments = Job.countDocuments
  const originalDistinct = Job.distinct
  const restoreReadyState = setConnectionReadyState(1)
  let countCalled = false
  let distinctCalled = false
  let capturedSummaryUpdate = null

  JobDatasetSummary.findOne = () => ({
    sort() { return this },
    lean() {
      return this
    },
    exec: async () => null,
  })
  JobDatasetSummary.findOneAndUpdate = (_filter, update) => {
    capturedSummaryUpdate = summaryFromUpdate(update)
    return {
      lean() {
        return this
      },
      exec: async () => summaryFromUpdate(update),
    }
  }
  Job.aggregate = createSummaryAggregateStub({
    totalJobs: 22,
    companies: ['Example Corp', 'Another Corp'],
    cities: ['Bangalore', 'Pune'],
    jobTypes: ['Intern', 'Full-time Experienced'],
  })
  Job.countDocuments = async () => {
    countCalled = true
    return 0
  }
  Job.distinct = async () => {
    distinctCalled = true
    return []
  }

  try {
    const res = createResponseDouble()

    await getJobStats({}, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.data.totalJobs, 22)
    assert.equal(res.body.data.totalCompanies, 2)
    assert.equal(countCalled, false)
    assert.equal(distinctCalled, false)
    assert.deepEqual(capturedSummaryUpdate?.companies, ['Another Corp', 'Example Corp'])
    assert.deepEqual(capturedSummaryUpdate?.cities, ['Bangalore', 'Pune'])
  } finally {
    restoreReadyState()
    JobDatasetSummary.findOne = originalFindOne
    JobDatasetSummary.findOneAndUpdate = originalFindOneAndUpdate
    Job.aggregate = originalAggregate
    Job.countDocuments = originalCountDocuments
    Job.distinct = originalDistinct
  }
})

test('getJobStats rebuilds the dataset summary when the persisted snapshot is missing', async () => {
  const originalFindOne = JobDatasetSummary.findOne
  const originalFindOneAndUpdate = JobDatasetSummary.findOneAndUpdate
  const originalAggregate = Job.aggregate
  const restoreReadyState = setConnectionReadyState(1)
  let capturedMatch = null
  let findOneCalls = 0

  JobDatasetSummary.findOne = () => ({
    sort() { return this },
    lean() {
      return this
    },
    exec: async () => {
      findOneCalls += 1
      return null
    },
  })
  Job.aggregate = createSummaryAggregateStub({
      totalJobs: 5,
      companies: ['Acme Labs', 'CloudWorks'],
      cities: ['Bangalore'],
      jobTypes: ['Internship'],
    }, pipeline => {
      capturedMatch = { ...pipeline[0].$match, ...pipeline[1].$facet.visible[0].$match }
    })
  JobDatasetSummary.findOneAndUpdate = (_filter, update) => ({
    lean() {
      return this
    },
    exec: async () => !Array.isArray(update) ? summaryFromUpdate(update) : ({
      key: 'public-active',
      totalJobs: 5,
      totalCompanies: 2,
      companies: ['Acme Labs', 'CloudWorks'],
      cities: ['Bangalore'],
      jobTypes: ['Internship'],
    }),
  })

  try {
    const res = createResponseDouble()

    await getJobStats({}, res)

    assert.equal(findOneCalls, 2)
    assertMatchesPublicJobScope(capturedMatch, { status: 'active' })
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.data.totalJobs, 5)
    assert.equal(res.body.data.totalCompanies, 2)
  } finally {
    restoreReadyState()
    JobDatasetSummary.findOne = originalFindOne
    JobDatasetSummary.findOneAndUpdate = originalFindOneAndUpdate
    Job.aggregate = originalAggregate
  }
})
