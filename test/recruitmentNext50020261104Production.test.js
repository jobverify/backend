import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/recruitmentNext50020261104/native-production.json.gz',import.meta.url))))
const key=(url,init={})=>(init.method||'GET')+':'+url+':'+(init.body||'')
const proof=job=>({id:String(job.jobId||job.requisitionId||job.sourceUrl||job.link),title:job.title,country:job.country,
 location:job.location,descriptionSHA256:sha(job.jobDescription||job.sourceDescription),postingDate:job.postingDate||null})

test('all thirteen source captures retain 218 independently country-proven active role records and intact HTTP bodies',()=>{
 assert.equal(fixture.sources.length,13)
 assert.equal(fixture.sources.reduce((n,s)=>n+s.expected.proofs.length,0),218)
 for(const source of fixture.sources){
  assert.equal(source.countryEvidence.length,source.expected.proofs.length)
  for(const request of source.requests)if(request.text!==undefined)assert.equal(sha(request.text),request.bodySHA256)
 }
})

for(const capture of fixture.sources)test(capture.source+': registered scraper replays native identities, countries, full descriptions and publication dates',async()=>{
 const provider=structuredClone(getScraperCatalog().find(p=>p.source===capture.source)),pending=new Map()
 for(const request of capture.requests){const id=key(request.requestedURL,{method:request.method,body:request.body}),rows=pending.get(id)||[];rows.push(request);pending.set(id,rows)}
 const original=globalThis.fetch
 globalThis.fetch=async(url,init={})=>{
  const queue=pending.get(key(String(url),init))
  assert.ok(queue?.length,'Uncaptured HTTP request: '+url)
  const request=queue.shift()
  if(request.error)throw Object.assign(Error(request.error),{abortRetries:true})
  const response=new Response([204,205,304].includes(request.status)?null:request.text,{status:request.status,
   headers:request.headers||{'content-type':request.contentType||'text/html'}})
  Object.defineProperty(response,'url',{value:request.finalURL})
  return response
 }
 try{
  const jobs=await createCatalogScraper(provider).run({now:()=>capture.startedAt})
  assert.deepEqual(jobs.map(proof).sort((a,b)=>a.id.localeCompare(b.id)),[...capture.expected.proofs].sort((a,b)=>a.id.localeCompare(b.id)))
  for(const job of jobs){assert.equal(job.country,'India');assert.ok((job.jobDescription||job.sourceDescription).length>=100)}
  assert.notEqual(readInventoryEvidence(jobs)?.listingComplete,true)
  for(const job of jobs){assert.notEqual(job.sourceScopeComplete,true);assert.notEqual(job.lifecycleCleanupAllowed,true)}
  for(const [id,rows]of pending)assert.equal(rows.length,0,'Unconsumed response: '+id)
 }finally{globalThis.fetch=original}
})
