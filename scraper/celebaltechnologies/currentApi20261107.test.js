import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync}from'node:fs'
import {gunzipSync}from'node:zlib'
import {createCatalogScraper,getScraperCatalog}from'../../scraper-support/providers/index.js'
import {readInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-api-20261107.json.gz',import.meta.url))))
const provider=getScraperCatalog().find(row=>row.source==='celebaltechnologies')
function replay(mutate=()=>{},extra={}){
 const data=structuredClone(fixture);mutate(data);const calls=[],seen=new Map()
 return{calls,options:{now:()=>data.capturedAt,...extra,fetchText:async(url,options)=>{
  calls.push({url,signal:options?.signal});const rows=data.responses.filter(row=>row.requestedUrl===url),index=seen.get(url)||0;seen.set(url,index+1)
  // The historical capture has one role document. This retained-document
  // control exercises the added closing declaration check; live proof is separate.
  if(index===1&&rows.length===1&&url==='https://celebaltech.com/careers/website-owner')return rows[0].body
  assert.ok(rows[index],'unexpected current native read '+url+' #'+index);return rows[index].body
 }}}
}
const listRows=data=>data.responses.filter(row=>row.requestedUrl.endsWith('/getAllJobs'))
const changeJson=(row,mutate)=>{const value=JSON.parse(row.body);mutate(value);row.body=JSON.stringify(value)}
test('registered Celebal source reads the declared live API and full criteria with explicit native India country',async()=>{
 const{options}=replay(),jobs=await createCatalogScraper(provider).run(options)
 assert.equal(jobs.length,6)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete===true&&job.jobDescription.length>300))
 assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.ok(!jobs.some(job=>['data-scientist-fresher','data-engineer-fresher','data-scientist','lorem-ipsum'].includes(job.jobId)))
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs[0].nativeCollectionEvidence.unknownCountry.length,16)
})
test('unreviewed Celebal list and detail clients cannot activate their native API contracts',async()=>{
 for(const part of ['/pages/careers-','/pages/careers/%5Bid%5D-']){
  const{options,calls}=replay(data=>{data.responses.find(row=>row.requestedUrl.includes(part)).body+=';fetch("https://foreign.example/jobs")'})
  await assert.rejects(createCatalogScraper(provider).run(options),/program|client|contract/)
  if(part==='/pages/careers-')assert.equal(calls.some(row=>row.url.endsWith('/getAllJobs')),false)
  else assert.equal(calls.some(row=>row.url.includes('/getJob/')),false)
 }
})
test('an inert Celebal careers script does not establish an active API handoff',async()=>{
 const{options,calls}=replay(data=>{data.responses[0].body=data.responses[0].body.replace(/<script\b[^>]*src="[^"]*\/pages\/careers-[^"]+"[^>]*><\/script>/,'<template>$&</template>')})
 await assert.rejects(createCatalogScraper(provider).run(options),/surface|client|handoff|contract|visible/)
 assert.equal(calls.some(row=>row.url.endsWith('/getAllJobs')),false)
})
test('Celebal rejects duplicate identities and unexpected pagination',async()=>{
 for(const change of [value=>value.data.push(value.data[0]),value=>{value.hasMore=true}]){
  const{options}=replay(data=>changeJson(listRows(data)[0],change))
  await assert.rejects(createCatalogScraper(provider).run(options),/inventory|identity|pagination/)
 }
})

test('Celebal list and detail handoffs require executable modern script declarations',async()=>{
 for(const part of ['/pages/careers-','/pages/careers/%5Bid%5D-'])for(const attribute of ['type="application/json"','type="text/plain"','nomodule','onload="activateForeign()"']){
  const{options,calls}=replay(data=>{for(const row of data.responses)row.body=row.body.replace(/<script\b([^>]*\bsrc="([^"]+)"[^>]*)>/g,(whole,attrs,src)=>src.includes(part)?`<script ${attribute} ${attrs}>`:whole)})
  await assert.rejects(createCatalogScraper(provider).run(options),/surface|client|handoff|contract|visible/)
  if(part==='/pages/careers-')assert.equal(calls.some(row=>row.url.endsWith('/getAllJobs')),false)
  else assert.equal(calls.some(row=>row.url.includes('/getJob/')),false)
 }
})
test('Celebal full detail identity and workplace must match the current active record',async()=>{
 for(const field of ['id','title','location','status']){
  const{options}=replay(data=>changeJson(data.responses.find(row=>row.requestedUrl.endsWith('/getJob/website-owner')),value=>{value.data[field]=field==='location'?'London, United Kingdom':field==='status'?'archive':'different'}))
  await assert.rejects(createCatalogScraper(provider).run(options),/detail|identity|active/)
 }
})
test('Celebal cannot replace full native criteria with a card summary',async()=>{
 const{options}=replay(data=>{
  const shorten=row=>{row.description='A short job summary.';row.responsibilities=[];row.qualifications=[];row.desiredSkills=[];row.goodToHave=[]}
  for(const row of listRows(data))changeJson(row,value=>shorten(value.data.find(row=>row.id==='website-owner')))
  changeJson(data.responses.find(row=>row.requestedUrl.endsWith('/getJob/website-owner')),value=>shorten(value.data))
 })
 const jobs=await createCatalogScraper(provider).run(options)
 assert.equal(jobs.length,5);assert.equal(jobs.some(job=>job.jobId==='website-owner'),false)
 assert.deepEqual(jobs.nativeCollectionEvidence.criteriaHolds,['website-owner'])
})
test('Celebal closing inventory compares full native records, including publication status and criteria',async()=>{
 for(const field of ['status','description']){
  const{options}=replay(data=>changeJson(listRows(data)[1],value=>{value.data.find(row=>row.id==='website-owner')[field]=field==='status'?'archive':'changed current criteria'}))
  await assert.rejects(createCatalogScraper(provider).run(options),/closing|inventory|criteria/)
 }
})
test('Celebal city-only and all-office roles remain withheld without active native India office proof',async()=>{
 const{options}=replay(data=>{for(const row of data.responses.filter(row=>row.requestedUrl.endsWith('/office-locations')))row.body=row.body.replace(/>India<\/h2>/,'>Canada</h2>')})
 const jobs=await createCatalogScraper(provider).run(options)
 assert.ok(jobs.length>0&&jobs.length<20)
 assert.ok(jobs.every(job=>/^India \(Jaipur\)/.test(job.sourceNativeLocation)))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('a Celebal requested sample cannot authorize cleanup or a complete inventory',async()=>{
 const{options}=replay(()=>{},{maxJobs:2}),jobs=await createCatalogScraper(provider).run(options)
 assert.equal(jobs.length,2)
 assert.ok(jobs.every(job=>job.sourceListingComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Celebal cancellation inside an injected native reader stops before another request',async()=>{
 const controller=new AbortController(),reason={cancel:'reader'},calls=[]
 await assert.rejects(createCatalogScraper(provider).run({signal:controller.signal,fetchText:async(url,options)=>{
  calls.push({url,signal:options?.signal});controller.abort(reason);return fixture.responses[0].body
 }}),error=>error===reason)
 assert.equal(calls.length,1)
 assert.equal(calls[0].signal,controller.signal)
})
test('an unexpected native country carrier cannot be silently ignored for a Celebal India role',async()=>{
 const{options}=replay(data=>{
  for(const row of listRows(data))changeJson(row,value=>{value.data.find(row=>row.id==='website-owner').country='Canada'})
  changeJson(data.responses.find(row=>row.requestedUrl.endsWith('/getJob/website-owner')),value=>{value.data.country='Canada'})
 })
 await assert.rejects(createCatalogScraper(provider).run(options),/inventory|country|contract/)
})
test('Celebal retains nonempty native job details along with every criteria section',async()=>{
 const details={department:'Native department',employmentType:'Fixed-term',ctcBand:'Native published compensation'}
 const{options}=replay(data=>{
  for(const row of listRows(data))changeJson(row,value=>{value.data.find(row=>row.id==='website-owner').jobDetails=details})
  changeJson(data.responses.find(row=>row.requestedUrl.endsWith('/getJob/website-owner')),value=>{value.data.jobDetails=details})
 })
 const jobs=await createCatalogScraper(provider).run(options),job=jobs.find(row=>row.jobId==='website-owner')
 assert.match(job.jobDescription,/Native published compensation/)
 assert.equal(job.employmentType,'Fixed-term')
})
