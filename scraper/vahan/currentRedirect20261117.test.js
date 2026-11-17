import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-redirect-20261117.json.gz',import.meta.url))))
const HOME='https://www.vahan.co/',CURRENT='https://www.vahan.ai/'

test('Vahan follows its actual exact permanent corporate migration to the employer-declared current careers assets',async()=>{
 const reachedCurrentAssets=Object.freeze({declaredCurrentCareersAssets:true})
 let index=0
 await assert.rejects(run({fetchImpl:async(url,init)=>{
  assert.equal(init.redirect,'manual');assert.equal(init.method,'GET')
  if(index===fixture.requests.length){assert.equal(url,CURRENT+'_astro/styles.DCxPlcQy.css');throw reachedCurrentAssets}
  const packet=fixture.requests[index++]
  assert.equal(url,packet.requestedURL)
  return Object.defineProperty(new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
 }}),error=>error===reachedCurrentAssets)
 assert.equal(index,3)
})

for(const destination of ['https://other.example/','https://www.vahan.ai/jobs/','http://www.vahan.ai/',CURRENT+'?changed=1'])test('Vahan rejects an unreviewed corporate redirect '+destination,async()=>{
 let calls=0
 await assert.rejects(run({fetchImpl:async url=>{
  calls++;assert.equal(url,HOME)
  return Object.defineProperty(new Response('',{status:301,headers:{location:destination}}),'url',{value:HOME})
 }}),/Vahan|vahan|redirect|identity|authority/)
 assert.equal(calls,1)
})

const native=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url))))
function replay(change=(_packet,value)=>value){
 const calls=[],counts=new Map()
 return {calls,fetchImpl:async(url,init)=>{
  assert.equal(init.redirect,'manual');assert.equal(init.method,'GET')
  const count=counts.get(url)??0;counts.set(url,count+1)
  const packet=native.requests.filter(row=>row.requestedURL===url)[count]
  assert.ok(packet,'No unrecorded native public URL '+url);calls.push(url)
  assert.ok(!new URL(url).pathname.startsWith('/jobs/'),'Customer marketplace grants no employer vacancy authority')
  const value=change(packet,{body:Buffer.from(packet.bodyBase64,'base64'),status:packet.status,headers:packet.headers,url:packet.url},count)
  return Object.defineProperty(new Response(value.body,{status:value.status,headers:value.headers}),'url',{value:value.url})
 }}
}

test('Vahan current81 originals reconcile28 complete native India employer roles on the declared new domain',async()=>{
 const io=replay(),jobs=await run({...io,now:()=>native.completedAt})
 assert.equal(io.calls.length,81)
 assert.equal(jobs.length,28)
 assert.ok(jobs.every(job=>job.companyDomain==='vahan.ai'&&job.sourceUrl.startsWith(CURRENT+'careers/')&&job.companyCareerPage===CURRENT+'careers/'))
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.sourceScopeComplete===false))
 assert.equal(jobs.nativeCollectionEvidence.closingStable,true)
 assert.equal(readSourceObservationEvidence(jobs,'vahan').observedVacancyCount,28)
 assert.equal(readInventoryEvidence(jobs).surface,CURRENT+'careers/')
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(jobs.nativeCollectionEvidence.responses.filter(row=>row.status===301).length,2)
})

test('Vahan requires the same exact permanent domain migration at closing',async()=>{
 const io=replay((packet,value,count)=>packet.requestedURL===HOME&&count===1?{...value,status:200}:value)
 await assert.rejects(run(io),/corporate redirect changed during closing/)
})

test('Vahan current domain cannot change the legal employer or own-role canonical authority',async()=>{
 for(const mode of ['employer','canonical']){
  const io=replay((packet,value)=>{
   if(mode==='employer'&&packet.requestedURL===CURRENT)return {...value,body:value.body.toString().replaceAll('Vahan Technologies India Pvt. Ltd.','Other Employer Pvt. Ltd.')}
   if(mode==='canonical'&&packet.requestedURL===CURRENT+'careers/business-development-manager-lucknow/')return {...value,body:value.body.toString().replace('rel="canonical" href="https://www.vahan.ai/','rel="canonical" href="https://other.example/')}
   return value
  })
  await assert.rejects(run(io),/employer identity|canonical URL identity/)
 }
})
