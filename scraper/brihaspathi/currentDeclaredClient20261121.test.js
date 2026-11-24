import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {nativeFixture} from '../bizongo/nativeFixture.js'
import {runNativeBrihaspathi,CAREERS_URL,CLIENT_URL,JOBS_API_URL} from './native.js'
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-declared-client-20261121.json.gz',import.meta.url))))
test('unreviewed current native page must reject undeclared retired client before any stale dependency request',async()=>{
 const calls=[];let error
 try{await runNativeBrihaspathi({requestIntervalMs:0,fetchPage:async url=>{calls.push(url);const packet=current.packets.find(row=>row.requestedURL===url);assert.ok(packet,'Only actual retained current native packets');const body=Buffer.from(packet.bodyBase64,'base64').toString('utf8')+(url===CAREERS_URL?'<!-- unreviewed current page mutation -->':'');return{status:packet.status,url:packet.finalURL,headers:new Headers(packet.headers),body}}})}catch(caught){error=caught}
 assert.ok(error);assert.deepEqual(calls,[CAREERS_URL],'The retired '+CLIENT_URL+' is absent from the current native declaration')
 assert.match(error.message,/client|delegation|reviewed/i)
})
test('reviewed current declared client preserves historical actual zero-envelope semantics through both closing transport snapshots',async()=>{
 const fixture=nativeFixture(import.meta.url),calls=[],owner=current.currentOwnerPacket;assert.ok(owner)
 const jobs=await runNativeBrihaspathi({requestIntervalMs:0,fetchPage:async url=>{
  calls.push(url)
  if(url===CAREERS_URL){const packet=current.packets[0];return{status:packet.status,url:packet.finalURL,headers:new Headers(packet.headers),body:Buffer.from(packet.bodyBase64,'base64').toString('utf8')}}
  if(url===owner.requestedURL)return{status:owner.status,url:owner.url,headers:new Headers(owner.headers),body:Buffer.from(owner.bodyBase64,'base64').toString('utf8')}
  assert.notEqual(url,CLIENT_URL,'The retired unadvertised client must never be requested')
  return fixture.fetchPage(url)
 }})
 assert.equal(jobs.length,0);assert.equal(calls.length,6);assert.equal(calls.filter(url=>url===owner.requestedURL).length,2)
 assert.equal(jobs.nativeInventoryEvidence.declaredBoardComplete,true);assert.equal(jobs.nativeInventoryEvidence.sourceScopeComplete,false);assert.equal(jobs.nativeInventoryEvidence.lifecycleCleanupAllowed,false)
 assert.equal(jobs.nativeInventoryEvidence.fullNativeDescriptionRecords,0);assert.equal(jobs.nativeInventoryEvidence.companyGlobalTotal,undefined)
})
test('reviewed legacy declared client still reaches both original zero-enumeration snapshots',async()=>{
 const fixture=nativeFixture(import.meta.url),calls=[]
 const jobs=await runNativeBrihaspathi({requestIntervalMs:0,fetchPage:async url=>{calls.push(url);return fixture.fetchPage(url)}})
 assert.equal(jobs.length,0);assert.equal(jobs.nativeInventoryEvidence.declaredBoardComplete,true);assert.equal(jobs.nativeInventoryEvidence.sourceScopeComplete,false);assert.equal(calls.length,6)
})

// API responses below are the unchanged historical public zero packet. They
// test transport/closure contracts and do not assert a current live inventory.
function replay(transform=()=>{}){
 const fixture=nativeFixture(import.meta.url),calls=[],occurrences=new Map()
 const fetchPage=async(url,init)=>{
  calls.push(url);const occurrence=(occurrences.get(url)||0)+1;occurrences.set(url,occurrence)
  const packet=url===CAREERS_URL?current.packets[0]:url===current.currentOwnerPacket.requestedURL?current.currentOwnerPacket:null
  let response=packet?{status:packet.status,url:packet.url??packet.finalURL,headers:new Headers(packet.headers),body:Buffer.from(packet.bodyBase64,'base64').toString('utf8')}:await fixture.fetchPage(url)
  response=await transform({url,init,occurrence,response,fixture})??response
  return response
 }
 return{calls,fetchPage}
}

for(const [label,change] of [
 ['employer title',body=>body.replace('<title>Brihaspathi technologies limited</title>','<title>Different employer</title>')],
 ['legal organization',body=>body.replace('"name":"Brihaspathi Technologies Limited"','"name":"Different employer"')],
 ['executable delegation',body=>body.replace('src="/_next/static/chunks/33cq_vnnn7709.js"','nomodule src="/_next/static/chunks/33cq_vnnn7709.js"')],
 ['vacancy visibility',body=>body.replace('id="vacancies"','hidden id="vacancies"')],
 ['unreviewed document bytes',body=>body+'<!-- changed declared document -->']
])test('current '+label+' drift rejects before any client or API request',async()=>{
 const fixture=replay(({url,response})=>{if(url===CAREERS_URL){const changed=change(response.body);assert.notEqual(changed,response.body);return{...response,body:changed}}})
 await assert.rejects(runNativeBrihaspathi({...fixture,requestIntervalMs:0}),/employer|organization|client|delegation|roles/i)
 assert.deepEqual(fixture.calls,[CAREERS_URL])
})

for(const [label,change]of[
 ['private handler copy',body=>body.replace('Please upload your resume.','Changed unreviewed application copy.')],
 ['active query',body=>body.replace('filters[isActive][$eq]=true','filters[isActive][$eq]=false')]
])test('exact current client '+label+' drift rejects before native API',async()=>{
 const fixture=replay(({url,response})=>{if(url===current.currentOwnerPacket.requestedURL){const changed=change(response.body);assert.notEqual(changed,response.body);return{...response,body:changed}}})
 await assert.rejects(runNativeBrihaspathi({...fixture,requestIntervalMs:0}),/client bytes changed/i)
 assert.equal(fixture.calls.length,2);assert.equal(fixture.calls.includes(JOBS_API_URL),false)
})

test('closing cannot switch the exact current declared cohort to the historical default',async()=>{
 const fixture=replay(({url,occurrence,fixture})=>url===CAREERS_URL&&occurrence===2?fixture.fetchPage(url):undefined)
 await assert.rejects(runNativeBrihaspathi({...fixture,requestIntervalMs:0}),/closing declared client cohort/i)
 assert.equal(fixture.calls.length,4);assert.equal(fixture.calls.includes(CLIENT_URL),false)
})

test('closing current document remains exact before any closing client read',async()=>{
 const fixture=replay(({url,occurrence,response})=>url===CAREERS_URL&&occurrence===2?{...response,body:response.body+'<!-- closing drift -->'}:undefined)
 await assert.rejects(runNativeBrihaspathi({...fixture,requestIntervalMs:0}),/client|delegation/i)
 assert.equal(fixture.calls.length,4)
})

test('closing current client retains full exact reviewed bytes',async()=>{
 const fixture=replay(({url,occurrence,response})=>url===current.currentOwnerPacket.requestedURL&&occurrence===2?{...response,body:response.body+'\n/* closing drift */'}:undefined)
 await assert.rejects(runNativeBrihaspathi({...fixture,requestIntervalMs:0}),/client bytes changed/i)
 assert.equal(fixture.calls.length,5)
})

test('closing native failure cannot be mistaken for the replayed zero envelope',async()=>{
 const fixture=replay(({url,occurrence,response})=>{if(url===JOBS_API_URL&&occurrence===2){const payload=JSON.parse(response.body);payload.error={status:503,message:'unavailable'};return{...response,body:JSON.stringify(payload)}}})
 await assert.rejects(runNativeBrihaspathi({...fixture,requestIntervalMs:0}),/error envelope|unavailable/i)
 assert.equal(fixture.calls.length,6)
})

test('current client opaque transport failure retains the exact caller reason',async()=>{
 const reason=Object.freeze({opaque:'current-client'}),fixture=replay(({url})=>{if(url===current.currentOwnerPacket.requestedURL)throw reason})
 await assert.rejects(runNativeBrihaspathi({...fixture,requestIntervalMs:0}),value=>value===reason);assert.equal(fixture.calls.length,2)
})

test('pre-aborted current caller makes no request and preserves its frozen reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze({cancel:'before-current-read'}),fixture=replay();controller.abort(reason)
 await assert.rejects(runNativeBrihaspathi({...fixture,signal:controller.signal,requestIntervalMs:0}),value=>value===reason);assert.equal(fixture.calls.length,0)
})

test('caller cancellation during current client read cannot become a completed inventory',async()=>{
 const controller=new AbortController(),reason=Object.freeze({cancel:'during-current-client'}),fixture=replay(({url})=>{if(url===current.currentOwnerPacket.requestedURL)controller.abort(reason)})
 await assert.rejects(runNativeBrihaspathi({...fixture,signal:controller.signal,requestIntervalMs:0}),value=>value===reason);assert.equal(fixture.calls.length,2)
})

test('caller profile-shaped values cannot approve a changed current native document',async()=>{
 const fixture=replay(({url,response})=>url===CAREERS_URL?{...response,body:response.body+'<!-- caller approval is not authority -->'}:undefined)
 await assert.rejects(runNativeBrihaspathi({...fixture,requestIntervalMs:0,clientUrl:current.currentOwnerPacket.requestedURL,reviewedCurrentClient:{allowChangedDocument:true},skipClosing:true}),/client|delegation/i)
 assert.equal(fixture.calls.length,1)
})

test('caller zero cap preserves both current replay snapshots and all company cleanup holds',async()=>{
 const fixture=replay();let report
 const jobs=await runNativeBrihaspathi({...fixture,requestIntervalMs:0,maxJobs:0,onAudit:value=>{report=value}})
 assert.equal(jobs.length,0);assert.equal(fixture.calls.length,6);assert.equal(report.closingReconciled,true)
 assert.equal(report.companyGlobalTotal,null);assert.equal(report.companyIndiaTotal,null);assert.equal(report.lifecycleCleanupAllowed,false);assert.equal(report.indiaAbsenceProven,false);assert.equal(report.sourceScopeComplete,false)
})
