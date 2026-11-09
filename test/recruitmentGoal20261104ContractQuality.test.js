import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {normalizeScrapedJob} from '../scraper-support/utils/normalizeScrapedJob.js'
import {filterIndiaJobs} from '../scraper-support/utils/indiaLocationFilter.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/native-contract-quality.json.gz',import.meta.url))))
const sha=value=>createHash('sha256').update(value).digest('hex')
const key=(url,method='GET',body='')=>method+':'+url+':'+body
const captures=new Map(fixture.sources.map(row=>[row.source,row]))
test('native quality fixtures retain all 27 original bodies, including the actual corporate HTTP 403',()=>{
 assert.equal(fixture.sources.length,2)
 assert.equal(fixture.sources.reduce((n,s)=>n+s.requests.length,0),27)
 for(const source of fixture.sources)for(const q of source.requests){assert.equal(q.replayed,false);assert.equal(sha(q.text),q.bodySHA256)}
 const rocket=captures.get('rocketsoftware')
 assert.equal(rocket.requests.length,1)
 assert.equal(rocket.requests[0].status,403)
})

const replay=async(source,consume)=>{
 const capture=captures.get(source),pending=new Map(),original=globalThis.fetch,calls=[]
 for(const q of capture.requests){const identity=key(q.requestedURL,q.method,q.body||''),rows=pending.get(identity)||[];rows.push(q);pending.set(identity,rows)}
 globalThis.fetch=async(url,init={})=>{
  const rows=pending.get(key(String(url),init.method||'GET',init.body||''));assert.ok(rows?.length,'Uncaptured native request: '+url)
  const q=rows.shift();calls.push(String(url))
  const response=new Response(q.text,{status:q.status,headers:q.headers||{'content-type':q.contentType}})
  Object.defineProperty(response,'url',{value:q.finalURL});return response
 }
 const provider=getScraperCatalog().find(p=>p.source===source)
 try{await consume(()=>createCatalogScraper(provider).run({now:()=>capture.completedAt}),provider,calls)
  assert.equal([...pending.values()].reduce((n,rows)=>n+rows.length,0),0)
 }finally{globalThis.fetch=original}
}

test('Finacus retains all 20 native descriptions and models while countries and company-wide scope stay unqualified',async()=>replay('finacussolutions',async(run,provider,calls)=>{
 const jobs=await run()
 assert.equal(jobs.length,20)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 for(const job of jobs){
  assert.equal(job.country,null);assert.equal(job.city,null);assert.equal(job.location,null)
  assert.deepEqual(job.locations,[])
  assert.equal(job.sourceDetailComplete,false)
  assert.equal(job.sourceDetailFailureKind,'native-country-unavailable')
  assert.equal(job.nativeDescriptionComplete,true)
  assert.equal(job.nativeSourceRecord.listing.jobId,job.jobId)
  assert.equal(job.nativeSourceRecord.metadata.Location,job.nativeLocation)
  assert.equal(sha(job.nativeSourceRecord.detailHTML),job.nativeDocumentSHA256)
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.sourceListingComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  assert.equal(job.applicationVisited,false)
 }
 assert.equal(filterIndiaJobs(jobs).length,0)
 assert.equal(filterIndiaJobs(jobs.map(job=>normalizeScrapedJob(job,provider))).length,0)
 assert.ok(calls.every(url=>!url.includes('#careerform')))
}))

test('Rocket actual denied corporate response ends the registered route without ATS or application requests',async()=>replay('rocketsoftware',async(run,_provider,calls)=>{
 await assert.rejects(run(),/HTTP 403/)
 assert.deepEqual(calls,['https://www.rocketsoftware.com/en-us/careers'])
}))
