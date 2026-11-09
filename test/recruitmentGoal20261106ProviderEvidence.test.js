import assert from 'node:assert/strict'
import test from 'node:test'
import { decorateJobsWithProviderMetadata } from '../scraper-support/providers/index.js'
import { attachSourceObservationEvidence, readSourceObservationEvidence } from '../scraper-support/utils/sourceObservationEvidence.js'

const source = 'provider_evidence_fixture'
const provider = { source, companyName: 'Controlled provider evidence fixture' }
const observation = (changes = {}) => ({ source, recordKind: 'vacancy-rows', observedRecordCount: 1,
  observedVacancyCount: 1, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null, ...changes })
const rowsWithAudit = audit => {
  const jobs = [{ source, title: 'Controlled native vacancy' }]
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: audit, configurable: true })
  return jobs
}

test('a plain observation remains an immutable snapshot after provider decoration', () => {
  const audit = observation()
  const decorated = decorateJobsWithProviderMetadata(rowsWithAudit(audit), provider)
  audit.observedRecordCount = 999
  audit.observedVacancyCount = 999
  assert.equal(decorated.nativeCollectionEvidence.observedRecordCount, 1)
  assert.equal(Object.isFrozen(decorated.nativeCollectionEvidence), true)
})

test('valid full source audits keep original records, closing holds and receipts alongside bounded diagnostics', () => {
  const audit = { ...observation(), originalOpeningRecords: [{ id: 'native-1' }], originalClosingRecords: [],
    holds: [{ nativeId: 'native-1', reason: 'native-record-missing-unpublished-or-changed-at-closing' }],
    reader: { receipts: [{ method: 'GET', requestedUrl: 'https://example.invalid/jobs' }] } }
  const decorated = decorateJobsWithProviderMetadata(rowsWithAudit(audit), provider)
  assert.equal(decorated.nativeCollectionEvidence, audit)
  assert.equal(decorated.nativeCollectionEvidence.holds[0].nativeId, 'native-1')
  assert.equal(decorated.nativeCollectionEvidence.reader.receipts.length, 1)
  assert.deepEqual(readSourceObservationEvidence(decorated, source), observation())
})

test('rich-looking native receipts do not reinstate invalid observation counts', () => {
  const audit = { ...observation({ observedVacancyCount: 2 }), reader: { receipts: [] }, holds: [] }
  const decorated = decorateJobsWithProviderMetadata(rowsWithAudit(audit), provider)
  assert.equal(decorated.nativeCollectionEvidence, undefined)
  assert.equal(readSourceObservationEvidence(decorated, source), null)
})

test('a later raw audit cannot replace an earlier validated observation snapshot with conflicting counts', () => {
  const jobs = rowsWithAudit(observation())
  attachSourceObservationEvidence(jobs, observation())
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: { ...observation({ observedRecordCount: 99,
    observedVacancyCount: 99 }), holds: [], reader: { receipts: [] } }, configurable: true })
  const decorated = decorateJobsWithProviderMetadata(jobs, provider)
  assert.deepEqual(decorated.nativeCollectionEvidence, observation())
  assert.equal(readSourceObservationEvidence(decorated, source).observedVacancyCount, 1)
})

test('foreign or inherited native audit objects do not acquire the registered provider identity', () => {
  for (const audit of [{ source: 'anothercompany', retainedResponses: [] }, Object.create(observation())]) {
    const decorated = decorateJobsWithProviderMetadata(rowsWithAudit(audit), provider)
    assert.equal(decorated.nativeCollectionEvidence, undefined)
  }
})

test('omitting recordKind cannot reinstate contradictory observation counts or source scope', () => {
  const jobs = rowsWithAudit(observation())
  attachSourceObservationEvidence(jobs, observation())
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { configurable: true, value: {
    source, observedRecordCount: 99, observedVacancyCount: 99, sourceScopeComplete: true,
    companyGlobalTotal: 99, companyIndiaTotal: 99, reader: { receipts: [] }, holds: [],
  } })
  const decorated = decorateJobsWithProviderMetadata(jobs, provider)
  assert.deepEqual(decorated.nativeCollectionEvidence, observation())
  assert.equal(readSourceObservationEvidence(decorated, source).observedVacancyCount, 1)
})

test('missing recordKind cannot turn an invalid count object into a legacy native audit', () => {
  const audit = { source, observedRecordCount: -1, observedVacancyCount: 99, reader: { receipts: [] } }
  const decorated = decorateJobsWithProviderMetadata(rowsWithAudit(audit), provider)
  assert.equal(decorated.nativeCollectionEvidence, undefined)
})

test('legacy native detail audits retain their source-owned listing and detail evidence', () => {
  const audit = { source, observedListingCount: 3, candidateDetails: 3, successfulDetailReads: 2,
    failures: [{ jobId: 'native-3', stage: 'detail', kind: 'upstream-unavailable' }] }
  const decorated = decorateJobsWithProviderMetadata(rowsWithAudit(audit), provider)
  assert.equal(decorated.nativeCollectionEvidence, audit)
  assert.equal(readSourceObservationEvidence(decorated, source), null)
})
