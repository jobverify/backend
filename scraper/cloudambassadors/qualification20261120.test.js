import test from 'node:test'
import assert from 'node:assert/strict'
import {replayOptions,exactRejection} from './fixture20261120.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {runCurrentCloudAmbassadors as run} from './currentReader.js'
const SOURCE='cloudambassadors'
test('bound publisher criteria are complete without borrowing country or inventing posting/application identities',async()=>{
 const options=replayOptions(),jobs=await run(options);assert.equal(jobs.length,5);assert.equal(options.calls.length,30)
 for(const j of jobs){assert.equal(j.country,null);assert.equal(j.location,null);assert.equal(j.sourceCountryScopeUnresolved,true);assert.equal(j.jobId,null);assert.equal(j.applyUrl,null);assert.equal(j.sharedApplicationURL,'https://cloudambassadors.com/careers/apply');assert.equal(j.jobSpecificApplicationIdentityQualified,false);assert.equal(j.sourceDetailComplete,true);assert.equal(j.nativeCriteriaComplete,true);assert.equal(j.nativeHiringOrganization,'Cloud Ambassadors');assert.equal(j.legalEmployer,null);assert.equal(j.nativeCriteriaVisibilityQualified,false);assert.equal(j.nativeAuthoredCriteriaEvidence.localPayloadUnaltered,true);assert.deepEqual(j.nativeSourceRecord.nativeRole,j.nativeClosingRecord.nativeRole);assert.ok(j.jobDescription.includes(j.nativeSourceRecord.nativeRole.bio));for(const text of j.nativeSourceRecord.nativeRole.arr)assert.ok(j.jobDescription.includes(text))}
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(jobs.nativeCollectionEvidence.qualifiedIndiaRecords,0);assert.ok(jobs.nativeCollectionEvidence.heldRecords.every(j=>j.reason==='native-role-workplace-country-unpublished;shared-application-not-role-bound'))
})
test('a new unreviewed native field prevents a complete authored-criteria claim',async()=>{
 const jobs=await run(replayOptions({},text=>text.replace('name:"Cloud Consultant",','name:"Cloud Consultant",additionalEligibility:"Native new qualification",')));assert.equal(jobs.length,5);assert.equal(jobs[0].nativeCriteriaComplete,false);assert.equal(jobs[0].sourceDetailComplete,false);assert.ok(jobs[0].nativeSourceRecord.nativeUnknownFields.includes('additionalEligibility'))
})

for(const reason of [Object.freeze({caller:'frozen final ownership'}),null]){
 test('exact caller reason survives final inventory attachment: '+String(reason),async()=>{
  const caller=new AbortController(),define=Object.defineProperty;let hooked=false
  Object.defineProperty=function(target,key,descriptor){const result=define(target,key,descriptor);if(Array.isArray(target)&&typeof key==='symbol'&&String(key).includes('inventory')){hooked=true;caller.abort(reason)}return result}
  try{await exactRejection(run(replayOptions({signal:caller.signal})),reason);assert.equal(hooked,true)}finally{Object.defineProperty=define}
 })
 for(const denied of [false,true])test('exact caller reason survives '+(denied?'HTTP403':'success')+' final cleanup: '+String(reason),async()=>{
  const caller=new AbortController(),options=replayOptions({signal:caller.signal}),abort=AbortController.prototype.abort,remove=caller.signal.removeEventListener;let closed=false
  if(SOURCE==='cloudambassadors')caller.signal.removeEventListener=function(...args){const result=remove.apply(this,args);if(args[0]==='abort'){closed=true;caller.abort(reason)}return result}
  else AbortController.prototype.abort=function(value){if((SOURCE==='asiptechnologies'&&value===undefined)||(SOURCE==='base64ai'&&value?.code==='BASE64AI_FINISHED')){closed=true;caller.abort(reason)}return abort.call(this,value)}
  if(denied)options.fetchImpl=async url=>{const response=new Response('Native denial',{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:String(url)});return response}
  try{await exactRejection(run(options),reason);assert.equal(closed,true)}finally{AbortController.prototype.abort=abort;caller.signal.removeEventListener=remove}
 })
}
