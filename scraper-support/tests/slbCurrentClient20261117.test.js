import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {readSlbSearchConfiguration,slbSearchURL,runCurrentSlbCareers,SLB_CLIENT,SLB_INDEX,SLB_COLLECTION} from '../apiPortal/slbCurrentCareers.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../utils/inventoryEvidence.js'

const current=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-contracts-20261113/slb-current-client-20261117.json.gz',import.meta.url))))
const original=JSON.parse(gunzipSync(readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/slb-current-native-quality.json.gz',import.meta.url))))
const body=url=>{
 const packet=current.requests.find(row=>row.requestedURL===url),bytes=Buffer.from(packet.bodyBase64,'base64')
 assert.equal(packet.status,200);assert.equal(packet.url,url)
 assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256)
 return bytes.toString('utf8')
}
const CURRENT_CLIENT=SLB_CLIENT+'?639304140100000000'
const html=body(SLB_INDEX),client=body(CURRENT_CLIENT)

test('SLB actual current whole client retains exact native source and India query configuration',()=>{
 const config=readSlbSearchConfiguration(html,client),url=new URL(slbSearchURL(config,0))
 assert.equal(config.organizationId,'schlumbergerproduction0cs2zrh7')
 assert.equal(config.source,'ATS_Jobs_Source - Prod')
 assert.equal(config.searchHub,'CoveoJobsHub')
 assert.equal(url.searchParams.get('aq'),'@country=="India"')
 assert.equal(url.searchParams.get('numberOfResults'),'50')
})

test('SLB current original differs only by the exact search-state assignment relocation',()=>{
 const old=original.requests.find(row=>row.requestedURL===SLB_CLIENT).text
 const before='if(t===c)return;const s',after='if(t===c)return;t=c;const s'
 assert.equal(old.split(before).length,2)
 const inserted=old.replace(before,after)
 assert.equal(inserted.split(')),t=c});').length,2)
 assert.equal(inserted.replace(')),t=c});','))});'),client)
 const oldHTML=original.requests.find(row=>row.requestedURL===SLB_INDEX).text
 assert.equal(readSlbSearchConfiguration(oldHTML,old).organizationId,readSlbSearchConfiguration(html,client).organizationId)
})

test('SLB current search program must match its exact declared versioned URL and whole body',()=>{
 const old=original.requests.find(row=>row.requestedURL===SLB_CLIENT).text
 assert.throws(()=>readSlbSearchConfiguration(html,old),/search client/)
 const changed=html.replace('/static/js/js-atomic-job-listing-search.js?639304140100000000','/static/js/js-atomic-job-listing-search.js?unreviewed')
 assert.notEqual(changed,html)
 assert.throws(()=>readSlbSearchConfiguration(changed,client),/search client/)
 const originalScript=/<script\b[^>]*src="\/static\/js\/js-atomic-job-listing-search\.js\?639304140100000000"[^>]*>[\s\S]*?<\/script>/i
 assert.match(html,originalScript)
 assert.throws(()=>readSlbSearchConfiguration(html.replace(originalScript,'<template>$&</template>'),client),/search client/)
})

test('SLB finite whole-client variants reject extra statements and country/source changes',()=>{
 for(const edited of [client+';globalThis.unreviewed=true',client.replace('f-country-job','f-other-country-job'),client.replace('jobSource=document.querySelector("#searchsource")','jobSource=document.querySelector("#other-source")')]){
  assert.notEqual(edited,client)
  assert.throws(()=>readSlbSearchConfiguration(html,edited),/current published search client changed/)
 }
})

const native=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-contracts-20261113/slb-current-native-20261117.json.gz',import.meta.url))))
function replay(edit=(_packet,body)=>body){
 const counts=new Map(),calls=[]
 return {calls,fetchImpl:async(url,init)=>{
  const count=counts.get(url)??0;counts.set(url,count+1)
  assert.equal(init.method??'GET','GET');assert.equal(init.redirect,'manual')
  const packet=native.requests.filter(row=>row.requestedURL===url)[count]
  assert.ok(packet,'Only captured declared original public URLs '+url);calls.push(url)
  const bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256)
  return Object.defineProperty(new Response(edit(packet,bytes.toString('utf8'),count),{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
 }}
}
// Replay original entities without wall-clock waits; live defaults retain pacing.
const provider={source:'slb',companyName:'SLB',countryFilter:'India',companyCareerPage:SLB_INDEX,config:{rateLimit:{minimumIntervalMs:0}}}

test('SLB current51 original reads retain45 own-visible India roles and exact current client provenance under scope holds',async()=>{
 const io=replay(),jobs=await runCurrentSlbCareers({...io,provider,now:()=>native.completedAt})
 assert.equal(io.calls.length,51);assert.equal(jobs.length,45)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.applicationVisited===false&&job.sourceScopeComplete===false))
 assert.ok(jobs.every(job=>job.nativeSourceRecord.nativeAccount.clientURL===CURRENT_CLIENT&&job.nativeSourceRecord.nativeAccount.clientSHA256==='128f5870dd0b12c85e74b640e70e0830461cfe996220c2f6075471f42d2038be'))
 assert.equal(jobs[SLB_COLLECTION].openingNativeCount,45)
 assert.equal(jobs[SLB_COLLECTION].closingNativeCount,45)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('SLB an unreviewed closing client declaration holds prior roles without fetching an unlinked program',async()=>{
 const io=replay((packet,body,count)=>{
  if(packet.requestedURL!==SLB_INDEX||count!==1)return body
  const changed=body.replace('/static/js/js-atomic-job-listing-search.js?639304140100000000','/static/js/js-atomic-job-listing-search.js?unreviewed')
  assert.notEqual(changed,body);return changed
 })
 const jobs=await runCurrentSlbCareers({...io,provider,now:()=>native.completedAt})
 assert.equal(jobs.length,0)
 assert.equal(jobs[SLB_COLLECTION].closingNativeCount,null)
 assert.ok(jobs[SLB_COLLECTION].failures.some(f=>f.stage==='current-native-closing-inventory'&&/client URL changed/.test(f.message)))
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
