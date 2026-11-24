import test from 'node:test'
import assert from 'node:assert/strict'
import {replayOptions,exactRejection} from './fixture20261120.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {runAsipQualified as run} from './currentQualified20261119.js'
import {getValidIndiaCityForJob} from '../../src/utils/publicJobLocationScope.js'
const SOURCE='asiptechnologies'
test('actual native Hyderabad roles use the public city policy without inventing country or refreshing February2025 dates',async()=>{
 const options=replayOptions(),jobs=await run(options);assert.equal(jobs.length,4);assert.equal(options.calls.length,10)
 for(const j of jobs){assert.equal(j.country,null);assert.equal(j.sourceNativeJobPosting.jobLocation.address,'Hyderabad');assert.equal(j.sourcePublicLocationQualified,true);assert.equal(j.sourcePublicLocationScopeEvidence.policy,'publicJobLocationScope.getValidIndiaCityForJob');assert.equal(j.sourcePublicLocationScopeEvidence.rawNativeCountry,null);assert.equal(j.sourceCountryScopeUnresolved,false);assert.equal(getValidIndiaCityForJob(j),'Hyderabad');assert.match(j.postingDate,/^2025-02-/);assert.equal(j.sourceNativeDates.datePosted,j.postingDate);assert.equal(j.sourceDetailComplete,true);assert.equal(j.sourceClosingQualified,true)}
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
})
test('mismatched closing criteria remain held for a public-policy-qualified workplace city',async()=>{
 const jobs=await run(replayOptions({},(text,url,n)=>url.includes('/career/end-of-line')&&n===1?text.replaceAll('Production Management','Changed Production Management'):text));assert.equal(jobs.length,3);assert.ok(!jobs.some(j=>j.jobId==='326'));assert.equal(jobs.nativeCollectionEvidence.held.length,1)
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
