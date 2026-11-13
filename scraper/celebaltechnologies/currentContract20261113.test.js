import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261113/current-declared.json.gz',import.meta.url))))
const historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-api-20261107.json.gz',import.meta.url))))
const latest=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261113/latest-deployment.json.gz',import.meta.url))))
const native=new Map(current.packets.map(row=>[row.url,Buffer.from(row.bodyBase64,'base64').toString('utf8')]))
const latestNative=new Map(latest.packets.map(row=>[row.url,Buffer.from(row.bodyBase64,'base64').toString('utf8')]))
for(const row of [...current.packets,...latest.packets]){const body=Buffer.from(row.bodyBase64,'base64');assert.equal(body.length,row.bodyBytes??row.bytes);assert.equal(createHash('sha256').update(body).digest('hex'),row.bodySHA256??row.sha256)}
function replay(useCurrent=true,change=(body)=>body,overlay=new Map()){return{now:()=>current.capturedAt,fetchText:async url=>{
 const body=overlay.get(url)??(useCurrent?native.get(url)??historical.responses.find(row=>row.requestedUrl===url)?.body:historical.responses.find(row=>row.requestedUrl===url)?.body)
 assert.equal(typeof body,'string','retained original current route '+url);return change(body,url)
}}}
const registered=()=>createCatalogScraper(getScraperCatalog().find(row=>row.source==='celebaltechnologies'))
test('current Celebal deployment publishes only six explicit India roles and retains every native observation',async()=>{
 const jobs=await registered().run(replay())
 assert.deepEqual(jobs.map(row=>row.jobId).sort(),['marketing-executive','marketing-specialist','senior-solution-sales-specialist','senior-strategic-content-manager','strategic-content-writer','website-owner'])
 assert.ok(jobs.every(row=>row.sourceDetailComplete&&row.sourceScopeComplete===false&&row.lifecycleCleanupAllowed===false))
 assert.equal(readSourceObservationEvidence(jobs,'celebaltechnologies').observedRecordCount,25)
 assert.equal(jobs.nativeCollectionEvidence.observations.length,25)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 for(const job of jobs){const original=JSON.parse(native.get('https://celebal-connect-backend-prod-c2d0ghayhbgjhkc6.centralindia-01.azurewebsites.net/api/jobOpenings/getJob/'+job.jobId)).data;assert.deepEqual(job.sourceNativeRecord,original)}
})
test('reviewed Celebal deployment cannot infer role country from cities or company offices',async()=>{
 const jobs=await registered().run(replay(false))
 assert.equal(jobs.length,6);assert.ok(jobs.every(row=>row.sourceNativeLocation.startsWith('India (Jaipur)')))
})
test('Celebal preserves partial native observations when an individual authored criterion is hidden',async()=>{
 const jobs=await registered().run(replay(false,(body,url)=>{
  if(!url.includes('/jobOpenings/'))return body
  const payload=JSON.parse(body),rows=Array.isArray(payload.data)?payload.data:[payload.data]
  for(const row of rows)if(row.id==='website-owner')row.responsibilities[0]+='<span hidden>Mandatory clearance.</span>'
  return JSON.stringify(payload)
 }))
 assert.equal(jobs.some(row=>row.jobId==='website-owner'),false)
 assert.equal(jobs.nativeCollectionEvidence.observations.length,24)
})
test('a raw-text script cannot hide a mandatory Celebal criterion from completeness checks',async()=>{
 const jobs=await registered().run(replay(false,(body,url)=>{
  if(!url.includes('/jobOpenings/'))return body
  const payload=JSON.parse(body),rows=Array.isArray(payload.data)?payload.data:[payload.data]
  for(const row of rows)if(row.id==='website-owner')row.responsibilities[0]+='<script type="application/json">Mandatory clearance.</script>'
  return JSON.stringify(payload)
 }))
 assert.equal(jobs.some(row=>row.jobId==='website-owner'),false)
})
for(const attrs of ['style="position:fixed;left:-9999px"','class="unreviewed-hidden-criterion"'])test('Celebal holds an authored criterion with unreviewed markup '+attrs,async()=>{
 const jobs=await registered().run(replay(true,(body,url)=>{
  if(!url.includes('/jobOpenings/'))return body
  const payload=JSON.parse(body),rows=Array.isArray(payload.data)?payload.data:[payload.data]
  for(const row of rows)if(row.id==='website-owner')row.responsibilities[0]='<span '+attrs+'>'+row.responsibilities[0]+'</span>'
  return JSON.stringify(payload)
 }))
 assert.equal(jobs.some(row=>row.jobId==='website-owner'),false)
})
test('Celebal build rotation preserves an unchanged reviewed native program contract',async()=>{
 const jobs=await registered().run(replay(true,body=>body.replaceAll('AmFVTJJWVWMRWrpCou4bP','same-client-new-deployment')))
 assert.equal(jobs.length,6);assert.equal(jobs.nativeCollectionEvidence.observations.length,25)
})
test('latest actual Celebal deployment uses its reviewed new complete text renderer',async()=>{
 const jobs=await registered().run(replay(true,body=>body,latestNative))
 assert.equal(jobs.length,6);assert.equal(jobs.nativeCollectionEvidence.observations.length,25)
 assert.ok(jobs.every(row=>row.sourceDetailComplete&&row.lifecycleCleanupAllowed===false))
})
for(const [deployment,overlay] of [['retained',new Map()],['latest',latestNative]]){
 for(const part of ['/chunks/pages/careers-','/chunks/pages/careers/%5Bid%5D-']){
  test(deployment+' Celebal rejects changed whole native client bytes '+part,async()=>{
   await assert.rejects(registered().run(replay(true,(body,url)=>url.includes(part)?body+';void 0':body,overlay)),/client program contract/)
  })
  test(deployment+' Celebal rejects an unreviewed active declared client URL '+part,async()=>{
   await assert.rejects(registered().run(replay(true,(body,url)=>url==='https://celebaltech.com/careers'||url==='https://celebaltech.com/careers/website-owner'
    ?body.replace(/(\/chunks\/pages\/careers(?:\/\%5Bid\%5D)?)-[a-f0-9]+\.js/g,match=>match.includes(part)?match.replace(/-[a-f0-9]+\.js$/,'-ffffffffffffffff.js'):match):body,overlay)),/publisher surface|handoff|contract/)
  })
 }
 test(deployment+' Celebal rejects a changed closing publisher deployment',async()=>{
  let careerReads=0
  await assert.rejects(registered().run(replay(true,(body,url)=>url==='https://celebaltech.com/careers'&&++careerReads===2
   ?body.replace(/"buildId":"[^"]+"/,'"buildId":"changed-during-acquisition"'):body,overlay)),/closing publisher deployment/)
 })
 test(deployment+' Celebal rejects a changed closing detail declaration',async()=>{
  let roleReads=0
  await assert.rejects(registered().run(replay(true,(body,url)=>url==='https://celebaltech.com/careers/website-owner'&&++roleReads===2
   ?body.replace(/(\/careers\/\%5Bid\%5D)-[a-f0-9]+\.js/g,'$1-ffffffffffffffff.js'):body,overlay)),/detail client handoff/)
 })
}
test('new Celebal text renderer holds authored markup while preserving its original native record',async()=>{
 const jobs=await registered().run(replay(true,(body,url)=>{
  if(!url.includes('/jobOpenings/'))return body
  const payload=JSON.parse(body),rows=Array.isArray(payload.data)?payload.data:[payload.data]
  for(const row of rows)if(row.id==='website-owner')row.responsibilities[0]='<strong>'+row.responsibilities[0]+'</strong>'
  return JSON.stringify(payload)
 },latestNative))
 assert.equal(jobs.length,5);assert.equal(jobs.some(row=>row.jobId==='website-owner'),false)
 assert.match(jobs.nativeCollectionEvidence.observations.find(row=>row.nativeSourceRecord.id==='website-owner').nativeSourceRecord.responsibilities[0],/^<strong>/)
})
for(const empty of [false,true])test('Celebal '+(empty?'empty':'foreign-only')+' native inventory retains unknown company scope and cleanup hold',async()=>{
 const jobs=await registered().run(replay(false,(body,url)=>{
  if(!url.endsWith('/getAllJobs'))return body
  const value=JSON.parse(body);if(empty)value.data=[];else for(const row of value.data)row.location='London, United Kingdom'
  return JSON.stringify(value)
 }))
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observations.length,empty?0:24)
 assert.equal(readSourceObservationEvidence(jobs,'celebaltechnologies').sourceScopeComplete,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})
