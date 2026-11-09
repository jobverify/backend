import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import assert from 'node:assert/strict'
import test from 'node:test'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
const HOME='https://www.avanade.com/en/career',SEARCH=HOME+'/search-jobs',ROLE=HOME+'/job-details/'
const API='https://avanadesc9productionlk3bs0x7.org.coveo.com/rest/search/v2?organizationId=avanadesc9productionlk3bs0x7'
const BOARD=API+'&firstResult=0', now=()=> '2026-10-23T12:00:00.000Z'
const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261023.json.gz',import.meta.url))))
function mock({synthetic=0,mutate=p=>p}={}){
 const pack=fixture(),calls=[],first=JSON.parse(Buffer.from(pack.requests.find(p=>p.url===BOARD).rawBodyBase64,'base64'))
 let rows=first.results.filter(r=>['R00362368','R00360205'].includes(r.raw.jobid))
 if(synthetic)rows=Array.from({length:synthetic},(_,i)=>JSON.parse(JSON.stringify(rows[0]).split('R00362368').join('R'+String(362368+i).padStart(8,'0'))))
 return {calls,async transport(url,request){
  calls.push({url,method:request.method});let packet
  if(url.startsWith(API+'&')){
   assert.equal(request.method,'POST');assert.match(request.headers.Authorization,/^Bearer .+/)
   const body=JSON.parse(request.body);assert.equal(Object.hasOwn(body,'firstResult'),false)
   assert.equal(body.q,'@jobcountryid == 19821');assert.equal(body.numberOfResults,12)
   const offset=Number(new URL(url).searchParams.get('firstResult'))
   packet={url,status:200,headers:{'content-type':'application/json'},body:Buffer.from(JSON.stringify({...first,totalCount:rows.length,totalCountFiltered:rows.length,results:rows.slice(offset,offset+12)})),bodyComplete:true}
  }else{
   assert.equal(request.method,'GET')
   const stored=pack.requests.find(p=>p.url===url)||url.startsWith(ROLE)&&pack.requests.find(p=>p.url===ROLE+'R00362368')
   assert.ok(stored,url);let body=Buffer.from(stored.rawBodyBase64,'base64')
   if(url.startsWith(ROLE)){
    const row=rows.find(r=>url===ROLE+r.raw.jobid);assert.ok(row)
    const html=body.toString(),match=/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html),next=JSON.parse(match[1])
    next.props.pageProps.jobDetails=structuredClone(row);next.query={id:row.raw.jobid}
    body=Buffer.from(html.replace(match[1],()=>JSON.stringify(next)))
   }
   packet={...stored,url,body,bodyComplete:true}
  }
  return mutate(packet,calls)
 }}
}
const editDetail=(p,action)=>{
 const html=p.body.toString(),match=/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html),next=JSON.parse(match[1]);action(next)
 return{...p,body:Buffer.from(html.replace(match[1],()=>JSON.stringify(next)))}
}
const editListing=(p,action)=>{const data=JSON.parse(p.body);action(data);return{...p,body:Buffer.from(JSON.stringify(data))}}

test('Avanade sentinel becomes native India roles with full sections and original epoch dates',async()=>{
 const m=mock(),jobs=await run({transport:m.transport,now});assert.equal(jobs.length,2)
 const job=jobs.find(j=>j.jobId==='R00362368'),raw=job.nativeFacts.nativeAPIRecord.raw
 assert.equal(job.company,'Avanade');assert.equal(job.country,'India');assert.equal(job.city,'Bengaluru');assert.equal(job.state,'Karnataka')
 assert.equal(job.postingDate,new Date(raw.jobposteddate).toISOString());assert.notEqual(job.postingDate,new Date(raw.jobcreatedon).toISOString())
 assert.equal(job.nativeOriginalPostingEpoch,raw.jobposteddate)
 assert.equal(job.sourceDescription,raw.jobdescription+'\n\n'+raw.qualification)
 assert.equal(job.applyUrl,raw.apply_url);assert.equal(job.sourceUrl,ROLE+job.jobId)
 assert.equal(job.applicationVisited,false);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 assert.equal(job.nativeCollectionEvidence.pagesFetched,1);assert.equal(job.nativeCollectionEvidence.closingInventoryMatches,true)
 assert.equal(job.nativeCollectionEvidence.failures.length,0);assert.equal(readInventoryEvidence(jobs).reportedTotal,2)
 assert.ok(m.calls.every(p=>!p.url.includes('myworkdayjobs.com')))
})

test('native offset pagination includes all25 synthetic roles and retained physical request proofs',async()=>{
 const m=mock({synthetic:25}),jobs=await run({transport:m.transport,now});assert.equal(jobs.length,25,JSON.stringify(jobs[0]?.nativeCollectionEvidence.failures))
 const c=jobs[0].nativeCollectionEvidence;assert.equal(c.pagesFetched,3);assert.equal(c.observedListingCount,25)
 assert.equal(c.retainedResponses.length,33);assert.equal(c.listingPaginationComplete,true)
 assert.ok(c.retainedResponses.filter(p=>p.url.startsWith(API)).every(p=>p.provenance.nativeReadRequest.method==='POST'&&!p.provenance.nativeReadRequest.body.includes('firstResult')))
 assert.equal(Object.hasOwn(jobs[1].nativeCollectionEvidence,'retainedResponses'),false)
})

test('old posting dates remain old even when native index and import clocks are recent',async()=>{
 const m=mock({mutate:p=>!p.url.startsWith(API)&&!p.url.startsWith(ROLE)?p:p.url.startsWith(API)?editListing(p,d=>{d.results[1].raw.jobposteddate=d.results[1].raw.job_posted_date=Date.parse('2026-07-01T00:00:00.000Z')})
  :p.url.endsWith('R00360205')?editDetail(p,d=>{d.props.pageProps.jobDetails.raw.jobposteddate=d.props.pageProps.jobDetails.raw.job_posted_date=Date.parse('2026-07-01T00:00:00.000Z')}):p})
 const jobs=await run({transport:m.transport,now}),analysis=analyzePublishableJobs(jobs,{now:new Date(now())})
 assert.equal(jobs.length,2);assert.equal(analysis.eligibleJobs.length,1);assert.equal(analysis.filterCounts.old,1)
})

test('missing content and identity,country,date or application conflicts retain explicit detail gaps',async()=>{
 for(const kind of ['description','qualification','id','country','date','application','HTTP']){
  const m=mock({mutate:p=>p.url!==ROLE+'R00360205'?p:kind==='HTTP'?{...p,status:503}:editDetail(p,next=>{
   const r=next.props.pageProps.jobDetails.raw
   if(kind==='description')r.jobdescription=r.job_description=''
   if(kind==='qualification')r.qualification=''
   if(kind==='id')r.jobid='R00000000'
   if(kind==='country')r.jobcountry='Singapore'
   if(kind==='date')r.jobposteddate=r.job_posted_date=Date.parse('2099-01-01')
   if(kind==='application')r.apply_url=r.apply_url.replace('AvanadeCareers','OtherCompany')
  })}),jobs=await run({transport:m.transport,now})
  assert.equal(jobs.length,1,kind);assert.equal(jobs[0].nativeCollectionEvidence.failures.length,1,kind)
  assert.equal(jobs[0].nativeCollectionEvidence.unknownRawFailures.length,1,kind)
 }
})

test('partial pages retain extracted jobs and never authorize deletion',async()=>{
 const m=mock({synthetic:25,mutate:p=>p.url===API+'&firstResult=12'?{...p,status:503}:p}),jobs=await run({transport:m.transport,now})
 assert.equal(jobs.length,12);assert.equal(jobs[0].nativeCollectionEvidence.listingPaginationComplete,false)
 assert.equal(jobs[0].nativeCollectionEvidence.cleanupAllowed,false)
})

test('scoped zero is distinguished from missing inventory and remains coverage-gap',async()=>{
 const m=mock({mutate:p=>p.url!==BOARD?p:editListing(p,d=>{d.totalCount=d.totalCountFiltered=0;d.results=[]})}),jobs=await run({transport:m.transport,now})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).reportedTotal,0)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(jobs[Symbol.for('jobverify.native-html-evidence')].verifiedZeroInventory,false)
 for(const target of [HOME,SEARCH,BOARD])await assert.rejects(run({transport:mock({mutate:p=>p.url===target?{...p,status:503}:p}).transport,now}))
})

test('closing inventory detects business mutations',async()=>{
 const m=mock({mutate:(p,calls)=>p.url!==BOARD?p:editListing(p,d=>{if(calls.filter(c=>c.url===BOARD).length===2)d.results[0].raw.job_name='Changed'})})
 const jobs=await run({transport:m.transport,now});assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches,false)
})

test('unverified listing rows retain raw counts and cannot establish an empty inventory',async()=>{
 const m=mock({mutate:p=>!p.url.startsWith(API)?p:editListing(p,d=>{d.results[1].raw.jobcountry='Singapore'})}),jobs=await run({transport:m.transport,now})
 assert.equal(jobs.length,1);const c=jobs[0].nativeCollectionEvidence
 assert.equal(c.nativeReportedTotal,2);assert.equal(c.observedListingCount,2);assert.equal(c.unknownRawFailures.length,1)
 assert.equal(c.listingPaginationComplete,false);assert.equal(c.verifiedZeroInventory,false)
})

test('index and import clock changes alone retain stable business identity and original publication',async()=>{
 const m=mock({mutate:p=>!p.url.startsWith(ROLE)?p:editDetail(p,d=>{
  const r=d.props.pageProps.jobDetails.raw;r.jobcreatedon+=1000;r.jobupdatedon+=1000;r.sysindexeddate+=1000
 })}),jobs=await run({transport:m.transport,now})
 assert.equal(jobs.length,2);assert.equal(jobs[0].nativeCollectionEvidence.failures.length,0)
 assert.ok(jobs.every(j=>j.postingDate===new Date(j.nativeOriginalPostingEpoch).toISOString()))
})

test('missing,conflicting and truncated native totals remain unknown failures',async()=>{
 for(const kind of ['missing','conflict','truncated']){
  const m=mock({mutate:p=>p.url!==BOARD?p:editListing(p,d=>{
   if(kind==='missing')delete d.totalCount
   if(kind==='conflict')d.totalCountFiltered++
   if(kind==='truncated')d.results.pop()
  })})
  await assert.rejects(run({transport:m.transport,now}),error=>{assert.equal(error.nativeEvidence.verifiedZeroInventory,false);return true})
 }
})

test('public source rejects unlisted roles,other tenants,credentials,scopes and application actions',async()=>{
 const {createSourceConfig}=await import('./parser.js'),config=createSourceConfig({now})
 for(const url of [API+'&firstResult=1',API+'&firstResult=-12',API.replace('avanadesc9productionlk3bs0x7','other')+'&firstResult=0',BOARD+'&q=other',ROLE+'R00362368','https://user:password@www.avanade.com/en/career',HOME+'/login'])assert.throws(()=>config.validateURL(url))
})

test('access denial stops new native reads with no retries or empty success',async()=>{
 const m=mock({mutate:p=>p.url===BOARD?{...p,status:403}:p})
 await assert.rejects(run({transport:m.transport,now}),error=>{assert.equal(error.nativeEvidence.verifiedZeroInventory,false);return true})
 assert.equal(m.calls.filter(c=>c.url===BOARD).length,1);assert.equal(m.calls.length,5)
})

test('normal fetch transport uses only public GETs and read-only search POSTs with credentials omitted',async()=>{
 const m=mock(),methods=[]
 await run({now,fetchImpl:async(url,request)=>{
  assert.equal(request.credentials,'omit');assert.equal(request.redirect,'manual');methods.push(request.method)
  const p=await m.transport(url,request)
  return{url,status:p.status,headers:new Headers(p.headers),body:new ReadableStream({start(c){c.enqueue(p.body);c.close()}})}
 }})
 assert.equal(methods.filter(m=>m==='POST').length,2);assert.equal(methods.filter(m=>m==='GET').length,6)
})
