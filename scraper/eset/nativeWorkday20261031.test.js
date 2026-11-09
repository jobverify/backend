import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {run} from './script.js'
import {createFailClosedSentinelScraper} from './failClosedSentinel.js'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {isWorkdayBackedProvider} from '../../scraper-support/providers/sourcePaths.js'
import {acquireWorkdaySourceAdmission} from '../../scraper-support/shared/workdaySourceAdmission.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {resolveZeroJobOutcome} from '../../scraper-support/runner.js'
const load=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/2026-10-31-'+name+'.json.gz',import.meta.url))))
const official=load('official'),native=load('native-vanity')
const PRIMARY='https://www.eset.com/us/about/careers/',VANITY='https://jobs.eset.com/en-US/ESET_External'
const BOARD='https://eset.wd3.myworkdayjobs.com/ESET_External',API='https://eset.wd3.myworkdayjobs.com/wday/cxs/eset/ESET_External/jobs'
const asResponse=page=>{
 const result=new Response(page.body,{status:page.status,headers:page.headers||{'content-type':'text/html'}})
 Object.defineProperty(result,'url',{value:page.finalUrl||page.url})
 for(const key of ['capturedAt','startedAt'])if(Object.hasOwn(page,key))Object.defineProperty(result,key,{value:page[key]})
 return result
}
const options={requestTimeoutMs:1000,retryBaseDelayMs:0,requestScheduler:{acquire:async()=>()=>{},recordRateLimit(){}}}

test('registered default HTTP consumes actual ESET handoffs and keeps controlled board-zero separate from company authority',async t=>{
 const seen=[]
 t.mock.method(globalThis,'fetch',async(url,init={})=>{
  seen.push(url)
  if(url===PRIMARY)return asResponse(official)
  if(url===VANITY)return asResponse(native)
  if(url===BOARD)return asResponse({url,status:200,body:'<html><body>Controlled bootstrap response.</body></html>'})
  assert.equal(url,API);assert.equal(init.method,'POST')
  assert.deepEqual(JSON.parse(init.body),{appliedFacets:{},limit:20,offset:0,searchText:''})
  return asResponse({url,status:200,headers:{'content-type':'application/json'},body:JSON.stringify({total:0,jobPostings:[]})})
 })
 const provider=getScraperCatalog().find(row=>row.source==='eset')
 const jobs=await createCatalogScraper(provider).run(options)
 assert.deepEqual(seen,[PRIMARY,VANITY,BOARD,API,API,API])
 assert.equal(jobs.length,0)
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(evidence.verifiedAt,null)
 assert.equal(resolveZeroJobOutcome({provider},jobs,[]),'coverage-gap')
 assert.deepEqual(readSourceObservationEvidence(jobs,'eset'),{source:'eset',recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
})

test('ESET uses the real Workday shard admission and has no static verified counts or clocks',async()=>{
 const provider=getScraperCatalog().find(row=>row.source==='eset')
 assert.equal(provider.adapter,'script');assert.equal(provider.atsPlatform,'workday')
 assert.equal(isWorkdayBackedProvider(provider),true)
 assert.equal(provider.baseUrl,BOARD)
 for(const key of ['verifiedAt','verifiedOn','verifiedPublicJobCount','verifiedIndiaJobCount','companyGlobalTotal','companyIndiaTotal','officialBindingVerifiedAt','bindingEvidence','recruitmentCandidate'])assert.equal(provider[key],null)
 const lease=await acquireWorkdaySourceAdmission({name:'eset',provider})
 assert.ok(lease)
 try{assert.equal(lease.groupKey,'workday:wd3')}finally{lease.release()}
})

test('source and legacy entrypoint preserve immutable caller cancellation without native reads',async t=>{
 const controller=new AbortController(),reason=Object.freeze(Error('controlled ESET caller stop'))
 controller.abort(reason)
 let calls=0
 t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('Unexpected HTTP after cancellation')})
 for(const operation of [run,createFailClosedSentinelScraper().run])await assert.rejects(operation({signal:controller.signal}),error=>error===reason)
 assert.equal(calls,0)
})

test('registered ESET and a distinct wd3 source lease share shard admission without overlap',async()=>{
 const provider=getScraperCatalog().find(row=>row.source==='eset')
 const first=await acquireWorkdaySourceAdmission({name:'eset',provider})
 assert.ok(first)
 let second,admitted=false,waited=0
 try{
  const pending=acquireWorkdaySourceAdmission({name:'distinct-wd3-source-control',provider:{...provider,source:'distinct-wd3-source-control'}},{onWait(){waited++}}).then(value=>{admitted=true;return value})
  await Promise.resolve()
  assert.equal(waited,1);assert.equal(admitted,false)
  first.release()
  second=await pending
  assert.equal(second.groupKey,'workday:wd3')
 }finally{first.release();second?.release()}
})

test('current primary denial is unavailable and cannot become a sentinel zero or an ATS fallback',async t=>{
 let calls=0
 t.mock.method(globalThis,'fetch',async url=>{calls++;assert.equal(url,PRIMARY);return asResponse({...official,status:403,body:'Access denied'})})
 await assert.rejects(run(options),error=>error.abortRetries===true)
 assert.equal(calls,1)
})

test('registered ESET rejects replaced literal native identity before bootstrap or inventory IO',async t=>{
 const bodies=[
  native.body.replace(/<script\b/i,'<script>var workday={tenant:"other",siteId:"Other"};</script><script'),
  ...['Object.defineProperty(window,"workday",{value:{tenant:"other",siteId:"Other"}});','var cfg=window.workday;cfg.tenant="other";','globalThis.workday={tenant:"other",siteId:"Other"};'].map(payload=>native.body.replace('</head>','<script>'+payload+'</script></head>')),
 ]
 for(const body of bodies){
  const calls=[]
  const mock=t.mock.method(globalThis,'fetch',async(url,init={})=>{
   calls.push(url)
   if(url===PRIMARY)return asResponse(official)
   if(url===VANITY)return asResponse({...native,body})
   if(url===BOARD)return asResponse({url,status:200,body:'<html><body>Controlled bootstrap.</body></html>'})
   assert.equal(url,API);assert.equal(init.method,'POST')
   return asResponse({url,status:200,headers:{'content-type':'application/json'},body:JSON.stringify({total:0,jobPostings:[]})})
  })
  try{
   const provider=getScraperCatalog().find(row=>row.source==='eset')
   await assert.rejects(createCatalogScraper(provider).run(options),error=>error.name==='WorkdayIncompleteScopeError'&&error.abortRetries===true)
   assert.deepEqual(calls,[PRIMARY,VANITY])
  }finally{mock.mock.restore()}
 }
})

const continuation=load('native-continuation')
const completedNativePackets=[official,native,...continuation.pilotAttempts.filter(packet=>typeof packet.body==='string'),...continuation.remainingResponses]
for(const packet of completedNativePackets)assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
assert.equal(continuation.pilotAttempts.length,20)
assert.equal(continuation.pilotAttempts.filter(packet=>typeof packet.body!=='string').length,2)
const currentIndiaUrl=API.replace(/\/jobs$/,'')+'/job/India/Business-Development-Manager-II_JR-05944'
const packetKey=(url,method,body)=>JSON.stringify([url,method||'GET',body??null])
const replayNativeContinuation=async(t,{mutateIndia}={})=>{
 const byRequest=new Map(),calls=[]
 for(const packet of completedNativePackets){const key=packetKey(packet.url,packet.method,packet.requestBody);if(!byRequest.has(key))byRequest.set(key,[]);byRequest.get(key).push(packet)}
 let indiaReads=0
 t.mock.method(globalThis,'fetch',async(url,init={})=>{
  init.signal?.throwIfAborted()
  const packet=byRequest.get(packetKey(String(url),init.method,init.body))?.shift()
  assert.ok(packet,'No uncaptured request or replacement native response: '+url)
  calls.push({url:String(url),status:packet.status,originalCapturedAt:packet.capturedAt,sha256:packet.sha256})
  if(String(url)===currentIndiaUrl){
   indiaReads++
   if(mutateIndia){const payload=JSON.parse(packet.body);mutateIndia(payload,{closing:indiaReads===2});return asResponse({...packet,body:JSON.stringify(payload)})}
  }
  return asResponse(packet)
 })
 const provider=getScraperCatalog().find(row=>row.source==='eset')
 // Only scheduler waiting/attempt timing are controlled here. The registered
 // default HTTP/body/native parser remains actual; the separate diagnostic
 // replays these same packets with the normal scheduler and source defaults.
 const jobs=await createCatalogScraper(provider).run(options)
 return{jobs,calls,indiaReads,remaining:[...byRequest.values()].reduce((count,items)=>count+items.length,0)}
}

test('actual captured ESET India employer declaration qualifies that same native vacancy without company-scope authority',async t=>{
 const{jobs,calls,indiaReads,remaining}=await replayNativeContinuation(t)
 assert.equal(calls.length,78);assert.equal(remaining,0);assert.equal(indiaReads,2)
 assert.equal(jobs.length,1)
 const job=jobs[0],payload=JSON.parse(completedNativePackets.find(packet=>packet.url===currentIndiaUrl).body)
 assert.equal(job.title,'Business Development Manager II');assert.equal(job.requisitionId,'JR-05944')
 assert.equal(job.company,'ESET');assert.equal(job.source,'eset');assert.equal(job.country,'India')
 assert.equal(job.nativeEmployer,'ESET Software India Private Limited')
 assert.equal(job.sourceDescription,payload.jobPostingInfo.jobDescription)
 assert.equal(job.applyUrl,payload.jobPostingInfo.externalUrl)
 assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceListingComplete,false);assert.equal(job.sourceScopeComplete,false)
 assert.equal(job.lifecycleCleanupAllowed,false)
 const observation=readSourceObservationEvidence(jobs,'eset'),inventory=readInventoryEvidence(jobs)
 assert.equal(observation.observedRecordCount,69);assert.equal(observation.companyGlobalTotal,null);assert.equal(observation.companyIndiaTotal,null)
 assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null);assert.equal(inventory.verifiedAt,null)
 assert.ok(!calls.some(call=>/\/job\/Singapore\//.test(call.url)),'Four explicit-foreign listing rows remain unread, with no invented JDs')
})

test('controlled literal ESET employer remains accepted with the same native identity and closing reads',async t=>{
 const{jobs,indiaReads}=await replayNativeContinuation(t,{mutateIndia:payload=>{payload.hiringOrganization.name='ESET'}})
 assert.equal(jobs.length,1);assert.equal(jobs[0].nativeEmployer,'ESET');assert.equal(indiaReads,2)
})

for(const name of['Other Employer Private Limited','ESET Software India Pvt Ltd','ESET Software India Private Limited Branch','ESET Software India Private Limited ',null]){
 test('ESET exact native declaration match rejects unrelated/similar or absent employer '+JSON.stringify(name),async t=>{
  await assert.rejects(replayNativeContinuation(t,{mutateIndia:payload=>{
   if(name===null)delete payload.hiringOrganization
   else payload.hiringOrganization.name=name
  }}),error=>error.name!=='AssertionError'&&/native employer unavailable or mismatched/.test(error.message))
 })
}

for(const[label,mutate]of[
 ['wrong tenant/site',info=>{info.jobPostingSiteId='Other_External'}],
 ['wrong native requisition',info=>{info.jobReqId='JR-99999'}],
 ['contradictory native country',info=>{info.country.descriptor='United States of America'}],
 ['changed closing title',info=>{info.title+=' Different role'}],
 ['changed closing full criteria',info=>{info.jobDescription+='<p>Controlled changed role responsibility.</p>'}],
 ['another board canonical URL',info=>{info.externalUrl=info.externalUrl.replace('/ESET_External/','/Other_External/')}],
])test('accepting the exact native ESET employer never bypasses '+label,async t=>{
 await assert.rejects(replayNativeContinuation(t,{mutateIndia:(payload,{closing})=>{if(closing)mutate(payload.jobPostingInfo)}}),
  error=>error.name!=='AssertionError'&&/native.*(?:mismatch|unavailable|conflict)|canonical|board|requisition|title|description/i.test(error.message))
})
