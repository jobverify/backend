import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261107/current-chunked-api.json.gz',import.meta.url))))
const provider=getScraperCatalog().find(row=>row.source==='tensorgosoftwarepvtltd')
function replay(mutate=()=>{},extra={}){
 const data=structuredClone(fixture);mutate(data)
 const calls=[],seen=new Map()
 const read=async url=>{
  calls.push(url)
  const rows=data.responses.filter(row=>row.requestedUrl===url),index=seen.get(url)||0
  seen.set(url,index+1)
  assert.ok(rows[index],'unexpected native URL '+url+' #'+index)
  return rows[index].body
 }
 return{calls,options:{now:()=>data.capturedAt,fetchText:read,fetchJson:async url=>JSON.parse(await read(url)),...extra}}
}
const changeJson=(data,index,mutate)=>{const row=data.responses.filter(row=>row.requestedUrl==='https://api.humains.one/api/jobs')[index];const value=JSON.parse(row.body);mutate(value);row.body=JSON.stringify(value)}
test('registered TensorGo source reads its published lazy careers modules and all ten full native details',async()=>{
 const {options}=replay(),jobs=await createCatalogScraper(provider).run(options)
 assert.equal(jobs.length,10)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete===true&&job.jobDescription.length>1000))
 assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).status,'complete-inventory')
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
test('an unknown TensorGo main program cannot activate the public API',async()=>{
 const {options,calls}=replay(data=>{data.responses.find(row=>row.requestedUrl.includes('/main.')).body+=';fetch("https://foreign.example/jobs")'})
 await assert.rejects(createCatalogScraper(provider).run(options),/handoff|program|contract/)
 assert.equal(calls.some(url=>url.startsWith('https://api.humains.one')),false)
})
test('a changed declared TensorGo dependency cannot activate the public API',async()=>{
 const {options,calls}=replay(data=>{data.responses.find(row=>row.requestedUrl.includes('/985.')).body+=';globalThis.moreJobs=true'})
 await assert.rejects(createCatalogScraper(provider).run(options),/handoff|program|contract/)
 assert.equal(calls.some(url=>url.startsWith('https://api.humains.one')),false)
})
test('legacy marker strings cannot bypass the reviewed current TensorGo program',async()=>{
 const {options,calls}=replay(data=>{data.responses.find(row=>row.requestedUrl.includes('/main.')).body+=';get("/api/jobs");get("/api/jobs/".concat(slug));({path:"/careers",other:{path:"/careers/:slug"}});JobPosting;TensorGo;'})
 await assert.rejects(createCatalogScraper(provider).run(options),/handoff|program|contract/)
 assert.equal(calls.some(url=>url.startsWith('https://api.humains.one')),false)
})
test('a renamed main plus legacy marker strings cannot bypass TensorGo program review or closing reads',async()=>{
 const{options,calls}=replay(data=>{
  const main=data.responses.find(row=>row.requestedUrl.includes('/main.'))
  const previous=new URL(main.requestedUrl).pathname,next='/static/js/main.aaaaaaaa.js'
  data.responses[0].body=data.responses[0].body.replace(previous,next)
  main.requestedUrl='https://tensorgo.com'+next;main.url=main.requestedUrl
  main.body+=';get("/api/jobs");get("/api/jobs/".concat(slug));({path:"/careers",other:{path:"/careers/:slug"}});JobPosting;TensorGo;'
 })
 await assert.rejects(createCatalogScraper(provider).run(options),/handoff|program|contract/)
 assert.equal(calls.some(url=>url.startsWith('https://api.humains.one')),false)
})
test('a main program appearing only inside an inert template does not establish the TensorGo handoff',async()=>{
 const {options,calls}=replay(data=>{data.responses[0].body=data.responses[0].body.replace(/<script\b[^>]*src="[^"\s]*\/static\/js\/main\.[^"]+"[^>]*><\/script>/,'<template>$&</template>')})
 await assert.rejects(createCatalogScraper(provider).run(options),/handoff|bundle|program|contract/)
 assert.equal(calls.some(url=>url.startsWith('https://api.humains.one')),false)
})
test('TensorGo closing native inventory drift cannot publish opening-only roles',async()=>{
 const {options}=replay(data=>changeJson(data,1,value=>value.items.pop()))
 await assert.rejects(createCatalogScraper(provider).run(options),/closing|changed|inventory/)
})
test('TensorGo does not substitute its bundled fallback jobs for a missing live API inventory',async()=>{
 const {options}=replay(data=>changeJson(data,0,value=>{value.items=[]}))
 await assert.rejects(createCatalogScraper(provider).run(options),error=>error.failureKind==='upstream_inventory_unavailable')
})
test('TensorGo retains unresolved country scope without inventing India for a remote role',async()=>{
 const {options}=replay(data=>{
  for(const index of [0,1])changeJson(data,index,value=>{value.items[0].locations=['Remote']})
 })
 const jobs=await createCatalogScraper(provider).run(options)
 assert.equal(jobs.length,9)
 assert.ok(jobs.every(job=>job.sourceListingComplete===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('TensorGo rejects detail identity and location changes',async()=>{
 for(const field of ['id','title','locations']){
  const {options}=replay(data=>{const row=data.responses.find(row=>row.requestedUrl.endsWith('/ai-engineer'));const detail=JSON.parse(row.body);detail[field]=field==='locations'?['London']:'different';row.body=JSON.stringify(detail)})
  await assert.rejects(createCatalogScraper(provider).run(options),/mismatched job detail/)
 }
})
test('TensorGo card summaries cannot replace full native criteria',async()=>{
 const {options}=replay(data=>{const row=data.responses.find(row=>row.requestedUrl.endsWith('/ai-engineer'));const detail=JSON.parse(row.body);detail.description=detail.short;row.body=JSON.stringify(detail)})
 await assert.rejects(createCatalogScraper(provider).run(options),/criteria|mismatched job detail/)
})
test('a TensorGo maxJobs sample cannot authorize inventory cleanup',async()=>{
 const {options}=replay(()=>{},{maxJobs:2}),jobs=await createCatalogScraper(provider).run(options)
 assert.equal(jobs.length,2)
 assert.ok(jobs.every(job=>job.sourceListingComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
