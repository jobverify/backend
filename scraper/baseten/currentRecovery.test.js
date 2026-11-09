import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {extractionRawJobMetrics} from '../../scraper-support/utils/extractionRawJobMetrics.js'
import {extractionDetailHealth} from '../../scraper-support/utils/extractionDetailHealth.js'
import {inventoryCleanupOptions,finishScraperProcessing,scraperTaskOutcome} from '../../scraper-support/utils/scraperOutcome.js'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'

const fixture=()=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261105.json.gz',import.meta.url))))
const official='https://www.baseten.co/resources/careers/',canonical=official.slice(0,-1)
function transport(mutator){
 const {responses}=fixture(),calls=[]
 return {calls,fetchImpl:async(url,init)=>{
  const record=responses.find(r=>r.requestedUrl===String(url));assert.ok(record,'only currently observed public URLs may be requested')
  calls.push(String(url));assert.equal(init.method,'GET');assert.equal(init.redirect,'manual')
  const headers=new Headers(record.headers)
  const raw=record.bodyUnavailable?null:Buffer.from(record.bodyBase64,'base64')
  const response=new Response(raw,{status:record.status,headers})
  Object.defineProperty(response,'url',{value:record.finalUrl})
  return mutator?.(response,{url:String(url),init,calls})??response
 }}
}

test('current canonical hiring hop retains102 native observations without claiming complete scope',async()=>{
 const {fetchImpl,calls}=transport(),audits=[]
 const jobs=await run({fetchImpl,onAudit:audit=>audits.push(audit)})
 const evidence=readInventoryEvidence(jobs),audit=audits[0]
 assert.equal(jobs.length,0)
 assert.equal(audit.nativeCount,102)
 assert.equal(audit.opening.cms.length,103)
 assert.equal(audit.opening.publisher.format,'turbopack-literal-job-list')
 assert.deepEqual(audit.opening.cms.filter(row=>!audit.opening.payload.jobs.some(job=>job.id===row.id&&job.jobUrl===row.url)).map(row=>row.id),['4e507a15-c9bb-4877-b422-f3eb462a3732'])
 assert.equal(audit.reasons.includes('unreviewed-advertised-cms-only-role'),true)
 assert.equal(audit.originalNativePayloadPreserved,true)
 assert.equal(audit.sourceScopeComplete,false)
 assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null,'observed rows are not a verified publisher total')
 assert.equal(evidence.indiaFacetCount,null)
 assert.deepEqual(readSourceObservationEvidence(jobs,'baseten'),{source:'baseten',recordKind:'vacancy-rows',observedRecordCount:102,observedVacancyCount:102,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 assert.deepEqual(extractionRawJobMetrics({source:'baseten'},jobs,evidence),{rawJobs:102,rawJobsBasis:'observed-native-vacancy-rows'})
 assert.equal(calls.filter(url=>url===official).length,2)
 assert.equal(calls.filter(url=>url===canonical).length,2)
 assert.equal(calls.length,8,'stale assets and stale role paths must not be fetched from the replaced publisher')
})

test('registered current Baseten preserves raw metrics and incomplete outcome independently of eligible health',async()=>{
 const provider=getScraperCatalog().find(row=>row.source==='baseten'),audits=[]
 const jobs=await createCatalogScraper(provider).run({...transport(),onAudit:audit=>audits.push(audit)})
 const evidence=readInventoryEvidence(jobs),health=extractionDetailHealth(jobs)
 assert.equal(audits[0].nativeCount,102)
 assert.equal(readSourceObservationEvidence(jobs,'baseten').observedVacancyCount,102)
 assert.equal(extractionRawJobMetrics(provider,jobs,evidence).rawJobs,102)
 assert.equal(health.inspectedJobs,0,'this helper measures the returned eligible cohort only')
 assert.equal(audits[0].fullNativeDetails<102,true,'unreviewed criteria/geography cannot become all-role healthy')
 const outcome=finishScraperProcessing({success:true,jobs:jobs.length,inventoryEvidence:evidence,detailHealth:health,zeroJobEvidence:'unverified-zero'})
 assert.equal(scraperTaskOutcome(outcome),'softFailed')
 assert.equal(outcome.partial,true)
 assert.deepEqual(inventoryCleanupOptions(outcome),{replaceExisting:false})
})

test('current hiring redirect cannot leave its one exact observed canonical public route',async()=>{
 const t=transport((response,{url})=>{
  if(url!==official)return response
  const altered=new Response(null,{status:308,headers:{location:'https://jobs.ashbyhq.com/other','content-type':'text/html'}})
  Object.defineProperty(altered,'url',{value:official});return altered
 })
 await assert.rejects(run(t),/redirect|identity/i)
 assert.equal(t.calls.length,1)
})

test('external cancellation owns an ignored fetch that resolves after the run has rejected',async()=>{
 const controller=new AbortController(),reason=new Error('exact external cancellation')
 let resolveFetch,cancelled=0
 const pending=run({signal:controller.signal,fetchImpl:()=>new Promise(resolve=>{resolveFetch=resolve})})
 controller.abort(reason)
 let timeout
 const result=await Promise.race([pending.then(value=>({value}),error=>({error})),new Promise(resolve=>{timeout=setTimeout(()=>resolve({missedDeadline:true}),100)})])
 clearTimeout(timeout)
 const stream=new ReadableStream({cancel(){cancelled++}})
 const late=new Response(stream,{status:200,headers:{'content-type':'text/html'}})
 Object.defineProperty(late,'url',{value:official})
 resolveFetch(late)
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(result.error,reason,'the exact external reason must reject before an ignored fetch settles')
 assert.equal(cancelled,1,'late transport body must be disposed without being read')
})

test('source request deadline rejects an uncooperative transport and disposes its late body',async()=>{
 let resolveFetch,cancelled=0
 const pending=run({requestTimeoutMs:20,collectionTimeoutMs:1000,fetchImpl:()=>new Promise(resolve=>{resolveFetch=resolve})})
 let timeout
 const result=await Promise.race([pending.then(value=>({value}),error=>({error})),new Promise(resolve=>{timeout=setTimeout(()=>resolve({missedDeadline:true}),150)})])
 clearTimeout(timeout)
 const late=new Response(new ReadableStream({cancel(){cancelled++}}),{status:200,headers:{'content-type':'text/html'}})
 Object.defineProperty(late,'url',{value:official});resolveFetch(late)
 await new Promise(resolve=>setImmediate(resolve))
 assert.match(result.error?.message??'',/request deadline/)
 assert.equal(cancelled,1)
})

test('declared overlarge responses are rejected before their body is consumed',async()=>{
 let consumed=0,cancelled=0
 const response={status:200,url:official,headers:new Headers({'content-type':'text/html','content-length':'12000001'}),
  body:{cancel(){cancelled++;return Promise.resolve()},getReader(){consumed++;throw Error('body should not be consumed')}},
  clone(){consumed++;throw Error('unbounded clone should not run')}}
 await assert.rejects(run({fetchImpl:async()=>response}),/byte bound|size bound/)
 assert.equal(consumed,0)
 assert.equal(cancelled,1)
})

test('null external abort reason is preserved while an acquired reader is cancelled',async()=>{
 const controller=new AbortController();let cancelReader=0,readStarted
 const started=new Promise(resolve=>{readStarted=resolve})
 const response={status:200,url:official,headers:new Headers({'content-type':'text/html'}),body:{getReader(){return {read(){readStarted();return new Promise(()=>{})},cancel(){cancelReader++;return Promise.resolve()},releaseLock(){}}}}}
 const pending=run({signal:controller.signal,fetchImpl:async()=>response})
 await started;controller.abort(null)
 let rejected=false,reason
 await pending.then(()=>{},error=>{rejected=true;reason=error})
 assert.equal(rejected,true)
 assert.equal(reason,null)
 assert.equal(cancelReader,1)
})

test('a reader acquired after external cancellation is still disposed',async()=>{
 const controller=new AbortController(),reason=new Error('cancel while acquiring reader')
 let resolveReader,started,bodyCancelled=0,readerCancelled=0
 const acquiring=new Promise(resolve=>{started=resolve})
 const body={getReader(){started();return new Promise(resolve=>{resolveReader=resolve})},cancel(){bodyCancelled++;return Promise.resolve()}}
 const response={status:200,url:official,headers:new Headers({'content-type':'text/html'}),body}
 const pending=run({signal:controller.signal,fetchImpl:async()=>response})
 await acquiring;controller.abort(reason)
 await assert.rejects(pending,error=>error===reason)
 resolveReader({cancel(){readerCancelled++;return Promise.resolve()}})
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(bodyCancelled,1)
 assert.equal(readerCancelled,1)
})

test('synchronous reader acquisition failure disposes the original response',async()=>{
 let cancelled=0
 const reason=new Error('reader acquisition rejected')
 const response={status:200,url:official,headers:new Headers({'content-type':'text/html'}),body:{getReader(){throw reason},cancel(){cancelled++;return Promise.resolve()}}}
 await assert.rejects(run({fetchImpl:async()=>response}),error=>error===reason)
 assert.equal(cancelled,1)
})

test('an overlarge response stream is cancelled at the byte bound',async()=>{
 let cancelled=0
 const response=new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(12000001))},cancel(){cancelled++}}),{status:200,headers:{'content-type':'text/html'}})
 Object.defineProperty(response,'url',{value:official})
 await assert.rejects(run({fetchImpl:async()=>response}),/streamed byte bound/)
 assert.equal(cancelled,1)
})
