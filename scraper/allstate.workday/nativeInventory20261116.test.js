import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run,JOBS_SEARCH_URL,extractJsonpPayload} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

// Original HTTP bodies from the employer page, its declared API (10 and 3
// records per page), all ten corporate details, and the public CWS program.
const {originals}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261116.json.gz',import.meta.url))))
const body=p=>Buffer.from(p.bodyBase64,'base64').toString()
const packets=new Map(originals.map(p=>[p.url,p]))
const records=extractJsonpPayload(body(originals[1])).queryResult
const now=()=>new Date().toISOString()
function fixture({mutatePayload,mutateHtml,signal}={}){
 const requests=[],calls=new Map()
 const read=async(url,options={})=>{
  signal?.(url,options)
  requests.push(url);const count=(calls.get(url)||0)+1;calls.set(url,count)
  // The legacy reader repeated identical facets from both active widgets.
  // Those redundant facets select the same captured query, not another feed.
  const query=new URL(url),facets=query.searchParams.getAll('facet')
  if(facets.length){query.searchParams.delete('facet');query.searchParams.delete('callback');for(const f of new Set(facets))query.searchParams.append('facet',f);query.searchParams.append('callback','jobverifyAllstateCallback')}
  const packet=packets.get(query.href);assert.ok(packet,`Uncaptured Allstate fixture request: ${url}`)
  assert.equal(packet.status,200)
  if(url.startsWith('https://jobsapi-internal.')){
   const payload=extractJsonpPayload(body(packet));mutatePayload?.(payload,{url,count})
   return `${new URL(url).searchParams.get('callback')}(${JSON.stringify(payload)})`
  }
  return mutateHtml?.(body(packet),{url,count})??body(packet)
 }
 return {requests,fetchText:read,fetchJsonpText:read}
}
const pageOptions={pageSize:3,now}

test('Allstate closes the complete original India feed and preserves its company scope hold',async()=>{
 const io=fixture(),jobs=await run({...pageOptions,...io})
 assert.equal(jobs.length,10)
 assert.deepEqual(jobs.map(j=>j.jobId).sort(),records.map(r=>r.ref).sort())
 assert.ok(jobs.every(j=>j.country==='India'&&j.countryCode==='IN'&&j.sourceDescription===records.find(r=>r.ref===j.jobId).description&&j.sourceDetailComplete===true&&j.nativeCriteriaComplete===true))
 assert.equal(io.requests.filter(u=>u.startsWith('https://jobsapi-internal.')).length,8)
 assert.equal(io.requests.filter(u=>u===JOBS_SEARCH_URL).length,2)
 assert.equal(io.requests.filter(u=>/^https:\/\/www.allstate.jobs\/job\//.test(u)).length,10)
 const proof=readInventoryEvidence(jobs)
 assert.equal(proof.status,'complete-inventory');assert.equal(proof.listingComplete,true)
 assert.equal(proof.reportedTotal,10);assert.equal(proof.indiaFacetCount,10);assert.equal(proof.pagesFetched,8)
 assert.equal(jobs.nativeCollectionEvidence.closingRawRowsMatch,true)
 assert.ok(jobs.every(j=>j.sourceScopeComplete===false&&j.companyInventoryComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessed=assessSoftFailureAcquisition({source:'allstate',companyName:'Allstate'},jobs)
 assert.equal(assessed.rawJobs,10);assert.equal(assessed.indiaJobs,10)
 // The native feed retains its Product Manager row; the current publishing
 // title policy excludes that row after acquisition.
 assert.equal(assessed.eligibleJobs,9);assert.equal(assessed.filterCounts.excludedTitle,1)
 assert.equal(assessed.inventoryEvidence.listingComplete,true)
})

test('Allstate requires safe stable counts, exact pages, unique identities, and complete native rows',async(t)=>{
 const mutations=[
  ['missing count',p=>delete p.totalHits],['string count',p=>p.totalHits='10'],
  ['negative count',p=>p.totalHits=-1],['fraction count',p=>p.totalHits=1.5],
  ['unsafe count',p=>p.totalHits=Number.MAX_SAFE_INTEGER+1],['missing rows',p=>delete p.queryResult],
  ['truncated page',p=>p.queryResult.pop()],['extra row',p=>p.queryResult.push(p.queryResult[0])],
  ['duplicate identity',p=>p.queryResult[1]=p.queryResult[0]],
  ['foreign organization',p=>p.queryResult[0].scout_orgid=9999],
  ['foreign employer',p=>p.queryResult[0].company_name='Other employer'],
  ['contradictory country',p=>p.queryResult[0].primary_country='US'],
  ['missing explicit country',p=>p.queryResult[0].primary_country=''],
  ['foreign facet',p=>p.queryResult[0].is_internal='other'],
  ['closed row',p=>p.queryResult[0].entity_status='Closed'],
  ['missing title',p=>p.queryResult[0].title=''],['missing requisition',p=>p.queryResult[0].ref=''],
  ['mismatched requisition',p=>p.queryResult[0].clientid='R99999'],
  ['missing description',p=>p.queryResult[0].description=''],
  ['description placeholder',p=>p.queryResult[0].description='<p>Coming soon</p>'],
  ['foreign detail URL',p=>p.queryResult[0].url='https://example.com/job/23644204/'],
  ['wrong native URL identity',p=>p.queryResult[0].url=p.queryResult[0].url.replace('/23644204/','/99999999/')],
  ['foreign application',p=>p.queryResult[0].seo_url=p.queryResult[0].seo_url.replace('allstate.wd5','other.wd5')],
 ]
 for(const[label,mutate]of mutations)await t.test(label,async()=>{
  const io=fixture({mutatePayload:(p,{count})=>{if(count===1)mutate(p)}})
  await assert.rejects(run({...pageOptions,...io}),/Allstate/)
 })
})

test('Allstate rejects later count drift, cross-page duplicate IDs and closing full raw-row drift',async(t)=>{
 for(const mode of ['count','duplicate','closing-description','closing-unmapped-field'])await t.test(mode,async()=>{
  const io=fixture({mutatePayload:(p,{url,count})=>{
   const offset=new URL(url).searchParams.get('offset')
   if(mode==='count'&&offset==='4')p.totalHits=11
   if(mode==='duplicate'&&offset==='4')p.queryResult[0]=structuredClone(records[0])
   if(count===2&&offset==='7'){
    if(mode==='closing-description')p.queryResult[1].description+='<p>New criteria</p>'
    if(mode==='closing-unmapped-field')p.queryResult[1].custom_fields={newField:'changed'}
   }
  }})
  await assert.rejects(run({...pageOptions,...io}),/Allstate/)
 })
})

test('Allstate rechecks active employer bindings and complete visible detail content',async(t)=>{
 const changes=[
  ['active API',s=>s.replaceAll('CWS.jobs.set_api("https://jobsapi-internal.m-cloud.io/api/")','CWS.jobs.set_api("https://example.com/api/")'),JOBS_SEARCH_URL],
  ['active org',s=>s.replaceAll('org_id: "2030"','org_id: "9999"'),JOBS_SEARCH_URL],
  ['active facet',s=>s.replaceAll('filters: ["ats_portalid:Workday-MuleAPI-External","is_internal:allstate_careers"]','filters: ["ats_portalid:Other","is_internal:allstate_careers"]'),JOBS_SEARCH_URL],
  ['inert employer page',s=>`<template>${s}</template>`,JOBS_SEARCH_URL],
  ['quoted employer model',s=>s.replace(/var cws_opts = (\{[^\n]+\});/g,(_,model)=>`const example = ${JSON.stringify(`var cws_opts = ${model};`)};`),JOBS_SEARCH_URL],
  ['detail identity',s=>s.replaceAll('"clientid":"R29050"','"clientid":"R99999"'),records[0].url],
  ['quoted detail model',s=>s.replace(/var current_job = (\{[^\n]+\});/g,(_,model)=>`const example = ${JSON.stringify(`var current_job = ${model};`)};`),records[0].url],
  ['visible criteria omitted',s=>s.replaceAll('class="ejd-desc"','class="hidden-criteria"'),records[0].url],
 ]
 for(const[label,mutate,url]of changes)await t.test(label,async()=>{
  const io=fixture({mutateHtml:(s,ctx)=>ctx.url===url?mutate(s):s})
  await assert.rejects(run({...pageOptions,...io}),/Allstate/)
 })
 const io=fixture({mutateHtml:(s,{url,count})=>url===JOBS_SEARCH_URL&&count===2?s.replaceAll('org_id: "2030"','org_id: "9999"'):s})
 await assert.rejects(run({...pageOptions,...io}),/Allstate/)
})

test('Allstate caller caps cannot publish a complete receipt, and cancellation retains its reason',async()=>{
 for(const cap of [{maxJobs:2},{maxPages:1},{maxJobs:0},{maxPages:0}]){
  const io=fixture(),jobs=await run({...pageOptions,...io,...cap})
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
  if(cap.maxJobs!=null)assert.ok(jobs.length<=cap.maxJobs)
  if(cap.maxPages===0||cap.maxJobs===0)assert.equal(io.requests.length,0)
 }
 const control=new AbortController(),reason=new Error('caller stopped Allstate')
 const io=fixture({signal:(url,options)=>{
  assert.equal(options.signal,control.signal)
  if(url.startsWith('https://jobsapi-internal.'))control.abort(reason)
 }})
 await assert.rejects(run({...pageOptions,...io,signal:control.signal}),e=>e===reason)
 const aborted=new AbortController();aborted.abort(reason)
 await assert.rejects(run({...pageOptions,...fixture(),signal:aborted.signal}),e=>e===reason)
})

test('Allstate verified empty requires two explicit coherent zero counts and retains the receipt cleanup hold',async()=>{
 const io=fixture({mutatePayload:p=>{p.totalHits=0;p.queryResult=[]}})
 const jobs=await run({...pageOptions,...io})
 assert.equal(jobs.length,0)
 assert.equal(io.requests.length,4)
 assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const malformed=fixture({mutatePayload:p=>{delete p.totalHits;p.queryResult=[]}})
 await assert.rejects(run({...pageOptions,...malformed}),/Allstate native inventory count/)
 const changed=fixture({mutatePayload:(p,{count})=>{p.totalHits=count===1?0:1;p.queryResult=count===1?[]:[records[0]]}})
 await assert.rejects(run({...pageOptions,...changed}),/Allstate native inventory total changed/)
})

test('Allstate fails closed on an unrequested JSONP callback and propagates a cancellation during a failed read',async()=>{
 const io=fixture()
 await assert.rejects(run({...pageOptions,...io,fetchJsonpText:async url=>(await io.fetchJsonpText(url)).replace(/^jobverifyAllstateCallback/,'otherCallback')}),/Allstate jobs API callback/)
 const controller=new AbortController(),reason=new Error('Allstate caller cancelled during I/O')
 await assert.rejects(run({...pageOptions,...fixture(),signal:controller.signal,fetchJsonpText:async()=>{controller.abort(reason);throw Error('transport failure')}}),error=>error===reason)
})

test('Allstate dormant or conditional setter programs cannot bind an active native feed',async()=>{
 for(const wrap of [body=>'function neverCalledByThePublisher(){'+body+'\n}',body=>'if(false){'+body+'\n}',body=>'()=>{'+body+'\n}']){
  let wrapped=0
  const io=fixture({mutateHtml:(html,{url})=>url!==JOBS_SEARCH_URL?html:html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g,(full,attrs,body)=>{
   if(!/CWS\.jobs\.(?:set_api|set_options)\s*\(/.test(body))return full
   wrapped++;return '<script'+attrs+'>'+wrap(body)+'</script>'
  })})
  await assert.rejects(run({...pageOptions,...io}),/Allstate.*(?:handoff|configuration|binding)/)
  assert.equal(wrapped,4)
 }
})

test('Allstate default transport requires observed HTTP200 at the exact requested URL',async t=>{
 for(const [status,foreign] of [[201,false],[200,true]]){
  t.mock.method(globalThis,'fetch',async url=>{
   const packet=packets.get(url);assert.ok(packet)
   return Object.defineProperty(new Response(body(packet),{status,headers:packet.headers}),'url',{value:foreign?'https://unrelated.example/jobs':url})
  })
  await assert.rejects(run(),/Allstate.*response identity|HTTP 201/)
 }
})

test('Allstate rejects an additional computed setter override and preserves a null caller abort reason',async()=>{
 const extra='<script>jQuery(document).ready(function(){CWS.jobs["set_options"]({org_id:"9999",filters:["ats_portalid:Other","is_internal:other_feed"]});});</script>'
 const io=fixture({mutateHtml:(html,{url})=>url===JOBS_SEARCH_URL?html.replace('</body>',extra+'</body>'):html})
 await assert.rejects(run({...pageOptions,...io}),/Allstate.*(?:execution|binding)/)
 const stopped=fixture()
 await assert.rejects(run({...pageOptions,...stopped,signal:AbortSignal.abort(null)}),error=>error===null)
 assert.equal(stopped.requests.length,0)
})
