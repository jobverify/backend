import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createNativeLiciousScraper} from './nativeInventory.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261113/current-declared.json.gz',import.meta.url))))
const handoff=new Map(current.packets.map(row=>[row.url,row]))
const component='https://www.licious.in/_next/static/chunks/app/content/careers/jobs/page-ee5b4b837d8d8e74.js'
for(const row of current.packets){const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(bytes.length,row.bodyBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.bodySHA256)}
function replay(change=()=>{},useCurrent=true){
 const historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/current-app-router-default-20261107.json.gz',import.meta.url)))),seen=new Map(),calls=[]
 return{calls,now:()=>historical.collectionStartedAt,fetchPage:async(url,init)=>{
  init.signal?.throwIfAborted();calls.push(url)
  const key=JSON.stringify([url,init.body??null]),index=seen.get(key)||0;seen.set(key,index+1)
  const packet=useCurrent?handoff.get(url):null
  const old=historical.packets.filter(row=>row.requestedUrl===url&&row.requestBody===(init.body??null))[index]
  const row=packet?{url:packet.url,finalUrl:packet.finalURL,status:packet.status,contentType:packet.contentType,body:Buffer.from(packet.bodyBase64,'base64').toString('utf8')}:old?{url:old.requestedUrl,finalUrl:old.finalUrl,status:old.status,contentType:old.contentType,body:Buffer.from(old.bodyBase64,'base64').toString('utf8')}:null
  assert.ok(row,'undeclared test read '+url);change(row)
  return{url:row.finalUrl,status:row.status,contentType:row.contentType,body:row.body}
 }}
}
test('current 13 November Licious handoff retains all native observations without country inference in a labelled mixed-time replay',async()=>{
 const options=replay(),jobs=await createCatalogScraper(getScraperCatalog().find(row=>row.source==='licious')).run(options)
 assert.equal(jobs.length,0)
 assert.equal(readSourceObservationEvidence(jobs,'licious').observedRecordCount,32)
 assert.equal(jobs.nativeCollectionEvidence.observations.length,32)
 assert.ok(jobs.nativeCollectionEvidence.observations.every(row=>row.listingRecord&&row.detailRecord))
 assert.ok(options.calls.includes(component));assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})
test('a modified current Licious component cannot activate the native board',async()=>{
 const options=replay(row=>{if(row.url===component)row.body+=';fetch("https://foreign.example/jobs")'})
 await assert.rejects(createNativeLiciousScraper({now:options.now}).run(options),/client contract changed/)
 assert.equal(options.calls.some(url=>url.includes('/reqlist/get')),false)
})
test('the current Licious iframe cannot select another employer',async()=>{
 const options=replay(row=>{if(row.url==='https://www.licious.in/careers/jobs')row.body=row.body.replace('id="mnhembedded"','id="mnhembedded" src="https://foreign.mynexthire.com/employer/jobs/careers"')})
 await assert.rejects(createNativeLiciousScraper({now:options.now}).run(options),/iframe handoff/)
})
test('city-only native Licious rows stay unqualified even through the previously reviewed handoff',async()=>{
 const options=replay(()=>{},false),jobs=await createNativeLiciousScraper({now:options.now}).run(options)
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observations.length,32)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})
const explicitCountry=row=>{
 if(!row.url.endsWith('/reqlist/get')&&!row.url.endsWith('/requisition/object'))return
 const payload=JSON.parse(row.body),records=payload.reqDetailsBOList||[payload.data.reqDetailsBO]
 for(const record of records)record.countryCode='IN'
 row.body=JSON.stringify(payload)
}
test('explicit role country retains the 29 native Licious roles whose criteria and employer qualify',async()=>{
 const options=replay(explicitCountry,false),jobs=await createNativeLiciousScraper({now:options.now}).run(options)
 assert.equal(jobs.length,29);assert.ok(jobs.every(row=>row.sourceDetailComplete&&row.country==='India'))
})
test('one hidden native criterion cannot qualify as a complete Licious description',async()=>{
 const options=replay(row=>{explicitCountry(row);if(row.url.endsWith('/requisition/object')){const payload=JSON.parse(row.body);if(payload.data.reqDetailsBO.reqId===1594)payload.data.reqDetailsBO.jdDisplay+='<p hidden>Mandatory security clearance.</p>';row.body=JSON.stringify(payload)}},false)
 const jobs=await createNativeLiciousScraper({now:options.now}).run(options)
 assert.equal(jobs.some(row=>row.jobId==='1594'),false)
 assert.equal(jobs.nativeCollectionEvidence.observations.length,32)
})
test('a raw-text data script cannot hide a mandatory Licious criterion from completeness checks',async()=>{
 const options=replay(row=>{explicitCountry(row);if(row.url.endsWith('/requisition/object')){const payload=JSON.parse(row.body);if(payload.data.reqDetailsBO.reqId===1594)payload.data.reqDetailsBO.jdDisplay+='<script type="application/json">Mandatory clearance.</script>';row.body=JSON.stringify(payload)}},false)
 const jobs=await createNativeLiciousScraper({now:options.now}).run(options)
 assert.equal(jobs.some(row=>row.jobId==='1594'),false)
})
test('Licious holds an offscreen authored criterion despite an explicit native country control',async()=>{
 const options=replay(row=>{explicitCountry(row);if(row.url.endsWith('/requisition/object')){const payload=JSON.parse(row.body);if(payload.data.reqDetailsBO.reqId===1594)payload.data.reqDetailsBO.jdDisplay+='<p style="position:fixed;left:-9999px">Mandatory security clearance.</p>';row.body=JSON.stringify(payload)}},false)
 const jobs=await createNativeLiciousScraper({now:options.now}).run(options)
 assert.equal(jobs.some(row=>row.jobId==='1594'),false)
})
