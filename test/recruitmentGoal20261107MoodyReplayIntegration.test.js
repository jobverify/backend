import assert from 'node:assert/strict'
import test from 'node:test'
import {getScraperCatalog} from '../scraper-support/providers/index.js'
import {assertSpecializedBatchExtraction,assertSpecializedBatchDenial} from './helpers/replaySpecializedRecruitmentBatch.js'

for(const source of ['moodys','moodyscorporation']){
 test(source+' current native replay retains its own registration and all44 native role models',async t=>{
  const provider=getScraperCatalog().find(p=>p.source===source);assert.ok(provider)
  const {jobs,calls}=await assertSpecializedBatchExtraction(t,provider)
  assert.equal(jobs.length,44);assert.equal(calls.length,104)
  for(const j of jobs){assert.equal(j.source,source);assert.equal(j.nativeHiringOrganization.name,"Moody's");assert.equal(j.sourceScopeComplete,false);assert.equal(j.lifecycleCleanupAllowed,false);assert.equal(j.sourceDescription,j.nativeClosingSourceRecord.description)}
 })
 test(source+' current native primary denial stops before additional reads',async t=>{
  const provider=getScraperCatalog().find(p=>p.source===source);assert.ok(provider)
  await assertSpecializedBatchDenial(t,provider)
 })
}
