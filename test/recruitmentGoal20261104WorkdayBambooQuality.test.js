import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {currentNativeQuality,capturedSource,currentNativeTransport,replayCurrentNative} from './helpers/replayCurrentNativeQuality.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import * as utopus from '../scraper/utopusinsights/script.js'
import * as datacore from '../scraper/datacoresystems/script.js'
import {run as runEntegris} from '../scraper/entegris.workday/script.js'

test('four-source regression evidence retains 94 original response bodies with matching hashes',()=>{
 assert.equal(currentNativeQuality.sources.length,4)
 const packets=[...currentNativeQuality.sources.flatMap(s=>s.requests),...currentNativeQuality.relatedDocuments]
 assert.equal(packets.length,94)
 for(const p of packets){assert.equal(p.replayed,false);assert.equal(createHash('sha256').update(p.text).digest('hex'),p.bodySHA256)}
})
test('fresh Dover requests retain production pacing for each native origin',()=>{
 const previous=new Map()
 for(const packet of capturedSource('dovercorporation').requests){
  const origin=new URL(packet.requestedURL).origin,start=Date.parse(packet.startedAt)
  if(previous.has(origin))assert.ok(start-previous.get(origin)>=850,'Public native origin was not paced: '+origin)
  previous.set(origin,start)
 }
})
test('Entegris current registered route preserves the full original India role, employer, dates and closing publisher binding',async()=>{
 const {jobs,transport}=await replayCurrentNative('entegris')
 assert.equal(transport.remaining,0);assert.equal(jobs.length,1)
 const j=jobs[0],v=j.nativeSourceRecord.jobPostingInfo
 assert.equal(j.jobId,'REQ-14920');assert.equal(j.requisitionId,v.jobReqId)
 assert.equal(j.sourceDescription,v.jobDescription)
 assert.equal(j.nativeHiringOrganization.name,'4255 Entegris India Private Ltd.')
 assert.deepEqual(j.nativeHiringOrganization,j.nativeSourceRecord.hiringOrganization)
 assert.equal(j.postingDate,v.startDate);assert.equal(j.postingDatePrecision,'calendar-date');assert.equal(j.firstEverPostedAt,null)
 assert.equal(j.country,'India');assert.equal(v.posted,true);assert.equal(v.canApply,true)
 assert.equal(j.sourceOfficialBinding.currentHandoffRechecked,true)
 assert.equal(j.sourceScopeComplete,false);assert.equal(j.sourceListingComplete,false);assert.equal(j.lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})
for(const[name,change]of[
 ['country',d=>d.jobPostingInfo.country.descriptor='United States of America'],
 ['employer',d=>d.hiringOrganization.name='Unrelated Company'],
 ['active publication',d=>d.jobPostingInfo.posted=false],
 ['application availability',d=>d.jobPostingInfo.canApply=false],
 ['requisition',d=>d.jobPostingInfo.jobReqId='REQ-99999'],
])test('Entegris holds a conflicting native '+name,async()=>{
 await assert.rejects(replayCurrentNative('entegris',p=>{if(p.requestedURL.includes('/job/')){const d=JSON.parse(p.text);change(d);p.text=JSON.stringify(d)}}),/native|scope|country|identity|employer|detail|incomplete|requisition/i)
})
test('decoded Entegris HTML keeps compressed wire metadata and identity-body truncation checks remain active',async()=>{
 const primary=capturedSource('entegris').requests[0]
 assert.equal(primary.headers['content-encoding'],'gzip');assert.notEqual(Number(primary.headers['content-length']),Buffer.byteLength(primary.text))
 await assert.rejects(replayCurrentNative('entegris',p=>{if(p.requestedURL===primary.requestedURL)delete p.headers['content-encoding']}),/Truncated|mismatched/i)
})
test('Entegris closing full-description mismatch is held',async()=>{
 let reads=0
 await assert.rejects(replayCurrentNative('entegris',p=>{if(p.requestedURL.includes('/job/')&&++reads===2){const d=JSON.parse(p.text);d.jobPostingInfo.jobDescription+='<p>Changed native criteria.</p>';p.text=JSON.stringify(d)}}),/description/i)
})

async function withNativeTransport(source,run,mutate,assertion,options={}){
 const transport=currentNativeTransport(source,mutate),prior=globalThis.fetch
 globalThis.fetch=(...args)=>transport.fetch(...args)
 try{await assertion(()=>run({fetchImpl:(...args)=>transport.fetch(...args),requestIntervalMs:0,...options}),transport)}finally{globalThis.fetch=prior}
}
for(const[source,run]of[['entegris',runEntegris],['datacoresystems',datacore.run]])test(source+' current company denial stops before any native-board fallback',async()=>{
 await withNativeTransport(source,run,p=>p.status=403,async(action,t)=>{await assert.rejects(action,/403|HTTP/i);assert.equal(t.consumed,1)})
})
test('Utopus current Duda page envelopes expose the published widget without evaluating their scripts',()=>{
 const c=capturedSource('utopusinsights')
 const first=currentNativeQuality.relatedDocuments.find(p=>p.requestedURL===utopus.CAREERS_URL)
 const second=currentNativeQuality.relatedDocuments.find(p=>p.requestedURL===utopus.OPEN_POSITIONS_URL)
 assert.equal(JSON.parse(first.text).alias,'careers');assert.equal(JSON.parse(second.text).alias,'open-positions')
 assert.equal(utopus.hasOfficialCareersSignal(first.text),true)
 assert.equal(utopus.hasOfficialOpenPositionsSignal(second.text),true)
 assert.equal(utopus.hasOfficialCareersSignal(c.requests[0].text),true)
 assert.equal(utopus.hasOfficialOpenPositionsSignal(c.requests[1].text),true)
 assert.throws(()=>utopus.currentUtopusDocument(first.text,'open-positions'),/identity/i)
 assert.equal(utopus.hasOfficialOpenPositionsSignal('<template><div id="BambooHR" data-domain="utopusinsights.bamboohr.com" data-version="1.0.0"></div><script src="'+utopus.BAMBOOHR_SCRIPT_URL+'"></script></template>'),false)
})
test('Utopus follows its declared JSON widget contract and blank HTTP200 is an unresolved error',async()=>{
 await withNativeTransport('utopusinsights',utopus.run,undefined,async(action,t)=>{
  await assert.rejects(action,e=>e.recruitmentObservations?.failures[0]?.failureKind==='empty-native-json-response')
  assert.equal(t.consumed,4);assert.equal(t.calls.at(-1).url,utopus.BAMBOOHR_EMBED_URL)
  assert.ok(t.calls.at(-1).url.endsWith('&format=json'))
 })
 assert.equal(utopus.hasEmptyOpeningsSignal(''),false)
 assert.equal(utopus.hasEmptyOpeningsSignal('{"departments":[],"labels":{},"error":"unavailable"}'),false)
 assert.equal(utopus.hasEmptyOpeningsSignal('{"departments":[],"labels":{},"success":false}'),false)
 assert.equal(utopus.hasEmptyOpeningsSignal('{"departments":[],"labels":{}}'),true)
})
test('a changed Utopus widget client stops before querying an unreviewed response contract',async()=>{
 await withNativeTransport('utopusinsights',utopus.run,p=>{if(p.requestedURL===utopus.BAMBOOHR_SCRIPT_URL)p.text+='/*changed*/'},async(action,t)=>{
  await assert.rejects(action,/client changed/i);assert.equal(t.consumed,3)
 })
})
test('Data-Core does not publish LCA notices as vacancies or infer country from city/state defaults',()=>{
 const rows=[{id:665,jobOpeningName:'LCA Notices 2026',location:{city:'Bristol',state:'Pennsylvania'}},
  {id:720,jobOpeningName:'Senior Healthcare Sales Professional',location:{city:'Salt Lake City',state:'Kolkata'}},
  {id:721,jobOpeningName:'Functional Lead',location:{countryCode:'US',country:'India',city:'New York'}}]
 const jobs=datacore.extractJobs({result:rows,meta:{totalCount:3}})
 assert.deepEqual(jobs.map(j=>j.jobId),['720','721'])
 for(const j of jobs){assert.equal(j.country,null);assert.equal(j.city,null);assert.equal(j.location,null);assert.equal(j.sourceDetailComplete,false);assert.equal(j.requisitionId,null)}
 assert.equal(jobs[0].nativeSourceRecord.location.state,'Kolkata')
 assert.throws(()=>datacore.extractJobs({result:rows,meta:{totalCount:4}}),/truncated/i)
})
for(const[source,run]of[['utopusinsights',utopus.run],['datacoresystems',datacore.run]])test(source+' caps and caller cancellation cause no public reads',async()=>{
 await withNativeTransport(source,run,undefined,async(action,t)=>{const jobs=await action();assert.equal(t.consumed,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')},{maxJobs:0})
 await withNativeTransport(source,run,undefined,async(action,t)=>{await assert.rejects(action,/caller cancelled/);assert.equal(t.consumed,0)},{signal:AbortSignal.abort(Error('caller cancelled'))})
})
