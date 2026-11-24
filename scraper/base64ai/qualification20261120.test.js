import test from 'node:test'
import assert from 'node:assert/strict'
import {replayOptions,exactRejection} from './fixture20261120.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {createBase64AINativeScraper} from './native20261108.js'
const run=options=>createBase64AINativeScraper().run(options),SOURCE='base64ai'
test('actual Turkey and United States roles remain foreign with full native criteria and originals',async()=>{
 const jobs=await run(replayOptions());assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observations.length,4);const all=await run(replayOptions({countryFilter:'Global'}));assert.equal(all.length,4);assert.deepEqual(all.map(j=>j.country),['Turkey','United States','Turkey','Turkey']);assert.ok(all.every(j=>j.sourceCurrentNativeRoleQualified&&j.sourceDetailComplete&&j.applyUrl.startsWith('mailto:careers@base64.ai?subject=')));assert.ok(all.every(j=>j.sourceNativePostingId===null&&j.jobIdIsSynthetic===true&&j.postingDate===null));assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(jobs.nativeCollectionEvidence.authoritativeIndiaZero,false)
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
