import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test,{mock} from 'node:test'
import {run} from './script.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {createCurrentReader} from './currentRead20261119.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))))
const replay=(change=()=>{})=>{
 const queues=new Map(),calls=[]
 for(const [fixtureIndex,row] of fixture.responses.entries()){if(!queues.has(row.requestedUrl))queues.set(row.requestedUrl,[]);queues.get(row.requestedUrl).push({...row,fixtureIndex})}
 return {calls,fetchImpl:async(url,init)=>{
  const original=queues.get(url)?.shift();assert.ok(original,'Unbound native read '+url)
  const row={...structuredClone(original),body:Buffer.from(original.bodyBase64,'base64').toString('utf8')};change(row,url)
  calls.push({url,phase:row.phase,method:init.method??'GET'})
  return Object.defineProperties(new Response(row.body,{status:row.status,headers:row.headers}),{url:{value:row.url},redirected:{value:row.redirected}})
 }}
}

test('current whole native Mumbai/Thane role alternatives and full closing models recover nine own records',async()=>{
 const io=replay(),network=mock.method(globalThis,'fetch',()=>{throw Error('No uncaptured source reads')})
 try{
  const jobs=await run({fetchImpl:io.fetchImpl,requestIntervalMs:0})
  assert.equal(jobs.length,9)
  assert.ok(jobs.every(job=>job.country==='India'&&job.sourceClosingReconciled))
  assert.ok(jobs.every(job=>job.sourceNativeApplication.boundToRole&&job.backendApplicationActivationVerified===false))
  assert.ok(jobs.every(job=>job.sourceNativeOpeningRoleHTML&&job.sourceNativeClosingRoleHTML))
  assert.equal(jobs.nativeCollectionEvidence.nativeObservedRecords,14)
  assert.equal(jobs.nativeCollectionEvidence.heldRecords.length,5)
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
  assert.equal(io.calls.length,76)
  assert.ok(io.calls.every(call=>call.method==='GET'))
  const assessment=assessSoftFailureAcquisition({source:'cybertechsystemsandsoftware'},jobs)
  assert.equal(assessment.runnerOutcome.success,true)
  assert.equal(assessment.indiaJobs,9)
  assert.equal(assessment.cleanupOptions.replaceExisting,false)
 }finally{network.mock.restore()}
})

const target='https://cybertech.com/job/sap-abap-developer/'
const listing=/^https:\/\/cybertech\.com\/wp-json\/wp\/v2\/job(?:\?page=2)?$/
const editPost=(row,url,edit)=>{
 if(!listing.test(url))return
 const posts=JSON.parse(row.body);for(const post of posts)if(post.id===8662)edit(post)
 row.body=JSON.stringify(posts)
}
const mutated=async change=>run({fetchImpl:replay(change).fetchImpl,requestIntervalMs:0})
const heldTarget=jobs=>{assert.equal(jobs.length,8);assert.ok(!jobs.some(job=>job.jobId==='8662'));assert.ok(jobs.nativeCollectionEvidence.heldRecords.some(row=>row.jobId==='8662'))}

test('a whole native location label containing foreign alternatives is held',async()=>{
 const jobs=await mutated((row,url)=>{if(url.includes('job-location?post=8662')){const terms=JSON.parse(row.body);terms[0].name='Thane / London';row.body=JSON.stringify(terms)}})
 heldTarget(jobs)
})

test('closing role criteria changes hold the affected role',async()=>{
 const jobs=await mutated((row,url)=>{if(url===target&&row.phase==='closing-qualified-role')row.body=row.body.replace('</h1>','</h1><p>Changed closing criteria.</p>')})
 heldTarget(jobs)
})

test('an application hidden URL for another role is held',async()=>{
 const jobs=await mutated((row,url)=>{if(url===target)row.body=row.body.replace(/(name=['"]input_12['"][^>]*value=['"])[^'"]+/, '$1https://cybertech.com/job/another-role/')})
 heldTarget(jobs)
})

test('an unknown closing taxonomy field change is held',async()=>{
 const jobs=await mutated((row,url)=>{if(url.includes('job-location?post=8662')&&row.phase==='closing-qualified-role'){const terms=JSON.parse(row.body);terms[0].newNativeField='changed';row.body=JSON.stringify(terms)}})
 heldTarget(jobs)
})

test('a native type term for another term ID is held even when stable',async()=>{
 const jobs=await mutated((row,url)=>{if(url.includes('job-type?post=8662')){const terms=JSON.parse(row.body);terms[0].id=999;row.body=JSON.stringify(terms)}})
 heldTarget(jobs)
})

test('closing authoritative taxonomy counts must reconcile',async()=>{
 const jobs=await mutated((row,url)=>{if(url.includes('job-location?post=8662')&&row.phase==='closing-qualified-role')row.headers['x-wp-total']='2'})
 heldTarget(jobs)
})

test('contradictory nonempty native API criteria cannot become a partial HTML record',async()=>{
 const jobs=await mutated((row,url)=>editPost(row,url,post=>{post.content.rendered='<p>A different native criteria body.</p>'}))
 heldTarget(jobs)
})

test('valid native India role with missing API criteria remains explicitly partial',async()=>{
 const jobs=await mutated((row,url)=>editPost(row,url,post=>{post.content.rendered=''}))
 assert.equal(jobs.length,9)
 const job=jobs.find(job=>job.jobId==='8662');assert.ok(job);assert.equal(job.sourceDetailComplete,false)
 assert.equal(job.sourceNativeWordPressPost.content.rendered,'');assert.ok(job.sourceNativeOpeningRoleHTML)
})

test('unknown full native closing job model changes are held',async()=>{
 const jobs=await mutated((row,url)=>{if(row.fixtureIndex>=46&&row.fixtureIndex<=47)editPost(row,url,post=>{post.newNativeField='changed'})})
 heldTarget(jobs)
})

for(const [name,addition] of [['foreign country','<p>Work country: United States</p>'],['another employer','<p>Hiring company: Another Employer</p>'],['closed position','<p>This position is now closed.</p>'],['client role','<p>Our client is hiring.</p>'],['new structured location','<script type="application/ld+json">{"@type":"JobPosting","jobLocation":{"addressCountry":"US"}}</script>']]){
 test(name+' cannot inherit own native India taxonomy',async()=>{
  const jobs=await mutated((row,url)=>{if(url===target)row.body=row.body.replace('</h1>','</h1>'+addition)})
  heldTarget(jobs)
 })
}

test('opaque caller abort rejects promptly while the original fetch ignores cancellation',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'opaque abort'});let entered
 const started=new Promise(resolve=>{entered=resolve})
 const pending=run({signal:controller.signal,requestIntervalMs:0,fetchImpl:()=>{entered();return new Promise(()=>{})}})
 await started;controller.abort(reason);await assert.rejects(pending,error=>error===reason)
})

const firstURL='https://cybertech.com/careers/'
const readerOptions=fetchImpl=>({fetchImpl,requestIntervalMs:0})
const response=(body='native',overrides={})=>Object.defineProperties(new Response(body,{headers:{'content-type':'text/html'}}),{url:{value:firstURL},...overrides})
for(const [name,make] of [['foreign response URL',()=>response('native',{url:{value:'https://other.example/careers/'}})],['missing redirect metadata',()=>response('native',{redirected:{value:undefined}})],['redirected response',()=>response('native',{redirected:{value:true}})],['wrong native MIME',()=>Object.defineProperty(new Response('native',{headers:{'content-type':'text/plain'}}),'url',{value:firstURL})]]){
 test('original HTTP reader rejects '+name,async()=>{
  const reader=createCurrentReader(readerOptions(async()=>make()),url=>url===firstURL)
  try{await assert.rejects(reader.read(firstURL))}finally{reader.close()}
 })
}

test('original stream ceiling cancels and releases a noncooperative stream',async()=>{
 let canceled=0,released=0
 const fetchImpl=async()=>({status:200,url:firstURL,redirected:false,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read:async()=>({done:false,value:new Uint8Array(100)}),cancel:()=>{canceled++},releaseLock:()=>{released++}})}})
 const reader=createCurrentReader({...readerOptions(fetchImpl),maxEntityBytes:50},url=>url===firstURL)
 try{await assert.rejects(reader.read(firstURL),/byte ceiling/);assert.equal(canceled,1);assert.equal(released,1)}finally{reader.close()}
})

test('aggregate and request ceilings are enforced before another native fetch',async()=>{
 let requests=0
 const reader=createCurrentReader({...readerOptions(async()=>{requests++;return response('123456')}),maxTotalBytes:10,maxRequests:2},url=>url===firstURL)
 try{await reader.read(firstURL);await assert.rejects(reader.read(firstURL),/byte ceiling/);await assert.rejects(reader.read(firstURL),/excessive/);assert.equal(requests,2)}finally{reader.close()}
})

test('an incomplete current native collection remains unavailable rather than a qualified zero',async()=>{
 await assert.rejects(mutated((row,url)=>{if(listing.test(url))row.headers['x-wp-total']='15'}),/native published collection boundaries/)
})

test('duplicate current native integer IDs cannot be hidden by the native Map',async()=>{
 await assert.rejects(mutated((row,url)=>{if(url==='https://cybertech.com/wp-json/wp/v2/job'){const posts=JSON.parse(row.body);posts[1]=structuredClone(posts[0]);row.body=JSON.stringify(posts)}}),/native published collection boundaries/)
})

test('opaque caller abort cancels and releases a pending stream read',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'opaque pending-stream abort'});let entered,canceled=0,released=0
 const started=new Promise(resolve=>{entered=resolve})
 const reader=createCurrentReader({...readerOptions(async()=>({status:200,url:firstURL,redirected:false,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read:()=>{entered();return new Promise(()=>{})},cancel:()=>{canceled++},releaseLock:()=>{released++}})}})),signal:controller.signal},url=>url===firstURL)
 try{const pending=reader.read(firstURL);await started;controller.abort(reason);await assert.rejects(pending,error=>error===reason);assert.equal(canceled,1);assert.equal(released,1)}finally{reader.close()}
})

test('source deadline bounds a transport that never settles',async()=>{
 await assert.rejects(run({...readerOptions(()=>new Promise(()=>{})),sourceTimeoutMs:25}),error=>error?.name==='TimeoutError')
})
