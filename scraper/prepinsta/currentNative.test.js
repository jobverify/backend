import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url))))
function replay(change=(_url,body)=>body){const calls=[],counts=new Map();return {calls,read:async(url,init)=>{calls.push({url,method:init.method});const row=fixture.responses.find(row=>row.requestedUrl===url);assert.ok(row,'Undeclared source request '+url);const count=(counts.get(url)??0)+1;counts.set(url,count);const response=new Response(change(url,Buffer.from(row.bodyBase64,'base64').toString('utf8'),count),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalUrl});return response}}}
test('current PrepInsta exact native tenant empty observations exclude other employers and retain unknown company inventory',async t=>{
 const transport=replay();t.mock.method(globalThis,'fetch',transport.read)
 const jobs=await run({fetchImpl:transport.read})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const observation=readSourceObservationEvidence(jobs,'prepinsta');assert.equal(observation.observedVacancyCount,0);assert.equal(observation.companyGlobalTotal,null)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpening.tenant.id,'4128337');assert.equal(jobs.nativeCollectionEvidence.nativeOpening.tenant.liveJobListingsCount,0)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpening.tenant['relatedJobListings({"limit":20})'].length,6)
 assert.equal(jobs.nativeCollectionEvidence.wholeObservedNativeTenantClosingReconciled,true);assert.equal(transport.calls.length,6)
})
test('PrepInsta refuses another employer tenant and newly nonempty native input',async()=>{
 for(const [from,to]of [['"name":"PrepInsta"','"name":"Other Employer"'],['"liveJobListingsCount":0','"liveJobListingsCount":1']]){
  const transport=replay((url,body)=>url.startsWith('https://wellfound.com/')?body.replace(from,to):body)
  await assert.rejects(run({fetchImpl:transport.read}),/tenant|connection/i)
 }
})
test('PrepInsta closing whole native tenant changes cannot certify unchanged empty observations',async()=>{
 const transport=replay((url,body,count)=>{
  if(!url.startsWith('https://wellfound.com/')||count!==2)return body
  const changed=body.replace('"jobPreamble":"We hire for diverse roles','"jobPreamble":"We now hire for diverse roles');assert.notEqual(changed,body);return changed
 })
 await assert.rejects(run({fetchImpl:transport.read}),/Closing whole own native tenant model changed/)
})
test('PrepInsta foreign corporate canonical fails before employer board acquisition',async()=>{
 const transport=replay((url,body)=>url.includes('career-opportunities')?body.replace('rel="canonical" href="https://prepinsta.com/career-opportunities/"','rel="canonical" href="https://foreign.example/careers"'):body)
 await assert.rejects(run({fetchImpl:transport.read}),/corporate identity/);assert.equal(transport.calls.length,1)
})
for(const mode of ['pre-abort','fulfilled','rejected'])test('PrepInsta frozen opaque '+mode+' preserves exact caller reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:true,mode});let calls=0
 if(mode==='pre-abort')controller.abort(reason)
 await assert.rejects(run({signal:controller.signal,fetchImpl:async()=>{calls++;controller.abort(reason);if(mode==='rejected')throw Object.freeze(Error('replacement'));const row=fixture.responses[0];const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalUrl});return response}}),error=>error===reason)
 assert.equal(calls,mode==='pre-abort'?0:1)
})

for(const mode of ['source-deadline','caller'])test('PrepInsta pacing preserves '+mode+' without another native request',async()=>{
 const transport=replay(),controller=new AbortController(),reason=Object.freeze({owner:'prepinsta',stage:'pacing'});let timer
 if(mode==='caller')timer=setTimeout(()=>controller.abort(reason),300)
 try{
  await assert.rejects(run({fetchImpl:transport.read,signal:controller.signal,sourceTimeoutMs:mode==='source-deadline'?300:2000}),error=>mode==='caller'?error===reason:error.name==='TimeoutError'&&/source deadline/.test(error.message))
  assert.equal(transport.calls.length,1)
 }finally{clearTimeout(timer)}
})
