import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {buildScrapers,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=name=>JSON.parse(readFileSync(new URL('./fixtures/'+name+'.json',import.meta.url)))
const html=name=>readFileSync(new URL('./fixtures/'+name+'.html',import.meta.url),'utf8')
const client='ebed3959-fa8a-4719-b143-0730e1223ec8',homepage='https://www.volopay.com/'
const boardIo=`https://app.dover.io/dover/careers/${client}`,boardCom=boardIo.replace('.io/','.com/')
const base='https://app.dover.com/api/v1/',listing=base+`careers-page/${client}/jobs?format=json`
const date='2026-10-24T18:16:41.388Z'
const execute=async({mutate=()=>{},options={},block=null}={})=>{
  const requests=[],details=fixture('details'),originalFetch=globalThis.fetch
  let listingReads=0
  const fetchImpl=async(url,init={})=>{
    requests.push({url,...init});let kind,payload,mime='application/json',status=200,finalUrl=url,location
    if(url===homepage){kind='homepage';payload=html('official-binding');mime='text/html'}
    else if(url===boardIo){kind='redirect';payload='';mime='text/html';status=301;location=boardCom}
    else if(url===boardCom){kind='board';payload=html('board');mime='text/html'}
    else if(url===base+`careers-page/${client}?format=json`){kind='client';payload=fixture('client')}
    else if(url.split('?')[0]===listing.split('?')[0]){kind=++listingReads===1?'listing':'final-listing';payload=fixture(kind==='listing'?'listing-initial':'listing-final')}
    else if(url.startsWith(base+'inbound/application-portal-job/')){const id=url.split('/').at(-1).split('?')[0];kind='detail';payload=structuredClone(details[id]);if(!payload)throw Error('Foreign or unknown detail must not be hydrated: '+id)}
    else throw Error('Unexpected Volopay public request '+url)
    if(kind===block)throw Error('Controlled unavailable '+kind)
    const receipt={kind,payload,status,finalUrl,mime,location}
    await mutate(receipt,url,init)
    const body=typeof receipt.payload==='string'?receipt.payload:JSON.stringify(receipt.payload)
    return {url:receipt.finalUrl,status:receipt.status,ok:receipt.status>=200&&receipt.status<300,
      headers:{get:key=>key.toLowerCase()==='content-type'?receipt.mime:key.toLowerCase()==='location'?receipt.location:null},
      text:async()=>body,json:async()=>JSON.parse(body)}
  }
  // The registration test also reproduces the old apiPortal mapping before the
  // source-local override exists. No network is permitted through either path.
  globalThis.fetch=fetchImpl
  try{
    const scraper=buildScrapers().find(s=>s.name==='volopay')
    const jobs=await scraper.run({fetchImpl,now:()=>date,...options})
    return {jobs,requests}
  }finally{globalThis.fetch=originalFetch}
}

test('registered Volopay source recovers exact native employer HTML and declared publication days for all seven India jobs',async()=>{
  const {jobs,requests}=await execute(),details=fixture('details')
  assert.equal(jobs.length,7)
  for(const job of jobs){
    const d=details[job.jobId]
    assert.equal(job.sourceDescription,d.user_provided_description)
    assert.equal(job.jobDescriptionHtml,d.user_provided_description)
    assert.equal(job.postingDate,new Date(d.created).toISOString().slice(0,10))
    assert.equal(job.sourceDateEvidence.nativeCreated,d.created)
    assert.equal(job.closingDate,null)
    assert.equal(job.country,'India')
    assert.equal(job.sourceListingComplete,true)
    assert.equal(job.applyUrl,`https://app.dover.com/apply/volopay/${job.jobId}`)
  }
  const remote=jobs.find(j=>j.title==='Content Writer')
  assert.equal(remote.location,'India');assert.equal(remote.city,null);assert.equal(remote.remoteStatus,'Remote')
  assert.ok(jobs.some(j=>j.title==='Customer Success Manager - SG'&&j.country==='India'))
  assert.equal(requests.filter(r=>r.url===listing).length,2)
  assert.equal(requests.filter(r=>r.url.includes('/inbound/application-portal-job/')).length,7)
  assert.ok(requests.filter(r=>r.url.includes('/api/')).every(r=>new URL(r.url).searchParams.get('format')==='json'))
  assert.equal(readInventoryEvidence(jobs)?.status,'complete-inventory')
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal,8)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount,7)
})

test('Volopay source rejects client, role, publication status, India and location substitution',async()=>{
  for(const change of [
    r=>{r.payload.client_id='00000000-0000-4000-8000-000000000000'},r=>{r.payload.client_name='Other employer'},r=>{r.payload.client_domain='other.example'},
    r=>{r.payload.id='00000000-0000-4000-8000-000000000000'},r=>{r.payload.title='Other role'},r=>{r.payload.active=false},r=>{r.payload.is_private=true},
    r=>{r.payload.locations[0].location_option.country='PH'},r=>{r.payload.locations[0].location_option.city='Mumbai'},
    r=>{r.payload.locations[0].location_option.id='00000000-0000-4000-8000-000000000000'},
  ])await assert.rejects(execute({mutate:r=>{if(r.kind==='detail')change(r)}}),/Volopay.*(?:identity|client|role|location|active|public)/i)
})

test('Volopay requires positive active native descriptions and valid native calendar timestamps',async()=>{
  for(const change of [
    r=>{r.payload.user_provided_description=''},r=>{r.payload.user_provided_description='<p>Apply now</p>'},
    r=>{r.payload.user_provided_description='<template>Build financial reporting systems.</template>'},
    r=>{r.payload.created=null},r=>{r.payload.created='2026-09-31T10:00:24.243168Z'},r=>{r.payload.created='today'},
  ])await assert.rejects(execute({mutate:r=>{if(r.kind==='detail')change(r)}}),/Volopay.*(?:description|content|date|timestamp)/i)
})

test('Volopay rejects unavailable, truncated, duplicate, unpublished and unreviewed paginated inventories',async()=>{
  for(const change of [
    r=>{r.payload.count=9},r=>{r.payload.next=listing+'&offset=8'},r=>{r.payload.previous=listing},
    r=>{r.payload.results[1].id=r.payload.results[0].id},r=>{r.payload.results[0].is_published=false},r=>{r.payload.results[0].is_sample=true},
    r=>{delete r.payload.results[0].locations[0].location_option.country},
  ])await assert.rejects(execute({mutate:r=>{if(r.kind==='listing')change(r)}}),/Volopay.*(?:inventory|listing|country|published|sample)/i)
  await assert.rejects(execute({block:'listing'}),/unavailable|inventory|transport/i)
})

test('Volopay requires exact current publisher, board transport and client metadata binding',async()=>{
  for(const change of [
    r=>{if(r.kind==='homepage')r.payload='<template>'+r.payload+'</template>'},
    r=>{if(r.kind==='redirect')r.location='https://other.example/careers'},
    r=>{if(r.kind==='board')r.payload='Dover'},r=>{if(r.kind==='client')r.payload.id='00000000-0000-4000-8000-000000000000'},
    r=>{if(r.kind==='client')r.payload.name='Other employer'},r=>{if(r.kind==='client')r.payload.primary_domain='other.example'},
  ])await assert.rejects(execute({mutate:change}),/Volopay.*(?:publisher|handoff|redirect|board|client|identity)/i)
})

test('Volopay does not mistake HTTP200 DRF HTML or an unverified final URL for native JSON content',async()=>{
  for(const change of [
    r=>{r.mime='text/html';r.payload='<html><title>Django REST framework</title></html>'},
    r=>{r.finalUrl='https://other.example/api'},r=>{r.status=403},
  ])await assert.rejects(execute({mutate:r=>{if(r.kind==='detail')change(r)}}),/Volopay.*(?:JSON|HTTP|URL|response|transport)/i)
})

test('Volopay final listing must retain the same complete native role identities, titles, locations and visibility',async()=>{
  for(const change of [r=>{r.payload.results.pop();r.payload.count--},r=>{r.payload.results[0].title='Replaced role'},r=>{r.payload.results[0].is_published=false}]){
    await assert.rejects(execute({mutate:r=>{if(r.kind==='final-listing')change(r)}}),/Volopay.*(?:inventory|listing|published|changed)/i)
  }
})

test('Volopay caller limits and verified empty inventory preserve complete-source evidence boundaries',async()=>{
  const limited=await execute({options:{maxJobs:1}})
  assert.equal(limited.jobs.length,1);assert.equal(limited.jobs[0].sourceListingComplete,false)
  assert.equal(readInventoryEvidence(limited.jobs)?.listingComplete,false)
  const empty=await execute({mutate:r=>{if(r.kind==='listing'||r.kind==='final-listing')r.payload={count:0,next:null,previous:null,results:[]}}})
  assert.deepEqual(empty.jobs,[]);assert.equal(readInventoryEvidence(empty.jobs)?.status,'verified-empty')
})

test('Volopay propagates exact caller cancellation before I/O and during native detail recovery',async()=>{
  for(const stage of ['before','detail']){
    const controller=new AbortController(),reason={stage};if(stage==='before')controller.abort(reason)
    await assert.rejects(execute({options:{signal:controller.signal},mutate:r=>{if(stage==='detail'&&r.kind==='detail')controller.abort(reason)}}),e=>e===reason)
  }
})

test('Volopay aggregate deadline bounds a fetch that ignores cancellation',async()=>{
  for(const fetchImpl of [()=>new Promise(()=>{}),async url=>({url,status:200,headers:{get:()=> 'text/html'},text:()=>new Promise(()=>{})})]){
    await assert.rejects(execute({options:{timeoutMs:10,fetchImpl}}),/Volopay.*deadline/i)
  }
})

test('Volopay stops queued details and waits for active calls after the first native failure',async()=>{
  const failure=Error('first Volopay detail unavailable')
  let activeStarted,releaseActive,settled=false,earlyRejection=false,details=0
  const active=new Promise(resolve=>{activeStarted=resolve})
  const result=execute({options:{detailConcurrency:2},mutate:async r=>{
    if(r.kind!=='detail')return
    details++
    if(details===1)throw failure
    if(details===2){activeStarted();await new Promise(resolve=>{releaseActive=resolve});settled=true;throw Error('second native detail settled')}
    throw Error('queued detail started after failure')
  }}).catch(error=>{earlyRejection=!settled;return error})
  await Promise.race([active,result.then(()=>{throw Error('Active detail never started')})])
  await new Promise(resolve=>setImmediate(resolve));releaseActive()
  const error=await result
  assert.equal(error.cause,failure)
  assert.equal(earlyRejection,false)
  assert.equal(details,2)
})

test('Volopay rejects malformed native title and location text types even when listing and detail agree',async()=>{
  const id=fixture('listing-initial').results[0].id
  for(const change of [row=>{row.title={text:'role'}},row=>{row.locations[0].name={text:'India'}},row=>{row.locations[0].location_option.city={text:'Bengaluru'}}]){
    await assert.rejects(execute({mutate:r=>{
      if(r.kind==='listing'||r.kind==='final-listing')change(r.payload.results[0])
      if(r.kind==='detail'&&r.payload.id===id)change(r.payload)
    }}),/Volopay.*(?:identity|location|title)/i)
  }
})

test('Volopay stops and cancels oversized streamed native response bodies before continuing source reads',async()=>{
  let cancelled=false,reads=0,calls=0
  await assert.rejects(execute({options:{fetchImpl:async url=>{
    calls++
    return {url,status:200,headers:{get:()=> 'text/html'},text:async()=>html('official-binding'),body:{getReader:()=>({
      read:async()=>{reads++;return {done:false,value:new Uint8Array(3000001)}},cancel:async()=>{cancelled=true},releaseLock:()=>{},
    })}}
  }}}),/Volopay.*body.*bound/i)
  assert.equal(cancelled,true);assert.equal(reads,1);assert.equal(calls,1)
})

test('a valid foreign-only Volopay native inventory retains its known global total and India zero without claiming globally empty',async()=>{
  const foreign=fixture('listing-initial').results.filter(row=>row.locations.every(l=>l.location_option.country==='PH'))
  const {jobs}=await execute({mutate:r=>{if(r.kind==='listing'||r.kind==='final-listing')r.payload={count:foreign.length,next:null,previous:null,results:foreign}}})
  assert.deepEqual(jobs,[])
  assert.equal(readInventoryEvidence(jobs)?.status,'complete-inventory')
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal,1)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount,0)
})

test('a native city-only label that is also a country name does not override its explicitly typed country field',async()=>{
  const foreign=fixture('listing-initial').results.filter(row=>row.locations.every(l=>l.location_option.country==='PH'))
  const location=foreign[0].locations[0]
  Object.assign(location,{name:'Singapore'})
  Object.assign(location.location_option,{display_name:'Singapore',city:'Singapore',country:'US',location_type:'CITY'})
  const {jobs}=await execute({mutate:r=>{if(r.kind==='listing'||r.kind==='final-listing')r.payload={count:1,next:null,previous:null,results:foreign}}})
  assert.deepEqual(jobs,[])
  assert.equal(readInventoryEvidence(jobs)?.status,'complete-inventory')
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal,1)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount,0)
})

test('Volopay rejects contradictory explicit country labels instead of certifying India zero from changed ISO codes',async()=>{
  for(const countryCode of ['PH','US']){
    await assert.rejects(execute({mutate:r=>{
      if(r.kind==='listing'||r.kind==='final-listing')for(const row of r.payload.results)for(const location of row.locations)location.location_option.country=countryCode
    }}),/Volopay.*country.*(?:conflict|contradict)/i)
  }
})

test('Volopay retains the complete native HTML including surrounding whitespace',async()=>{
  const {jobs}=await execute({mutate:r=>{if(r.kind==='detail')r.payload.user_provided_description='\n\n'+r.payload.user_provided_description+'\n'}})
  const details=fixture('details')
  for(const job of jobs){
    assert.equal(job.sourceDescription,'\n\n'+details[job.jobId].user_provided_description+'\n')
    assert.equal(job.jobDescriptionHtml,job.sourceDescription)
  }
})

test('Volopay aborts cooperative sibling requests after first failure and reports that they settled',async()=>{
  const first=Error('first detail failure retained'),signals=[]
  let details=0,aborted=false
  const error=await execute({options:{detailConcurrency:2,timeoutMs:40},mutate:async(r,url,init)=>{
    if(r.kind!=='detail')return
    details++;signals.push(init.signal)
    if(details===1)throw first
    await new Promise((resolve,reject)=>{init.signal.addEventListener('abort',()=>{aborted=true;reject(init.signal.reason)},{once:true})})
  }}).catch(e=>e)
  assert.equal(error.cause,first)
  assert.equal(aborted,true)
  assert.ok(signals.every(signal=>signal.aborted))
  assert.equal(details,2)
  assert.equal(error.detailRequestsSettled,true)
  assert.equal(error.unsettledDetailRequests,0)
})

test('Volopay preserves first failure across aggregate deadline and explicitly reports an uncooperative sibling',async()=>{
  const first=Error('first detail failure survives deadline')
  let details=0,siblingSignal
  const error=await execute({options:{detailConcurrency:2,timeoutMs:40,detailSettleMs:100},mutate:async(r,url,init)=>{
    if(r.kind!=='detail')return
    details++
    if(details===1)throw first
    siblingSignal=init.signal
    await new Promise(()=>{})
  }}).catch(e=>e)
  assert.equal(error.cause,first)
  assert.equal(siblingSignal.aborted,true)
  assert.equal(details,2)
  assert.equal(error.detailRequestsSettled,false)
  assert.equal(error.unsettledDetailRequests,1)
  assert.equal(error.lifecycleCleanupAllowed,false)
  assert.equal(error.inventoryEvidence.reportedTotal,null)
})

test('Volopay preserves a falsy first transport rejection and starts no queued details',async()=>{
  let details=0
  const error=await execute({options:{detailConcurrency:1},mutate:r=>{if(r.kind==='detail'){details++;throw null}}}).catch(e=>e)
  assert.equal(error.cause,null)
  assert.equal(details,1)
})

test('Volopay catalog registers the verified source-local script without changing generic Dover configuration',()=>{
  const provider=getScraperCatalog().find(p=>p.source==='volopay')
  assert.equal(provider.adapter,'script')
  assert.match(provider.modulePath,/volopay[\\/]script\.js$/)
  assert.equal(provider.companyName,'Volopay')
})
