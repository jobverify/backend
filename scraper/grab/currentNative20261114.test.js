import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {BOARD_URL,FEED_URL} from './currentNative.js'
import {createGrabScraper} from './script.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-20261114.json.gz',import.meta.url))))
fixture.responses.push(...JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-styles-20261114.json.gz',import.meta.url)))).responses)
const sha=value=>createHash('sha256').update(value).digest('hex')
const provider=getScraperCatalog().find(row=>row.source==='grab'),scraper=()=>createCatalogScraper(provider)
const ids=['744000161218849','744000159351149','744000156946578','744000156260400','744000154359024','744000151842122','744000149229199','744000147495489','744000144006034','744000138554499']
const datalayerVariant=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-datalayer-variant-20261114.json.gz',import.meta.url)))).responses[0]
function replay(change=(_url,row)=>row){
 const counts=new Map(),requests=[]
 const read=async(url,init={})=>{
  url=String(url);init.signal?.throwIfAborted();assert.equal(init.method||'GET','GET')
  const original=fixture.responses.find(row=>row.url===url);assert.ok(original,'Unbound request '+url)
  const count=(counts.get(url)||0)+1;counts.set(url,count);requests.push(url)
  const row=await change(url,structuredClone(original),count,init),response=new Response(row.body,{status:row.status,headers:row.headers})
  Object.defineProperty(response,'url',{value:row.finalUrl??row.url});return response
 }
 return{read,requests}
}

test('Grab registered collector reconciles ten complete explicit India roles from current publisher feed and full native pages',async t=>{
 for(const row of fixture.responses)assert.equal(sha(row.body),row.sha256)
 const transport=replay();t.mock.method(globalThis,'fetch',transport.read)
 const jobs=await scraper().run()
 assert.deepEqual(jobs.map(job=>job.jobId),ids)
 assert.deepEqual(jobs.map(job=>sha(job.sourceDescriptionHTML)),[
  'e413151e0ec361a0097659a9f95a7c1c0f8ae5869e50d15d47f67fca117dd4af','95918c3dc37875520c8b2c669d8d6b6794d49a7ea877a7ece8e7b0957dac724e',
  '33f6415aafc62196bf1aa78b04475c53133a51980a4cc1f06c9a2dbba33e547e','5b9534477462638c311d4e26f55aaecd11ff493d5400d7f46bae21062e567c4c',
  'da9cf1ee389a65c78711c14c711d2bffb07b8ee49381f67bf3a1cd8b026c05fb','1b76e98627b207237cf3f1bd3c9150d659cd325b9fb932dce9bc712c846b427d',
  'd6b579c1e3ac5d0061eb03263a31d895bd00c528dc73d2afdd0854598008facf','2b64c5838df34ece0b87cc4ae73df1824a709ae63f4410f5f69d4cccccaa371b',
  '797a4f654de97146892cf0ff39c4eaf36bb1be4b47f6aeab2479b6e2d8c0ebdc','25074b776425b7ecfdd8c8ca13dea9f027fceeb80f3ae95fe374d2b1fc12dae0'])
 assert.ok(jobs.every(job=>job.country==='India'&&job.company==='Grab'&&job.sourceDetailComplete&&job.sourceClosingReconciled&&job.lifecycleCleanupAllowed===false))
 assert.equal(jobs[0].postingDate,'2026-11-12T05:00:07.000Z');assert.equal(jobs.at(-1).postingDate,'2026-07-20T04:10:08.000Z')
 assert.ok(jobs.every(job=>job.sourceNativeJobRecord.apijobid===job.jobId&&job.sourceNativeJobPosting.identifier===job.requisitionId&&!job.applicationVisited))
 assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,431);assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount,431)
 assert.equal(jobs.nativeCollectionEvidence.observedIndiaCount,10);assert.equal(jobs.nativeCollectionEvidence.observedForeignCount,421)
 assert.equal(jobs.nativeCollectionEvidence.openingClosingRecordsMatch,true);assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessment=assessSoftFailureAcquisition(provider,jobs)
 assert.equal(assessment.runnerOutcome.success,true);assert.ok(assessment.filterCounts.old>0)
 assert.ok(transport.requests.every(url=>!url.includes('jobs.smartrecruiters.com')))
})

test('Grab body-only callbacks cannot certify the current native contract',async()=>{
 await assert.rejects(scraper().run({fetchText:async()=>fixture.responses[0].body}),/Original HTTP metadata is required/)
})

test('Grab registered collector preserves all ten complete India roles with the exact current dataLayer entity',async()=>{
 const transport=replay((url,row)=>url===datalayerVariant.url?structuredClone(datalayerVariant):row)
 const jobs=await scraper().run({fetchImpl:transport.read})
 assert.deepEqual(jobs.map(job=>job.jobId),ids)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.sourceClosingReconciled&&job.lifecycleCleanupAllowed===false))
 assert.equal(jobs.nativeCollectionEvidence.openingClosingRecordsMatch,true)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

const changeRecord=(xml,id,change)=>xml.replace(/<job>[\s\S]*?<\/job>/g,value=>value.includes('<apijobid><![CDATA['+id+']]></apijobid>')?change(value):value)

test('Grab closing reconciliation withholds changed and removed records before enforcing an output cap',async()=>{
 const transport=replay((url,row,count)=>{
  if(url===FEED_URL&&count===2){
   row.body=changeRecord(row.body,ids[0],job=>job.replace(/<lastactivitydate>[\s\S]*?<\/lastactivitydate>/,'<lastactivitydate><![CDATA[Sat, 14 Nov 2026 12:00:00 GMT]]></lastactivitydate>'))
   row.body=changeRecord(row.body,ids.at(-1),()=> '')
  }
  if(url===BOARD_URL&&count===2)row.body=row.body.replace('of <strong>431</strong>','of <strong>430</strong>')
  return row
 })
 const jobs=await scraper().run({fetchImpl:transport.read,maxJobs:1})
 assert.deepEqual(jobs.map(job=>job.jobId),['744000159351149'])
 assert.equal(jobs.nativeCollectionEvidence.openingClosingRecordsMatch,false)
 assert.equal(jobs.nativeCollectionEvidence.outputLimited,true)
 assert.deepEqual(jobs.nativeCollectionEvidence.holds.map(hold=>[hold.nativeId,hold.reason]),[
  ['744000161218849','native-record-missing-or-changed-at-closing'],['744000138554499','native-record-missing-or-changed-at-closing']])
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('Grab never infers country from Bangalore or publishes intake-only criteria',async()=>{
 const transport=replay((url,row)=>{
  if(url===FEED_URL){
   row.body=changeRecord(row.body,ids[0],job=>job.replace('<country><![CDATA[India]]></country>','<country><![CDATA[]]></country>'))
   row.body=changeRecord(row.body,ids[1],job=>job.replace('<country><![CDATA[India]]></country>','<country><![CDATA[Malaysia]]></country>'))
   row.body=changeRecord(row.body,ids[2],job=>job.replace(/<description>[\s\S]*?<\/description>/,'<description><![CDATA[<p>Apply now</p>]]></description>'))
  }
  return row
 })
 const jobs=await scraper().run({fetchImpl:transport.read})
 assert.deepEqual(jobs.map(job=>job.jobId),ids.slice(3))
 assert.equal(jobs.nativeCollectionEvidence.observedIndiaCount,8)
 assert.equal(jobs.nativeCollectionEvidence.observedForeignCount,422)
 assert.equal(jobs.nativeCollectionEvidence.unknownCountryCount,1)
 assert.deepEqual(jobs.nativeCollectionEvidence.holds.map(hold=>[hold.nativeId,hold.reason]),[
  ['744000161218849','native-country-unqualified'],['744000156946578','native-full-criteria-unavailable']])
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('Grab quarantines an explicitly closed role still present in the native feed and keeps the remaining inventory open',async()=>{
 const notice='Get to Know the Role - This position is closed. We are no longer accepting applications.'
 const transport=replay((url,row)=>{
  if(url===FEED_URL)row.body=changeRecord(row.body,ids[0],job=>job.replaceAll('Get to Know the Role',notice))
  if(url.includes('/'+ids[0]+'/'))row.body=row.body.replaceAll('Get to Know the Role',notice)
  return row
 })
 const jobs=await scraper().run({fetchImpl:transport.read})
 assert.deepEqual(jobs.map(job=>job.jobId),ids.slice(1))
 assert.equal(jobs.nativeCollectionEvidence.observedIndiaCount,10)
 assert.deepEqual(jobs.nativeCollectionEvidence.holds.map(hold=>[hold.nativeId,hold.reason]),[['744000161218849','native-role-explicitly-unavailable']])
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('Grab registered collector rejects hidden criteria even when feed, native data and visible DOM all carry the same class',async()=>{
 const replacement="<strong class='d-lg-none'>Get to Know the Role</strong>"
 const transport=replay((url,row)=>{
  if(url===FEED_URL)row.body=changeRecord(row.body,ids[0],job=>job.replaceAll('Get to Know the Role',replacement))
  if(url.includes('/'+ids[0]+'/'))row.body=row.body.replaceAll('Get to Know the Role',replacement)
  return row
 })
 await assert.rejects(scraper().run({fetchImpl:transport.read}),error=>error.nativeAuthorityFailure===true&&error.softFailure===true&&error.lifecycleCleanupAllowed===false)
})

test('Grab rejects a truncated feed instead of accepting an unknown zero',async()=>{
 const transport=replay((url,row)=>{
  if(url===FEED_URL)row.body=row.body.replace(/<job>[\s\S]*?<\/job>/g,'')
  return row
 })
 await assert.rejects(scraper().run({fetchImpl:transport.read}),/board\/feed count/)
})

for(const [label,change] of [
 ['immutable renderer changes',(url,row)=>/\/phb\/dataLayer\.js\./.test(url)?{...row,body:row.body+'\n/* changed */'}:row],
 ['HTML MIME changes',(url,row)=>url===BOARD_URL?{...row,headers:{'content-type':'application/json'}}:row],
 ['HTTP redirect changes',(url,row)=>url===BOARD_URL?{...row,status:302,headers:{...row.headers,location:'https://example.test/jobs/'}}:row],
 ['final URL changes',(url,row)=>url===BOARD_URL?{...row,finalUrl:'https://example.test/jobs/'}:row],
 ['JS entity gains a UTF-8 BOM',(url,row)=>/\/phb\/dataLayer\.js\./.test(url)?{...row,body:'\ufeff'+row.body}:row],
 ['CSS entity gains a UTF-8 BOM',(url,row)=>url.includes('/phb/style.css.')?{...row,body:'\ufeff'+row.body}:row],
 ['CSS bytes add a qualification',(url,row)=>url.includes('/phb/style.css.')?{...row,body:row.body+'\n.cms-content:after{content:"Unpaired mandatory qualification"}'}:row],
 ['CSS MIME changes',(url,row)=>url.includes('/phb/style.css.')?{...row,headers:{'content-type':'text/html'}}:row]
])test('Grab registered collector fails closed when '+label,async()=>{
 const transport=replay(change)
 await assert.rejects(scraper().run({fetchImpl:transport.read}),error=>error.softFailure===true&&error.lifecycleCleanupAllowed===false)
})

test('Grab preserves opaque pre-aborted caller cancellation without reads',async()=>{
 const controller=new AbortController(),reason=Object.freeze({stop:'caller pre-abort'});controller.abort(reason)
 let requests=0
 await assert.rejects(scraper().run({signal:controller.signal,fetchImpl:()=>{requests++;throw Error('unexpected read')}}),error=>error===reason)
 assert.equal(requests,0)
})

test('Grab releases a late response exactly once after opaque caller cancellation',async()=>{
 const controller=new AbortController(),reason=Object.freeze({stop:'caller late response'});let resolveFetch,cancels=0
 const running=scraper().run({signal:controller.signal,fetchImpl:()=>new Promise(resolve=>{resolveFetch=resolve})})
 while(!resolveFetch)await new Promise(resolve=>setImmediate(resolve))
 controller.abort(reason);await assert.rejects(running,error=>error===reason)
 const response=new Response(new ReadableStream({cancel(value){assert.equal(value,reason);cancels++}}),{headers:{'content-type':'text/html'}})
 Object.defineProperty(response,'url',{value:BOARD_URL});resolveFetch(response)
 await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve))
 assert.equal(cancels,1)
})

test('Grab preserves opaque caller cancellation during mandatory read spacing',async()=>{
 const controller=new AbortController(),reason=Object.freeze({stop:'caller read spacing'}),transport=replay()
 const running=createGrabScraper().run({signal:controller.signal,fetchImpl:transport.read})
 const timer=setTimeout(()=>controller.abort(reason),75)
 try{await assert.rejects(running,error=>error===reason)}finally{clearTimeout(timer)}
 assert.equal(transport.requests.length,1)
})

test('Grab source deadline keeps its timeout classification during mandatory read spacing',async()=>{
 const transport=replay()
 await assert.rejects(createGrabScraper().run({sourceTimeoutMs:75,fetchImpl:transport.read}),error=>error.name==='TimeoutError')
 assert.equal(transport.requests.length,1)
})

for(const [label,limits] of [
 ['request',{requestTimeoutMs:25}],['whole-source',{sourceTimeoutMs:25}]
])test('Grab enforces its '+label+' deadline for an uncooperative transport',async()=>{
 const started=performance.now()
 await assert.rejects(scraper().run({...limits,fetchImpl:()=>new Promise(()=>{})}),error=>error.name==='TimeoutError')
 assert.ok(performance.now()-started<2000)
})

test('Grab caller cancellation at closing returns no partial inventory',async()=>{
 const controller=new AbortController(),reason=Object.freeze({stop:'caller closing'}),transport=replay((url,row,count)=>{
  if(url===FEED_URL&&count===2)controller.abort(reason)
  return row
 })
 await assert.rejects(scraper().run({signal:controller.signal,fetchImpl:transport.read}),error=>error===reason)
})

test('Grab rejects attempts to expand source or request deadlines',async()=>{
 for(const limits of [{requestTimeoutMs:15001},{sourceTimeoutMs:180001}]){
  await assert.rejects(scraper().run({...limits,fetchImpl:()=>{throw Error('unexpected read')}}),RangeError)
 }
})
