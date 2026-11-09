import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import zlib from 'node:zlib'
import { createHash } from 'node:crypto'
import { nativePostingJobs } from '../scraper-support/shared/nativeJobPosting.js'

const fixture = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-posting-evidence-394.json.gz', import.meta.url))))
const evidence = fixture.nativeCollectionEvidence
const projected = () => nativePostingJobs(evidence, { source: 'coursera', companyName: 'Coursera' })
const bytes = value => Buffer.byteLength(JSON.stringify(value))

test('four actual native roles retain one full response batch instead of repeating it four times', () => {
  const jobs = projected()
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].nativeCollectionEvidence, evidence)
  for (const response of jobs[0].nativeCollectionEvidence.retainedResponses) assert.equal(createHash('sha256').update(Buffer.from(response.rawBodyBase64, 'base64')).digest('hex'), response.bodySHA256)
  for (const job of jobs.slice(1)) {
    const compact = job.nativeCollectionEvidence
    assert.equal(compact.fullBatchEvidenceOnFirstExtractedJob, true)
    assert.equal(compact.firstExtractedJobID, jobs[0].jobId)
    assert.equal(compact.extractedDetailJobs, 4)
    assert.equal(compact.observedListingCount, 30)
    assert.equal(compact.candidateDetails, 6)
    assert.equal(compact.unknownRawFailureCount, 2)
    assert.equal(compact.failures.length, 2)
    assert.equal(compact.retainedResponses.length, 11)
    assert.equal(Object.hasOwn(compact, 'jobs'), false)
    assert.equal(Object.hasOwn(compact, 'unknownRawFailures'), false)
    assert.ok(compact.retainedResponses.every(response => !Object.hasOwn(response, 'rawBodyBase64')))
  }
  assert.ok(bytes(jobs) < bytes(jobs.map(job => ({ ...job, nativeCollectionEvidence: evidence }))) * 0.45)
})

test('evidence compaction preserves every role description, source date, identity and failure qualification', () => {
  const jobs = projected()
  for (const [index, job] of jobs.entries()) {
    const fact = evidence.jobs[index]
    assert.equal(job.jobId, fact.id)
    assert.equal(job.nativeFacts, fact)
    assert.equal(job.sourceDescription, fact.nativeVisibleDescriptionHTML)
    assert.equal(job.nativeSchemaDescription, fact.nativeSchemaDescription)
    assert.equal(job.postingDate, fact.nativePostedDate.raw)
    assert.equal(job.applyUrl, fact.nativeApplicationURL)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.nativeCollectionEvidence.cleanupAllowed, false)
    assert.equal(job.nativeCollectionEvidence.verifiedZeroInventory, false)
  }
})
