import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createCriblScraper} from './native20261107.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const captured=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/render-drift-20261118.json.gz',import.meta.url))))
const NOW='2026-11-18T18:00:00.000Z'
const replay=async({onlyConflict=false,change=()=>{},cancelAtEnd=false}={})=>{
 const packets=structuredClone(captured),controller=new AbortController()
 // A two-role subset of the complete captured native collection is a replay
 // control, not a live inventory total. Both original own models are intact.
 const payload=JSON.parse(packets[2].body)
 payload.jobs=payload.jobs.filter(row=>onlyConflict?row.id===6232798004:[6250219004,6232798004].includes(row.id))
 payload.meta.total=payload.jobs.length;packets[2].body=JSON.stringify(payload);delete packets[2].rawBodyBase64
 change(packets,payload)
 const paths=[...packets.slice(0,3).map(packet=>packet.url),...payload.jobs.flatMap(row=>[
  'https://cribl.io/job-detail/'+row.id,'https://cribl.io/job-detail/'+row.id+'/',
 ])]
 const expected=[...paths,...paths]
 let reads=0
 const jobs=await createCriblScraper().run({now:()=>NOW,rateLimitMs:0,signal:controller.signal,fetchImpl:async(url,init)=>{
  assert.equal(url,expected[reads++]);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual')
  const packet=packets.find(packet=>packet.url===url)
  const body=packet.rawBodyBase64?Buffer.from(packet.rawBodyBase64,'base64'):packet.body
  const response=new Response(body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalURL})
  if(cancelAtEnd&&reads===expected.length)controller.abort(Error('Caller cancelled final native response'))
  return response
 }})
 assert.equal(reads,expected.length)
 return jobs
}

test('Cribl retains an independently matching role while quarantining the exact stale content rendition',async()=>{
 const jobs=await replay()
 assert.deepEqual(jobs.map(job=>job.jobId),['6250219004'])
 assert.equal(jobs[0].country,null)
 const evidence=jobs.nativeCollectionEvidence
 assert.equal(evidence.observedRecordCount,2)
 assert.equal(evidence.ownNativeModels,1)
 const held=evidence.observations.find(row=>row.nativeId==='6232798004')
 assert.equal(held.nativeRenderConflicts.length,2)
 assert.deepEqual(held.nativeRenderConflicts.map(row=>row.phase),['opening','closing'])
 assert.deepEqual(held.nativeRenderConflicts[0].differingFields,['content','updated_at'])
 assert.equal(held.nativeRenderConflicts[0].listingRecord.updated_at,'2026-11-18T11:39:15-05:00')
 assert.equal(held.nativeRenderConflicts[0].ownRecord.updated_at,'2026-11-18T08:29:29-05:00')
 assert.equal(held.nativeRenderConflicts[0].sourceURL,'https://cribl.io/job-detail/6232798004/')
 assert.equal(held.paired,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('Cribl all-rejected renditions remain unknown coverage rather than an authoritative India zero',async()=>{
 const jobs=await replay({onlyConflict:true})
 assert.equal(jobs.length,0)
 assert.equal(jobs.nativeCollectionEvidence.observations.length,1)
 assert.equal(jobs.nativeCollectionEvidence.rejectedNativeRecordCount,1)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('Cribl model title, country, ID or URL identity conflicts still fail the source',async()=>{
 for(const field of ['title','location','id','absolute_url'])await assert.rejects(replay({change:(packets,payload)=>{
  const row=payload.jobs.find(row=>row.id===6232798004)
  if(field==='title')row.title='Unrelated role'
  else if(field==='location')row.location.name='Remote - India'
  else if(field==='id')row.id=99999
  else row.absolute_url='https://unrelated.example/job-detail/?gh_jid=6232798004'
  packets[2].body=JSON.stringify(payload);delete packets[2].rawBodyBase64
 }}),error=>error.code==='CRIBL_NATIVE_PROOF')
})

test('Cribl caller cancellation remains exact while the last rendition is being quarantined',async()=>{
 await assert.rejects(replay({onlyConflict:true,cancelAtEnd:true}),/Caller cancelled final native response/)
})
