import assert from 'node:assert/strict'
import test from 'node:test'
import { buildScraperAttemptDiagnostics } from '../scraper-support/runner.js'

// Synthetic in-memory records exercise the actual exported diagnostics builder.
// They are not native captures, inventory proof or permission to clean up jobs.
const source = 'synthetic-attempt-diagnostics'
const channels = ['emptyOnlyRecruitmentRecovery', 'softFailureRecruitmentRecovery']
const role = () => ({ source, jobId: 'CONTROL-1', requisitionId: 'CONTROL-1',
  title: 'Synthetic Engineer', company: 'Synthetic Employer', country: 'India',
  location: 'Bengaluru, India', applyUrl: 'https://employer.example.test/roles/control-1',
  jobDescription: 'Build reliable customer services, maintain API contracts, and investigate production failures.',
  sourceDetailComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false })
const attach = (jobs, key, value) => Object.defineProperty(jobs, key, { value, configurable: true })
const absent = (diagnostics, key) => assert.equal(Object.hasOwn(diagnostics, key), false, key)
const providerCases = [
  ['omitted provider', undefined], ['empty provider', {}], ['adapter only', { adapter: 'script' }],
  ['undefined source', { source: undefined }], ['null source', { source: null }],
  ['empty source', { source: '' }], ['whitespace source', { source: ' \t ' }],
  ['numeric source', { source: 0 }], ['boolean source', { source: false }],
]

for (const [kind, make] of [['empty', () => []], ['positive', () => [role()]]]) {
  for (const [label, provider] of providerCases) {
    test(`${kind} diagnostics survive ${label} without inventing recovery metadata`, () => {
      const jobs = make(), diagnostics = provider === undefined
        ? buildScraperAttemptDiagnostics(jobs)
        : buildScraperAttemptDiagnostics(jobs, undefined, provider)
      assert.equal(diagnostics.rawRecords, jobs.length)
      assert.equal(diagnostics.jobs, jobs.length)
      assert.equal(diagnostics.eligibleJobs, jobs.length)
      assert.equal(diagnostics.filteredNonIndia, 0)
      assert.equal(diagnostics.filteredEmptyDescription, 0)
      for (const key of channels) absent(diagnostics, key)
      if (jobs.length) {
        assert.equal(diagnostics.detailHealth.complete, false)
        assert.equal(diagnostics.detailHealth.missingDescriptions, 0)
        assert.equal(diagnostics.jobIdentityHashes.length, 1)
      }
    })
  }
}

test('ordinary mixed-country output keeps diagnostic counts independent of absent recovery metadata', () => {
  const jobs = [role(), { ...role(), jobId: 'CONTROL-2', requisitionId: 'CONTROL-2', country: 'United States', location: 'Boston, United States' }]
  const diagnostics = buildScraperAttemptDiagnostics(jobs)
  assert.equal(diagnostics.rawRecords, 2)
  assert.equal(diagnostics.jobs, 1)
  assert.equal(diagnostics.eligibleJobs, 1)
  assert.equal(diagnostics.filteredNonIndia, 1)
  assert.equal(diagnostics.inventoryEvidence, null)
  for (const key of channels) absent(diagnostics, key)
})

for (const key of channels) {
  test(`${key} forwards a matching own data record by reference without changing frozen input`, () => {
    const metadata = Object.freeze({ source, status: 'unavailable', requestCount: 2,
      failures: Object.freeze([{ status: 503 }]), lifecycleCleanupAllowed: false })
    const jobs = attach([], key, metadata)
    Object.freeze(jobs)
    const descriptors = Object.getOwnPropertyDescriptors(jobs)
    const diagnostics = buildScraperAttemptDiagnostics(jobs, undefined, { source })
    assert.equal(diagnostics[key], metadata)
    assert.equal(diagnostics[key].status, 'unavailable')
    assert.equal(diagnostics[key].requestCount, 2)
    assert.equal(diagnostics[key].lifecycleCleanupAllowed, false)
    assert.equal(diagnostics.rawRecords, 0)
    assert.equal(diagnostics.eligibleJobs, 0)
    assert.equal(diagnostics.inventoryEvidence, null)
    assert.deepEqual(Object.getOwnPropertyDescriptors(jobs), descriptors)
  })

  test(`${key} does not forward a record belonging to another source`, () => {
    absent(buildScraperAttemptDiagnostics(attach([], key, { source: 'other-source' }), undefined, { source }), key)
  })

  for (const [label, value] of [['undefined', undefined], ['null', null], ['false', false], ['zero', 0],
    ['empty text', ''], ['text', source], ['empty object', {}], ['empty array', []]]) {
    test(`${key} excludes malformed ${label} metadata`, () => {
      absent(buildScraperAttemptDiagnostics(attach([], key, value), undefined, { source }), key)
    })
  }

  for (const [label, value] of [['array', Object.assign([], { source })], ['function', Object.assign(() => {}, { source })]]) {
    test(`${key} excludes a ${label} carrying a matching source field`, () => {
      absent(buildScraperAttemptDiagnostics(attach([], key, value), undefined, { source }), key)
    })
  }

  for (const [label, invalid] of [['undefined', undefined], ['null', null], ['empty', ''], ['whitespace', ' \t '],
    ['zero', 0], ['false', false], ['symbol', Symbol('synthetic-source')]]) {
    test(`${key} excludes matching ${label} source values that cannot identify a provider`, () => {
      absent(buildScraperAttemptDiagnostics(attach([], key, { source: invalid }), undefined, { source: invalid }), key)
    })
  }

  test(`${key} does not invoke an accessor on the jobs array`, () => {
    let reads = 0
    const jobs = []
    Object.defineProperty(jobs, key, { get() { reads++; throw Error('Array metadata accessor executed') } })
    absent(buildScraperAttemptDiagnostics(jobs, undefined, { source }), key)
    assert.equal(reads, 0)
  })

  test(`${key} does not invoke an accessor for the metadata source`, () => {
    let reads = 0
    const metadata = {}
    Object.defineProperty(metadata, 'source', { get() { reads++; throw Error('Metadata source accessor executed') } })
    absent(buildScraperAttemptDiagnostics(attach([], key, metadata), undefined, { source }), key)
    assert.equal(reads, 0)
  })

  test(`${key} does not inspect unrelated fields on valid own metadata`, () => {
    let reads = 0
    const metadata = { source }
    Object.defineProperty(metadata, 'unrelated', { get() { reads++; throw Error('Unrelated metadata accessor executed') } })
    const diagnostics = buildScraperAttemptDiagnostics(attach([], key, metadata), undefined, { source })
    assert.equal(diagnostics[key], metadata)
    assert.equal(reads, 0)
  })

  test(`${key} excludes inherited array metadata`, () => {
    const prototype = Object.create(Array.prototype)
    Object.defineProperty(prototype, key, { value: { source } })
    const jobs = Object.setPrototypeOf([], prototype)
    absent(buildScraperAttemptDiagnostics(jobs, undefined, { source }), key)
  })

  test(`${key} excludes metadata whose source is inherited`, () => {
    absent(buildScraperAttemptDiagnostics(attach([], key, Object.create({ source })), undefined, { source }), key)
  })

  test(`${key} excludes a provider source inherited from its prototype`, () => {
    absent(buildScraperAttemptDiagnostics(attach([], key, { source }), undefined, Object.create({ source })), key)
  })
}

test('both matching recovery channels retain distinct original record references', () => {
  const empty = Object.freeze({ source, status: 'not-attempted', requestCount: 0 })
  const soft = Object.freeze({ source, status: 'unavailable', requestCount: 1 })
  const jobs = attach(attach([], channels[0], empty), channels[1], soft)
  const diagnostics = buildScraperAttemptDiagnostics(jobs, undefined, { source })
  assert.equal(diagnostics.emptyOnlyRecruitmentRecovery, empty)
  assert.equal(diagnostics.softFailureRecruitmentRecovery, soft)
  assert.equal(diagnostics.rawRecords, 0)
  assert.equal(diagnostics.jobs, 0)
  assert.equal(diagnostics.eligibleJobs, 0)
})
