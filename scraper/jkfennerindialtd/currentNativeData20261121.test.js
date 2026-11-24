import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {sourceLifecycleCleanupForbidden,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-data-20261121.json.gz',import.meta.url))))
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const home='https://jkfenner.com/',careers=home+'about-us/careers'
const list=fixture.packets.find(p=>p.method==='POST'),details=fixture.packets.filter(p=>p.phase==='native-details'),carriers=fixture.packets.filter(p=>p.phase==='native-criteria-carriers')
const json=packet=>JSON.parse(Buffer.from(packet.bodyBase64,'base64').toString('utf8'))
const model=index=>json(details[index]).data
const replay=(transform=()=>{})=>{
 const calls=[],occurrences=new Map()
 const fetchImpl=async(url,init={})=>{
  const method=init.method??'GET',packet=fixture.packets.find(p=>p.url===url&&p.method===method)
  assert.ok(packet,'Only exact retained current public declarations may be read')
  const bytes=Buffer.from(packet.bodyBase64,'base64');assert.equal(sha(bytes),packet.sha256)
  if(method==='POST')assert.deepEqual(JSON.parse(init.body),JSON.parse(packet.requestBody))
  const occurrence=(occurrences.get(url)??0)+1;occurrences.set(url,occurrence);calls.push({url,method,init})
  const value={status:packet.status,url:packet.finalURL,redirected:false,headers:new Headers(packet.headers),bytes}
  const changed=await transform({url,init,occurrence,value,calls,packet})??value
  return{...changed,arrayBuffer:async()=>Uint8Array.from(changed.bytes).buffer,text:async()=>changed.bytes.toString('utf8')}
 }
 // This explicit legacy transport makes the RED fail on the real obsolete
 // corporate predicate, while the new default path must use fetchImpl metadata.
 const fetchText=async url=>(await fetchImpl(url)).text()
 return{calls,fetchImpl,fetchText,now:()=>fixture.observedAt}
}
const changeJSON=(value,mutate)=>{const v=JSON.parse(value.bytes.toString('utf8'));mutate(v);return{...value,bytes:Buffer.from(JSON.stringify(v))}}

test('current exact public board recovers both complete original criteria models with country/application holds',async()=>{
 const source=replay(),jobs=await run(source)
 assert.equal(jobs.length,2);assert.equal(source.calls.length,30)
 assert.deepEqual(jobs.map(j=>j.jobId),details.map(p=>json(p).data.requisitionId))
 for(let index=0;index<jobs.length;index++){
  const job=jobs[index],raw=model(index)
  assert.deepEqual(job.nativeRawModel,raw)
  assert.deepEqual(job.nativePositionDetails,raw.positionDetails)
  assert.equal(job.country,null);assert.equal(job.countryCode,null);assert.equal(job.sourceCountryScopeUnresolved,true)
  assert.equal(job.applyUrl,null);assert.equal(job.link,null);assert.equal(job.sourceDetailComplete,false);assert.equal(job.criteriaComplete,true)
  assert.equal(job.sourceNativeDataOnly,true);assert.equal(job.sourceListingComplete,false);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  assert.equal(job.postingDate,null);assert.equal(job.closingDate,null)
  assert.deepEqual(job.nativePublicationSchedule,raw.postChannelConfiguration)
  for(const section of Object.values(raw.positionDetails))assert.ok(job.jobDescription.includes(section.htmlText))
  assert.ok(job.nativeOriginalCriteriaCarrierText.length>500)
 }
 assert.match(jobs[0].nativeOriginalCriteriaCarrierText,/35-40 years/)
 assert.match(jobs[1].nativeOriginalCriteriaCarrierText,/> 4 years experience/)
 assert.deepEqual(jobs[1].nativeRawModel.experience,{work:{minRange:0,maxRange:7},relevant:{minRange:0,maxRange:4}})
 assert.match(jobs[1].sourceNativeCriteriaConflict,/4\+/)
 assert.equal(jobs.nativeCollectionEvidence.openingNativeRows,2);assert.equal(jobs.nativeCollectionEvidence.closingReconciled,true)
 assert.equal(jobs.nativeCollectionEvidence.configuredRawBoardComplete,true);assert.equal(jobs.nativeCollectionEvidence.completeInventory,false)
 assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 const metrics=analyzePublishableJobs(jobs);assert.equal(metrics.indiaJobs.length,0);assert.equal(metrics.eligibleJobs.length,0)
 assert.ok(!jobs.some(j=>['9870','9820','9713'].includes(j.jobId)))
})

test('caller cap zero follows complete native closing reconciliation and keeps an explicit cleanup hold',async()=>{
 const source=replay(),jobs=await run({...source,maxJobs:0})
 assert.equal(jobs.length,0);assert.equal(source.calls.length,30)
 assert.equal(jobs.nativeCollectionEvidence.nativePayload.length,2)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})

for(const [label,select,mutate]of[
 ['corporate country authority',p=>p.url===home,html=>html+'<p>Every advertised role is based in Canada and requires Canadian residency.</p>'],
 ['corporate closure authority',p=>p.url===careers,html=>html+'<p>Applications for all advertised roles are closed.</p>'],
 ['corporate selected programme',p=>p.phase==='declared-assets',html=>html+';unreviewedHiringAuthority()'],
 ['native environment',p=>p.phase==='native-frame',html=>html.replace(/NEXT_PUBLIC_APIENV\s*=\s*'Production'/,"NEXT_PUBLIC_APIENV = 'Other'")],
 ['native API origin',p=>p.phase==='native-frame',html=>html.replace('https://mservices.zinghr.com/','https://other.invalid/')],
 ['native selected renderer/controller',p=>p.phase==='native-assets'&&p.url.includes('/9513-'),html=>html+';unreviewedCountryCriteria()']
])test('whole current '+label+' change cannot pass through the unchanged iframe/title/key',async()=>{
 const source=replay(({packet,value})=>{if(!select(packet))return;const original=value.bytes.toString('utf8'),changed=mutate(original);assert.notEqual(changed,original);return{...value,bytes:Buffer.from(changed)}})
 await assert.rejects(run({...source,currentNativeProfile:{allowChangedHTML:true}}),/authority|programme|surface/)
 assert.ok(!source.calls.some(c=>c.url===list.url))
})

for(const[label,mutate]of[
 ['country field',v=>{v.data.country='Canada'}],
 ['full criteria tail',v=>{v.data.positionDetails.krAsAndKPIs.htmlText+='<p>Requires a changed mandatory qualification.</p>'}],
 ['employer',v=>{v.data.positionDetails.description.htmlText=v.data.positionDetails.description.htmlText.replace('J.K FENNER (INDIA) LIMITED','Other Employer Limited')}],
 ['publication schedule',v=>{v.data.postChannelConfiguration.careerSite.fromDate='2026-11-20T13:31:10'}],
 ['application authority',v=>{v.data.longURL='https://other.invalid/login?token=changed'}],
 ['structured criteria',v=>{v.data.experience.work.maxRange=1}]
])test('a changed '+label+' holds that original model and retains the unrelated full native model',async()=>{
 const source=replay(({url,value})=>url===details[0].url?changeJSON(value,mutate):undefined),jobs=await run(source)
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,model(1).requisitionId)
 assert.equal(jobs[0].country,null);assert.equal(jobs.nativeCollectionEvidence.heldRecords.length,1)
 assert.equal(jobs.nativeCollectionEvidence.openingNativeRows,2)
 assert.equal(jobs.nativeCollectionEvidence.completeInventory,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('a changed original criteria binary holds one model without suppressing the other native role',async()=>{
 const source=replay(({url,value})=>url===carriers[0].url?{...value,bytes:Buffer.concat([value.bytes,Buffer.from('\nchanged mandatory criteria')])}:undefined),jobs=await run(source)
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,model(1).requisitionId)
 assert.equal(jobs.nativeCollectionEvidence.heldRecords.length,1)
 assert.match(jobs.nativeCollectionEvidence.heldRecords[0].reason,/criteria carrier/)
})

test('a native-detail requisition mismatch cannot borrow the listing identity',async()=>{
 const source=replay(({url,value})=>url===details[0].url?changeJSON(value,v=>{v.data.requisitionId=model(1).requisitionId}):undefined),jobs=await run(source)
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,model(1).requisitionId)
 assert.match(jobs.nativeCollectionEvidence.heldRecords[0].reason,/identity/)
})

test('a changed signed carrier permission is held before any altered URL is requested',async()=>{
 const source=replay(({url,value})=>url===details[0].url?changeJSON(value,v=>{v.data.jobProperties.jdpdf.fileUrl=v.data.jobProperties.jdpdf.fileUrl.replace('sp=r','sp=rw')}):undefined),jobs=await run(source)
 assert.equal(jobs.length,1);assert.ok(source.calls.every(c=>!c.url.includes('sp=rw')))
 assert.equal(jobs.nativeCollectionEvidence.heldRecords.length,1)
})

test('closing compares the complete original criteria and structured publication model',async()=>{
 const source=replay(({url,occurrence,value})=>url===details[0].url&&occurrence===2?changeJSON(value,v=>{v.data.positionDetails.krAsAndKPIs.htmlText+='<p>Closing-only changed authority.</p>'}):undefined)
 await assert.rejects(run(source),/closing/)
})

test('closing list is reconciled in full rather than only IDs or count',async()=>{
 const source=replay(({url,occurrence,value})=>url===list.url&&occurrence===2?changeJSON(value,v=>{v.data.requisitionList[0].postChannelConfiguration.careerSite.toDate='2026-11-20T00:00:00'}):undefined)
 await assert.rejects(run(source),/closing/)
})

test('closing corporate authority is fetched again and reconciled before publication',async()=>{
 const source=replay(({url,occurrence,value})=>url===home&&occurrence===2?{...value,bytes:Buffer.concat([value.bytes,Buffer.from('<p>All applications closed.</p>')])}:undefined)
 await assert.rejects(run(source),/authority|closing/);assert.equal(source.calls.length,16)
})

for(const [label,change]of[
 ['public denial',v=>({...v,status:403})],
 ['redirect',v=>({...v,status:302,url:'https://other.invalid/',redirected:true})],
 ['missing media type',v=>({...v,headers:new Headers()})]
])test(label+' stops once and never becomes an empty board',async()=>{
 const source=replay(({value})=>change(value))
 await assert.rejects(run(source),/HTTP|metadata|media|public/);assert.equal(source.calls.length,1)
})

for(const reason of[Object.freeze({opaque:'caller cancellation'}),null,Error('caller cancellation')])test('pre-aborted caller preserves its exact reason '+String(reason),async()=>{
 const controller=new AbortController();controller.abort(reason);const source=replay()
 await assert.rejects(run({...source,signal:controller.signal}),error=>error===reason);assert.equal(source.calls.length,0)
})

test('opaque transport failure is preserved and never retried',async()=>{
 const reason=Object.freeze({opaque:'transport'}),source=replay(()=>{throw reason})
 await assert.rejects(run(source),error=>error===reason);assert.equal(source.calls.length,1)
})

test('caller cancellation during an audit observer wins over successful models',async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:'audit cancellation'}),source=replay()
 await assert.rejects(run({...source,signal:controller.signal,onAudit:()=>{controller.abort(reason);return new Promise(()=>{})}}),error=>error===reason)
 assert.equal(source.calls.length,30)
})

test('collection deadline bounds a transport which ignores its signal',async()=>{
 const source=replay(()=>new Promise(()=>{}))
 await assert.rejects(run({...source,collectionBudgetMs:10}),/deadline/);assert.equal(source.calls.length,1)
})

test('invalid caller bounds stop before any public read',async()=>{
 for(const options of[{maxJobs:-1},{maxJobs:1.5},{maxRequests:0},{collectionBudgetMs:0},{collectionBudgetMs:90001}]){
  const source=replay();await assert.rejects(run({...source,...options}),/invalid/);assert.equal(source.calls.length,0)
 }
})

test('request budget is enforced before the next public read',async()=>{
 const source=replay();await assert.rejects(run({...source,maxRequests:1}),/request budget/);assert.equal(source.calls.length,1)
})

test('terminal public denial aborts the owned request signal and leaves the caller signal intact',async()=>{
 const caller=new AbortController(),source=replay(({value})=>({...value,status:403}))
 await assert.rejects(run({...source,signal:caller.signal}),/HTTP/)
 assert.equal(source.calls.length,1);assert.equal(caller.signal.aborted,false)
 assert.equal(source.calls[0].init.signal.aborted,true,'A terminal source must close its owned outstanding transport/body work')
})

for(const [label,reason]of[
 ['frozen code collision',Object.freeze({code:'JKFENNER_CURRENT_NATIVE',opaque:'transport'})],
 ['opaque code getter',Object.defineProperty({},'code',{get(){throw Error('An opaque reason must not be inspected')}})]
])test('opaque transport '+label+' retains exact identity without annotation',async()=>{
 const source=replay(()=>{throw reason})
 await assert.rejects(run(source),error=>error===reason);assert.equal(source.calls.length,1)
})

test('in-flight caller abort with a frozen source-code collision retains exact opaque reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze({code:'JKFENNER_CURRENT_NATIVE',opaque:'caller'}),source=replay(()=>{controller.abort(reason);return new Promise(()=>{})})
 await assert.rejects(run({...source,signal:controller.signal}),error=>error===reason);assert.equal(source.calls.length,1)
})
