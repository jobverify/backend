import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import mongoose from 'mongoose'
import ScraperRun from '../../src/models/ScraperRun.js'
import ScraperStatus from '../../src/models/ScraperStatus.js'
import { createCatalogScraper,decorateJobsWithProviderMetadata } from '../providers/index.js'
import { buildScraperAttemptDiagnostics } from '../runner.js'
import { readInventoryEvidence, isVerifiedEmptyEvidence } from '../utils/inventoryEvidence.js'
import { extractionRawJobMetrics } from '../utils/extractionRawJobMetrics.js'
import { upsertScraperStatus,writeScraperRun } from '../utils/scraperPersistence.js'
import { SOURCE_OBSERVATION_EVIDENCE,attachSourceObservationEvidence,readSourceObservationEvidence } from '../utils/sourceObservationEvidence.js'

const source='observationfixture20261031'
const provider={source,companyName:'Controlled source',adapter:'script',
  modulePath:fileURLToPath(new URL('./fixtures/sourceObservation20261031.js',import.meta.url)),
  companyCareerPage:'https://example.invalid/careers',companyDomain:'example.invalid'}
const observation=changes=>({source,recordKind:'departments',observedRecordCount:4,observedVacancyCount:0,
  sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,...changes})

test('a registered empty partial source retains department observations separately from vacancy counts',async()=>{
  const audit=observation()
  const jobs=await createCatalogScraper(provider).run({observation:audit})
  assert.equal(jobs.length,0)
  assert.deepEqual(jobs.nativeCollectionEvidence,audit)
  const evidence=readInventoryEvidence(jobs)
  assert.equal(evidence.status,'coverage-gap')
  assert.equal(isVerifiedEmptyEvidence(evidence),false)
  assert.equal(evidence.reportedTotal,null)
  assert.equal(evidence.indiaFacetCount,null)
  assert.deepEqual(extractionRawJobMetrics(provider,jobs,evidence),{rawJobs:0,rawJobsBasis:'observed-native-non-vacancy-records'})
  const diagnostics=buildScraperAttemptDiagnostics(jobs,undefined,provider)
  assert.equal(diagnostics.rawRecords,0)
  assert.deepEqual(diagnostics.sourceObservations,audit)
})

test('mixed native records report the actual vacancy observations without counting categories as jobs',async()=>{
  const audit=observation({recordKind:'mixed',observedVacancyCount:1})
  const jobs=await createCatalogScraper(provider).run({observation:audit,rows:[{
    source,title:'Controlled native role',country:'India',location:'Pune, India',
    sourceUrl:'https://example.invalid/jobs/1',applyUrl:'https://example.invalid/jobs/1',
    jobDescription:'Controlled role criteria supplied only for this no-network integration test.',sourceListingComplete:false,
  }]})
  assert.deepEqual(extractionRawJobMetrics(provider,jobs,readInventoryEvidence(jobs)),{rawJobs:1,rawJobsBasis:'observed-native-vacancy-rows'})
  assert.deepEqual(buildScraperAttemptDiagnostics(jobs,undefined,provider).sourceObservations,audit)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('the real status/history mapping and strict Mongoose schema retain native non-vacancy observations',async t=>{
  const audit=observation()
  const original=Object.getOwnPropertyDescriptor(mongoose.connection,'readyState')
  Object.defineProperty(mongoose.connection,'readyState',{configurable:true,value:1})
  t.after(()=>original?Object.defineProperty(mongoose.connection,'readyState',original):delete mongoose.connection.readyState)
  let status,history
  t.mock.method(ScraperStatus,'findOneAndUpdate',async(_filter,update)=>{status=update.$set.latestAttempt;return{}})
  t.mock.method(ScraperRun,'create',async input=>{history=new ScraperRun(input).toObject({flattenMaps:true});return{}})
  const result={success:false,softFailure:true,partial:true,jobs:0,eligibleJobs:0,
    completedAt:'2026-10-31T10:00:00.000Z',sourceObservations:audit}
  await upsertScraperStatus(source,result)
  await writeScraperRun(new Date('2026-10-31T10:00:00.000Z'),{[source]:result})
  assert.deepEqual(status.sourceObservations,audit)
  assert.deepEqual(history.sources[source].sourceObservations,audit)
})

for(const [label,changes] of [
  ['foreign source',{source:'anothercompany'}],
  ['unrecognized record kind',{recordKind:'company-inventory'}],
  ['negative record count',{observedRecordCount:-1}],
  ['string record count',{observedRecordCount:'4'}],
  ['fractional vacancy count',{observedVacancyCount:0.5}],
  ['vacancy count exceeding all records',{recordKind:'mixed',observedVacancyCount:5}],
  ['department count presented as vacancies',{observedVacancyCount:4}],
  ['vacancy-row count presented as a mixed category total',{recordKind:'vacancy-rows',observedVacancyCount:1}],
  ['unbounded count',{observedRecordCount:1000001}],
  ['promoted source scope',{sourceScopeComplete:true}],
  ['invented company zero',{companyGlobalTotal:0}],
  ['invented India zero',{companyIndiaTotal:0}],
]) test('registration rejects '+label+' without manufacturing observation diagnostics',async()=>{
  const jobs=await createCatalogScraper(provider).run({observation:observation(changes)})
  assert.equal(jobs.nativeCollectionEvidence,undefined)
  assert.equal(readSourceObservationEvidence(jobs,source),null)
  assert.equal(buildScraperAttemptDiagnostics(jobs,undefined,provider).sourceObservations,undefined)
  assert.deepEqual(extractionRawJobMetrics(provider,jobs,readInventoryEvidence(jobs)),{rawJobs:0,rawJobsBasis:'extracted-jobs-fallback'})
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('metadata getters and inherited fields cannot create observation counts',()=>{
  let getterCalls=0
  const value=observation()
  Object.defineProperty(value,'observedRecordCount',{get(){getterCalls++;throw Error('Getter must not run')}})
  const jobs=[]
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value})
  assert.equal(decorateJobsWithProviderMetadata(jobs,provider).nativeCollectionEvidence,undefined)
  assert.equal(getterCalls,0)
  const inherited=[]
  Object.defineProperty(inherited,'nativeCollectionEvidence',{value:Object.create(observation())})
  assert.equal(readSourceObservationEvidence(inherited,source),null)
  const outer=[]
  Object.defineProperty(outer,'nativeCollectionEvidence',{get(){getterCalls++;throw Error('Outer getter must not run')}})
  assert.equal(decorateJobsWithProviderMetadata(outer,provider).nativeCollectionEvidence,undefined)
  assert.equal(getterCalls,0)
})

test('frozen empty arrays preserve a bounded immutable snapshot through actual decoration',()=>{
  const jobs=Object.freeze([]), audit=observation()
  assert.equal(attachSourceObservationEvidence(jobs,audit),jobs)
  audit.observedRecordCount=999
  const stored=readSourceObservationEvidence(jobs,source)
  assert.equal(stored.observedRecordCount,4)
  assert.equal(Object.isFrozen(stored),true)
  assert.equal(readSourceObservationEvidence(jobs,'anothercompany'),null)
  const decorated=decorateJobsWithProviderMetadata(jobs,provider)
  assert.deepEqual(decorated.nativeCollectionEvidence,observation())
  assert.equal(readInventoryEvidence(decorated),null)
  assert.equal(Object.hasOwn(stored,'verifiedAt'),false)
})

test('a source may retain an immutable earlier marker without blocking a later explicit observation snapshot',()=>{
  const jobs=[],original=Object.freeze(observation())
  Object.defineProperty(jobs,SOURCE_OBSERVATION_EVIDENCE,{value:original})
  assert.equal(attachSourceObservationEvidence(jobs,observation({observedRecordCount:5})),jobs)
  assert.equal(jobs[SOURCE_OBSERVATION_EVIDENCE],original)
  assert.equal(readSourceObservationEvidence(jobs,source).observedRecordCount,5)
  assert.equal(decorateJobsWithProviderMetadata(jobs,provider).nativeCollectionEvidence.observedRecordCount,5)
})

test('unqualified metadata extras are neither read nor retained in status diagnostics',async()=>{
  let getterCalls=0
  const audit=observation()
  Object.defineProperty(audit,'pageBody',{get(){getterCalls++;throw Error('Unbounded body must not be inspected')}})
  const jobs=await createCatalogScraper(provider).run({observation:audit})
  assert.deepEqual(buildScraperAttemptDiagnostics(jobs,undefined,provider).sourceObservations,observation())
  assert.equal(getterCalls,0)
  assert.equal(Object.hasOwn(jobs.nativeCollectionEvidence,'pageBody'),false)
})

test('counts cannot understate returned vacancy rows or silently follow later array growth',()=>{
  const jobs=[]
  attachSourceObservationEvidence(jobs,observation())
  jobs.push({source,title:'Controlled additional role'})
  assert.equal(readSourceObservationEvidence(jobs,source),null)
  assert.equal(buildScraperAttemptDiagnostics(jobs,undefined,provider).sourceObservations,undefined)
  assert.equal(buildScraperAttemptDiagnostics(jobs,undefined,provider).rawRecords,1)
})

test('existing first-job vacancy collection counts retain their original behavior',()=>{
  const jobs=[{source,nativeCollectionEvidence:{source,observedListingCount:8}}]
  assert.deepEqual(extractionRawJobMetrics(provider,jobs,null),{rawJobs:8,rawJobsBasis:'observed-native-listing-rows'})
  assert.equal(readSourceObservationEvidence(jobs,source),null)
})
