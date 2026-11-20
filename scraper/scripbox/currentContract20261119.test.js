import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as source from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261119.json.gz',import.meta.url))))
const html=()=>Buffer.from(fixture()[0].bodyBase64,'base64').toString()
const replay=mutate=>async(url,init)=>{assert.equal(init.method,'GET');const original=fixture().find(row=>row.url===url);assert.ok(original,'Bound native URL '+url);const row=mutate?.({...original,body:Buffer.from(original.bodyBase64,'base64').toString()})||original;const response=new Response(row.body??Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.url});return response}

test('Scripbox current ten-item rendered page retains all fourteen native India observations without invented criteria',async()=>{
 let detailReads=0
 const jobs=await source.run({fetchText:async()=>html(),fetchImpl:replay(),fetchJobDetail:async()=>{detailReads++;throw Object.assign(Error('Native HTTP 403'),{status:403})}})
 assert.equal(jobs.length,14);assert.ok(detailReads>0&&detailReads<=4)
 for(const job of jobs.nativeCollectionEvidence.nativeDetailObservations){assert.equal(job.country,'India');assert.equal(job.sourceDetailComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.requisitionId,null);assert.ok(job.sourceNativeJobRecord);assert.equal(job.postingDate,null);assert.ok(!job.sourceDescription)}
 assert.equal(jobs.nativeCollectionEvidence.nativeInventoryCount,14)
 assert.equal(jobs.nativeCollectionEvidence.initialRenderedRoleCount,10)
 assert.equal(jobs.nativeCollectionEvidence.closingReconciled,true)
 assert.equal(jobs.nativeCollectionEvidence.companyScopeComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 const assessment=assessSoftFailureAcquisition(getScraperCatalog().find(row=>row.source==='scripbox'),jobs)
 assert.equal(assessment.runnerOutcome.success,true)
 assert.equal(assessment.runnerOutcome.partial,true)
 assert.equal(assessment.runnerOutcome.detailHealth.complete,false)
 assert.equal(jobs.nativeCollectionEvidence.fullCriteriaRecovered,false)
 assert.equal(assessment.cleanupOptions.replaceExisting,false)
})

test('Scripbox current renderer rejects schema, identity, total, invisible list and unknown program changes',()=>{
 const rows=fixture(),original=html(),client=Buffer.from(rows[1].bodyBase64,'base64').toString()
 const controls=[
  original.replace('"post_on_careers_page":1','"post_on_careers_page":"1"'),
  original.replace('"group_company":"SWMPL"','"group_company":"SWMPL","unreviewedRequirement":"foreign-country-only"'),
  original.replace('14 of 14 roles','13 of 14 roles'),
  original.replace('class="joblist"','class="joblist" hidden'),
  original.replace('jobDetails/a6af6f3cf36e59','jobDetails/a0000000000000'),
  original.replace('<h3 class="jt">Associate Manager - Investment Operations</h3>','<h3 class="jt">A different role</h3>'),
  original.replace('id="__NEXT_DATA__"','id="__NEXT_DATA__" hidden'),
 ]
 for(const [index,body] of controls.entries()){
  assert.notEqual(body,original,'Mutation changed the native field: '+index)
  assert.throws(()=>source.readCurrentScripboxPage(body,client),/native careers|Active native content|Native literal/i,'Current contract control '+index)
 }
 assert.throws(()=>source.readCurrentScripboxPage(original,client+'\nunknownClientMutation()'),/renderer requires review/)
})

test('Scripbox requires the same complete native records after details and preserves opaque cancellation',async()=>{
 let pageReads=0
 await assert.rejects(source.run({fetchText:async()=>html(),detailEnrichmentBudgetMs:0,fetchImpl:replay(row=>{
  if(row.url===source.CAREERS_URL&&++pageReads===2)return {...row,body:row.body.replace('"experience_from":"3"','"experience_from":"4"')}
 })}),/Closing complete native careers records changed/)
 const caller=new AbortController(),reason=Object.freeze({opaque:'scripbox'});caller.abort(reason)
 await assert.rejects(source.run({signal:caller.signal,fetchText:()=>{throw Error('Unexpected request')}}),error=>error===reason)
})
