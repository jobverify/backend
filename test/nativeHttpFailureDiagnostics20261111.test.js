import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run as dailyhunt} from '../scraper/dailyhunt/script.js'
import {run as dassaultaviationindia} from '../scraper/dassaultaviationindia/script.js'
import {run as xto10x} from '../scraper/xto10x/script.js'
import {HANDOFF_URL,ENTRY_URL} from '../scraper/dassaultaviationindia/native.js'
import {classifyScraperError} from '../scraper-support/utils/failureClassification.js'

const now=()=> '2026-11-11T20:00:00.000Z'
const tick=()=>new Promise(resolve=>setImmediate(resolve))
const providers=[
 {source:'dailyhunt',run:dailyhunt,url:'https://www.eternoinfo.com/',code:'DAILYHUNT_COVERAGE_GAP',redirect:'error'},
 {source:'dassaultaviationindia',run:dassaultaviationindia,url:'https://www.dassault-aviation.com/en/group/careers/',code:'DASSAULTAVIATIONINDIA_COVERAGE_GAP',redirect:'manual'},
 {source:'xto10x',run:xto10x,url:'https://www.xto10x.com/about',code:'XTO10X_COVERAGE_GAP',redirect:'manual'},
]
const outcomes=[
 {status:403,classification:{softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied'}},
 {status:429,classification:{softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied'}},
 {status:503,classification:{softFailure:true,upstreamOutage:true,failureKind:'network_or_timeout'}},
 {status:202,classification:{softFailure:true,upstreamOutage:true,failureKind:'upstream_response_pending'}},
 {status:400,classification:{softFailure:false,upstreamOutage:false,failureKind:'parser_or_contract_error'}},
 {status:404,classification:{softFailure:true,upstreamOutage:false,failureKind:'surface_drift_or_fail_closed'}},
]

function trackedResponse(t,{status=200,url,headers,body}={}){
 const state={cancelled:false}
 const response=new Response(body??new ReadableStream({cancel(){state.cancelled=true}}),{status,headers})
 Object.defineProperty(response,'url',{value:url})
 t.after(async()=>{if(!state.cancelled&&!response.body?.locked)await response.body?.cancel()})
 return {response,state}
}

function assertHold(error,provider,pagesFetched=0){
 assert.ok(error instanceof Error)
 assert.equal(error.code,provider.code)
 assert.equal(error.sourceListingComplete,false)
 assert.equal(error.lifecycleCleanupAllowed,false)
 assert.equal(error.inventoryEvidence.status,'coverage-gap')
 assert.equal(error.inventoryEvidence.listingComplete,false)
 assert.equal(error.inventoryEvidence.reportedTotal,null)
 assert.equal(error.inventoryEvidence.indiaFacetCount,null)
 assert.equal(error.inventoryEvidence.pagesFetched,pagesFetched)
 if(provider.source!=='dailyhunt'){
  assert.equal(error.partial,true)
  assert.equal(error.abortRetries,true)
  assert.equal(error.retainedResponses.length,pagesFetched)
 }
}

function assertDiagnostics(error,{status,requestUrl,finalUrl,classification}){
 assert.equal(error.status,status)
 assert.equal(error.statusCode,status)
 assert.equal(error.requestUrl,requestUrl)
 assert.equal(error.finalUrl,finalUrl)
 assert.ok(error.message.includes('HTTP '+status),'Persisted failure message keeps the observed status')
 assert.ok(error.message.includes(requestUrl),'Persisted failure message keeps the actual request URL')
 assert.deepEqual(classifyScraperError(error),classification)
 assert.deepEqual(classifyScraperError({message:error.message}),classification,'Persisted message remains classifiable without response fields')
}

for(const provider of providers){
 for(const {status,classification} of outcomes){
  test(`${provider.source} preserves HTTP${status} diagnostics and stops denied collection`,async t=>{
   const {response,state}=trackedResponse(t,{status,url:provider.url}),requests=[]
   let requestSignal
   const error=await provider.run({now,fetchImpl:async(url,options)=>{
    requests.push(url);requestSignal=options.signal
    assert.equal(options.redirect,provider.redirect)
    return response
   }}).then(()=>assert.fail('A rejected response cannot certify an inventory'),error=>error)
   assert.deepEqual(requests,[provider.url])
   assertHold(error,provider)
   assertDiagnostics(error,{status,requestUrl:provider.url,finalUrl:provider.url,classification})
   assert.equal(requestSignal.aborted,true)
   if(provider.source!=='dassaultaviationindia')assert.equal(state.cancelled,true)
  })
 }

 test(`${provider.source} retains HTTP200 final-URL drift identity without certifying inventory`,async t=>{
  const finalUrl='https://controlled-response.invalid/different-final'
  const {response}=trackedResponse(t,{status:200,url:finalUrl}),requests=[]
  const error=await provider.run({now,fetchImpl:async url=>{requests.push(url);return response}}).then(()=>assert.fail('URL drift must reject'),error=>error)
  assert.deepEqual(requests,[provider.url])
  assertHold(error,provider)
  assertDiagnostics(error,{status:200,requestUrl:provider.url,finalUrl,classification:{softFailure:true,upstreamOutage:false,failureKind:'surface_drift_or_fail_closed'}})
 })

 test(`${provider.source} classifies the denied HTTP status when final URL also differs`,async t=>{
  const finalUrl='https://controlled-response.invalid/denied'
  const {response}=trackedResponse(t,{status:403,url:finalUrl})
  const error=await provider.run({now,fetchImpl:async()=>response}).then(()=>assert.fail('Denied response must reject'),error=>error)
  assertHold(error,provider)
  assertDiagnostics(error,{status:403,requestUrl:provider.url,finalUrl,classification:{softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied'}})
 })

 for(const stage of ['before-dispatch','during-fetch']){
  test(`${provider.source} preserves the exact caller abort reason ${stage}`,async t=>{
   const controller=new AbortController(),reason={caller:'exact-reason',stage},requests=[]
   const {response}=trackedResponse(t,{status:403,url:provider.url})
   if(stage==='before-dispatch')controller.abort(reason)
   await assert.rejects(provider.run({now,signal:controller.signal,fetchImpl:async url=>{
    requests.push(url);controller.abort(reason);return response
   }}),error=>error===reason)
   assert.equal(requests.length,stage==='before-dispatch'?0:1)
  })
 }

 for(const stage of ['caller','deadline']){
  test(`${provider.source} keeps ${stage} cancellation of an already-open response body`,async t=>{
   const controller=new AbortController(),reason={caller:'body-reason',stage},requests=[]
   const {response,state}=trackedResponse(t,{url:provider.url})
   const pending=provider.run({now,timeoutMs:stage==='deadline'?20:1000,signal:controller.signal,fetchImpl:async url=>{
    requests.push(url)
    if(stage==='caller')setImmediate(()=>controller.abort(reason))
    return response
   }})
   await assert.rejects(pending,stage==='caller'?error=>error===reason:error=>{assertHold(error,provider);return true})
   await tick()
   assert.deepEqual(requests,[provider.url])
   assert.equal(state.cancelled,true)
  })
 }
}

test('Dassault diagnostics retain the actual request after its reviewed handoff redirect',async t=>{
 const provider=providers[1],requests=[]
 // Controlled identity/handoff prefix only: no native inventory or vacancy is asserted.
 const official=trackedResponse(t,{url:provider.url,body:`<p>Dassault Aviation</p><a href="${HANDOFF_URL}">Join us</a>`}).response
 const handoff=trackedResponse(t,{status:302,url:HANDOFF_URL,headers:{location:ENTRY_URL}}).response
 const denied=trackedResponse(t,{status:403,url:ENTRY_URL}).response
 const responses=[official,handoff,denied]
 const error=await provider.run({now,fetchImpl:async(url,options)=>{
  assert.equal(options.redirect,'manual')
  requests.push(url)
  assert.ok(requests.length<=3,'Denied terminal response stops the redirect sequence')
  return responses[requests.length-1]
 }}).then(()=>assert.fail('Denied terminal response must reject'),error=>error)
 assert.deepEqual(requests,[provider.url,HANDOFF_URL,ENTRY_URL])
 assertHold(error,provider,2)
 assertDiagnostics(error,{status:403,requestUrl:ENTRY_URL,finalUrl:ENTRY_URL,classification:{softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied'}})
 assert.equal(error.inventoryEvidence.surface,HANDOFF_URL)
 assert.deepEqual(error.retainedResponses.map(row=>({url:row.url,finalUrl:row.finalUrl,status:row.status,location:row.location??null})),[
  {url:provider.url,finalUrl:provider.url,status:200,location:null},
  {url:HANDOFF_URL,finalUrl:HANDOFF_URL,status:302,location:ENTRY_URL},
 ])
})

test('Dassault retains HTTP302 diagnostics when rejecting an unreviewed corporate redirect',async t=>{
 const provider=providers[1],requests=[]
 const {response}=trackedResponse(t,{status:302,url:provider.url,headers:{location:'https://controlled-handoff.invalid/unreviewed'}})
 let requestSignal
 const error=await provider.run({now,fetchImpl:async(url,options)=>{
  requests.push(url);requestSignal=options.signal;return response
 }}).then(()=>assert.fail('Unreviewed redirect must stay rejected'),error=>error)
 assert.deepEqual(requests,[provider.url])
 assert.equal(requestSignal.aborted,true)
 assertHold(error,provider)
 assertDiagnostics(error,{status:302,requestUrl:provider.url,finalUrl:provider.url,classification:{softFailure:true,upstreamOutage:false,failureKind:'surface_drift_or_fail_closed'}})
})

test('Dassault redirect-limit diagnostics identify the fourth actual request rather than its next target',async t=>{
 const provider=providers[1],requests=[]
 // Replay only the unmodified captured corporate response; redirects below are controlled transport inputs.
 const {official}=JSON.parse(gunzipSync(readFileSync(new URL('../scraper/dassaultaviationindia/test-inputs/foreign-country-20261031.json.gz',import.meta.url))))
 const corporate=trackedResponse(t,{status:official.status,url:official.finalUrl,body:official.body}).response
 const error=await provider.run({now,fetchImpl:async(url,options)=>{
  requests.push(url)
  assert.equal(options.redirect,'manual')
  if(requests.length===1){assert.equal(url,official.url);return corporate}
  assert.ok(requests.length<=5,'The four-redirect bound must stop further requests')
  assert.ok(url===HANDOFF_URL||url===ENTRY_URL)
  return trackedResponse(t,{status:302,url,headers:{location:url===HANDOFF_URL?ENTRY_URL:HANDOFF_URL}}).response
 }}).then(()=>assert.fail('Redirect exhaustion cannot certify an inventory'),error=>error)
 assert.deepEqual(requests,[provider.url,HANDOFF_URL,ENTRY_URL,HANDOFF_URL,ENTRY_URL])
 assertHold(error,provider,5)
 assertDiagnostics(error,{status:302,requestUrl:ENTRY_URL,finalUrl:ENTRY_URL,classification:{softFailure:true,upstreamOutage:false,failureKind:'surface_drift_or_fail_closed'}})
 assert.deepEqual(error.retainedResponses.slice(1).map(row=>row.url),[HANDOFF_URL,ENTRY_URL,HANDOFF_URL,ENTRY_URL])
 assert.deepEqual(error.retainedResponses.slice(1).map(row=>row.location),[ENTRY_URL,HANDOFF_URL,ENTRY_URL,HANDOFF_URL])
})
