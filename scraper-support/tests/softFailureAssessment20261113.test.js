import assert from 'node:assert/strict'
import test from 'node:test'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'
import { attachInventoryEvidence } from '../utils/inventoryEvidence.js'

const provider = { source: 'diagnostic-native-source', zeroResultPolicy: 'evidence-required' }
const attach = (jobs, status, overrides = {}) => attachInventoryEvidence(jobs, {
  status, surface: 'https://publisher.example/careers', firstParty: true,
  listingComplete: false, lifecycleCleanupAllowed: false, pagesFetched: 1,
  reportedTotal: null, indiaFacetCount: null, verifiedAt: new Date().toISOString(), ...overrides,
})
const role = (country, location) => ({ title: 'Software Engineer', country, location,
  sourceUrl: 'https://publisher.example/careers/software-engineer',
  applyUrl: 'https://publisher.example/careers/software-engineer',
  jobDescription: 'Develop and maintain production software, investigate defects, and review technical designs.' })

test('successful source execution with an empty coverage gap remains a soft failure', () => {
  const result = assessSoftFailureAcquisition(provider, attach([], 'coverage-gap'))
  assert.equal(result.runnerOutcome.success, false)
  assert.equal(result.runnerOutcome.softFailure, true)
  assert.equal(result.runnerOutcome.failureKind, 'coverage_gap')
  assert.equal(result.zeroJobEvidence, 'coverage-gap')
  assert.equal(result.eligibleJobs, 0)
  assert.deepEqual(result.cleanupOptions, { replaceExisting: false })
})

test('current verified empty inventory is accepted while its explicit cleanup hold survives', () => {
  const result = assessSoftFailureAcquisition(provider, attach([], 'verified-empty', {
    listingComplete: true, reportedTotal: 0, indiaFacetCount: 0,
  }))
  assert.equal(result.runnerOutcome.success, true)
  assert.equal(result.zeroJobEvidence, 'verified-empty')
  assert.deepEqual(result.cleanupOptions, { replaceExisting: false })
})

test('complete foreign native inventory produces fetched zero rather than fabricated India jobs', () => {
  const result = assessSoftFailureAcquisition(provider, attach([
    role('United States', 'Austin, Texas, United States'),
  ], 'complete-inventory', { listingComplete: true, reportedTotal: 1, indiaFacetCount: 0 }))
  assert.equal(result.rawJobs, 1)
  assert.equal(result.indiaJobs, 0)
  assert.equal(result.eligibleJobs, 0)
  assert.equal(result.runnerOutcome.success, true)
  assert.equal(result.zeroJobEvidence, 'fetched-zero')
})

test('qualified India observations can succeed while inventory and cleanup remain incomplete', () => {
  const result = assessSoftFailureAcquisition(provider, attach([
    role('India', 'Bengaluru, Karnataka, India'),
  ], 'coverage-gap'))
  assert.equal(result.rawJobs, 1)
  assert.equal(result.indiaJobs, 1)
  assert.equal(result.eligibleJobs, 1)
  assert.equal(result.zeroJobEvidence, null)
  assert.equal(result.runnerOutcome.success, true)
  assert.equal(result.runnerOutcome.partial, true)
  assert.equal(result.inventoryEvidence.listingComplete, false)
  assert.deepEqual(result.cleanupOptions, { replaceExisting: false })
})
