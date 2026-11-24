import test from 'node:test'
import assert from 'node:assert/strict'
import {replayOptions,exactRejection} from './fixture20261120.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {createXponentNativeScraper} from './native20261108.js'
const run=options=>createXponentNativeScraper().run(options),SOURCE='xponentai'
test('ten actual current native posts expose their own bound forms and full controls without using candidate location as work-country evidence',async()=>{
 const options=replayOptions(),jobs=await run(options);assert.equal(jobs.length,10);assert.equal(options.calls.length,46)
 for(const j of jobs){assert.equal(j.applyUrl,j.sourceUrl);assert.equal(j.sourceNativeApplication.nativeRoleBindingQualified,true);assert.equal(j.sourceNativeApplication.jobId,j.jobId);assert.equal(j.sourceNativeApplication.submitted,false);assert.ok(j.sourceNativeApplication.originalHTML.includes('awsm_select_1'));assert.ok(j.sourceNativeApplication.nativeControls.some(n=>n.attrs.name==='awsm_file'));assert.equal(j.activeApplyVerified,false);assert.equal(j.country,null);assert.equal(j.location,null);assert.equal(j.sourceCountryScopeUnresolved,true);assert.match(j.postingDate,/^2024-05-10T/);assert.equal(j.sourceNativeApplicationClosingQualified,true);assert.equal(j.sourceNativeRecord.date_gmt,j.sourceNativePublication.originalWPDateGMT)}
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
})
test('a foreign role form ID cannot masquerade as the canonical native application',async()=>{
 await assert.rejects(run(replayOptions({},(text,url)=>url.includes('/jobs/visualization-engineer/')?text.replace('name="awsm_job_id" value="7930"','name="awsm_job_id" value="9999"'):text)),/application.*identity|form.*identity/i)
})
test('all native application criteria participate in closing while per-read nonce changes do not rewrite originals',async()=>{
 const jobs=await run(replayOptions({},(text,url,n)=>url.includes('/jobs/visualization-engineer/')&&n===1?text.replace('name="awsm_text_1"','data-native-eligibility="changed" name="awsm_text_1"'):text));assert.equal(jobs.length,9);assert.ok(!jobs.some(j=>j.jobId==='7930'));assert.equal(jobs.nativeCollectionEvidence.observations.length,10)
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

test('only the per-read native nonce is normalized for closing; both complete original values remain retained',async()=>{
 let changed=false
 const jobs=await run(replayOptions({},(text,url,n)=>{
  if(url.includes('/jobs/visualization-engineer/')&&n===1){const next=text.replace(/(<input\b[^>]*name="awsm_nonce"[^>]*value=")[^"]+("[^>]*>)/,'$1replacement-native-nonce$2');changed=next!==text;return next}return text
 }));assert.equal(changed,true);assert.equal(jobs.length,10)
 const job=jobs.find(j=>j.jobId==='7930'),opening=job.sourceNativeApplication.nativeControls.find(n=>n.attrs.name==='awsm_nonce'),closing=job.sourceNativeClosingApplication.nativeControls.find(n=>n.attrs.name==='awsm_nonce');assert.notEqual(opening.attrs.value,closing.attrs.value);assert.match(job.sourceNativeClosingApplication.originalHTML,/replacement-native-nonce/);assert.equal(job.sourceNativeApplicationClosingQualified,true)
})
