import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {CURRENT_API,CURRENT_BOARD,CURRENT_CAREERS} from '../../scraper/moengage/currentKula.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/moengage-public-kula-20261103.json.gz',import.meta.url))))
const provider=getScraperCatalog().find(row=>row.source==='moengage')
const replay=async({page=value=>value,api=value=>value,maxJobs,signal}={})=>{
 const calls=[];let apiReads=0
 const jobs=await createCatalogScraper(provider).run({maxJobs,signal,fetchPage:async url=>{
  calls.push(url);const row=capture.responses.find(row=>row.url===url);assert.ok(row,`Uncaptured public URL: ${url}`)
  let result=structuredClone(row)
  if(url===CURRENT_API){apiReads++;result.html=JSON.stringify(api(JSON.parse(result.html),apiReads))}
  return page(result)
 }})
 return{jobs,calls}
}

test('registered MoEngage source uses its current public Kula account instead of the removed Trakstar handoff',()=>{
 assert.equal(provider.atsPlatform,'kula-public-careers');assert.equal(provider.adapter,'script')
 assert.ok(provider.modulePath.endsWith('moengage\\script.js')||provider.modulePath.endsWith('moengage/script.js'))
})

test('MoEngage captured public data reconciles 22 India and 15 native foreign roles',async()=>{
 for(const row of capture.responses)assert.equal(createHash('sha256').update(row.html).digest('hex'),row.sha256)
 const{jobs,calls}=await replay();assert.equal(jobs.length,22);assert.equal(calls.length,6)
 for(const job of jobs){assert.equal(job.source,'moengage');assert.equal(job.country,'India');assert.ok(job.jobDescription.length>1000)
  assert.equal(job.lifecycleCleanupAllowed,true);assert.ok(job.sourceUrl.startsWith(CURRENT_BOARD+'/'))}
 const evidence=readInventoryEvidence(jobs);assert.equal(evidence.reportedTotal,37);assert.equal(evidence.firstParty,true)
 assert.equal(evidence.listingComplete,true);assert.equal(evidence.indiaFacetCount,22)
 const audit=jobs[0].nativeCollectionEvidence;assert.equal(audit.closingInventoryMatches,true)
 assert.equal(audit.nonIndiaRoles,15);assert.equal(audit.failures.length,0)
})

test('MoEngage hidden and inert current Kula handoffs cannot bind an employer',async()=>{
 for(const wrap of[link=>`<template>${link}</template>`,link=>`<!--${link}-->`,link=>`<span hidden>${link}</span>`]){
  await assert.rejects(replay({page:row=>row.url!==CURRENT_CAREERS?row:{...row,html:row.html.replace(/<a\b[^>]*href="https:\/\/careers\.kula\.ai\/moengage"[^>]*>[\s\S]*?<\/a>/g,wrap)}}),/active current employer handoff/)
 }
})

test('MoEngage public denial and foreign response URLs remain failures before inventory is observed',async()=>{
 await assert.rejects(replay({page:row=>({...row,status:403})}),error=>error.status===403&&error.failureKind==='blocked_or_access_denied')
 await assert.rejects(replay({page:row=>({...row,url:'https://unrelated.invalid/careers'})}),/public response URL/)
})

test('MoEngage a foreign numeric account or failed native API envelope cannot supply jobs',async()=>{
 await assert.rejects(replay({api:payload=>{payload.data[0].account_id=999999;return payload}}),/foreign account/)
 await assert.rejects(replay({api:payload=>({...payload,status:403})}),/native API error/)
})

test('MoEngage truncated native pagination cannot be reinterpreted as complete inventory',async()=>{
 await assert.rejects(replay({api:payload=>{payload.data.pop();return payload}}),/native page truncated/)
})

test('MoEngage a city and postal value without a native country cannot certify complete India scope',async()=>{
 const{jobs}=await replay({page:row=>({...row,html:row.html.replaceAll('United Arab Emirates','Unknown country')})})
 assert.equal(jobs.length,22);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.ok(jobs[0].nativeCollectionEvidence.failures.length>0)
})

test('MoEngage closing native criteria changes retain explicit incomplete coverage',async()=>{
 const{jobs}=await replay({api:(payload,read)=>{if(read===2)payload.data[0].title+=' changed';return payload}})
 assert.equal(jobs.length,22);assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('MoEngage a cap cannot turn positive native inventory into an authoritative zero',async()=>{
 const{jobs}=await replay({maxJobs:0});assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,37)
})

test('MoEngage a native India role removed at closing is withheld from partial results',async()=>{
 let removedId
 const{jobs}=await replay({api:(payload,read)=>{
  if(read===2){const index=payload.data.findIndex(row=>row.ats_job.offices.some(office=>office.country_code==='IN'))
   removedId=String(payload.data[index].id);payload.data.splice(index,1);payload.meta.count--}
  return payload
 }})
 assert.ok(removedId);assert.equal(jobs.length,21);assert.equal(jobs.some(job=>job.jobId===removedId),false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('MoEngage caller cancellation prevents all public transport',async()=>{
 const reason=Object.freeze({cancelled:true})
 await assert.rejects(replay({signal:AbortSignal.abort(reason)}),error=>error===reason)
})
