import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261119/current-native.json.gz',import.meta.url))))
const replay=(edit=()=>{})=>{
 let index=0
 const counts=new Map()
 return {fetchImpl:async(url,init)=>{
  const packet=structuredClone(fixture.responses[index++])
  assert.ok(packet,'only current public publisher/native declared responses')
  assert.equal(url,packet.requestedUrl);assert.equal(init.method,'GET')
  const count=(counts.get(url)??0)+1;counts.set(url,count);edit(packet,count)
  return Object.defineProperty(new Response(packet.text,{status:packet.status,headers:packet.headers}),'url',{value:packet.finalUrl})
 }}
}

test('Kidvento current imported acquisition preserves thirty original vacancies and thirteen fully reconciled India roles',async()=>{
 const jobs=await run(replay()),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,13)
 assert.equal(readSourceObservationEvidence(jobs,'kidvento').observedVacancyCount,30)
 assert.equal(audit.sourceNativeRaw.length,30)
 assert.equal(audit.sourceNativeClosingRaw.length,30)
 assert.equal(audit.allNativeDetailProofs.length,30)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.sourceNativeCriteriaComplete
  &&job.sourceNativeDetailSha256===job.sourceNativeClosingDetailSha256))
 assert.equal(audit.receipts.length,86)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('Kidvento current publisher admission cannot infer countries, hide extra criteria or accept a changed closing role',async()=>{
 for(const kind of ['country','extra-criteria','closing']){
  const jobs=await run(replay((packet,count)=>{
   if(/\/api\/(?:embed)?jobs\/.*active/.test(packet.requestedUrl)&&(kind!=='closing'||count===2)){
    const rows=JSON.parse(packet.text),row=rows.find(row=>String(row.id)==='167753')
    if(kind==='country')for(const place of row.jobLocations){delete place.countryCode;delete place.countryName}
    else if(kind==='extra-criteria')row.mandatoryQualifications='Public additional requirement outside the reviewed schema'
    else row.description+='<p>New mandatory requirement at closing.</p>'
    packet.text=JSON.stringify(rows)
   }
  }))
  assert.equal(jobs.some(job=>job.jobId==='167753'),false,kind)
  assert.ok(jobs.length>0,'independent complete positives remain')
  const proof=jobs.nativeCollectionEvidence.allNativeDetailProofs.find(row=>row.id==='167753')
  assert.equal(proof.complete,false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 }
})
