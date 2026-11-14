import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261114/current-deployment.json.gz',import.meta.url))))
const provider=getScraperCatalog().find(row=>row.source==='tensorgosoftwarepvtltd')
const API='https://api.humains.one/api/jobs', MAIN='https://tensorgo.com/static/js/main.e95187a2.js'
const sha=body=>createHash('sha256').update(body).digest('hex')
const readFixture=()=>structuredClone(fixture)
function replay(mutate=()=>{}){
 const data=readFixture();mutate(data)
 const calls=[],seen=new Map()
 const read=async url=>{
  calls.push(url)
  const index=seen.get(url)||0;seen.set(url,index+1)
  const row=data.responses.filter(row=>row.requestedUrl===url)[index]
  assert.ok(row,`Unexpected native request ${url} #${index}`)
  return row.body
 }
 return{data,calls,options:{now:()=>data.capturedAt,fetchText:read,fetchJson:async url=>JSON.parse(await read(url))}}
}
const run=options=>createCatalogScraper(provider).run(options)
const changeApi=(data,url,index,change)=>{
 const row=data.responses.filter(row=>row.requestedUrl===url)[index]
 const value=JSON.parse(row.body);change(value);row.body=JSON.stringify(value)
}

// This is evidence of the whole live response, never an executable source of
// sample jobs. All role criteria below come from the current public API.
test('current response fixture preserves hashes and declared role country/employer rendering',()=>{
 assert.equal(fixture.responses.length,20)
 for(const row of fixture.responses)assert.equal(sha(row.body),row.sha256)
 const main=fixture.responses.find(row=>row.requestedUrl===MAIN).body
 assert.match(main,/legalName:"TensorGo Software Private Limited"/)
 assert.match(main,/jobLocation:\(t\.locations\|\|\[\]\)\.map\(e=>\(\{"@type":"Place",address:\{"@type":"PostalAddress",addressLocality:e,addressCountry:"IN"/)
 const renderer=fixture.responses.find(row=>row.requestedUrl.endsWith('/803.76777e33.chunk.js')).body
 assert.ok(renderer.includes('jsonLd:[(0,M.tQ)({job:t,path:a})'))
 assert.ok(renderer.includes('(0,W.jsx)(q,{text:t.description})'))
})

test('registered TensorGo source accepts the reviewed current deployment and all ten full native roles',async()=>{
 const io=replay(),jobs=await run(io.options)
 assert.equal(io.calls.length,20)
 assert.equal(jobs.length,10)
 const details=fixture.responses.filter(row=>row.requestedUrl.startsWith(API+'/')).map(row=>JSON.parse(row.body))
 for(const job of jobs){
  const detail=details.find(row=>row.id===job.jobId)
  assert.equal(job.company,'TensorGo Software Pvt Ltd')
  assert.equal(job.source,'tensorgosoftwarepvtltd')
  assert.equal(job.country,'India')
  assert.equal(job.jobDescription,detail.description.trim())
  assert.ok(job.jobDescription.length>1000)
  assert.equal(job.postingDate,detail.datePosted)
  assert.equal(job.sourceDetailComplete,true)
  assert.equal(job.sourceListingComplete,true)
  assert.equal(job.sourceScopeComplete,false)
  assert.equal(job.lifecycleCleanupAllowed,false)
 }
 assert.equal(readInventoryEvidence(jobs).reportedTotal,10)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,10)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

for(const[label,change]of[
 ['unknown main body',data=>{data.responses.find(row=>row.requestedUrl===MAIN).body+=';globalThis.extraJobs=true'}],
 ['reviewed URL with a mismatched main hash',data=>{
  data.responses[0].body=data.responses[0].body.replaceAll('/static/js/main.e95187a2.js','/static/js/main.dd1b2abe.js')
  data.responses.find(row=>row.requestedUrl===MAIN).requestedUrl='https://tensorgo.com/static/js/main.dd1b2abe.js'
 }],
 ['inert main declaration',data=>{data.responses[0].body=data.responses[0].body.replace(/<script\b[^>]*src="[^"\s]*\/static\/js\/main\.[^"]+"[^>]*><\/script>/,'<template>$&</template>')}],
 ['duplicate active main declaration',data=>{data.responses[0].body=data.responses[0].body.replace('</head>','<script defer src="/static/js/main.e95187a2.js"></script></head>')}],
 ['foreign main declaration',data=>{data.responses[0].body=data.responses[0].body.replaceAll('/static/js/main.e95187a2.js','https://different.invalid/static/js/main.e95187a2.js')}],
 ['changed declared JobPosting country',data=>{data.responses.find(row=>row.requestedUrl===MAIN).body=data.responses.find(row=>row.requestedUrl===MAIN).body.replace('addressCountry:"IN"','addressCountry:"US"')}],
 ['changed declared legal employer',data=>{data.responses.find(row=>row.requestedUrl===MAIN).body=data.responses.find(row=>row.requestedUrl===MAIN).body.replace('legalName:"TensorGo Software Private Limited"','legalName:"Another Employer"')}],
])test(`current deployment rejects ${label} before querying the API`,async()=>{
 const io=replay(change)
 await assert.rejects(run(io.options),/handoff|program|contract|origin/)
 assert.equal(io.calls.some(url=>url.startsWith(API)),false)
})

for(const id of ['375','756','757','985','402','803'])test(`current deployment rejects changed entire dependency ${id} before API access`,async()=>{
 const io=replay(data=>{data.responses.find(row=>row.requestedUrl.includes(`/static/js/${id}.`)).body+=';globalThis.unreviewed=true'})
 await assert.rejects(run(io.options),/handoff|program|contract/)
 assert.equal(io.calls.some(url=>url.startsWith(API)),false)
})

for(const[label,url,index,change]of[
 ['card summary substituted for full criteria',API+'/ai-engineer',0,row=>{row.description=row.short}],
 ['detail workplace contradiction',API+'/ai-engineer',0,row=>{row.locations=['London']}],
 ['detail role identity',API+'/ai-engineer',0,row=>{row.id='different'}],
 ['closing membership change',API,1,row=>{row.items.pop()}],
 ['closing pagination continuation',API,1,row=>{row.nextCursor='more-native-rows'}],
 ['duplicate native identity',API,0,row=>{row.items[1].id=row.items[0].id}],
])test(`current deployment rejects ${label}`,async()=>{
 const io=replay(data=>changeApi(data,url,index,change))
 await assert.rejects(run(io.options),/criteria|mismatched|changed|pagination|duplicate/)
})

test('current native mixed-country workplaces remain held without a false complete inventory',async()=>{
 const io=replay(data=>{for(const index of[0,1])changeApi(data,API,index,row=>{row.items[0].locations=['Hyderabad','London']})})
 const jobs=await run(io.options)
 assert.equal(jobs.length,9)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceListingComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('current empty API never falls back to bundled sample vacancies',async()=>{
 const io=replay(data=>changeApi(data,API,0,row=>{row.items=[]}))
 await assert.rejects(run(io.options),error=>error.code==='TENSORGO_INVENTORY_UNAVAILABLE')
})

test('current profile still holds requested samples outside complete listing scope',async()=>{
 const io=replay(),jobs=await run({...io.options,maxJobs:2})
 assert.equal(jobs.length,2)
 assert.ok(jobs.every(job=>!job.sourceListingComplete&&!job.sourceScopeComplete&&!job.lifecycleCleanupAllowed))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('current profile preserves opaque cancellation before any native read',async()=>{
 const controller=new AbortController(),reason=Symbol('cancelled');controller.abort(reason)
 const io=replay()
 await assert.rejects(run({...io.options,signal:controller.signal}),error=>error===reason)
 assert.equal(io.calls.length,0)
})

test('current profile preserves cancellation at API handoff without detail reads',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'opaque'}),io=replay()
 await assert.rejects(run({...io.options,signal:controller.signal,fetchJson:async url=>{
  controller.abort(reason)
  return io.options.fetchJson(url)
 }}),error=>error===reason)
 assert.equal(io.calls.filter(url=>url.startsWith(API)).length,1)
 assert.equal(io.calls.some(url=>url.startsWith(API+'/')),false)
})
