import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {extractOpenings,extractApplyEmail,hasOfficialCareersSignal,run,CAREERS_PAGE_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {buildScrapers} from '../../scraper-support/providers/index.js'
import {isIndiaJob} from '../../scraper-support/utils/indiaLocationFilter.js'

const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current20261110.json.gz',import.meta.url))))
const body=Buffer.from(packet.rawBodyBase64,'base64')
assert.equal(body.length,packet.bodyBytes)
assert.equal(createHash('sha256').update(body).digest('hex'),packet.bodySHA256)
const html=body.toString('utf8')
const page=value=>({status:packet.status,url:packet.finalUrl,headers:packet.headers,html:value})

test('Innovision genuine metadata lists five roles but only Pan India supplies an explicit country',()=>{
 const jobs=extractOpenings(html)
 assert.equal(jobs.length,5)
 assert.equal(jobs.filter(job=>job.country==='India').length,1)
 assert.equal(jobs.find(job=>job.country==='India').title,'Facility Manager')
 assert.equal(jobs.find(job=>job.title==='Security Supervisor').department,'Operations')
 assert.equal(jobs.find(job=>job.title==='Security Supervisor').employmentType,'Full-time')
 for(const job of jobs.filter(job=>job.title!=='Facility Manager')){
  assert.equal(job.country,null)
  assert.ok(!job.location.endsWith(', India'))
 }
 assert.ok(jobs.every(job=>job.jobDescription===null))
 assert.ok(jobs.every(job=>job.requisitionId===null))
})
test('Innovision metadata-only native rows remain incomplete with all five observations retained',async()=>{
 const jobs=await run({fetchPage:async()=>page(html)})
 assert.equal(jobs.length,5)
 assert.ok(jobs.every(job=>job.sourceDetailComplete===false&&job.sourceListingComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.equal(readSourceObservationEvidence(jobs,'innovision').observedVacancyCount,5)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})
// Synthetic visibility/foreign/limit controls below mutate the genuine body.
for(const [label,open,close] of [['hidden','<div hidden>','</div>'],['template','<template>','</template>'],['inert','<div inert>','</div>'],['aria-hidden','<div aria-hidden="true">','</div>'],['display-none','<div style="display:none">','</div>']]){
 test('Innovision inactive '+label+' source cannot supply publisher or role evidence',()=>{
  assert.equal(hasOfficialCareersSignal(page(open+html+close)),false)
  assert.throws(()=>extractOpenings(open+html+close),/verified|careers|native/i)
  assert.equal(extractApplyEmail(open+html+close),null)
 })
}
test('Innovision a hidden country label cannot override the visible unresolved worksite',()=>{
 const changed=html.replace('Pan India','<span hidden>Pan India</span>Multiple Locations')
 assert.equal(extractOpenings(changed).find(job=>job.title==='Facility Manager').country,null)
})
test('Innovision explicit foreign location remains foreign rather than appending India',()=>{
 const changed=html.replace('Pan India','Toronto, Canada')
 const job=extractOpenings(changed).find(job=>job.title==='Facility Manager')
 assert.equal(job.country,'Canada')
 assert.equal(job.location,'Toronto, Canada')
})
test('Innovision unrelated contact email cannot replace the own published resume handoff',()=>{
 const changed=html.replaceAll('mailto:careers@innovision.co.in','mailto:investors@innovision.co.in')
 assert.equal(extractApplyEmail(changed),null)
 assert.throws(()=>extractOpenings(changed),/email|careers|handoff/i)
})
test('Innovision zero result limit retains observed rows and forbids inventory completeness',async()=>{
 const jobs=await run({fetchPage:async()=>page(html),maxJobs:0})
 assert.equal(jobs.length,0)
 assert.equal(readSourceObservationEvidence(jobs,'innovision').observedVacancyCount,5)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Innovision registered wrapper preserves unknown country through the public India filter',async()=>{
 const scraper=buildScrapers().find(scraper=>scraper.name==='innovision')
 const jobs=await scraper.run({fetchPage:async()=>page(html)})
 assert.equal(jobs.filter(isIndiaJob).length,1)
 assert.ok(jobs.filter(job=>job.country===null).every(job=>job.sourceCountryScopeUnresolved===true))
})
for(const location of ['Toronto, Canada, India','Toronto (Canada), India','Toronto - Canada, India']){
 test('Innovision conflicting own written countries cannot supply India: '+location,()=>{
  assert.equal(extractOpenings(html.replace('Pan India',location)).find(job=>job.title==='Facility Manager').country,null)
 })
}
test('Innovision quoted country text cannot supply the active worksite',()=>{
 const changed=html.replace('Pan India','<blockquote>Pan India</blockquote>Multiple Locations')
 assert.equal(extractOpenings(changed).find(job=>job.title==='Facility Manager').country,null)
})
test('Innovision neighboring contact metadata cannot complete an empty native role card',()=>{
 const title=html.indexOf('Security Supervisor</h3>'),start=html.lastIndexOf('<div class="group ',title),headEnd=html.indexOf('</h3>',title)+5,end=html.indexOf('</button></div>',headEnd)+15,card=html.slice(start,end)
 const buttonStart=card.indexOf('<button'),buttonEnd=card.indexOf('</button>')+9,metadataStart=card.indexOf('<div class="flex flex-wrap'),metadataEnd=card.indexOf('</div></div>',metadataStart)+6
 const changed=html.slice(0,start)+html.slice(start,headEnd)+'</div></div><section aria-label="Unrelated contact information">'+card.slice(metadataStart,metadataEnd)+card.slice(buttonStart,buttonEnd)+'</section>'+html.slice(end)
 assert.throws(()=>extractOpenings(changed),/card|shape|native|openings/i)
})
test('Innovision exact caller cancellation survives an uncooperative legacy reader',async()=>{
 const controller=new AbortController(),reason=new Error('Innovision controlled caller stop')
 let timer
 try{
  const result=await Promise.race([run({signal:controller.signal,fetchPage:()=>{controller.abort(reason);return new Promise(()=>{})}}).then(()=>null,error=>error),new Promise(resolve=>{timer=setTimeout(()=>resolve('cancellation missing'),250)})])
  assert.equal(result,reason)
 }finally{clearTimeout(timer)}
})
test('Innovision source deadline bounds an uncooperative legacy reader',async()=>{
 let timer
 try{
  const result=await Promise.race([run({sourceTimeoutMs:5,fetchPage:()=>new Promise(()=>{})}).then(()=>null,error=>error),new Promise(resolve=>{timer=setTimeout(()=>resolve('deadline missing'),250)})])
  assert.equal(result?.name,'TimeoutError')
 }finally{clearTimeout(timer)}
})
for(const kind of ['request','source']){
 test('Innovision elapsed '+kind+' deadline rejects a synchronously stalled reader',async()=>{
  await assert.rejects(run({sourceTimeoutMs:kind==='source'?5:1000,requestTimeoutMs:kind==='request'?5:1000,
   fetchPage:()=>{const start=performance.now();while(performance.now()-start<20){ /* Simulate a stalled synchronous producer. */ }return page(html)}}),{name:'TimeoutError'})
 })
}
for(const maxJobs of [-1,1.5,'2',NaN]){
 test('Innovision rejects invalid result limit '+String(maxJobs),async()=>{
  await assert.rejects(run({maxJobs,fetchPage:async()=>page(html)}),RangeError)
 })
}
test('Innovision retained native source URL stays the current own careers page',()=>{
 assert.equal(packet.url,CAREERS_PAGE_URL)
 assert.equal(packet.finalUrl,CAREERS_PAGE_URL)
 assert.equal(packet.status,200)
})
