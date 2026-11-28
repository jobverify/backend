import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'

import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {resolveJobsChunkUrl,run,CAREERS_URL,JOB_OPENING_URL,KEKA_INFO_URL,KEKA_JOBS_URL} from './script.js'
import {resolveNestedJobsChunkUrl} from './declaredJobsChunk.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261128.json.gz',import.meta.url))))
const current=fixture.responses
const retained=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261120.json.gz',import.meta.url))))
const main=current[2],bridge=current[3],client=current[4]
const oldMain=retained.responses.find(row=>row.requestedUrl.includes('/main.'))
const provider=()=>getScraperCatalog().find(row=>row.source==='amberstudent')
const response=packet=>Object.defineProperty(new Response(packet.text,{status:packet.status,headers:packet.headers}),'url',{value:packet.finalUrl})
function replay(change=()=>{},{stopAtAccount=false,aliases={}}={}){
 const calls=[],visits=new Map(),boundary=new Error('Unacquired current native account boundary')
 return {calls,visits,boundary,run:()=>run({requestIntervalMs:0,now:()=>retained.now,fetchImpl:async(url,init)=>{
  assert.equal(init.method,'GET')
  calls.push(url)
  const visit=(visits.get(url)??0)+1;visits.set(url,visit)
  if(stopAtAccount&&url===KEKA_INFO_URL)throw boundary
  const original=aliases[url]??current.find(row=>row.requestedUrl===url)??retained.responses.find(row=>row.requestedUrl===url)
  assert.ok(original,'Only current declared prefix or explicitly retained native controls: '+url)
  const packet=structuredClone(original);change(packet,url,visit)
  return response(packet)
 }})}
}

test('Amber five genuine current corporate/program originals retain complete hashes and unchanged bridge/client bodies',()=>{
 assert.equal(fixture.source,'amberstudent');assert.equal(current.length,5)
 for(const packet of current){
  assert.equal(packet.method,'GET');assert.equal(packet.status,200);assert.equal(packet.finalUrl,packet.requestedUrl)
  assert.equal(packet.bodyOriginalUnmodified,true)
  assert.equal(createHash('sha256').update(packet.text).digest('hex'),packet.sha256)
 }
 assert.equal(Buffer.byteLength(main.text),946023)
 assert.equal(main.sha256,'525d818dc4d718bb940f2033781c9d651fb89dc7994a6a25db8fd181a6fb6b59')
 assert.equal(bridge.text,retained.responses.find(row=>row.requestedUrl===bridge.requestedUrl).text)
 assert.equal(client.text,retained.responses.find(row=>row.requestedUrl===client.requestedUrl).text)
})

test('Amber actual current lexical route resolves the exact bridge and its exported nested native Jobs client',()=>{
 assert.equal(resolveJobsChunkUrl(main.text),bridge.requestedUrl)
 assert.equal(resolveNestedJobsChunkUrl(main.text,bridge.text),client.requestedUrl)
})

test('Amber genuine current prefix reaches the native account boundary without inventing current native inventory',async()=>{
 const r=replay(()=>{},{stopAtAccount:true})
 await assert.rejects(r.run(),error=>error===r.boundary)
 assert.deepEqual(r.calls,[...current.map(row=>row.requestedUrl),KEKA_INFO_URL])
})

test('Amber current program tuple with explicitly retained native controls preserves full raw criteria and partial company scope',async()=>{
 // The account/roles remain genuine November20 compatibility controls here.
 // They do not stand in for a current live native account or inventory.
 const r=replay(),jobs=await r.run(),observation=readSourceObservationEvidence(jobs,'amberstudent')
 assert.ok(jobs.some(row=>row.jobId==='147192'&&row.country==='India'))
 assert.equal(observation.observedRecordCount,15)
 assert.equal(observation.companyGlobalTotal,null);assert.equal(observation.companyIndiaTotal,null)
 assert.equal(observation.sourceScopeComplete,false)
 assert.ok(jobs.every(row=>row.country==='India'&&row.sourceDetailComplete&&row.sourceClosingQualified
  &&row.sourceScopeComplete===false&&row.lifecycleCleanupAllowed===false
  &&row.nativeSourceRecord.description===row.sourceRawDescription
  &&row.nativeSourceRecord.publishedOn===row.postingDate))
 assert.ok(jobs.every(row=>row.sourceNativeContract.mainURL===main.requestedUrl
  &&row.sourceNativeContract.mainSHA256===main.sha256&&row.sourceNativeContract.browserEquivalenceComplete===false))
 assert.equal(jobs.nativeCollectionEvidence.closingFullNativeInventoryMatch,true)
 assert.deepEqual(jobs.nativeCollectionEvidence.nativeOpeningInventory,jobs.nativeCollectionEvidence.nativeClosingInventory)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessment=assessSoftFailureAcquisition(provider(),jobs)
 assert.equal(assessment.indiaJobs,jobs.length);assert.deepEqual(assessment.cleanupOptions,{replaceExisting:false})
 assert.equal(assessment.inventoryEvidence.listingComplete,false)
})

for(const[name,alter]of[
 ['unreviewed full main bytes',()=>main.text+';/* unreviewed current main */'],
 ['a prior reviewed main body under the current main URL',()=>oldMain.text],
])test('Amber rejects '+name+' before any native account read',async()=>{
 const r=replay((packet,url)=>{if(url===main.requestedUrl)packet.text=alter()})
 await assert.rejects(r.run(),/module tuple profile changed/)
 assert.equal(r.calls.includes(KEKA_INFO_URL),false)
})

test('Amber current main body under an unreviewed declared URL cannot borrow another tuple',async()=>{
 const unknown=main.requestedUrl.replace('094c4dab3df8b5f1','1234567890abcdef')
 const r=replay((packet,url)=>{if(url===JOB_OPENING_URL)packet.text=packet.text.replaceAll(main.requestedUrl,unknown)},
  {aliases:{[unknown]:{...main,requestedUrl:unknown,finalUrl:unknown}}})
 await assert.rejects(r.run(),/module tuple profile changed/)
 assert.equal(r.calls.includes(unknown),true);assert.equal(r.calls.includes(KEKA_INFO_URL),false)
})

for(const[name,url,alter]of[
 ['bridge resolve/import disagreement',bridge.requestedUrl,text=>text.replace('resolve:()=>34905','resolve:()=>34906')],
 ['changed complete native Jobs client',client.requestedUrl,text=>text+';/* unreviewed Jobs executable */'],
 ['main resolve/import disagreement',main.requestedUrl,text=>text.replace('resolve:()=>20923','resolve:()=>20924')],
])test('Amber '+name+' remains rejected before native data reads',async()=>{
 const r=replay((packet,request)=>{if(request===url){const changed=alter(packet.text);assert.notEqual(changed,packet.text);packet.text=changed}})
 await assert.rejects(r.run(),/route|module|loader|profile|tenant/i)
 assert.equal(r.calls.includes(KEKA_INFO_URL),false)
})

test('Amber new tuple cannot infer India when the complete native role has no country',async()=>{
 const r=replay((packet,url)=>{if(url===KEKA_JOBS_URL){const rows=JSON.parse(packet.text),row=rows.find(row=>String(row.id)==='147192');
  for(const place of row.jobLocations){delete place.countryCode;delete place.countryName}packet.text=JSON.stringify(rows)}})
 const jobs=await r.run(),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.some(row=>row.jobId==='147192'),false);assert.ok(audit.unknownCountryIds.includes('147192'))
 const raw=audit.nativeOpeningInventory.find(row=>String(row.id)==='147192')
 assert.ok(raw.description.length>0);assert.deepEqual(raw,audit.nativeClosingInventory.find(row=>String(row.id)==='147192'))
 assert.equal(readSourceObservationEvidence(jobs,'amberstudent').observedRecordCount,15)
 assert.equal(assessSoftFailureAcquisition(provider(),jobs).indiaJobs,jobs.length)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('Amber new tuple cannot resolve conflicting native role country alternatives as India',async()=>{
 const r=replay((packet,url)=>{if(url===KEKA_JOBS_URL){const rows=JSON.parse(packet.text),row=rows.find(row=>String(row.id)==='147192');
  for(const place of row.jobLocations){place.countryCode='IN';place.countryName='United States'}packet.text=JSON.stringify(rows)}})
 const jobs=await r.run()
 assert.equal(jobs.some(row=>row.jobId==='147192'),false);assert.ok(jobs.nativeCollectionEvidence.countryConflictIds.includes('147192'))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('Amber current program cannot authorize a foreign native account',async()=>{
 const r=replay((packet,url)=>{if(url===KEKA_INFO_URL){const value=JSON.parse(packet.text);value.careersPortalDomain='foreign.keka.com';packet.text=JSON.stringify(value)}})
 await assert.rejects(r.run(),/Keka tenant identity is unverified/)
 assert.equal(r.calls.includes(KEKA_JOBS_URL),false)
})

test('Amber whole closing native criteria extension prevents opening positives from returning',async()=>{
 const r=replay((packet,url,visit)=>{if(url===KEKA_JOBS_URL&&visit===2){const rows=JSON.parse(packet.text);rows.at(-1).additionalPublicRequirement='mandatory';packet.text=JSON.stringify(rows)}})
 await assert.rejects(r.run(),/closing full native inventory model changed/)
 assert.equal(r.visits.get(KEKA_JOBS_URL),2)
})

test('Amber changed native account at closing cannot return opening positives',async()=>{
 const r=replay((packet,url,visit)=>{if(url===KEKA_INFO_URL&&visit===2){const value=JSON.parse(packet.text);value.careersPortalDomain='foreign.keka.com';packet.text=JSON.stringify(value)}})
 await assert.rejects(r.run(),/account or route changed at closing/)
 assert.equal(r.visits.get(KEKA_INFO_URL),2)
})

test('Amber closing cannot mix the current tuple with an independently reviewed previous main tuple',async()=>{
 const r=replay((packet,url,visit)=>{if(url===JOB_OPENING_URL&&visit===2)packet.text=packet.text.replaceAll(main.requestedUrl,oldMain.requestedUrl)})
 await assert.rejects(r.run(),/account or route changed at closing/)
 assert.equal(r.calls.includes(oldMain.requestedUrl),true)
})

test('Amber current closing main body cannot reuse opening program qualification',async()=>{
 const r=replay((packet,url,visit)=>{if(url===main.requestedUrl&&visit===2)packet.text+=';/* changed closing program */'})
 await assert.rejects(r.run(),/module tuple profile changed/)
 assert.equal(r.visits.get(main.requestedUrl),2)
})

for(const status of[401,403,429])test('Amber current main HTTP '+status+' stops before native account or alternative program reads',async()=>{
 const r=replay((packet,url)=>{if(url===main.requestedUrl)packet.status=status})
 await assert.rejects(r.run(),new RegExp('HTTP '+status))
 assert.deepEqual(r.calls,[CAREERS_URL,JOB_OPENING_URL,main.requestedUrl])
})

test('Amber default registered source reaches the genuine account boundary and preserves exact caller cancellation',async t=>{
 const calls=[],controller=new AbortController(),stop=Object.freeze({unacquiredCurrentAmberAccount:true})
 t.mock.method(globalThis,'fetch',async input=>{
  const url=String(input);calls.push(url)
  if(url===KEKA_INFO_URL){controller.abort(stop);throw stop}
  const packet=current.find(row=>row.requestedUrl===url)
  assert.ok(packet,'No uncaptured alternate source reads: '+url)
  return response(packet)
 })
 await assert.rejects(createCatalogScraper(provider()).run({signal:controller.signal}),error=>error===stop)
 assert.deepEqual(calls,[...current.map(row=>row.requestedUrl),KEKA_INFO_URL])
})
