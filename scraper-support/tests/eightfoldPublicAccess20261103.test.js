import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog} from '../providers/index.js'
import {runApiPortalScraper} from '../apiPortal/engine.js'
import {readEightfoldLocationScope} from '../apiPortal/eightfoldLocations.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {withRetry} from '../utils/retry.js'

const captures=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/eightfold-public-access-20261103.json.gz',import.meta.url)))).sources
const catalog=getScraperCatalog()
const configured=source=>{
 const provider=structuredClone(catalog.find(row=>row.source===source))
 provider.config.rateLimit={minimumIntervalMs:0,maxRetries:0,baseDelayMs:0,maxDelayMs:0}
 provider.config.detail.concurrency=1
 return provider
}
const denial=status=>Object.assign(Error(`HTTP ${status} native public access denied`),{status,abortRetries:true})
const replay=async(source,{provider=configured(source),laterError=denial(403),load}={})=>{
 const capture=captures.find(row=>row.source===source),calls=[]
 const jobs=await runApiPortalScraper({provider,fetchJson:async(url,options)=>{
  calls.push(url)
  const found=[capture.listing,...capture.details].find(row=>row.url===url)
  if(load)return load({url,options,found,calls,capture})
  if(!found)throw laterError
  return JSON.parse(found.body)
 }})
 return{jobs,calls}
}

test('thirteen current Eightfold providers pace public reads and require exact native detail identity; SLB uses its current company index',()=>{
 const sources=['eaton','eightfoldai','ericsson','fluke','hsbctechnologyindia','infineon','johndeereindia','lamresearch','qualcomm','stmicroelectronics','tektronix','trimble','worley']
 for(const source of sources){
  const provider=catalog.find(row=>row.source===source)
  assert.equal(provider.publicAccessPolicy,'preserve-verified-stop-denied-origin')
  assert.equal(provider.config.detail.requireListingIdentity,true)
  assert.ok(provider.config.rateLimit.minimumIntervalMs>=1000)
 }
 assert.equal(catalog.find(row=>row.source==='qualcomm').config.pagination.traversalMode,'staged-snapshot')
 const slb=catalog.find(row=>row.source==='slb')
 assert.equal(slb.nativeCurrentCareerSurface,'slb-current-public-coveo')
 assert.equal(slb.publicAccessPolicy,'preserve-verified-stop-denied-origin')
 assert.ok(slb.config.rateLimit.minimumIntervalMs>=1000)
})

for(const capture of captures){
 test(`${capture.source} retained current native responses match their hashes`,()=>{
  for(const response of[capture.listing,...capture.details])assert.equal(createHash('sha256').update(response.body).digest('hex'),response.sha256)
 })
 test(`${capture.source} verified full descriptions survive a later denial with incomplete inventory explicit`,async()=>{
  const{jobs}=await replay(capture.source)
  // Explicit native IND postal addresses also include New Delhi and
  // Ranjangaon; the former city regex incorrectly dropped those two roles.
  assert.equal(jobs.length,{eaton:10,eightfoldai:10,ericsson:10,fluke:6}[capture.source])
  const evidence=readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete,capture.source==='fluke')
  for(const job of jobs){assert.ok(job.jobDescription.length>=150);assert.equal(job.country,'India')}
  if(capture.source!=='fluke'){
   assert.equal(evidence.indiaFacetCount,null);assert.match(evidence.reason,/native-listing-access-denied-http403/)
   for(const job of jobs)assert.equal(job.lifecycleCleanupAllowed,false)
  }
 })
}

for(const status of[401,403,429,451])test(`initial HTTP ${status} remains a failure with no invented zero`,async()=>{
 const error=denial(status);let reads=0
 await assert.rejects(replay('eightfoldai',{load:async()=>{reads++;throw error}}),value=>value===error)
 assert.equal(reads,1)
})

test('an ordinary native HTTP 429 stops an opted-in origin on its first denial even when retries are configured',async()=>{
 const provider=configured('eightfoldai'),error=Object.assign(Error('HTTP 429 native rate limit'),{status:429})
 provider.config.rateLimit.maxRetries=2
 let reads=0
 await assert.rejects(replay('eightfoldai',{provider,load:async()=>{reads++;throw error}}),value=>value===error)
 assert.equal(reads,1)
})

test('the outer source retry wrapper cannot restart an opted-in origin after its first ordinary HTTP429',async()=>{
 const provider=configured('eightfoldai'),error=Object.assign(Error('HTTP 429 native rate limit'),{status:429})
 let reads=0
 await assert.rejects(withRetry(()=>replay('eightfoldai',{provider,load:async()=>{reads++;throw error}}),{
  attempts:3,baseDelayMs:0,label:'eightfold-first-denial',
 }),/HTTP 429/)
 assert.equal(reads,1)
 assert.equal(error.abortRetries,true)
})

test('a detail denial stops further native requests and retains only already verified roles',async()=>{
 let denied
 const{jobs,calls}=await replay('eightfoldai',{load:async({url,found,capture})=>{
  if(url===capture.details[1].url){denied=denial(403);throw denied}
  assert.ok(found);return JSON.parse(found.body)
 }})
 assert.ok(denied);assert.equal(calls.length,3);assert.equal(jobs.length,1)
 assert.equal(jobs[0].jobId,JSON.parse(captures.find(row=>row.source==='eightfoldai').listing.body).data.positions[0].id)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('a denial before any native detail is proven propagates its original error',async()=>{
 const error=denial(403);let reads=0
 await assert.rejects(replay('eightfoldai',{load:async({found,capture,url})=>{
  reads++;if(url!==capture.listing.url)throw error
  return JSON.parse(found.body)
 }}),value=>value===error)
 assert.equal(reads,2)
})

test('short or missing native descriptions cannot enter the retained set',async()=>{
 const{jobs}=await replay('eightfoldai',{load:async({url,found,capture})=>{
  if(!found)throw denial(403)
  const model=JSON.parse(found.body)
  if(url===capture.details[0].url)model.data.jobDescription=''
  return model
 }})
 assert.equal(jobs.length,9)
 const first=JSON.parse(captures.find(row=>row.source==='eightfoldai').listing.body).data.positions[0].id
 assert.equal(jobs.some(row=>row.jobId===first),false)
})

test('a different native role identity remains a contract failure rather than partial recovery',async()=>{
 await assert.rejects(replay('eightfoldai',{load:async({url,found,capture})=>{
  const model=JSON.parse(found.body)
  if(url===capture.details[1].url)model.data.id='foreign-role'
  return model
 }}),/detail identity mismatch: id/)
})

test('malformed later listing data does not trigger access-denial recovery',async()=>{
 await assert.rejects(replay('eightfoldai',{load:async({found})=>found?JSON.parse(found.body):{data:{positions:'malformed',count:20}}}),/listing array missing or malformed/)
})

test('a later access denial remains an error for providers that did not opt in',async()=>{
 const provider=configured('eightfoldai');delete provider.publicAccessPolicy
 const error=denial(403)
 await assert.rejects(replay('eightfoldai',{provider,laterError:error}),value=>value===error)
})

test('staged collection never hydrates an incomplete denied opening cohort',async()=>{
 const provider=configured('eightfoldai');provider.config.pagination.traversalMode='staged-snapshot'
 const error=denial(403);let reads=0
 await assert.rejects(replay('eightfoldai',{provider,load:async({url,found,capture})=>{
  reads++;if(url!==capture.listing.url)throw error
  return JSON.parse(found.body)
 }}),value=>value===error)
 assert.equal(reads,2)
})

test('a denied closing pass retains verified staged details without authorizing cleanup',async()=>{
 const provider=configured('fluke');provider.config.pagination.traversalMode='staged-snapshot'
 let listings=0
 const{jobs}=await replay('fluke',{provider,load:async({url,found,capture})=>{
  if(url===capture.listing.url&&++listings>1)throw denial(403)
  return JSON.parse(found.body)
 }})
 assert.equal(listings,2);assert.equal(jobs.length,6)
 assert.match(readInventoryEvidence(jobs).reason,/closing-inventory-unavailable/)
 for(const job of jobs)assert.equal(job.lifecycleCleanupAllowed,false)
})

test('caller cancellation stays authoritative over access-denial recovery',async()=>{
 const caller=new AbortController(),provider=configured('eightfoldai'),capture=captures.find(row=>row.source==='eightfoldai')
 await assert.rejects(runApiPortalScraper({provider,signal:caller.signal,fetchJson:async url=>{
  if(url!==capture.listing.url){caller.abort(0);throw denial(403)}
  return JSON.parse(capture.listing.body)
 }}),value=>value===0)
})

test('Eaton postal addresses carry their own explicit country and contradicting standardized countries still fail',()=>{
 const records=JSON.parse(captures.find(row=>row.source==='eaton').listing.body).data.positions
 for(const row of records)assert.equal(readEightfoldLocationScope(row).country,'India')
 const row=structuredClone(records[0]);row.standardizedLocations=['Pune, MH, US']
 assert.throws(()=>readEightfoldLocationScope(row),/contradictory explicit native country/)
 const unqualified=structuredClone(records[0]);unqualified.locations=['Hadapsar, Pune, Maharashtra, 411013']
 assert.throws(()=>readEightfoldLocationScope(unqualified),/unaligned/)
 assert.equal(readEightfoldLocationScope({locations:['Indianapolis, IN, 46204']}).country,null)
})
