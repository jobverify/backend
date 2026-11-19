import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261119.json.gz',import.meta.url))))
const replay=(edit=()=>{})=>{
 const visits=new Map()
 return {requestIntervalMs:0,now:()=>fixture.now,fetchImpl:async(url,init)=>{
  const packet=structuredClone(fixture.responses.find(row=>row.requestedUrl===url))
  assert.ok(packet,'only captured declared employer/native resources '+url)
  assert.equal(init.method,'GET')
  const count=(visits.get(url)??0)+1;visits.set(url,count);edit(packet,count)
  return Object.defineProperty(new Response(packet.text,{status:packet.status,headers:packet.headers}),'url',{value:packet.finalUrl})
 }}
}

test('current Amber coherent main and unchanged Jobs chunk recover nine country-qualified full native roles',async()=>{
 const jobs=await run(replay())
 assert.equal(jobs.length,9)
 assert.equal(readSourceObservationEvidence(jobs,'amberstudent').observedVacancyCount,14)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.sourceClosingQualified
  &&job.nativeSourceRecord.description&&job.nativeClosingRecord))
 assert.equal(jobs.nativeCollectionEvidence.closingFullNativeInventoryMatch,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('Amber finite current tuple rejects a changed main, changed Jobs client and URL/body version mixing',async()=>{
 const old=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261117.json.gz',import.meta.url))))
 const oldMain=Buffer.from(old.responses.find(row=>row.requestedURL.includes('/main.')).bodyBase64,'base64').toString()
 for(const edit of [
  packet=>{if(packet.requestedUrl.includes('/main.'))packet.text+=';unreviewedEmployerOverride()'},
  packet=>{if(packet.requestedUrl.includes('/5004.'))packet.text=packet.text.replaceAll('amberstudent.keka.com','foreign.keka.com')},
  packet=>{if(packet.requestedUrl.includes('/main.'))packet.text=oldMain},
 ])await assert.rejects(run(replay(edit)),/current|profile|handoff|module|tenant/i)
})

test('Amber current closing account or route disagreement cannot return unqualified positive jobs',async()=>{
 for(const edit of [
  (packet,count)=>{if(count===2&&packet.requestedUrl.endsWith('/careerportalinfo')){
   const value=JSON.parse(packet.text);value.careersPortalDomain='foreign.keka.com';packet.text=JSON.stringify(value)
  }},
  (packet,count)=>{if(count===2&&packet.requestedUrl.includes('/main.'))packet.text+=';unreviewedClosingOverride()'},
 ])await assert.rejects(run(replay(edit)),/closing|route|account|profile|current/i)
})

test('Amber reconciles the whole closing native model and never infers a missing India country',async()=>{
 await assert.rejects(run(replay((packet,count)=>{
  if(count===2&&packet.requestedUrl.includes('/active/')){const rows=JSON.parse(packet.text);rows.at(-1).additionalPublicRequirement='mandatory';packet.text=JSON.stringify(rows)}
 })),/closing.*(?:inventory|model)/i)
 const jobs=await run(replay(packet=>{
  if(packet.requestedUrl.includes('/active/')){const rows=JSON.parse(packet.text);const row=rows.find(row=>String(row.id)==='147192');for(const location of row.jobLocations){delete location.countryCode;delete location.countryName}packet.text=JSON.stringify(rows)}
 }))
 assert.equal(jobs.some(job=>job.jobId==='147192'),false)
 assert.ok(jobs.nativeCollectionEvidence.unknownCountryIds.includes('147192'))
 assert.equal(jobs.length,8)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
