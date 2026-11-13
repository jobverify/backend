import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {publisher,profileForPublisher,program,loadingContract,profileModuleURL,detail,PRIMARY,API} from './nativeModels.js'
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261113/current-declared.json.gz',import.meta.url))))
const previous=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261111/current-graph-and-native.json.gz',import.meta.url))))
const graph=new Map();for(const row of current.packets){if(!graph.has(row.url))graph.set(row.url,row);const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(bytes.length,row.bodyBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.bodySHA256)}
const text=row=>Buffer.from(row.bodyBase64,'base64').toString('utf8')
function contractFor(useCurrent=true){const p=useCurrent?text(graph.get(PRIMARY)):previous.graphPackets.find(row=>row.url===PRIMARY).text,profile=profileForPublisher(publisher(p)),programs={};for(const key of Object.keys(profile)){const url=profileModuleURL(key,profile);programs[key]=program(useCurrent?text(graph.get(url)):previous.graphPackets.find(row=>row.url===url).text,key,profile)}return loadingContract(programs)}
test('current 13 November Groupon graph preserves the reviewed native GET list, detail and full role renderer',()=>{
 const contract=contractFor();assert.equal(contract.inventoryURL,API);assert.equal(contract.method,'GET');assert.equal(contract.publisherProgramsExecuted,false)
})
test('Groupon city labels cannot acquire a country from a shared corporate office list',()=>{
 const contract=contractFor(false),listing=JSON.parse(previous.nativePackets.find(row=>row.url===API).text).jobs.find(row=>row.location==='Madrid')
 assert.ok(listing);const packet=previous.nativePackets.find(row=>row.url===API+'/'+listing.id),job=detail(packet.text,listing,contract)
 assert.equal(job.country,null);assert.equal(job.sourceCountryScopeUnresolved,true);assert.equal(job.nativeRoleCriteriaReconciled,false)
})
test('registered current Groupon graph retains all original native observations in a labelled mixed-time replay',async()=>{
 const visits=new Map(),jobs=await createCatalogScraper(getScraperCatalog().find(row=>row.source==='groupon')).run({fetchResponse:async url=>{
  const visit=visits.get(url)||0;visits.set(url,visit+1);const packet=graph.get(url)
  if(packet)return{...packet,bytes:Buffer.from(packet.bodyBase64,'base64')}
  const original=previous.nativePackets.find(row=>row.url===url&&row.phase===(visit?'closing':'opening'));assert.ok(original,'retained original native public response '+url)
  return{bytes:Buffer.from(original.text),status:original.status,headers:original.headers,contentType:original.headers['content-type']}
 }})
 assert.equal(jobs.length,24);assert.equal(readSourceObservationEvidence(jobs,'groupon').observedRecordCount,24)
 assert.equal(jobs.nativeCollectionEvidence.observations.length,24)
 for(const job of jobs)assert.equal(job.sourceDescription,JSON.parse(previous.nativePackets.find(row=>row.url===API+'/'+job.jobId).text).job.contentHtml)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})
test('a changed current Groupon role renderer cannot authorize inventory requests',()=>{
 const profile=profileForPublisher(publisher(text(graph.get(PRIMARY))))
 assert.throws(()=>program(text(graph.get(profileModuleURL('roles',profile)))+';fetch("https://foreign.example/jobs")','roles',profile),/program changed/)
})
test('a synthetic explicit-country Groupon role still needs a current active application before full qualification',async()=>{
 const id=JSON.parse(previous.nativePackets.find(row=>row.url===API).text).jobs[0].id,visits=new Map()
 const jobs=await createCatalogScraper(getScraperCatalog().find(row=>row.source==='groupon')).run({fetchResponse:async url=>{
  const visit=visits.get(url)||0;visits.set(url,visit+1)
  const original=previous.graphPackets.find(row=>row.url===url)||previous.nativePackets.find(row=>row.url===url&&row.phase===(visit?'closing':'opening'));assert.ok(original)
  let body=original.text
  if(url.startsWith(API)){const payload=JSON.parse(body);for(const row of payload.jobs||[payload.job])if(row.id===id){row.location='Bangalore, India';row.offices=['Bangalore']}body=JSON.stringify(payload)}
  const clock=new Date().toISOString()
  return{bytes:Buffer.from(body),requestedURL:url,finalURL:url,method:'GET',body:null,status:original.status,headers:original.headers,contentType:original.headers['content-type'],startedAt:clock,completedAt:clock}
 }})
 assert.equal(jobs.find(row=>row.jobId===id).activeApplyVerified,false)
 assert.equal(jobs.find(row=>row.jobId===id).sourceDetailComplete,false)
})
