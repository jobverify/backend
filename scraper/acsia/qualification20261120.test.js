import test from 'node:test'
import assert from 'node:assert/strict'
import {fixture,recordedBody,replayOptions,exactRejection} from './fixture20261120.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {runCurrentAcsia as run,readCurrentAcsiaModel} from './currentNative20261117.js'
import {getValidIndiaCityForJob} from '../../src/utils/publicJobLocationScope.js'
const SOURCE='acsia',body=recordedBody(fixture.responses[0]).toString(),first=readCurrentAcsiaModel(body).rows[0],marker='class='+JSON.stringify(first.nativeContent.attrs.class)+'>'
const insert=text=>body.replace(marker,marker+text)
test('sixteen full own role models yield fifteen role-city-qualified records without fabricated countries, dates, IDs or job-specific intake',async()=>{
 const options=replayOptions(),jobs=await run(options);assert.equal(options.calls.length,2);assert.equal(jobs.length,15);assert.equal(jobs.nativeCollectionEvidence.observations.length,16)
 for(const j of jobs){assert.equal(j.country,null);assert.equal(j.postingDate,null);assert.equal(j.closingDate,null);assert.equal(j.jobId,null);assert.equal(j.requisitionId,null);assert.equal(j.fullOwnRoleCriteriaQualified,true);assert.equal(j.sourceDetailComplete,true);assert.equal(j.sourceCountryScopeUnresolved,false);assert.ok(getValidIndiaCityForJob(j));assert.equal(j.sourcePublicLocationScopeEvidence.rawNativeCountry,null);assert.equal(j.sourcePublicLocationScopeEvidence.policy,'publicJobLocationScope.getValidIndiaCityForJob');assert.equal(j.roleSpecificApplicationBindingQualified,false);assert.equal(j.activeApplyVerified,false);assert.equal(j.applyUrl,'https://www.acsiatech.com/careers/#apply-form')}
 const held=jobs.nativeCollectionEvidence.observations.find(j=>j.location==='Trivandrum or Remote');assert.equal(held.sourceCountryScopeUnresolved,true);assert.equal(held.sourcePublicLocationQualified,false);assert.ok(held.holdReasons.includes('native-workplace-mixed-remote-foreign-or-unqualified'));assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
})
test('corporate office labels, mixed foreign workplaces and explicit role country/employer conflicts never borrow a city qualification',async()=>{
 for(const [label,html]of[['office',body.replace('Location: Bangalore','Candidate address: Bangalore')],['mixed',body.replace('Location: Bangalore','Location: Bangalore or Toronto')],['country',insert('<p>Country: Canada</p>')],['employer',insert('<p>Employer: Different Employer</p>')]]){
  assert.notEqual(html,body,label);const jobs=await run(replayOptions({},()=>html));assert.equal(jobs.length,14,label);const row=jobs.nativeCollectionEvidence.observations[0];assert.ok(row.holdReasons.length>0,label);assert.equal(row.jobId,null)
 }
})
test('hidden or newly dated native criteria are retained as held models rather than claimed complete/current',async()=>{
 for(const html of [insert('<p hidden>Mandatory native eligibility: previously concealed requirement.</p>'),insert('<p>Closing Date: 2020-01-01</p>')]){
  const jobs=await run(replayOptions({},()=>html));assert.equal(jobs.length,14);assert.ok(jobs.nativeCollectionEvidence.observations[0].holdReasons.length>0);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 }
})
test('changed full closing criteria preserves both captures and never reports closing reconciliation',async()=>{
 await assert.rejects(run(replayOptions({},(text,url,n)=>n===1?text.replace('Bachelor','Changed Bachelor'):text)),e=>Boolean(e.recruitmentObservations?.nativeOpening&&e.recruitmentObservations?.nativeClosing))
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
