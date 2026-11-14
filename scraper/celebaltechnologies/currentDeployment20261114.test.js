import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261114/current-native.json.gz',import.meta.url))))
const provider=getScraperCatalog().find(row=>row.source==='celebaltechnologies')
const CLIENT='https://celebaltech.com/_next/static/chunks/pages/careers/%5Bid%5D-858fd4956ec3f8d0.js'
const ROLE='https://celebaltech.com/careers/website-owner'
const API='https://celebal-connect-backend-prod-c2d0ghayhbgjhkc6.centralindia-01.azurewebsites.net/api/jobOpenings/'
const run=options=>createCatalogScraper(provider).run(options)
function replay(change=(body)=>body){
 const calls=[],seen=new Map()
 return{calls,options:{now:()=>fixture.capturedAt,fetchText:async(url,options)=>{
  const count=(seen.get(url)||0)+1;seen.set(url,count);calls.push(url)
  const rows=fixture.responses.filter(row=>row.requestedUrl===url)
  assert.ok(rows.length,'Uncaptured native URL '+url)
  // Actual captured HTML/program bodies are reused only for this offline
  // control. The separate final registered capture contains fresh closing reads.
  return change(rows[Math.min(count-1,rows.length-1)].body,url,count,options)
 }}}
}
const apiChange=change=>(body,url)=>{
 if(!url.startsWith(API))return body
 const value=JSON.parse(body)
 for(const row of Array.isArray(value.data)?value.data:[value.data])change(row)
 return JSON.stringify(value)
}

test('actual current client and API response hashes remain intact in the regression fixture',()=>{
 for(const row of fixture.responses)assert.equal(createHash('sha256').update(row.body).digest('hex'),row.sha256)
 const body=fixture.responses.find(row=>row.requestedUrl===CLIENT).body
 for(const text of['/api/jobOpenings/getJob/','encodeURIComponent(T)','value:m.description','value:null==m?void 0:m.responsibilities','value:m.qualifications','value:m.desiredSkills','value:m.goodToHave'])assert.ok(body.includes(text),text)
})

test('registered current Celebal deployment retains six full explicit India roles and all 28 observations',async()=>{
 const io=replay(),jobs=await run(io.options)
 assert.equal(jobs.length,6)
 assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,28)
 assert.equal(jobs.nativeCollectionEvidence.observations.length,28)
 assert.equal(jobs.nativeCollectionEvidence.candidateRoles,22)
 assert.equal(jobs.nativeCollectionEvidence.unknownCountry.length,16)
 assert.equal(jobs.nativeCollectionEvidence.nativeDetailClient.url,CLIENT)
 assert.equal(jobs.nativeCollectionEvidence.nativeDetailClient.plainTextOnly,true)
 for(const job of jobs){
  const original=JSON.parse(fixture.responses.find(row=>row.requestedUrl===API+'getJob/'+job.jobId).body).data
  assert.deepEqual(job.sourceNativeRecord,original)
  assert.equal(job.country,'India');assert.match(job.sourceNativeLocation,/^India \(Jaipur\)/)
  assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  const description=job.jobDescription.replace(/\s+/g,' ')
  for(const part of[original.description,...original.responsibilities,...original.qualifications,...original.desiredSkills,...original.goodToHave])if(part.trim())assert.ok(description.includes(part.replace(/\s+/g,' ').trim()))
  assert.deepEqual(job.requiredSkills,original.skills)
 }
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})

for(const[label,change]of[
 ['whole client body',(body,url)=>url===CLIENT?body+';void 0':body],
 ['unreviewed active client URL',(body,url)=>url===ROLE?body.replaceAll('858fd4956ec3f8d0','ffffffffffffffff'):body],
 ['duplicate client declaration',(body,url)=>url===ROLE?body.replace('</head>','<script src="'+CLIENT+'"></script></head>'):body],
 ...['type="application/json"','nomodule','onload="foreignProgram()"'].map(attribute=>[attribute,(body,url)=>url===ROLE?body.replace(/<script\b([^>]*src="[^"]*858fd4956ec3f8d0\.js"[^>]*)>/,`<script ${attribute} $1>`):body]),
 ['inert client declaration',(body,url)=>url===ROLE?body.replace(/<script\b[^>]*src="[^"]*858fd4956ec3f8d0\.js"[^>]*><\/script>/,'<template>$&</template>'):body],
])test('current declaration rejects '+label+' before any native detail API read',async()=>{
 const io=replay(change)
 await assert.rejects(run(io.options),/handoff|client program|contract/)
 assert.equal(io.calls.some(url=>url.startsWith(API+'getJob/')),false)
})

test('changed closing detail declaration still rejects opening-only roles',async()=>{
 const io=replay((body,url,count)=>url===ROLE&&count===2?body.replaceAll('858fd4956ec3f8d0','337a5d16861cc114'):body)
 await assert.rejects(run(io.options),/closing native detail client handoff/)
})

test('new renderer never infers India from a city-only or foreign role',async()=>{
 const io=replay(apiChange(row=>{if(row.id==='website-owner')row.location='Jaipur, India / London, United Kingdom'}))
 const jobs=await run(io.options)
 assert.equal(jobs.length,5);assert.equal(jobs.some(row=>row.jobId==='website-owner'),false)
 assert.equal(jobs.nativeCollectionEvidence.unknownCountry.length,17)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('unreviewed typed country fields cannot bypass the complete API record contract',async()=>{
 const io=replay(apiChange(row=>{if(row.id==='website-owner')row.country='US'}))
 await assert.rejects(run(io.options),/native field contract changed/)
})

test('current plain-text renderer holds hidden or authored HTML without dropping the native criterion',async()=>{
 const io=replay(apiChange(row=>{if(row.id==='website-owner')row.responsibilities[0]+='<span hidden>Mandatory clearance</span>'}))
 const jobs=await run(io.options)
 assert.equal(jobs.length,5)
 assert.deepEqual(jobs.nativeCollectionEvidence.criteriaHolds,['website-owner'])
 assert.match(jobs.nativeCollectionEvidence.observations.find(row=>row.nativeSourceRecord.id==='website-owner').nativeSourceRecord.responsibilities[0],/Mandatory clearance/)
})

test('closing full native criteria still must equal the opening inventory',async()=>{
 const io=replay((body,url,count)=>{
  if(url!==API+'getAllJobs'||count!==2)return body
  const value=JSON.parse(body);value.data.find(row=>row.id==='website-owner').qualifications.push('New mandatory closing criterion')
  return JSON.stringify(value)
 })
 await assert.rejects(run(io.options),/closing whole native inventory or criteria/)
})

test('current empty inventory cannot certify India absence or cleanup',async()=>{
 const io=replay((body,url)=>url===API+'getAllJobs'?'{"data":[]}':body)
 const jobs=await run(io.options)
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})

test('current requested samples retain all raw observations and scope holds',async()=>{
 const io=replay(),jobs=await run({...io.options,maxJobs:1})
 assert.equal(jobs.length,1);assert.equal(jobs.nativeCollectionEvidence.observations.length,28)
 assert.equal(jobs.nativeCollectionEvidence.requestedSample,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('current deployment preserves cancellation before any native reads',async()=>{
 const controller=new AbortController(),reason=Symbol('caller');controller.abort(reason)
 const io=replay();await assert.rejects(run({...io.options,signal:controller.signal}),error=>error===reason)
 assert.equal(io.calls.length,0)
})

test('current deployment preserves cancellation at the declared client boundary',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'opaque'})
 const io=replay((body,url)=>{if(url===CLIENT)controller.abort(reason);return body})
 await assert.rejects(run({...io.options,signal:controller.signal}),error=>error===reason)
 assert.equal(io.calls.some(url=>url.startsWith(API+'getJob/')),false)
})
