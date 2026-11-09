import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/careem-native-quality.json.gz',import.meta.url))))
const proofKey=Symbol.for('jobverify.official-ats-discovery'),canonical='https://www.careem.com/en-ae/careers/'
const api='https://boards-api.greenhouse.io/v1/boards/careem/jobs?content=true'
const registered=(source,options)=>createCatalogScraper(getScraperCatalog().find(p=>p.source===source)).run(options)
function recording(mutate=()=>{},source='careem'){
 const calls=[],counts=new Map()
 const captured=source==='careem'?fixture:fixture.relatedSources.find(s=>s.source===source)
 return {calls,options:{requestIntervalMs:0,fetchImpl:async(url,init)=>{
  const packets=[...captured.requests,...(captured.diagnostics||[])].filter(p=>p.requestedURL===url)
  assert.ok(packets.length,'Uncaptured public read '+url)
  const occurrence=(counts.get(url)||0)+1;counts.set(url,occurrence)
  assert.ok(occurrence<=packets.length,'Repeated uncaptured public read '+url)
  const packet=structuredClone(packets[occurrence-1])
  mutate(packet,occurrence);calls.push({url,init,at:Date.now()})
  const response=new Response(packet.text,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalURL});return response
 }}}
}
test('current Careem and Auvik fixtures preserve twelve original paced response bodies',()=>{
 const groups=[fixture,...fixture.relatedSources]
 assert.equal(groups.reduce((n,g)=>n+g.requests.length,0),12)
 for(const g of groups){const prior=new Map();for(const p of g.requests){
  assert.equal(p.replayed,false);assert.equal(p.status,200);assert.equal(p.method,'GET')
  assert.equal(createHash('sha256').update(p.text).digest('hex'),p.bodySHA256);assert.equal(Buffer.byteLength(p.text),p.bodyBytes)
  const origin=new URL(p.requestedURL).origin,start=Date.parse(p.startedAt)
  if(prior.has(origin))assert.ok(start-prior.get(origin)>=850,'Unpaced production read')
  prior.set(origin,start)
 }}
})
test('Careem current registered reader reconciles its canonical corporate URL and full eleven-role native board twice',async()=>{
 const read=recording(),jobs=await registered('careem',read.options)
 assert.equal(jobs.length,0);assert.equal(read.calls.length,8);assert.equal(read.calls[0].url,canonical)
 assert.equal(read.calls.filter(c=>c.url===api).length,2)
 assert.equal(jobs[proofKey].nativeInventory.observedNativeRoles,11)
 assert.equal(jobs[proofKey].nativeInventory.fullContentRoles,11)
 assert.equal(jobs[proofKey].nativeInventory.selectedIndiaPostings,0)
 assert.equal(jobs[proofKey].nativeInventory.snapshots,2)
 assert.equal(jobs[proofKey].retainedResponses.length,8)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 for(const c of read.calls){assert.equal(c.init.credentials,'omit');assert.equal(c.init.method,'GET');assert.equal(c.init.redirect,'manual')}
})
test('current Auvik twelve-role inventory retains unknown countries and cannot certify an empty company inventory',async()=>{
 const read=recording(()=>{},'auvik'),jobs=await registered('auvik',read.options)
 assert.equal(jobs.length,0);assert.equal(read.calls.length,4);assert.equal(jobs[proofKey].nativeInventory.observedNativeRoles,12)
 assert.equal(jobs[proofKey].nativeInventory.fullContentRoles,12);assert.equal(jobs[proofKey].nativeInventory.unresolvedCountryScope,true)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for(const status of [403,429])test('Careem stops after denied closing native inventory HTTP '+status,async()=>{
 const read=recording((p,n)=>{if(p.requestedURL===api&&n===2)p.status=status})
 await assert.rejects(registered('careem',read.options),new RegExp('HTTP '+status))
 assert.equal(read.calls.length,8);assert.equal(read.calls.at(-1).url,api)
})
test('Careem and Auvik cancellation takes precedence over zero-cap output',async()=>{
 for(const source of ['careem','auvik']){
  const reason=Error('caller stopped'),signal=AbortSignal.abort(reason)
  await assert.rejects(registered(source,{signal,maxJobs:0,fetchImpl:async()=>assert.fail('No request after cancellation')}),e=>e===reason)
 }
})
test('default public transport cannot lower the production origin interval',async()=>{
 await assert.rejects(registered('careem',{requestIntervalMs:0}),/interval/i)
})
for(const source of ['careem','auvik'])test(source+' zero caps settle without requests or claims about native totals',async()=>{
 let calls=0
 const jobs=await registered(source,{maxJobs:0,fetchImpl:async()=>{calls++;throw Error('Zero cap must not request public data')}})
 assert.equal(calls,0);assert.equal(jobs.length,0);assert.equal(jobs[proofKey].nativeInventory.observedNativeRoles,null)
 assert.equal(jobs[proofKey].nativeInventory.snapshots,0);assert.equal(jobs[proofKey].binding,null)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).firstParty,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
test('Careem native reads observe the configured per-origin request interval',async()=>{
 const read=recording();await registered('careem',{...read.options,requestIntervalMs:30})
 const prior=new Map()
 for(const c of read.calls){const origin=new URL(c.url).origin;if(prior.has(origin))assert.ok(c.at-prior.get(origin)>=25,'Unpaced native read');prior.set(origin,c.at)}
})
