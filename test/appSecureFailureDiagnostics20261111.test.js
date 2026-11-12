import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from '../scraper/appsecure/script.js'
import {classifyScraperError} from '../scraper-support/utils/failureClassification.js'

const HOME='https://www.appsecure.security/'
const ABOUT='https://www.appsecure.security/about'
const EMPLOYER='https://www.linkedin.com/company/appsecure-security'
const corporate=JSON.parse(gunzipSync(readFileSync(new URL('../scraper/appsecure/fixtures/official-pages.json.gz',import.meta.url))))
const now=()=> '2026-11-11T19:59:56.200Z'
const blocked={softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied'}
const drift={softFailure:true,upstreamOutage:false,failureKind:'surface_drift_or_fail_closed'}

// Only transport failures are injected. Successful prerequisites are genuine
// historical corporate captures; these tests assert no current vacancy facts.
const unreadResponse=(status,finalUrl)=>{
 const state={reads:0,cancellations:0}
 const response=new Response(new ReadableStream({
  pull(){state.reads++;throw Error('Rejected response body must remain unread')},
  cancel(){state.cancellations++},
 },{highWaterMark:0}),{status,headers:{'content-type':'text/html'}})
 Object.defineProperty(response,'url',{value:finalUrl})
 return {response,state}
}
const collectFailure=async(fetchImpl,options={})=>{
 let failure
 await assert.rejects(run({fetchImpl,now,...options}),error=>{failure=error;return true})
 return failure
}
const assertHolds=(error,surface,pages)=>{
 assert.equal(error.code,'APPSECURE_COVERAGE_GAP')
 assert.equal(error.source,'appsecure')
 assert.equal(error.partial,true)
 assert.equal(error.abortRetries,true)
 assert.equal(error.sourceListingComplete,false)
 assert.equal(error.lifecycleCleanupAllowed,false)
 assert.equal(error.inventoryEvidence.status,'coverage-gap')
 assert.equal(error.inventoryEvidence.surface,surface)
 assert.equal(error.inventoryEvidence.listingComplete,false)
 assert.equal(error.inventoryEvidence.reportedTotal,null)
 assert.equal(error.inventoryEvidence.indiaFacetCount,null)
 assert.equal(error.inventoryEvidence.pagesFetched,pages)
 assert.equal(error.retainedResponses.length,pages)
}
const genuineCorporateResponse=url=>{
 const row=corporate.find(item=>item.url===url)
 assert.ok(row,'Only retained corporate prerequisites are available')
 const response=new Response(row.body,{status:row.status})
 Object.defineProperty(response,'url',{value:row.finalUrl})
 return response
}

test('AppSecure403 supplies the actual HTTP details required for blocked-access classification',async()=>{
 const {response,state}=unreadResponse(403,HOME)
 const calls=[]
 const error=await collectFailure(async(url,options)=>{
  calls.push(url);assert.equal(options.redirect,'manual');return response
 })
 assert.deepEqual(classifyScraperError(error),blocked)
 assert.deepEqual(classifyScraperError({message:error.message}),blocked)
 assert.equal(error.status,403)
 assert.equal(error.requestUrl,HOME)
 assert.equal(error.finalUrl,HOME)
 assertHolds(error,HOME,0)
 assert.deepEqual(calls,[HOME])
 assert.deepEqual(state,{reads:0,cancellations:1})
})

test('AppSecure400 is classified as a request contract error instead of surface drift',async()=>{
 const {response,state}=unreadResponse(400,HOME)
 const calls=[]
 const error=await collectFailure(async url=>{calls.push(url);return response})
 const expected={softFailure:false,upstreamOutage:false,failureKind:'parser_or_contract_error'}
 assert.deepEqual(classifyScraperError(error),expected)
 assert.deepEqual(classifyScraperError({message:error.message}),expected)
 assert.equal(error.status,400)
 assert.equal(error.requestUrl,HOME)
 assert.equal(error.finalUrl,HOME)
 assertHolds(error,HOME,0)
 assert.deepEqual(calls,[HOME])
 assert.deepEqual(state,{reads:0,cancellations:1})
})

test('AppSecure corporate coverage-gap authority follows its configured corporate origin',async()=>{
 const {response,state}=unreadResponse(503,ABOUT)
 const calls=[]
 const error=await collectFailure(async url=>{
  calls.push(url)
  return url===HOME?genuineCorporateResponse(url):response
 })
 assert.equal(error.inventoryEvidence.firstParty,true)
 assert.equal(error.status,503)
 assert.equal(error.requestUrl,ABOUT)
 assert.equal(error.finalUrl,ABOUT)
 assertHolds(error,ABOUT,1)
 assert.deepEqual(calls,[HOME,ABOUT])
 assert.deepEqual(state,{reads:0,cancellations:1})
})

test('AppSecure employer403 remains third-party and retains only successful corporate responses',async()=>{
 const {response,state}=unreadResponse(403,EMPLOYER)
 const calls=[]
 const error=await collectFailure(async url=>{
  calls.push(url)
  return url===EMPLOYER?response:genuineCorporateResponse(url)
 })
 assert.deepEqual(classifyScraperError(error),blocked)
 assert.equal(error.inventoryEvidence.firstParty,false)
 assert.equal(error.status,403)
 assert.equal(error.requestUrl,EMPLOYER)
 assert.equal(error.finalUrl,EMPLOYER)
 assertHolds(error,EMPLOYER,2)
 assert.deepEqual(calls,[HOME,ABOUT,EMPLOYER])
 assert.deepEqual(error.retainedResponses.map(row=>row.url),[HOME,ABOUT])
 assert.deepEqual(state,{reads:0,cancellations:1})
})

test('AppSecure200 URL drift preserves the actual status and separate requested and final URLs',async()=>{
 const {response,state}=unreadResponse(200,ABOUT)
 const calls=[]
 const error=await collectFailure(async url=>{calls.push(url);return response})
 assert.equal(error.status,200)
 assert.equal(error.requestUrl,HOME)
 assert.equal(error.finalUrl,ABOUT)
 assert.deepEqual(classifyScraperError(error),drift)
 assertHolds(error,HOME,0)
 assert.deepEqual(calls,[HOME])
 assert.deepEqual(state,{reads:0,cancellations:1})
})

test('AppSecure302 stays a single manual attempt without reading or following the response',async()=>{
 const {response,state}=unreadResponse(302,HOME)
 response.headers.set('location',EMPLOYER)
 const calls=[]
 const error=await collectFailure(async(url,options)=>{
  calls.push(url);assert.equal(options.redirect,'manual');return response
 })
 assert.equal(error.status,302)
 assert.equal(error.requestUrl,HOME)
 assert.equal(error.finalUrl,HOME)
 assert.deepEqual(classifyScraperError(error),drift)
 assertHolds(error,HOME,0)
 assert.deepEqual(calls,[HOME])
 assert.deepEqual(state,{reads:0,cancellations:1})
})

test('AppSecure preserves the exact caller reason before a request and when a denied response arrives',async()=>{
 for(const stage of ['before','response']){
  const caller=new AbortController(),reason={stage}
  const {response,state}=unreadResponse(403,HOME)
  let attempts=0
  if(stage==='before')caller.abort(reason)
  const error=await collectFailure(async()=>{
   attempts++;caller.abort(reason);return response
  },{signal:caller.signal})
  assert.equal(error,reason)
  assert.equal(attempts,stage==='before'?0:1)
  assert.equal(state.reads,0)
  assert.equal(state.cancellations,stage==='before'?0:1)
  if(stage==='before')await response.body.cancel()
 }
})
