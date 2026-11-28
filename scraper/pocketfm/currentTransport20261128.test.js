import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {runCurrentPocketFM} from './currentNative20261113.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const current=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-binding-20261128.json.gz',import.meta.url))))
const historical=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-registered-20261121.json.gz',import.meta.url))))
const decode=packet=>{
 const bytes=Buffer.from(packet.bodyBase64,'base64')
 assert.equal(bytes.length,packet.bytes);assert.equal(sha(bytes),packet.sha256)
 return bytes.toString('utf8')
}
// Genuine current authority programs plus the genuine historical native graph
// isolate the HTTP boundary. This composition asserts no current inventory.
const authority=new Map(current.packets.map(packet=>[packet.url,{packet,body:decode(packet)}]))
const runGraph=(t,mode,control={},options={})=>{
 const visits=new Map(),calls=[]
 const page=async value=>{
  const url=String(value),visit=visits.get(url)??0;visits.set(url,visit+1)
  const record=authority.get(url),packet=record?.packet??historical.packets.filter(row=>row.url===url)[visit]
  assert.ok(packet,'Only retained whole public responses: '+url+' #'+visit)
  const index=calls.length,body=record?.body??decode(packet)
  const headers=new Headers(packet.headers),target=index===control.index
  if(target&&control.header)headers.set(...control.header)
  const status=target&&control.status!==undefined?control.status:packet.status
  const finalURL=target&&control.finalURL?control.finalURL:packet.finalURL??packet.url
  const observation={url,status,bodyReads:0,cancellations:0};calls.push(observation)
  const cancel=async()=>{observation.cancellations++;if(target)await control.onCancel?.()}
  if(mode==='default')return{status,url:finalURL,headers,bodyUsed:false,body:{cancel},text:async()=>{observation.bodyReads++;return body}}
  const result={status,url:finalURL,headers:control.plainHeaders?Object.fromEntries(headers):headers,bodyUsed:false,body:{cancel}}
  Object.defineProperty(result,'html',{get(){observation.bodyReads++;return body}})
  return result
 }
 if(mode==='default')t.mock.method(globalThis,'fetch',async(url,init)=>{
  assert.equal(init.redirect,'manual');assert.ok(init.signal instanceof AbortSignal)
  return page(url)
 })
 else t.mock.method(globalThis,'fetch',()=>assert.fail('Injected response controls cannot use the network'))
 return{calls,result:runCurrentPocketFM({...options,...(mode==='injected'?{fetchPage:page}:{})})}
}
const assertBlocked=(error,{status,challenge=false,retryDelayMs})=>{
 assert.equal(error.httpStatus,status);assert.equal(error.abortRetries,true)
 assert.equal(error.failureKind,'blocked_or_access_denied')
 assert.equal(error.lifecycleCleanupAllowed,false);assert.equal(error.sourceScopeComplete,false)
 assert.equal(error.accessChallenge===true,challenge)
 if(retryDelayMs!==undefined)assert.equal(error.retryDelayMs,retryDelayMs)
 return true
}

for(const mode of['default','injected'])for(const control of[
 {name:'corporate HTTP200 Cloudflare challenge',index:0,status:200,header:['cf-mitigated','challenge'],challenge:true},
 {name:'corporate HTTP403 denial',index:0,status:403},
 {name:'corporate HTTP429 Retry-After',index:0,status:429,header:['retry-after','60'],retryDelayMs:60000},
 {name:'native listing HTTP200 AWS challenge',index:4,status:200,header:['x-amzn-waf-action','challenge'],challenge:true},
])test('Pocket FM '+mode+' stops before the body for '+control.name,async t=>{
 const source=runGraph(t,mode,control)
 await assert.rejects(source.result,error=>assertBlocked(error,control))
 assert.equal(source.calls.length,control.index+1,'No later authority/listing/detail/closing request is permitted')
 assert.equal(source.calls.at(-1).bodyReads,0,'Status and challenge headers qualify before text/html access')
 assert.equal(source.calls.at(-1).cancellations,1,'The rejected response is disposed')
})

for(const mode of['default','injected'])test('Pocket FM '+mode+' challenged role detail is terminal, including inside the per-role catch',async t=>{
 const control={index:6,status:200,header:['cf-mitigated','challenge'],challenge:true},source=runGraph(t,mode,control)
 await assert.rejects(source.result,error=>assertBlocked(error,control))
 assert.equal(source.calls.length,7,'Do not read its application, sibling role or closing inventory after a challenge')
 assert.match(source.calls.at(-1).url,/jobs\.lever\.co\/pocketfm\/[\da-f-]+$/)
 assert.equal(source.calls.at(-1).bodyReads,0);assert.equal(source.calls.at(-1).cancellations,1)
})

for(const mode of['default','injected'])test('Pocket FM '+mode+' retains a hard final-URL identity failure before body access',async t=>{
 const source=runGraph(t,mode,{index:0,finalURL:'https://other.example/'})
 await assert.rejects(source.result,error=>{
  assert.equal(error.httpStatus,200);assert.equal(error.abortRetries,true)
  assert.equal(error.failureKind,'parser_or_contract_error');assert.equal(error.softFailure,false)
  assert.equal(error.requestedUrl,'https://pocketfm.com/');assert.equal(error.responseUrl,'https://other.example/')
  assert.equal(error.lifecycleCleanupAllowed,false);return true
 })
 assert.equal(source.calls.length,1);assert.equal(source.calls[0].bodyReads,0)
})

for(const mode of['default','injected'])test('Pocket FM '+mode+' preserves an exact caller pre-abort reason with zero public reads',async t=>{
 const reason=Error('exact Pocket FM caller cancellation'),controller=new AbortController();controller.abort(reason)
 const source=runGraph(t,mode,{}, {signal:controller.signal})
 await assert.rejects(source.result,error=>error===reason);assert.equal(source.calls.length,0)
})

test('Pocket FM caller cancellation during rejected-body cleanup keeps the caller reason',async t=>{
 const reason=Error('caller cancelled during Pocket FM cleanup'),controller=new AbortController()
 const source=runGraph(t,'default',{index:0,status:403,onCancel:()=>controller.abort(reason)},{signal:controller.signal})
 await assert.rejects(source.result,error=>error===reason)
 assert.equal(source.calls.length,1);assert.equal(source.calls[0].bodyReads,0)
})

test('Pocket FM local request deadline during rejected-body cleanup preserves the primary typed denial',async t=>{
 const timeout=AbortSignal.timeout,controller=new AbortController(),localReason=Error('local request cleanup deadline')
 t.mock.method(AbortSignal,'timeout',ms=>ms===20000?controller.signal:timeout(ms))
 const source=runGraph(t,'default',{index:0,status:403,onCancel:()=>controller.abort(localReason)})
 await assert.rejects(source.result,error=>error!==localReason&&assertBlocked(error,{status:403}))
 assert.equal(source.calls.length,1);assert.equal(source.calls[0].bodyReads,0)
})

test('Pocket FM a role HTTP503 remains a typed acquisition failure rather than a local content omission',async t=>{
 const source=runGraph(t,'default',{index:6,status:503,header:['retry-after','30']})
 await assert.rejects(source.result,error=>{
  assert.equal(error.httpStatus,503);assert.equal(error.failureKind,'network_or_timeout')
  assert.equal(error.retryDelayMs,30000);assert.equal(error.lifecycleCleanupAllowed,false);return true
 })
 assert.equal(source.calls.length,7);assert.equal(source.calls.at(-1).bodyReads,0)
})

test('Pocket FM injected plain headers without a challenge retain the full genuine native graph and all scope holds',async t=>{
 const source=runGraph(t,'injected',{plainHeaders:true,index:0,header:['cf-mitigated','not-a-challenge']}),jobs=await source.result
 assert.deepEqual(jobs.map(job=>job.jobId),historical.expectedJobs.map(job=>job.jobId))
 for(const expected of historical.expectedJobs){
  const job=jobs.find(row=>row.jobId===expected.jobId)
  assert.equal(job.sourceNativeRecord.country,'IN');assert.equal(job.country,'India')
  assert.equal(job.postingDate,expected.postingDate);assert.equal(sha(job.sourceDescription),expected.sourceDescriptionSHA256)
  assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 }
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.equal(jobs.nativeCollectionEvidence.sourceCompanyWideScopeComplete,false)
 assert.deepEqual(jobs.nativeCollectionEvidence.failures,[])
})
