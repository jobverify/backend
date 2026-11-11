import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const bytes=fs.readFileSync(new URL('./test-data/native-20261110.json.gz',import.meta.url))
const manifest=JSON.parse(fs.readFileSync(new URL('./test-data/manifest.json',import.meta.url)))
const fixtures=JSON.parse(gunzipSync(bytes))
const sha=value=>createHash('sha256').update(value).digest('hex')
const replay=(mutate=()=>{},failure)=>{
 const rows=structuredClone(fixtures);mutate(rows);let at=0
 return {fetchImpl:async(url,init)=>{
  if(failure)return failure(url,init,at++)
  const row=rows[at++];assert.ok(row,'unexpected extra HTTP read')
  assert.equal(url,row.url);assert.equal(init.method||'GET',row.method)
  if(row.requestBody)assert.deepEqual(JSON.parse(init.body),JSON.parse(row.requestBody))
  const r=new Response(row.body,{status:row.status,headers:{'content-type':row.contentType}})
  Object.defineProperty(r,'url',{value:row.finalURL});return r
 },now:()=>fixtures[0].capturedAt}
}
test('current full response fixtures retain their captured SHA256',()=>{
 assert.equal(sha(bytes),manifest.sha256)
 for(const row of fixtures)assert.equal(sha(row.body),row.sha256)
})
test('enumerates and closes the exact ESPN inventory before proving a scoped India zero',async()=>{
 const jobs=await run(replay())
 assert.equal(jobs.length,0)
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.status,'verified-empty');assert.equal(evidence.indiaFacetCount,0)
 assert.equal(evidence.reportedTotal,null);assert.equal(evidence.listingComplete,true)
 assert.equal(evidence.lifecycleCleanupAllowed,false)
 const observation=readSourceObservationEvidence(jobs,'espn')
 assert.equal(observation.observedVacancyCount,15);assert.equal(observation.sourceScopeComplete,false)
 assert.equal(observation.companyGlobalTotal,null);assert.equal(observation.companyIndiaTotal,null)
})
for(const [name,index,from,to]of[
 ['country count gap',0,'data-count="15" data-display="United States"','data-count="14" data-display="United States"'],
 ['India country',0,'data-display="United States"','data-display="India"'],
 ['unknown country',0,'data-display="United States"','data-display="Unknown"'],
 ['extra applied brand',0,'&quot;IndustryCustomField&quot;:[&quot;ESPN&quot;]','&quot;IndustryCustomField&quot;:[&quot;ESPN&quot;,&quot;Disney Store&quot;]'],
 ['hidden location filter',0,'data-filtered-locations=""','data-filtered-locations="6252001"'],
 ['extra keyword filter',0,'data-keywords=""','data-keywords="engineer"'],
 ['opening total drift',0,'data-total-job-results="15"','data-total-job-results="16"'],
 ['closing country drift',2,'data-display="United States"','data-display="India"'],
 ['closing inventory drift',3,'Technical Director','Different Role'],
])test(`holds ${name} without manufacturing a verified zero`,async()=>{
 const opts=replay(rows=>{assert.ok(rows[index].body.includes(from));rows[index].body=rows[index].body.replace(from,to)})
 await assert.rejects(run(opts))
})
test('holds truncated native page rows',async()=>{
 const opts=replay(rows=>{const p=JSON.parse(rows[1].body);const before=p.results;p.results=p.results.replace(/(<ul id="search-results-jobs"[^>]*>\s*)<li\b[^>]*>[\s\S]*?<\/li>/,'$1');assert.notEqual(p.results,before);rows[1].body=JSON.stringify(p)})
 await assert.rejects(run(opts))
})
test('holds transport failures and redirected native API responses',async()=>{
 await assert.rejects(run(replay(()=>{},async()=>{throw new TypeError('fetch failed')})))
 await assert.rejects(run(replay(rows=>{rows[1].finalURL='https://foreign.test/jobs'})))
})
test('bounds stalled transport and honors caller cancellation',async()=>{
 const controller=new AbortController();controller.abort()
 await assert.rejects(run({...replay(),signal:controller.signal}))
 await assert.rejects(run({...replay(()=>{},()=>new Promise(()=>{})),sourceTimeoutMs:30}))
})
test('holds duplicate role IDs across inventory pages',async()=>{
 await assert.rejects(run(replay(rows=>{rows[1].body=rows[1].body.replaceAll('102819842944','102635837552')})))
})
for(const [name,mutate]of[
 ['response MIME',rows=>{rows[1].contentType='text/html'}],
 ['HTTP202 challenge',rows=>{rows[0].status=202}],
 ['hidden country section',rows=>{rows[0].body=rows[0].body.replace('id="country-filters-section"','hidden id="country-filters-section"')}],
 ['inert brand section',rows=>{rows[0].body=rows[0].body.replace('id="custom_fields_industrycustomfield-filters-section"','inert id="custom_fields_industrycustomfield-filters-section"')}],
 ['foreign role URL',rows=>{rows[0].body=rows[0].body.replace('href="/en/job/bristol/technical-operations-manager-remi-ops/391/102635837552"','href="https://foreign.test/en/job/bristol/technical-operations-manager-remi-ops/391/102635837552"')}],
])test(`holds ${name}`,async()=>{await assert.rejects(run(replay(mutate)))})
test('keeps a zero held when request or pagination budgets cannot close inventory',async()=>{
 await assert.rejects(run({...replay(),maxRequests:3}))
 await assert.rejects(run({...replay(),maxPages:1}))
})
test('cancels a stalled body reader when the caller aborts',async()=>{
 let cancelled=false,released=false
 const controller=new AbortController()
 const options=replay(()=>{},async()=>({status:200,url:fixtures[0].url,headers:new Headers({'content-type':'text/html'}),
  body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:()=>{cancelled=true},releaseLock:()=>{released=true}})}}))
 const pending=run({...options,signal:controller.signal})
 setTimeout(()=>controller.abort(),20)
 await assert.rejects(pending)
 assert.equal(cancelled,true);assert.equal(released,true)
})
test('rejects oversized declared bodies and disposes the unread stream',async()=>{
 let cancelled=false
 const options=replay(()=>{},async()=>({status:200,url:fixtures[0].url,headers:new Headers({'content-type':'text/html','content-length':'4000001'}),
  body:{cancel:()=>{cancelled=true}}}))
 await assert.rejects(run(options));assert.equal(cancelled,true)
})
for(const location of ['Toronto, Canada / Connecticut','Bristol, Connecticut, Canada','Bristol, Connecticut, France'])
test(`holds a contradictory native worksite: ${location}`,async()=>{
 await assert.rejects(run(replay(rows=>{for(const row of rows)row.body=row.body.replaceAll('Bristol,  Connecticut',location)})))
})
test('enforces elapsed source deadline even while a synchronous transport blocks timers',async()=>{
 const options=replay(),fetchImpl=options.fetchImpl
 await assert.rejects(run({...options,sourceTimeoutMs:1,fetchImpl:(url,init)=>{
  const until=performance.now()+20;while(performance.now()<until){ /* Deliberately block timer delivery to test the elapsed deadline. */ }
  return fetchImpl(url,init)
 }}))
})
test('preserves the original caller cancellation reason',async()=>{
 const controller=new AbortController(),reason=new Error('caller cancelled exact ESPN audit')
 controller.abort(reason)
 await assert.rejects(run({...replay(),signal:controller.signal}),error=>error===reason)
})
