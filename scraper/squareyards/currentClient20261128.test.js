import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {setTimeout as delay} from 'node:timers/promises'
import {squareListing,runSquareNative,SQUARE_CAREERS} from './currentNative20261119.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const load=name=>JSON.parse(gunzipSync(readFileSync(new URL('./test-data/'+name,import.meta.url))))
const current=load('current-client-20261128.json.gz'),historical=load('current-native-20261119.json.gz')
const career=current.packets.find(p=>p.url===SQUARE_CAREERS),client=current.packets.find(p=>p.url.endsWith('.js'))
const oldClient='https://www.squareyards.com/assets/js/carriers-cc4012780b.min.js'
function replay(mutate=(body)=>body,options={}){
 const calls=[],counts=new Map()
 const run=runSquareNative({...options,requestIntervalMs:0,now:()=> '2026-11-28T04:00:00.000Z',fetchImpl:async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')
  const n=counts.get(url)??0;counts.set(url,n+1);calls.push(url)
  let packet,body
  if(url===SQUARE_CAREERS||url===client.url){packet=url===SQUARE_CAREERS?career:client;body=packet.body}
  else{packet=historical.responses.filter(row=>row.requestedUrl===url)[n];assert.ok(packet,'Undeclared compatibility read '+url);body=Buffer.from(packet.bodyBase64,'base64').toString()}
  const value=mutate(body,url,n)
  const response=Object.defineProperty(new Response(value,{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
  return response
 }})
 return {run,calls,counts}
}

test('current genuine frame selects only its exact declared career program',()=>{
 assert.equal(current.synthetic,false);assert.equal(current.validCurrentCheck,false);assert.equal(current.historicalRolePipelineReplayOnly,true)
 assert.equal(squareListing(career.body).program,client.url)
})

test('current client preserves the complete historical native pipeline while holding new browser application availability and formal detail authority',async()=>{
 let observed
 const {run,calls}=replay(undefined,{onAudit:a=>{observed=a;a.currentClientPassiveDataOnly=false;a.openingNativeRecords[0].row.positionName='callback mutation'}})
 const jobs=await run
 assert.ok(jobs.length>=25);assert.equal(jobs.nativeCollectionEvidence.openingNativeRecords.length,46)
 assert.equal(calls.filter(url=>url===client.url).length,2);assert.equal(calls.includes(oldClient),false)
 assert.equal(observed.currentClientPassiveDataOnly,false)
 assert.equal(jobs.nativeCollectionEvidence.currentClientPassiveDataOnly,true)
 assert.notEqual(jobs.nativeCollectionEvidence.openingNativeRecords[0].row.positionName,'callback mutation')
 for(const job of jobs){
  assert.equal(job.country,'India');assert.ok(job.nativeSourceRecord.description.length>100);assert.equal(job.sourceClosingQualified,true)
  assert.equal(job.currentClientPassiveDataOnly,true);assert.equal(job.sourceDetailComplete,false);assert.equal(job.publicExperienceChecked,false)
  assert.equal(job.sourceBrowserRenderingQualified,false);assert.equal(job.sourceApplicationQualified,false);assert.equal(job.sourceAvailabilityQualified,false)
  assert.equal(job.sourceCompanyScopeUnresolved,true)
  assert.equal(job.sourceNativeApplication,null)
 }
 assert.deepEqual(jobs.nativeCollectionEvidence.openingApplications,[]);assert.deepEqual(jobs.nativeCollectionEvidence.closingApplications,[])
 assert.equal(calls.some(url=>url.includes('/career_form/')),false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null);assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null)
})

test('two admitted career declarations cannot ambiguously select either native producer',()=>{
 const html=career.body+'<script src="'+oldClient+'"></script>'
 assert.throws(()=>squareListing(html),/ambiguous|declaration/)
})

test('an unknown or inert current producer declaration does not qualify the career page',()=>{
 const declared=new URL(client.url).pathname
 assert.throws(()=>squareListing(career.body.replace(declared,'/assets/js/carriers-unreviewed.min.js')),/declaration/)
 assert.throws(()=>squareListing(career.body.replace('src="'+declared+'"','type="application/json" src="'+declared+'"')),/declaration/)
})

test('whole current producer drift is terminal on either opening or closing read',async()=>{
 for(const phase of [0,1])await assert.rejects(replay((body,url,n)=>url===client.url&&n===phase?body+'\n/* producer drift */':body).run,/whole declared program/)
})

test('the full raw closing model still rejects non-displayed recruiter metadata drift',async()=>{
 await assert.rejects(replay((body,url,n)=>{
  if(url===SQUARE_CAREERS+'/Sales'&&n===1){const data=JSON.parse(body);data.data[0].recuiterId+=1;return JSON.stringify(data)}
  return body
 }).run,/closing full inventory/)
})

test('an unknown per-role country field remains held without losing the full raw observation',async()=>{
 const jobs=await replay((body,url)=>{
  if(url===SQUARE_CAREERS+'/Sales'){const data=JSON.parse(body);data.data[0].country='United States';return JSON.stringify(data)}
  return body
 }).run
 const audit=jobs.nativeCollectionEvidence,held=audit.held.find(row=>row.originalRecord?.country==='United States')
 assert.ok(held);assert.equal(jobs.some(job=>job.jobId===String(held.id)),false)
 assert.equal(audit.openingNativeRecords[0].row.country,'United States')
})

test('explicit current response challenges are terminal before native JSON interpretation',async()=>{
 for(const headers of [{'cf-mitigated':'challenge'},{'x-amzn-waf-action':'challenge'}]){
  let reads=0
  await assert.rejects(runSquareNative({requestIntervalMs:0,fetchImpl:async url=>{reads++;return Object.defineProperty(new Response(career.body,{status:200,headers:{'content-type':'text/html',...headers}}),'url',{value:url})}}),error=>error.httpStatus===200&&error.abortRetries===true)
  assert.equal(reads,1)
 }
})

test('opaque caller cancellation starts no current native GET and retains the exact reason',async()=>{
 const controller=new AbortController();controller.abort(null);let calls=0
 await assert.rejects(runSquareNative({signal:controller.signal,fetchImpl:async()=>{calls++;throw Error('unexpected')}}),error=>error===null)
 assert.equal(calls,0)
})

test('typed current HTTP denials preserve status and retry metadata without another GET',async()=>{
 for(const status of [403,429,503]){
  let calls=0
  await assert.rejects(runSquareNative({requestIntervalMs:0,fetchImpl:async url=>{calls++;return Object.defineProperty(new Response('held',{status,headers:{'retry-after':'7','content-type':'text/html'}}),'url',{value:url})}}),error=>error.httpStatus===status&&(status===403||error.retryDelayMs===7000))
  assert.equal(calls,1)
 }
})

test('a late response after a local deadline is disposed without interpreting a current frame',async()=>{
 let disposed=0,reads=0
 const response={status:200,url:SQUARE_CAREERS,headers:new Headers({'content-type':'text/html'}),body:{cancel:async()=>{disposed++},async *[Symbol.asyncIterator](){reads++;yield Buffer.from(career.body)}}}
 await assert.rejects(runSquareNative({timeoutMs:10,requestIntervalMs:0,fetchImpl:async()=>{await delay(45);return response}}),/deadline/)
 await delay(70);assert.equal(disposed,1);assert.equal(reads,0)
})

test('wrapping the default response reader cannot bypass its minimum public pacing',async()=>{
 await assert.rejects(runSquareNative({requestIntervalMs:0}),/transport limits|pacing/)
})

test('unknown current department country employer or eligibility metadata stops the entire unqualified cohort',async()=>{
 for(const phase of [0,1])await assert.rejects(replay((body,url,n)=>{
  if(url===SQUARE_CAREERS+'/Sales'&&n===phase){const data=JSON.parse(body);data.country='United States';return JSON.stringify(data)}
  return body
 }).run,/department metadata/)
})

test('an unknown current native employer vertical remains a raw held record',async()=>{
 const jobs=await replay((body,url)=>{
  if(url===SQUARE_CAREERS+'/Sales'){const data=JSON.parse(body);data.data[0].verticalName='Unreviewed sibling brand';return JSON.stringify(data)}
  return body
 }).run
 const audit=jobs.nativeCollectionEvidence,raw=audit.openingNativeRecords[0].row
 assert.equal(raw.verticalName,'Unreviewed sibling brand')
 assert.ok(audit.held.some(row=>row.id===raw.id&&/employer vertical/.test(row.reason)))
 assert.equal(jobs.some(job=>job.jobId===String(raw.id)),false)
})
