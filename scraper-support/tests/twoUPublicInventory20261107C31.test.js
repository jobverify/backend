import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run,CAREERS_URL} from '../../scraper/2u/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'

const folder=new URL('./fixtures/twoUCurrent20261107C31/',import.meta.url)
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',folder),'utf8'))
const sha=b=>createHash('sha256').update(b).digest('hex')
const original=new Map(manifest.records.map(row=>{
 const body=gunzipSync(fs.readFileSync(new URL(row.bodyFile,folder)))
 assert.equal(body.length,row.bytes);assert.equal(sha(body),row.sha256)
 return[row.requestedUrl,{url:row.finalUrl,status:row.status,headers:row.headers,contentType:row.contentType,
  bodyBase64:body.toString('base64'),html:body.toString('utf8'),requestedAt:row.sourceRequestedAt,completedAt:row.sourceCompletedAt}]
}))
const JOBS='https://2u.com/careers/jobs/',ROLE=JOBS+'8871017002/'
const QUERY='https://2u.com/page-data/sq/d/1843004117.json'
const CLIENT='https://2u.com/careers-teams-locations-f81784e5e6f699b2511b.js'
const APP='https://2u.com/app-ebba611b9c6f19868c0a.js'
const LOCATIONS='https://2u.com/page-data/sq/d/3494932948.json'
const stamp='2026-11-06T21:25:00.000Z'
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve()}
const changed=(page,body)=>({...page,html:body,bodyBase64:Buffer.from(body).toString('base64')})
function reader(mutate){
 const calls=[]
 return{calls,fetchPage:async(url,init)=>{
  calls.push({url,init})
  assert.ok(original.has(url),'No implicit network or invented endpoint: '+url)
  const row=structuredClone(original.get(url))
  return mutate?mutate(row,url,calls):row
 }}
}
async function replay(options={},mutate){
 const transport=reader(mutate);let audit
 const jobs=await run({now:()=>stamp,...transport,...options,onAudit:async value=>{audit=value;await options.onAudit?.(value)}})
 return{jobs,audit,calls:transport.calls}
}

test('current original public models retain the complete US vacancy observation without company zero',async()=>{
 const {jobs,audit,calls}=await replay()
 assert.equal(jobs.length,0)
 assert.equal(audit.source,'2u');assert.equal(audit.observations.length,1)
 const role=audit.observations[0]
 assert.equal(role.id,'8871017002');assert.equal(role.title,'Senior Manager, Corporate FP&A')
 assert.equal(role.country,'United States');assert.deepEqual(role.sourceNativeCountries,['United States'])
 assert.equal(role.sourceCountryComplete,true);assert.equal(role.vacancy,true)
 assert.equal(role.nativeCriteriaComplete,true);assert.equal(role.visibleCriteriaMatch,true)
 assert.ok(role.jobDescription.includes('Lead continuous improvements'))
 assert.ok(role.jobDescription.includes('2U is an equal opportunity employer'))
 assert.equal(role.postingDate,null);assert.equal(role.nativeUpdatedAt,'2026-10-26T16:31:47-04:00')
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null)
 assert.equal(audit.closingMatches,true);assert.equal(audit.originalPages.length,16)
 assert.equal(calls.length,16);assert.ok(calls.every(r=>r.url!=='https://2u.com/'))
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.equal(readSourceObservationEvidence(jobs,'2u').observedVacancyCount,1)
 assert.equal(jobs.sourceAudit,audit)
})

test('original public bytes and original acquisition clocks survive an offline replay',async()=>{
 const {audit}=await replay()
 for(const page of audit.originalPages){
  const fixture=original.get(page.requestedURL),body=Buffer.from(fixture.bodyBase64,'base64')
  assert.equal(page.bodySHA256,sha(body));assert.equal(page.bytes,body.length)
  assert.equal(page.bodyBase64,fixture.bodyBase64)
  assert.equal(page.requestedAt,fixture.requestedAt);assert.equal(page.completedAt,fixture.completedAt)
  assert.notEqual(page.completedAt,stamp)
 }
})

test('each original read receives manual GET, no credentials and its bounded signal',async()=>{
 const {calls}=await replay()
 for(const {init} of calls){assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.ok(init.signal instanceof AbortSignal)}
})

test('changed current program fails before loading static-query models',async()=>{
 const transport=reader((row,url)=>url===CLIENT?changed(row,row.html+'\n/* changed program */'):row)
 await assert.rejects(run({...transport}),/program.*changed/i)
 assert.ok(!transport.calls.some(r=>r.url===QUERY))
})

test('non-executable and template-only script declarations cannot authorize data reads',async()=>{
 for(const replace of [src=>'<template>'+src+'</template>',src=>src.replace('<script','<script type="application/json"')]){
  const transport=reader((row,url)=>url===JOBS?changed(row,row.html.replace(/<script\b[^>]*src="\/careers-teams-locations-[^"]+"[^>]*><\/script>/,replace)):row)
  await assert.rejects(run({...transport}),/declaration|program/i)
  assert.ok(!transport.calls.some(r=>r.url===QUERY))
 }
})

test('redirect responses remain original and never authorize an automatic destination GET',async()=>{
 const transport=reader((row,url)=>url===CAREERS_URL?{...row,status:301,url:CAREERS_URL,headers:{location:'https://other.example/jobs'},bodyBase64:null,html:undefined}:row)
 let audit
 await assert.rejects(run({...transport,onAudit:value=>{audit=value}}),/HTTP 301/)
 assert.equal(transport.calls.length,1)
 assert.equal(audit.originalPages[0].status,301);assert.equal(audit.originalPages[0].bodyBase64,null)
 assert.equal(audit.originalPages[0].bytes,null);assert.equal(audit.originalPages[0].bodySHA256,null)
})

test('a changed original response URL is rejected',async()=>{
 const transport=reader(row=>({...row,url:row.url+'?redirected=1'}))
 await assert.rejects(run({...transport}),/response identity/i)
 assert.equal(transport.calls.length,1)
})

test('a denied original host is stopped without retry or alternate path',async()=>{
 const transport=reader((row,url)=>url===CAREERS_URL?changed({...row,status:403},'<title>Access denied</title>'):row)
 let audit
 await assert.rejects(run({...transport,onAudit:value=>{audit=value}}),/access denied/i)
 assert.equal(transport.calls.length,1);assert.deepEqual(audit.heldHosts,['2u.com'])
})

test('decoded text without original bytes is unqualified',async()=>{
 const transport=reader(row=>({...row,bodyBase64:undefined}))
 await assert.rejects(run({...transport}),/original.*bytes/i)
})

test('unqualified fetchText is rejected before invoking any callback',async()=>{
 let called=false
 await assert.rejects(run({fetchText:()=>{called=true;return 'text'}}),/original HTTP/i)
 assert.equal(called,false)
})

test('complete visible criteria must match every native character apart from whitespace',async()=>{
 let audit
 await assert.rejects(replay({onAudit:value=>{audit=value}},(row,url)=>url===ROLE?changed(row,row.html.replace('10+ years','2+ years')):row),/visible.*criteria/i)
 assert.equal(audit.observations[0].nativeCriteriaComplete,true)
 assert.equal(audit.observations[0].visibleCriteriaMatch,false)
 assert.equal(audit.sourceScopeComplete,false)
})

test('duplicate native role IDs are rejected without losing the original native model',async()=>{
 let audit
 const transport=reader((row,url)=>{if(url!==QUERY)return row;const model=JSON.parse(row.html);model.data.greenhouseJobs.jobs.push(structuredClone(model.data.greenhouseJobs.jobs[0]));return changed(row,JSON.stringify(model))})
 await assert.rejects(run({...transport,onAudit:value=>{audit=value}}),/duplicate.*identity/i)
 assert.ok(audit.originalPages.find(r=>r.requestedURL===QUERY))
})

test('a closing native model change preserves the observed positive and stays incomplete',async()=>{
 let count=0,audit
 const transport=reader((row,url)=>{if(url!==QUERY||++count===1)return row;const model=JSON.parse(row.html);model.data.greenhouseJobs.jobs=[];return changed(row,JSON.stringify(model))})
 await assert.rejects(run({...transport,onAudit:value=>{audit=value}}),/closing.*changed/i)
 assert.equal(audit.observations.length,1);assert.equal(audit.closingMatches,false)
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.lifecycleCleanupAllowed,false)
})

test('a finite request cap stops before the next original GET',async()=>{
 const transport=reader()
 await assert.rejects(run({...transport,maxRequests:2}),/request.*budget/i)
 assert.equal(transport.calls.length,2)
})

test('decoded response and aggregate limits are enforced',async()=>{
 for(const limit of [{responseBytes:100},{aggregateBytes:100}]){
  const transport=reader()
  await assert.rejects(run({...transport,...limit}),/byte.*limit/i)
  assert.equal(transport.calls.length,1)
 }
})

test('invalid limits and clocks fail before any original read',async()=>{
 for(const options of [{maxRequests:0},{maxRequests:65},{responseBytes:0},{aggregateBytes:NaN},{sourceTimeoutMs:0},
  {requestTimeoutMs:0},{auditTimeoutMs:Infinity},{maxDetails:-1},{maxJobs:-1},{now:()=>''}]){
  let called=false
  await assert.rejects(run({...options,fetchPage:()=>{called=true}}))
  assert.equal(called,false)
 }
})

test('pre-aborted opaque caller reason is preserved before all callbacks',async()=>{
 const controller=new AbortController(),reason=Object.freeze({cancel:'caller'});controller.abort(reason)
 let called=false,caught
 try{await run({signal:controller.signal,now:()=>{called=true},fetchPage:()=>{called=true}})}catch(error){caught=error}
 assert.equal(caught,reason);assert.equal(called,false)
})

test('late opaque caller cancellation bounds an ignored injected read',async()=>{
 const controller=new AbortController(),reason=Object.freeze({cancel:'late'})
 const promise=run({signal:controller.signal,fetchPage:()=>new Promise(()=>{})}).then(()=>null,e=>e)
 await flush();controller.abort(reason)
 assert.equal(await promise,reason)
})

test('an ignored injected original read is bounded by the request deadline',async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 const promise=run({requestTimeoutMs:20,fetchPage:()=>new Promise(()=>{})}).then(()=>null,e=>e)
 await flush();t.mock.timers.tick(20)
 assert.equal((await promise).code,'TWO_U_PUBLIC_READ_TIMEOUT')
})

test('a hung native response stream is cancelled without waiting for cancel to finish',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let cancelled=false
 const body=new ReadableStream({pull:()=>new Promise(()=>{}),cancel:()=>{cancelled=true;return new Promise(()=>{})}})
 const response=new Response(body,{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:CAREERS_URL})
 const promise=run({requestTimeoutMs:20,fetchImpl:async()=>response}).then(()=>null,e=>e)
 await flush();t.mock.timers.tick(20)
 assert.equal((await promise).code,'TWO_U_PUBLIC_READ_TIMEOUT');assert.equal(cancelled,true)
})

test('a native stream that aborts synchronously propagates its opaque reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze({cancel:'sync-stream'})
 const body=new ReadableStream({pull(){controller.abort(reason);throw reason}})
 const response=new Response(body,{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:CAREERS_URL})
 const promise=run({signal:controller.signal,fetchImpl:async()=>response}).then(()=>null,e=>e)
 assert.equal(await promise,reason)
})

test('a hung audit callback is bounded after the original evidence is assembled',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const transport=reader();let audited=false
 const promise=run({...transport,auditTimeoutMs:20,onAudit:()=>{audited=true;return new Promise(()=>{})}}).then(()=>null,e=>e)
 for(let i=0;i<20&&!audited;i++)await flush()
 assert.equal(audited,true);t.mock.timers.tick(20)
 assert.equal((await promise).code,'TWO_U_PUBLIC_AUDIT_TIMEOUT')
})

test('missing original response clocks remain missing rather than being restamped',async()=>{
 const {audit}=await replay({},row=>({...row,requestedAt:undefined,completedAt:undefined}))
 assert.ok(audit.originalPages.every(r=>r.requestedAt===null&&r.completedAt===null))
})

test('maxJobs zero skips native acquisition without claiming an empty inventory',async()=>{
 const {jobs,audit,calls}=await replay({maxJobs:0})
 assert.equal(jobs.length,0);assert.equal(audit.observations.length,0);assert.equal(calls.length,0)
 assert.equal(audit.originalPages.length,0);assert.equal(audit.closingMatches,false)
 assert.equal(readInventoryEvidence(jobs).firstParty,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('synthetic explicit India office control returns full matching criteria while keeping company scope incomplete',async()=>{
 const {jobs,audit}=await replay({},(row,url)=>{
  if(url===QUERY){const model=JSON.parse(row.html);model.data.greenhouseJobs.jobs[0].offices[0].name='India Remote';return changed(row,JSON.stringify(model))}
  if(url===LOCATIONS){const model=JSON.parse(row.html),office=model.data.cms.pages.find(r=>r.id==='215');office.title='Remote: India';office.abbreviation='IN';return changed(row,JSON.stringify(model))}
  if(url===ROLE)return changed(row,row.html.replaceAll('Remote: US, US','Remote: India, IN'))
  return row
 })
 assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].jobId,'8871017002');assert.equal(jobs[0].postingDate,null)
 assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].sourceScopeComplete,false)
 assert.equal(jobs[0].jobDescription,audit.observations[0].jobDescription)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})

test('synthetic general application remains a hiring signal rather than a vacancy',async()=>{
 const title='General Application - Talent Community'
 const {jobs,audit}=await replay({},(row,url)=>{
  if(url===QUERY){const model=JSON.parse(row.html);model.data.greenhouseJobs.jobs[0].title=title;return changed(row,JSON.stringify(model))}
  if(url===ROLE)return changed(row,row.html.replaceAll('Senior Manager, Corporate FP&amp;A',title))
  return row
 })
 assert.equal(jobs.length,0);assert.equal(audit.observations.length,1)
 assert.equal(audit.observations[0].vacancy,false)
 assert.equal(readSourceObservationEvidence(jobs,'2u').observedVacancyCount,0)
 assert.equal(readSourceObservationEvidence(jobs,'2u').recordKind,'hiring-signals')
})

test('source deadline bounds a signal-ignoring native fetch independently of its read deadline',async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 const promise=run({sourceTimeoutMs:10,requestTimeoutMs:20,fetchImpl:()=>new Promise(()=>{})}).then(()=>null,e=>e)
 await flush();t.mock.timers.tick(10)
 assert.equal((await promise).code,'TWO_U_PUBLIC_SOURCE_TIMEOUT')
})

test('an ignored native fetch response arriving after cancellation has its body cancelled',async()=>{
 const controller=new AbortController(),reason=Object.freeze({cancel:'late-native-response'})
 let release,cancelled=false
 const promise=run({signal:controller.signal,fetchImpl:()=>new Promise(resolve=>{release=resolve})}).then(()=>null,e=>e)
 await flush();controller.abort(reason);assert.equal(await promise,reason)
 const response=new Response(new ReadableStream({cancel(){cancelled=true}}),{headers:{'content-type':'text/html'}})
 Object.defineProperty(response,'url',{value:CAREERS_URL});release(response);await flush()
 assert.equal(cancelled,true)
})

test('opaque cancellation inside the audit callback keeps the exact caller reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze({cancel:'audit'})
 const transport=reader()
 const caught=await run({...transport,signal:controller.signal,onAudit:()=>{controller.abort(reason);throw reason}}).then(()=>null,e=>e)
 assert.equal(caught,reason)
})
