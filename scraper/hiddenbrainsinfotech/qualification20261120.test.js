import test from 'node:test'
import assert from 'node:assert/strict'
import {replayOptions,exactRejection} from './fixture20261120.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {createHiddenBrainsNativeScraper} from './native20261108.js'
const run=options=>createHiddenBrainsNativeScraper().run(options),SOURCE='hiddenbrainsinfotech'
test('fifteen exact Flight/display matches qualify full authored criteria independently of external rendering, keeping country and employer-native IDs unknown',async()=>{
 const options=replayOptions(),jobs=await run(options);assert.equal(options.calls.length,2);assert.equal(jobs.length,15)
 for(const j of jobs){assert.equal(j.sourceNativeCriteriaComplete,true);assert.equal(j.sourceDetailComplete,true);assert.equal(j.sourceNativeAuthoredCriteriaPairQualified,true);assert.equal(j.sourceNativeCriteriaVisibilityQualified,false);assert.equal(j.country,null);assert.equal(j.location,null);assert.equal(j.sourceCountryScopeUnresolved,true);assert.equal(j.sourceCurrentNativeRoleQualified,false);assert.equal(j.postingDate,null);assert.equal(j.jobId,null);assert.equal(j.requisitionId,null);assert.equal(j.activeApplyVerified,false);assert.deepEqual(j.sourceNativeRecord,j.sourceNativeClosingRecord);assert.equal(j.sourceDescription,j.sourceNativeRecord.fullCriteriaText)}
 const abu=jobs.find(j=>j.title.includes('Abu Dhabi'));assert.ok(abu);assert.equal(abu.country,null);assert.equal(abu.sourceCountryScopeUnresolved,true);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
})
test('full countryless authored records survive an India observation request without pretending any native India jobs exist',async()=>{
 const jobs=await run(replayOptions({countryFilter:'India'}));assert.equal(jobs.length,15);assert.ok(jobs.every(j=>j.sourceCountryScopeUnresolved&&j.country===null));assert.ok(jobs.every(j=>!j.sourceCurrentNativeRoleQualified))
})

for(const reason of [Object.freeze({caller:'frozen final ownership'}),null]){
 test('exact caller wins after final inventory attachment: '+String(reason),async()=>{
  const caller=new AbortController(),define=Object.defineProperty;let hooked=false
  Object.defineProperty=function(target,key,descriptor){const result=define(target,key,descriptor);if(Array.isArray(target)&&typeof key==='symbol'&&String(key).includes('inventory')){hooked=true;caller.abort(reason)}return result}
  try{await exactRejection(run(replayOptions({signal:caller.signal})),reason);assert.equal(hooked,true)}finally{Object.defineProperty=define}
 })
 for(const denied of [false,true])test('exact caller wins after '+(denied?'HTTP403':'success')+' cleanup: '+String(reason),async()=>{
  const caller=new AbortController(),options=replayOptions({signal:caller.signal}),abort=AbortController.prototype.abort;let closed=false
  AbortController.prototype.abort=function(value){if((SOURCE==='acsia'&&value===undefined)||value?.code===(SOURCE==='xponentai'?'XPONENT_FINISHED':'HIDDEN_BRAINS_FINISHED')){closed=true;caller.abort(reason)}return abort.call(this,value)}
  if(denied)options.fetchImpl=async url=>{const response=new Response('Native denial',{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:String(url)});return response}
  try{await exactRejection(run(options),reason);assert.equal(closed,true)}finally{AbortController.prototype.abort=abort}
 })
}
