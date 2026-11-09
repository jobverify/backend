import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync}from'node:fs'
import {gunzipSync}from'node:zlib'
import {createCatalogScraper,getScraperCatalog}from'../../scraper-support/providers/index.js'
import {readInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261107/current-native-inventory.json.gz',import.meta.url))))
const provider=getScraperCatalog().find(row=>row.source==='safranengineeringservicesindia')
function replay(mutate=()=>{}){
 const data=structuredClone(fixture);mutate(data);const seen=new Map(),calls=[]
 return{calls,options:{now:()=>data.capturedAt,fetchText:async url=>{
  calls.push(url);const rows=data.responses.filter(row=>row.requestedUrl===url),index=seen.get(url)||0;seen.set(url,index+1)
  assert.ok(rows[index],'unexpected native request '+url+' #'+index);return rows[index].body
 }}}
}
const changeForeign=(data,fn)=>{const row=data.responses.find(row=>row.requestedUrl.includes('_189963.aspx'));row.body=fn(row.body)}
test('registered Safran India source excludes the newly named German affiliate and retains six full India roles',async()=>{
 const{options}=replay(),jobs=await createCatalogScraper(provider).run(options)
 assert.equal(jobs.length,6)
 assert.ok(jobs.every(job=>job.country==='India'&&job.jobDescription.length>700&&job.sourceDetailComplete===true))
 assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Safran foreign affiliate filtering cannot authorize an India role from a different employer',async()=>{
 const{options}=replay(data=>changeForeign(data,body=>body.replace('Europe, Germany','Asia, India')))
 await assert.rejects(createCatalogScraper(provider).run(options),/detail|employer|country/)
})
test('Safran foreign country proof must be active and tied to the same requisition',async()=>{
 for(const modify of [body=>body.replace(/<p id="fldlocation_location_geographicalareacollection">[\s\S]*?<\/p>/,'<template>$&</template>'),body=>body.replace('Ref : 2026-189963.','Ref : 2026-999999.')]){
  const{options}=replay(data=>changeForeign(data,modify))
  await assert.rejects(createCatalogScraper(provider).run(options),/detail|identity|country/)
 }
})
test('Safran cannot publish an India meta summary when all native criteria fields disappear',async()=>{
 const{options}=replay(data=>{const row=data.responses.find(row=>row.requestedUrl.includes('_160766.aspx'));row.body=row.body.replace(/<p id="fldjobdescription_(?:description1|longtext2|description2)">[\s\S]*?<\/p>/g,'')})
 await assert.rejects(createCatalogScraper(provider).run(options),/criteria|detail/)
})
test('Safran role identity cannot borrow another requisition or an inert country field',async()=>{
 for(const modify of [body=>body.replace('Ref : 2025-160766.','Ref : 2025-999999.'),body=>body.replace(/<p id="fldlocation_location_geographicalareacollection">[\s\S]*?<\/p>/,'<template>$&</template>')]){
  const{options}=replay(data=>{const row=data.responses.find(row=>row.requestedUrl.includes('_160766.aspx'));row.body=modify(row.body)})
  await assert.rejects(createCatalogScraper(provider).run(options),/detail|identity|country/)
 }
})
test('Safran opening roles cannot be published after their closing native inventory changes',async()=>{
 const{options}=replay(data=>{const row=data.responses.at(-1);row.body=row.body.replaceAll('Architect - Infrastructure IT','Withdrawn role')})
 await assert.rejects(createCatalogScraper(provider).run(options),/closing native search inventory changed/)
})
test('Safran caller cancellation stops before a public request',async()=>{
 const controller=new AbortController(),reason={stop:'caller'};controller.abort(reason)
 const{options,calls}=replay();options.signal=controller.signal
 await assert.rejects(createCatalogScraper(provider).run(options),error=>error===reason)
 assert.equal(calls.length,0)
})
test('Safran published workplace and role fields come from the bound active detail',async()=>{
 const{options}=replay(data=>{
  const row=data.responses.find(row=>row.requestedUrl.includes('_160766.aspx'))
  row.body=row.body.replace('<body','<template><p id="fldlocation_joblocation">Delhi, NY, United States</p><p id="fldjobdescription_primaryprofile">Foreign department</p><p id="fldjobdescription_contract">Foreign contract</p></template><body')
 })
 const jobs=await createCatalogScraper(provider).run(options),job=jobs.find(job=>job.jobId==='160766')
 assert.equal(job.city,'Bangalore')
 assert.equal(job.location,'Bangalore, India')
 assert.notEqual(job.department,'Foreign department')
 assert.notEqual(job.employmentType,'Foreign contract')
})
