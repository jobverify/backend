import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import baselines from './native.scope.json' with {type:'json'}
import {verifyGoogleSitesPublisher} from './publisherChain.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
const captured=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261113/current-declared.json.gz',import.meta.url))))
const packets=new Map(captured.packets.map(row=>[row.url,row]))
for(const row of captured.packets){const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(bytes.length,row.bodyBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.bodySHA256)}
function replay(change=(text)=>text){const calls=[];return{calls,request:async url=>{calls.push(url);const row=packets.get(url);assert.ok(row,'only the captured publisher graph '+url);return change(Buffer.from(row.bodyBase64,'base64').toString('utf8'),url)}}}
test('current 13 November Kidvento controller preserves the typed employer Keka handoff without executing scripts',async()=>{
 const {calls,request}=replay(),result=await verifyGoogleSitesPublisher(request,baselines.$publisher)
 assert.equal(result.nativeShell,'https://kidvento.keka.com/careers');assert.equal(result.websiteJavaScriptExecuted,false)
 assert.equal(calls.length,4)
})
test('current Kidvento controller bytes remain pinned before admitting the native board',async()=>{
 const {request}=replay((body,url)=>url.endsWith('/m=N0NZx')?body+';fetch("https://foreign.example/jobs")':body)
 await assert.rejects(verifyGoogleSitesPublisher(request,baselines.$publisher),/controller bytes changed/)
})
test('current Kidvento publisher cannot bind a foreign Keka employer',async()=>{
 const {request}=replay((body,url)=>url==='https://www.kidvento.com/careers'?body.replaceAll('data-url="https://kidvento.keka.com/careers"','data-url="https://foreign.keka.com/careers"'):body)
 await assert.rejects(verifyGoogleSitesPublisher(request,baselines.$publisher),/embed missing/)
})
test('registered current Kidvento acquisition preserves every original native model and cleanup hold',async()=>{
 const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261113/current-native.json.gz',import.meta.url))))
 let index=0
 const jobs=await createCatalogScraper(getScraperCatalog().find(row=>row.source==='kidvento')).run({fetchImpl:async(url,init)=>{
  const row=current.packets[index++];assert.equal(url,row.requestedUrl);assert.equal(init.method,'GET')
  const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256)
  const response=new Response(bytes,{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.url});return response
 }})
 assert.equal(index,92);assert.equal(jobs.length,14)
 assert.equal(readSourceObservationEvidence(jobs,'kidvento').observedRecordCount,33)
 assert.equal(jobs.nativeCollectionEvidence.sourceNativeRaw.length,33)
 assert.equal(jobs.nativeCollectionEvidence.allNativeDetailProofs.length,33)
 assert.ok(jobs.every(row=>row.sourceScopeComplete===false&&row.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})
test('current Kidvento returns only complete roles and its four complete recent candidates',async()=>{
 const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261113/current-native.json.gz',import.meta.url))))
 let index=0
 const jobs=await createCatalogScraper(getScraperCatalog().find(row=>row.source==='kidvento')).run({fetchImpl:async(url)=>{
  const packet=current.packets[index++];assert.equal(url,packet.requestedUrl)
  const response=new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});return response
 }})
 assert.equal(jobs.length,14)
 assert.ok(jobs.every(row=>row.sourceDetailComplete===true&&row.sourceNativeCriteriaComplete===true))
 const eligible=analyzePublishableJobs(jobs,{now:new Date('2026-11-13T09:00:00Z')})
 assert.deepEqual(eligible.eligibleJobs.map(row=>row.jobId).sort(),['167526','167530','167534','167753'])
 assert.equal(jobs.nativeCollectionEvidence.sourceNativeRaw.length,33)
 assert.equal(jobs.nativeCollectionEvidence.allNativeDetailProofs.length,33)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})
for(const empty of [false,true])test('registered '+(empty?'empty':'foreign-only')+' Kidvento board retains native observations and denies company cleanup',async()=>{
 const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261113/current-native.json.gz',import.meta.url)))),seen=new Map()
 const jobs=await createCatalogScraper(getScraperCatalog().find(row=>row.source==='kidvento')).run({fetchImpl:async(url)=>{
  const visit=seen.get(url)||0;seen.set(url,visit+1);const packet=current.packets.filter(row=>row.requestedUrl===url)[visit];assert.ok(packet)
  let bytes=Buffer.from(packet.bodyBase64,'base64')
  if(url.includes('/api/jobs/default/active')||url.includes('/api/embedjobs/default/active/')){
   const original=JSON.parse(bytes);if(!empty)for(const row of original)for(const location of row.jobLocations){location.countryCode='GB';location.countryName='United Kingdom'}
   bytes=Buffer.from(JSON.stringify(empty?[]:original))
  }
  const response=new Response(bytes,{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});return response
 }})
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.sourceNativeRaw.length,empty?0:33)
 assert.equal(readSourceObservationEvidence(jobs,'kidvento').sourceScopeComplete,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})
for(const mode of ['raw-text','offscreen','negative-margin','transparent-color'])test('Kidvento retains but does not fully qualify '+mode+' native criteria',async()=>{
 const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261113/current-native.json.gz',import.meta.url))))
 let index=0
 const jobs=await createCatalogScraper(getScraperCatalog().find(row=>row.source==='kidvento')).run({fetchImpl:async(url)=>{
  const packet=current.packets[index++];assert.equal(url,packet.requestedUrl);let bytes=Buffer.from(packet.bodyBase64,'base64')
  if(url.includes('/api/jobs/default/active')||url.includes('/api/embedjobs/default/active/')){
   const raw=JSON.parse(bytes),row=raw.find(row=>row.id===167753)
   if(mode==='raw-text')row.description+='<script type="application/json">Mandatory security clearance.</script>'
   else{const style=mode==='offscreen'?'position:fixed;left:-9999px':mode==='negative-margin'?'margin-left:-9999px':'color:transparent';row.description='<div style="'+style+'">'+row.description+'</div>'}
   bytes=Buffer.from(JSON.stringify(raw))
  }
  const response=new Response(bytes,{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});return response
 }})
 assert.equal(jobs.some(row=>row.jobId==='167753'),false)
 const proof=jobs.nativeCollectionEvidence.allNativeDetailProofs.find(row=>row.id==='167753')
 assert.equal(proof.complete,false);assert.equal(proof.criteriaComplete,false)
 assert.equal(typeof proof.openingHtml,'string');assert.equal(typeof proof.closingHtml,'string')
 assert.equal(jobs.nativeCollectionEvidence.sourceNativeRaw.length,33)
})
