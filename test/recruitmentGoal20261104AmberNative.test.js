import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {hasVerifiedKekaJobsChunk,resolveJobsChunkUrl,run} from '../scraper/amberstudent/script.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/amber-native-quality.json.gz',import.meta.url))))
const feed='https://amberstudent.keka.com/careers/api/embedjobs/default/active/228f83f5-48b3-474a-b753-4fce2be7524f'
const nativeRows=JSON.parse(fixture.requests.find(p=>p.requestedURL===feed).text)
const ids=['144346','143164','141478','138920','138424','137681','131445']
test('Amber fixture preserves all twelve original paced opening and closing responses',()=>{
 assert.equal(fixture.requests.length,12)
 const prior=new Map()
 for(const packet of fixture.requests){
  assert.equal(packet.replayed,false);assert.equal(packet.method,'GET');assert.equal(packet.status,200)
  assert.equal(createHash('sha256').update(packet.text).digest('hex'),packet.bodySHA256)
  assert.equal(Buffer.byteLength(packet.text),packet.bodyBytes)
  const origin=new URL(packet.requestedURL).origin,start=Date.parse(packet.startedAt)
  if(prior.has(origin))assert.ok(start-prior.get(origin)>=850,'Production reads must retain per-origin pacing')
  prior.set(origin,start)
 }
})
function recorded(mutate=()=>{}){
 const calls=[],counts=new Map()
 const read=async url=>{
  const packets=fixture.requests.filter(p=>p.requestedURL===url);assert.ok(packets.length,'Uncaptured request '+url)
  const occurrence=(counts.get(url)||0)+1;counts.set(url,occurrence)
  const packet=structuredClone(packets[Math.min(occurrence-1,packets.length-1)]);mutate(packet,occurrence);calls.push(url)
  assert.equal(packet.status,200);return packet.text
 }
 return {calls,options:{requestIntervalMs:0,now:()=> '2026-11-05T05:00:00.000Z',fetchText:read,fetchJson:async url=>JSON.parse(await read(url))}}
}
test('Amber recognizes the current company-declared client that fetches and renders its own Keka jobs',()=>{
 const main=fixture.requests.find(p=>/\/main\.[a-f0-9]+\.desktop\.js$/.test(p.requestedURL))
 const chunkURL=resolveJobsChunkUrl(main.text)
 assert.equal(chunkURL,'https://cdn-static-assets.amberstudent.com/amber-user-website/build/assets/js/5004.e67bc9f3b7efcff9.desktop.js')
 const chunk=fixture.requests.find(p=>p.requestedURL===chunkURL)
 assert.equal(hasVerifiedKekaJobsChunk(chunk.text),true,'Current published jobs client must bind the exact Amber account and active feed')
})
test('Amber registered reader retains seven consistent full native India models, exact native publication and closing proof',async()=>{
 const read=recorded(),provider=getScraperCatalog().find(p=>p.source==='amberstudent')
 const jobs=await createCatalogScraper(provider).run(read.options)
 assert.deepEqual(jobs.map(j=>j.jobId),ids)
 for(const job of jobs){
  const row=nativeRows.find(r=>String(r.id)===job.jobId)
  assert.deepEqual(job.nativeSourceRecord,row)
  assert.equal(job.sourceRawDescription,row.description)
  assert.ok(job.jobDescription.length>500)
  assert.equal(job.postingDate,row.publishedOn);assert.equal(job.sourceDatePrecision,'instant')
  assert.equal(job.requisitionId,null);assert.equal(job.legalEmployer,null)
  assert.equal(job.country,'India');assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceClosingQualified,true)
  assert.equal(job.sourceListingComplete,false);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 }
 assert.equal(jobs[0].city,null);assert.equal(jobs[0].remoteStatus,'Remote')
 assert.equal(read.calls.filter(url=>url===feed).length,2)
 const observation=jobs[Symbol.for('jobverify.verified-recruitment-observations')]
 assert.deepEqual(observation.unknownCountryIds,['141425','139529','133882'])
 assert.deepEqual(observation.countryConflictIds,['145620','144143','143168','143013'])
 assert.equal(observation.closedNativeDetails,7)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})
function httpRecorded(mutate=()=>{}){
 const calls=[],counts=new Map()
 return {calls,options:{requestIntervalMs:0,now:()=> '2026-11-05T05:00:00.000Z',fetchImpl:async url=>{
  const packets=fixture.requests.filter(p=>p.requestedURL===url);assert.ok(packets.length,'Uncaptured request '+url)
  const occurrence=(counts.get(url)||0)+1;counts.set(url,occurrence)
  const packet=structuredClone(packets[Math.min(occurrence-1,packets.length-1)]);mutate(packet,occurrence);calls.push(url)
  const response=new Response(packet.text,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalURL});return response
 }}}
}
test('Amber HTTP reader stops after a later denial and retains earlier roles without closing claims',async()=>{
 const read=httpRecorded((p,n)=>{if(p.requestedURL===feed&&n===2)p.status=403})
 const jobs=await run(read.options)
 assert.equal(jobs.length,7);assert.ok(jobs.every(j=>j.sourceClosingQualified===false))
 assert.equal(read.calls.at(-1),feed);assert.equal(read.calls.length,7)
 assert.equal(jobs[Symbol.for('jobverify.verified-recruitment-observations')].failures[0].status,403)
})
test('Amber closing changes hold the changed full role and preserve other independently stable roles',async()=>{
 const read=httpRecorded((p,n)=>{if(p.requestedURL===feed&&n===2){const rows=JSON.parse(p.text);rows[1].description+='<p>Changed current role criteria.</p>';p.text=JSON.stringify(rows)}})
 const jobs=await run(read.options)
 assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.sourceClosingQualified));assert.ok(!jobs.some(j=>j.jobId==='144346'))
})
test('Amber result caps preserve full inventory reads and incomplete company scope',async()=>{
 const read=httpRecorded(),jobs=await run({...read.options,maxJobs:2})
 assert.deepEqual(jobs.map(j=>j.jobId),ids.slice(0,2))
 assert.equal(read.calls.filter(url=>url===feed).length,2);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs[Symbol.for('jobverify.verified-recruitment-observations')].nativePostings,14)
})
for(const status of [401,403,429,451])test('Amber stops on initial HTTP '+status,async()=>{
 const read=httpRecorded(p=>{p.status=status})
 await assert.rejects(run(read.options),new RegExp('HTTP '+status));assert.equal(read.calls.length,1)
})
test('Amber caller cancellation rejects without making public reads',async()=>{
 const read=httpRecorded(),reason=Error('caller cancelled')
 await assert.rejects(run({...read.options,signal:AbortSignal.abort(reason)}),e=>e===reason);assert.equal(read.calls.length,0)
})
test('Amber does not treat a currently empty account as a complete company inventory',async()=>{
 const read=httpRecorded(p=>{if(p.requestedURL===feed)p.text='[]'})
 const jobs=await run(read.options);assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})
test('Amber hidden corporate handoffs and modified client bytes cannot authorize the native feed',async()=>{
 for(const mode of ['hidden-link','changed-client']){
  const read=httpRecorded(p=>{
   if(mode==='hidden-link'&&p.requestedURL==='https://amberstudent.com/career')p.text='<title>Careers | Amber</title><template><a href="/job-opening">Explore Open Roles</a></template>'
   if(mode==='changed-client'&&/\/5004\./.test(p.requestedURL))p.text+=';/* unreviewed deployed module */'
  })
  await assert.rejects(run(read.options),/handoff|tenant/i);assert.ok(!read.calls.includes(feed))
 }
})
test('Amber zero result caps and invalid caps settle without public reads',async()=>{
 const never=async()=>assert.fail('No public reads for a zero or invalid cap')
 const jobs=await run({maxJobs:0,fetchText:never,fetchJson:never})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 for(const maxJobs of [-1,1.5,'1'])await assert.rejects(run({maxJobs,fetchText:never,fetchJson:never}),/limit|cap/i)
})
test('Amber holds conflicting native country fields instead of selecting IN over another country',async()=>{
 const read=recorded(p=>{if(p.requestedURL===feed){const rows=JSON.parse(p.text);rows[1].jobLocations[0].countryName='United States';p.text=JSON.stringify(rows)}})
 const jobs=await run(read.options)
 assert.equal(jobs.length,6);assert.ok(!jobs.some(j=>j.jobId==='144346'))
})
test('Amber rejects unrelated code that merely quotes the retired variable-name contract',()=>{
 const text='// let u="https://amberstudent.keka.com/careers",m=`${u}/api/embedjobs/default/active/228f83f5-48b3-474a-b753-4fce2be7524f`'
 assert.equal(hasVerifiedKekaJobsChunk(text),false)
})
