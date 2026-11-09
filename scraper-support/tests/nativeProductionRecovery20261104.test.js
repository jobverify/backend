import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-production-recovery-20261104.json.gz',import.meta.url))))
const key=(url,init={})=>(init.method||'GET')+':'+url+':'+(init.body||'')
const proof=job=>JSON.parse(JSON.stringify({id:String(job.jobId||job.requisitionId||job.sourceUrl),title:job.title,country:job.country,location:job.location,
 descriptionSHA256:sha(job.jobDescription||job.sourceDescription),postingDate:job.postingDate,sourceNativeLocations:job.sourceNativeLocations,
 sourceStandardizedLocations:job.sourceStandardizedLocations}))

test('the repair capture covers twelve sources with 392 explicit-country roles and a separately verified native empty inventory',()=>{
 assert.equal(fixture.sources.length,12)
 assert.equal(fixture.sources.reduce((sum,s)=>sum+s.expected.proofs.length,0),392)
 for(const source of fixture.sources)for(const request of source.requests)assert.equal(sha(request.text),request.bodySHA256)
})

for(const capture of fixture.sources)test(`${capture.source}: registered production replay preserves exact identities, descriptions, countries and incomplete scope`,async()=>{
 const provider=structuredClone(getScraperCatalog().find(p=>p.source===capture.source))
 if(provider.adapter==='apiPortal')provider.config.rateLimit.minimumIntervalMs=0 // Offline timing only; production pacing is tested separately.
 const pending=new Map()
 for(const request of capture.requests){const id=key(request.requestedURL,{method:request.method,body:request.body});const rows=pending.get(id)||[];rows.push(request);pending.set(id,rows)}
 const take=(url,init)=>{
  const rows=pending.get(key(String(url),init));assert.ok(rows?.length,'Uncaptured request: '+url)
  return rows.shift()
 }
 const original=globalThis.fetch
 const deniedOrigins=new Map()
 globalThis.fetch=async(url,init)=>{
  assert.equal(deniedOrigins.has(new URL(url).origin),false,'No HTTP request may follow an opted-in origin denial')
  const request=take(url,init)
  if([401,403,429,451].includes(request.status))deniedOrigins.set(new URL(url).origin,request.startedAt)
  const response=new Response(request.text,{status:request.status,headers:request.headers})
  Object.defineProperty(response,'url',{value:request.finalURL})
  return response
 }
 const options={now:()=>capture.startedAt}
 if(capture.source==='skan')options.now=capture.startedAt
 if(capture.source==='buffer'){
  options.now=()=>new Date(Date.parse(capture.completedAt)+1000)
  options.fetchPage=async url=>{const r=take(url);return {url:r.requestedURL,finalUrl:r.finalURL,status:r.status,body:r.text,
   sha256:r.bodySHA256,bytes:Buffer.byteLength(r.text),captureStartedAt:r.startedAt,capturedAt:r.completedAt}}
 }
 try{
  const jobs=await createCatalogScraper(provider).run(options)
  assert.deepEqual(jobs.map(proof).sort((a,b)=>a.id.localeCompare(b.id)),[...capture.expected.proofs].sort((a,b)=>a.id.localeCompare(b.id)))
  for(const job of jobs){assert.equal(job.country,'India');assert.ok((job.jobDescription||job.sourceDescription).length>=150)}
  const evidence=readInventoryEvidence(jobs)
  assert.equal(evidence.status,capture.expected.inventoryStatus)
  assert.equal(evidence.listingComplete,capture.expected.listingComplete)
  assert.equal(evidence.indiaFacetCount,capture.expected.indiaFacetCount)
  for(const [id,queue]of pending)for(const request of queue){
   // These original captures predate the first-denial stop. Every historical
   // request after that denial must now stay unused, including successful retries.
   const deniedAt=deniedOrigins.get(new URL(request.requestedURL).origin)
   assert.ok(deniedAt&&Date.parse(request.startedAt)>=Date.parse(deniedAt),'Unconsumed capture precedes any observed denial: '+id)
  }
 }finally{globalThis.fetch=original}
})
