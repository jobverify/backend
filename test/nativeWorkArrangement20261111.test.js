import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import Job from '../src/models/Job.js'
import {normalizeScrapedJob} from '../scraper-support/utils/normalizeScrapedJob.js'
import {extractJobFilterSignals} from '../src/utils/jobFilterSignals.js'
import {normalizePublicWorkArrangement} from '../src/utils/publicWorkArrangement.js'
import {normalizeJobListResponseJob} from '../src/controllers/jobController.js'
import {jobMatchesSavedFilters} from '../src/services/jobFilterMatcher.js'
import {renderBroadcastTemplate} from '../src/services/telegramBroadcastTemplate.js'
import {buildResumeJobSnapshot} from '../src/services/resumeLatexContent.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/eightfold-work-arrangement-source-20261111.json.gz',import.meta.url))))
const [bayer, dsm] = fixture.jobs

test('actual Bayer technical hybrid criteria cannot supply an unknown native work mode', () => {
  assert.match(bayer.sourceDescription, /hybrid integration patterns/i)
  assert.equal(bayer.remoteStatus,null)
  assert.equal(bayer.sourceRemoteStatusUnresolved,true)
  const job = normalizeScrapedJob(structuredClone(bayer))
  assert.equal(job.remoteStatus,null)
  assert.equal(job.workArrangement,null)
  assert.equal(job.filterSignals.confidence.workArrangement,'low')
  assert.equal(createHash('sha256').update(job.sourceDescription).digest('hex'),fixture.provenance[0].originalSourceDescriptionSHA256)
})

test('actual DSM city and role-dependent company attendance condition preserve unknown work mode', () => {
  assert.match(dsm.sourceDescription,/on site at least 60% of the time to connect, depending on the role\./)
  const job = normalizeScrapedJob(structuredClone(dsm))
  assert.equal(job.remoteStatus,null)
  assert.equal(job.workArrangement,null)
  assert.equal(job.filterSignals.confidence.workArrangement,'low')
  assert.equal(job.sourceDescription,dsm.sourceDescription)
})

test('Mongoose preserves the explicit native uncertainty flag and null arrangement', () => {
  const document = new Job({...normalizeScrapedJob(structuredClone(bayer)),workArrangement:null}).toObject()
  assert.equal(document.sourceRemoteStatusUnresolved,true)
  assert.equal(document.remoteStatus,null)
  assert.equal(document.workArrangement,null)
})

test('public serialization and saved filters ignore a stale derived arrangement on an unknown native record', () => {
  for (const stale of ['Hybrid','Remote','On-site']) {
    const job = {...dsm,workArrangement:stale}
    assert.equal(normalizePublicWorkArrangement(stale,job),null)
    assert.equal(normalizeJobListResponseJob(job).workArrangement,null)
    for (const workArrangement of ['Hybrid','Remote','On-site']) {
      assert.equal(jobMatchesSavedFilters({job,filters:{workArrangement},ignoreProfileEligibility:true}),false)
    }
    assert.equal(jobMatchesSavedFilters({job,filters:{company:job.company},ignoreProfileEligibility:true}),true)
  }
})

test('known canonical native arrangements remain usable despite stale derived values', () => {
  // Artificial metadata controls, never publisher or recovery evidence.
  for (const remoteStatus of ['Hybrid','Remote','On-site']) {
    const job = {...dsm,remoteStatus,workArrangement:'Hybrid'}
    assert.equal(extractJobFilterSignals(job).workArrangement,remoteStatus)
    assert.equal(normalizePublicWorkArrangement(job.workArrangement,job),remoteStatus)
    assert.equal(normalizeJobListResponseJob(job).workArrangement,remoteStatus)
    assert.equal(jobMatchesSavedFilters({job,filters:{workArrangement:remoteStatus},ignoreProfileEligibility:true}),true)
  }
})

test('unknown native records do not accept technical phrases as canonical remote-status metadata', () => {
  // Artificial malformed-field controls applied only to an offline fixture.
  for (const remoteStatus of [null,'','hybrid integration patterns','remote procedure calls','not remote']) {
    const job = {...dsm,remoteStatus,workArrangement:'On-site'}
    assert.equal(extractJobFilterSignals(job).workArrangement,null)
    assert.equal(normalizePublicWorkArrangement(job.workArrangement,job),null)
  }
})

test('literal normalized location evidence still supplies an explicit native arrangement', () => {
  for (const [location,expected] of [['Remote - India','Remote'],['On-site - Mumbai, India','On-site'],['Remote and on-site - India','Hybrid']]) {
    const job = normalizeScrapedJob({...dsm,location})
    assert.equal(job.remoteStatus,expected)
    assert.equal(job.workArrangement,expected)
  }
})

test('unflagged legacy processing and public defaults retain their previous meanings', () => {
  for (const sourceRemoteStatusUnresolved of [undefined,false,'true']) {
    const job = {...bayer,sourceRemoteStatusUnresolved}
    assert.equal(extractJobFilterSignals(job).workArrangement,'Hybrid')
    assert.equal(normalizePublicWorkArrangement(undefined,job),'On-site')
    assert.equal(normalizeJobListResponseJob({...job,workArrangement:'Remote'}).workArrangement,'Remote')
  }
})

test('preview-only broadcast formatting drops an unknown mode without dropping the original application', () => {
  const job = {...bayer,workArrangement:'Hybrid'}
  const preview = renderBroadcastTemplate('{title}\nWork mode: {workMode}\n{jobUrl}',job)
  assert.doesNotMatch(preview,/Work mode:/)
  assert.ok(preview.includes(job.applyUrl))
  assert.match(renderBroadcastTemplate('{title}\nWork mode: {workMode}\n{jobUrl}',{...job,remoteStatus:'Remote'}),/Work mode: Remote/)
})

test('resume job snapshots omit unknown derived modes and retain full original criteria', () => {
  const snapshot = buildResumeJobSnapshot({...bayer,workArrangement:'Hybrid'})
  assert.equal(Object.hasOwn(snapshot,'workArrangement'),false)
  assert.equal(Object.hasOwn(snapshot,'sourceRemoteStatusUnresolved'),false)
  assert.equal(snapshot.sourceDescription,bayer.sourceDescription)
  assert.equal(buildResumeJobSnapshot({...bayer,workArrangement:'Hybrid',remoteStatus:'Remote'}).workArrangement,'Remote')
})
